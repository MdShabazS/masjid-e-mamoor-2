import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Crypto from 'expo-crypto';
import { createManagementApi, formatPaiseINR } from '../../packages/api-client/index.js';
import { signInUsername, changeInitialPassword } from '../../packages/api-client/identity.js';
import { enrollConsentedDonor } from '../../packages/api-client/donor-enrollment.js';
import { getNativeClient } from './lib/supabase';
import OfflineDrafts from './lib/OfflineDrafts';
import FinanceAccounts from './lib/FinanceAccounts';
import PaymentQrProfile from './lib/PaymentQrProfile';

const colors = {
  ink: '#182e2a',
  muted: '#5e6e68',
  green: '#145b49',
  pale: '#e8f3ed',
  cream: '#faf8f1',
  border: '#d9e1d9',
  white: '#fff',
  error: '#a32b28',
};
const enrollmentRoles = new Set([
  'president',
  'vice_president',
  'secretary',
  'treasurer',
  'committee_member',
  'data_entry',
]);
const claimRoles = enrollmentRoles;

function Button({ label, onPress, disabled = false, secondary = false }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, secondary && styles.secondary, disabled && styles.disabled]}
    >
      <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{label}</Text>
    </Pressable>
  );
}

function Field({ label, value, onChangeText, ...props }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        style={styles.input}
        placeholderTextColor={colors.muted}
        {...props}
      />
    </View>
  );
}

export default function App() {
  const [client, setClient] = useState(null);
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [identityStatus, setIdentityStatus] = useState('signed_out');
  const [role, setRole] = useState(null);
  const [donors, setDonors] = useState([]);
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [amount, setAmount] = useState('');
  const [consent, setConsent] = useState(false);
  const [consentMethod, setConsentMethod] = useState('');
  const [consentEvidence, setConsentEvidence] = useState('');
  const [referrerId, setReferrerId] = useState('');
  const [period, setPeriod] = useState('');
  const [transaction, setTransaction] = useState('');
  const [selectedDonor, setSelectedDonor] = useState(null);
  const [claims, setClaims] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [verification, setVerification] = useState({});
  const [operation, setOperation] = useState(null);

  useEffect(() => {
    let mounted = true;
    let subscription;
    try {
      const nativeClient = getNativeClient();
      setClient(nativeClient);
      nativeClient.auth
        .getSession()
        .then(({ data, error: authError }) => {
          if (!mounted) return;
          if (authError) setError(authError.message);
          setIdentityStatus(data?.session ? 'checking' : 'signed_out');
          setSession(data?.session ?? null);
          setChecking(false);
        })
        .catch((cause) => {
          if (mounted) {
            setError(cause.message);
            setChecking(false);
          }
        });
      ({
        data: { subscription },
      } = nativeClient.auth.onAuthStateChange((_event, nextSession) => {
        if (mounted) {
          setIdentityStatus(nextSession ? 'checking' : 'signed_out');
          setSession(nextSession);
        }
      }));
    } catch (cause) {
      setError(cause.message);
      setChecking(false);
    }
    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!client || !session) {
      setRole(null);
      setDonors([]);
      setClaims([]);
      setAccounts([]);
      return;
    }
    let mounted = true;
    setIdentityStatus('checking');
    setRole(null);
    setDonors([]);
    setClaims([]);
    setAccounts([]);
    const api = createManagementApi(client);
    client
      .rpc('current_identity_gate')
      .then(async ({ data, error: gateError }) => {
        const gate = Array.isArray(data) ? data[0] : data;
        if (gateError || !gate?.account_active) throw new Error('Account access unavailable.');
        if (gate.must_change_password) {
          if (mounted) setIdentityStatus('temporary');
          return;
        }
        const nextRole = await api.getMyRole();
        const [list, pending, destinations] = await Promise.all([
          api.listMonthlyDonors(),
          nextRole === 'treasurer' ? api.listPendingMonthlyClaims() : [],
          nextRole === 'treasurer' ? api.listActiveMasjidAccounts() : [],
        ]);
        if (mounted) {
          setRole(nextRole);
          setDonors(list ?? []);
          setClaims(pending ?? []);
          setAccounts(destinations ?? []);
          setIdentityStatus('ready');
        }
      })
      .catch((cause) => {
        if (mounted) {
          setError(cause.message);
          setIdentityStatus('denied');
        }
      });
    return () => {
      mounted = false;
    };
  }, [client, session?.access_token]);

  async function signIn() {
    setBusy(true);
    setError('');
    try {
      await signInUsername({
        client,
        username: username.trim(),
        password,
        baseUrl: process.env.EXPO_PUBLIC_WEB_API_URL,
      });
      setPassword('');
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }

  async function changePassword() {
    setBusy(true);
    setError('');
    try {
      await changeInitialPassword({
        client,
        newPassword,
        baseUrl: process.env.EXPO_PUBLIC_WEB_API_URL,
      });
      setNewPassword('');
      setNotice('Password changed. Sign in with the new password.');
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }

  async function leaveTemporarySession() {
    setBusy(true);
    setError('');
    try {
      const { error: signOutError } = await client.auth.signOut();
      if (signOutError) throw signOutError;
      setNewPassword('');
      setNotice('Signed out. Use your assigned username to sign in.');
    } catch (cause) {
      setError(cause.message || 'Unable to sign out.');
    } finally {
      setBusy(false);
    }
  }

  async function enroll() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (!consent || !consentMethod)
        throw new Error('Record the contributor’s agreement and how it was obtained.');
      const api = createManagementApi(client);
      await enrollConsentedDonor({
        client,
        baseUrl: process.env.EXPO_PUBLIC_WEB_API_URL,
        input: {
          name: name.trim(),
          whatsapp: whatsapp.trim(),
          suggestedAmountINR: amount.trim(),
          referrerId: referrerId.trim() || null,
          consentMethod,
          consentRecordedAt: new Date().toISOString(),
          evidenceReference: consentEvidence.trim(),
        },
      });
      setDonors((await api.listMonthlyDonors()) ?? []);
      setName('');
      setWhatsapp('');
      setAmount('');
      setConsent(false);
      setConsentMethod('');
      setConsentEvidence('');
      setReferrerId('');
      setNotice('Contributor enrolled with consent recorded.');
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitClaim() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (!/^\d{4}-\d{2}-01$/.test(period))
        throw new Error('Enter the first day of the month as YYYY-MM-01.');
      await createManagementApi(client).submitMonthlyClaim({
        donorId: selectedDonor,
        periodDate: period,
        transactionId: transaction.trim(),
      });
      setPeriod('');
      setTransaction('');
      setSelectedDonor(null);
      if (role === 'treasurer')
        setClaims(await createManagementApi(client).listPendingMonthlyClaims());
      setNotice('Reference submitted for Treasurer review. No money has been posted yet.');
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }

  async function verifyClaim(claimId) {
    setBusy(true);
    setError('');
    setNotice('');
    const accountId = verification[claimId]?.accountId;
    const actualAmountINR = verification[claimId]?.amount?.trim();
    const id =
      operation?.claimId === claimId &&
      operation.accountId === accountId &&
      operation.actualAmountINR === actualAmountINR
        ? operation.id
        : Crypto.randomUUID();
    setOperation({ claimId, accountId, actualAmountINR, id });
    try {
      if (!accountId) throw new Error('Choose the account where the payment arrived.');
      const code = await createManagementApi(client).verifyMonthlyClaim({
        claimId,
        accountId,
        actualAmountINR,
        operationId: id,
      });
      setOperation(null);
      setClaims(await createManagementApi(client).listPendingMonthlyClaims());
      setNotice(`Verified and posted. Receipt code: ${code}`);
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <KeyboardAvoidingView
          style={styles.fill}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.eyebrow}>MASJID E MAMOOR 2</Text>
            <Text style={styles.title}>Community contributions</Text>
            <Text style={styles.intro}>A clear record of monthly support for our masjid.</Text>
            {checking && <ActivityIndicator color={colors.green} />}
            {!!error && (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            )}
            {!!notice && (
              <Text accessibilityRole="alert" style={styles.notice}>
                {notice}
              </Text>
            )}
            {!checking && !client && (
              <Text>Set the connection values in your environment to continue.</Text>
            )}
            {!checking && client && !session && (
              <View style={styles.card}>
                <Text style={styles.heading}>Sign in</Text>
                <Text style={styles.muted}>Use your provisioned management account.</Text>
                <Field
                  label="Username"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoComplete="username"
                />
                <Field
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete="password"
                />
                <Button label={busy ? 'Signing in…' : 'Sign in'} onPress={signIn} disabled={busy} />
              </View>
            )}
            {!checking && session && identityStatus === 'checking' && (
              <ActivityIndicator color={colors.green} />
            )}
            {!checking && session && identityStatus === 'denied' && (
              <View style={styles.card}>
                <Text style={styles.heading}>Account access unavailable</Text>
                <Button
                  label="Sign out"
                  secondary
                  onPress={leaveTemporarySession}
                  disabled={busy}
                />
              </View>
            )}
            {!checking && session && identityStatus === 'temporary' && (
              <View style={styles.card}>
                <Text style={styles.heading}>Change temporary password</Text>
                <Field
                  label="New password (at least 12 characters)"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                  autoComplete="new-password"
                />
                <Button
                  label={busy ? 'Saving…' : 'Change password'}
                  onPress={changePassword}
                  disabled={busy || newPassword.length < 12 || newPassword.length > 128}
                />
                <Button
                  label="Sign out"
                  secondary
                  onPress={leaveTemporarySession}
                  disabled={busy}
                />
              </View>
            )}
            {!checking && session && identityStatus === 'ready' && (
              <>
                <View style={styles.account}>
                  <Text style={styles.muted}>{session.user.email}</Text>
                  <Text style={styles.role}>
                    {role?.replaceAll('_', ' ') || 'Checking access…'}
                  </Text>
                  <Button
                    label="Sign out"
                    secondary
                    onPress={async () => {
                      setError('');
                      const { error: signOutError } = await client.auth.signOut();
                      if (signOutError) setError(signOutError.message);
                    }}
                  />
                </View>
                {role === 'president' && <PaymentQrProfile client={client} />}
                <FinanceAccounts client={client} role={role} />
                {enrollmentRoles.has(role) && (
                  <View style={styles.card}>
                    <Text style={styles.heading}>Enroll a contributor</Text>
                    <Text style={styles.muted}>
                      A suggested amount is voluntary. Record consent given by the contributor.
                    </Text>
                    <Field label="Name" value={name} onChangeText={setName} maxLength={200} />
                    <Field
                      label="WhatsApp number (+country code)"
                      value={whatsapp}
                      onChangeText={setWhatsapp}
                      keyboardType="phone-pad"
                      placeholder="+919876543210"
                    />
                    <Field
                      label="Suggested monthly amount (₹)"
                      value={amount}
                      onChangeText={setAmount}
                      keyboardType="decimal-pad"
                      placeholder="500.00"
                    />
                    <Field
                      label="Referrer account ID (if referred)"
                      value={referrerId}
                      onChangeText={setReferrerId}
                      autoCapitalize="none"
                    />
                    <Text style={styles.label}>How the contributor agreed</Text>
                    <View style={styles.methodOptions}>
                      {[
                        ['in-person', 'In person'],
                        ['phone-call', 'Phone call'],
                        ['message', 'Their message'],
                      ].map(([value, label]) => (
                        <Button
                          key={value}
                          label={label}
                          secondary={consentMethod !== value}
                          onPress={() => setConsentMethod(value)}
                        />
                      ))}
                    </View>
                    <Field
                      label="Consent evidence reference"
                      value={consentEvidence}
                      onChangeText={setConsentEvidence}
                      maxLength={240}
                    />
                    <View style={styles.consent}>
                      <Switch
                        value={consent}
                        onValueChange={setConsent}
                        trackColor={{ true: colors.green }}
                        accessibilityLabel="Contributor agreement evidence recorded"
                      />
                      <Text style={styles.consentText}>
                        I recorded the contributor’s agreement and evidence. WhatsApp messages
                        require separate opt-in from the recipient.
                      </Text>
                    </View>
                    <Button
                      label={busy ? 'Saving…' : 'Save contributor'}
                      onPress={enroll}
                      disabled={busy}
                    />
                  </View>
                )}
                {claimRoles.has(role) && (
                  <View style={styles.card}>
                    <Text style={styles.heading}>Submit a payment reference</Text>
                    <Text style={styles.muted}>
                      Choose the contributor and month. Submission does not post money.
                    </Text>
                    {donors
                      .filter((d) => d.active)
                      .map((d) => (
                        <Pressable
                          key={d.donor_id}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: selectedDonor === d.donor_id }}
                          onPress={() => setSelectedDonor(d.donor_id)}
                          style={[styles.choice, selectedDonor === d.donor_id && styles.selected]}
                        >
                          <Text style={styles.donor}>{d.donor_name}</Text>
                        </Pressable>
                      ))}
                    <Field
                      label="Month (YYYY-MM-01)"
                      value={period}
                      onChangeText={setPeriod}
                      placeholder="2026-10-01"
                      keyboardType="numbers-and-punctuation"
                    />
                    <Field
                      label="Transaction reference"
                      value={transaction}
                      onChangeText={setTransaction}
                      maxLength={200}
                    />
                    <Button
                      label={busy ? 'Submitting…' : 'Submit for Treasurer review'}
                      onPress={submitClaim}
                      disabled={busy || !selectedDonor}
                    />
                  </View>
                )}
                {role === 'treasurer' && (
                  <View style={styles.card}>
                    <Text style={styles.heading}>Pending review</Text>
                    {claims.length === 0 && <Text style={styles.empty}>No pending claims.</Text>}
                    {claims.map((claim) => (
                      <View key={claim.claim_id} style={styles.review}>
                        <Text style={styles.donor}>
                          {claim.donor_name} · {claim.period_date}
                        </Text>
                        <Text style={styles.muted}>Reference: {claim.transaction_id}</Text>
                        <Text style={styles.label}>Checked destination account</Text>
                        {accounts.map((account) => (
                          <Pressable
                            key={account.account_id}
                            accessibilityRole="radio"
                            accessibilityState={{
                              selected:
                                verification[claim.claim_id]?.accountId === account.account_id,
                            }}
                            onPress={() =>
                              setVerification((current) => ({
                                ...current,
                                [claim.claim_id]: {
                                  ...current[claim.claim_id],
                                  accountId: account.account_id,
                                },
                              }))
                            }
                            style={[
                              styles.choice,
                              verification[claim.claim_id]?.accountId === account.account_id &&
                                styles.selected,
                            ]}
                          >
                            <Text style={styles.donor}>
                              {account.account_name} ({account.account_kind})
                            </Text>
                          </Pressable>
                        ))}
                        <Field
                          label="Amount actually received (₹)"
                          value={verification[claim.claim_id]?.amount ?? ''}
                          onChangeText={(value) =>
                            setVerification((current) => ({
                              ...current,
                              [claim.claim_id]: { ...current[claim.claim_id], amount: value },
                            }))
                          }
                          keyboardType="decimal-pad"
                        />
                        <Button
                          label={busy ? 'Verifying…' : 'Verify and issue receipt'}
                          onPress={() => verifyClaim(claim.claim_id)}
                          disabled={busy}
                        />
                      </View>
                    ))}
                  </View>
                )}
                <OfflineDrafts client={client} actorId={session.user.id} role={role} />
                <View style={styles.card}>
                  <Text style={styles.heading}>Contributor roster</Text>
                  <Text style={styles.muted}>
                    Verified payments count at the amount actually received.
                  </Text>
                  {donors.length === 0 ? (
                    <Text style={styles.empty}>No contributors are listed yet.</Text>
                  ) : (
                    <FlatList
                      data={donors}
                      scrollEnabled={false}
                      keyExtractor={(item) => item.donor_id}
                      renderItem={({ item }) => (
                        <View style={styles.row}>
                          <View style={styles.fill}>
                            <Text style={styles.donor}>{item.donor_name}</Text>
                            <Text style={styles.muted}>{item.active ? 'Active' : 'Inactive'}</Text>
                          </View>
                          <Text style={styles.money}>
                            {formatPaiseINR(item.suggested_amount_paise)}
                          </Text>
                        </View>
                      )}
                    />
                  )}
                </View>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  fill: { flex: 1 },
  content: {
    padding: 24,
    paddingBottom: 48,
    gap: 15,
    maxWidth: 660,
    width: '100%',
    alignSelf: 'center',
  },
  eyebrow: {
    color: colors.green,
    fontWeight: '800',
    letterSpacing: 2,
    fontSize: 11,
    marginTop: 18,
  },
  title: { color: colors.ink, fontWeight: '800', fontSize: 34, lineHeight: 40 },
  intro: { color: colors.muted, fontSize: 16, lineHeight: 24, marginBottom: 10 },
  card: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heading: { fontSize: 21, fontWeight: '700', color: colors.ink },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  field: { gap: 6 },
  label: { color: colors.ink, fontWeight: '600', fontSize: 14 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 13,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.white,
  },
  methodOptions: { gap: 8 },
  button: { backgroundColor: colors.green, padding: 15, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: colors.white, fontWeight: '700', fontSize: 16 },
  disabled: { opacity: 0.55 },
  secondary: { backgroundColor: colors.pale },
  secondaryText: { color: colors.green },
  account: { gap: 8, paddingVertical: 6 },
  role: { color: colors.green, textTransform: 'capitalize', fontWeight: '700' },
  consent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  consentText: { flex: 1, color: colors.ink, lineHeight: 21 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  donor: { color: colors.ink, fontWeight: '700', fontSize: 15 },
  money: { color: colors.green, fontWeight: '700' },
  empty: { color: colors.muted, paddingVertical: 14 },
  choice: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 11 },
  selected: { borderColor: colors.green, backgroundColor: colors.pale },
  review: { borderTopWidth: 1, borderTopColor: colors.border, gap: 10, paddingVertical: 16 },
  error: { color: colors.error, backgroundColor: '#fff0ed', padding: 12, borderRadius: 8 },
  notice: { color: colors.green, backgroundColor: colors.pale, padding: 12, borderRadius: 8 },
});
