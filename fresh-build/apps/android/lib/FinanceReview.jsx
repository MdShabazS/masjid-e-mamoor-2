import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { formatPaiseINR, parseINRToPaise } from '../../../packages/api-client/index.js';
import { userMessage } from '../../../packages/api-client/messages.js';
import { DateField, indiaToday } from './Pickers';

function Button({ label, onPress, disabled = false, secondary = false }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, secondary && styles.secondary, disabled && styles.disabled]}
    >
      <Text style={secondary ? styles.secondaryText : styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

function Field({ label, value, onChangeText, ...props }) {
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        {...props}
      />
    </View>
  );
}

function AccountChoice({ label, accounts, value, onChange }) {
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      {accounts.length === 0 && <Text style={styles.error}>No matching active account.</Text>}
      {accounts.map((account) => (
        <Pressable
          key={account.account_id}
          accessibilityRole="radio"
          accessibilityState={{ selected: value === account.account_id }}
          onPress={() => onChange(account.account_id)}
          style={[styles.choice, value === account.account_id && styles.selected]}
        >
          <Text style={styles.body}>
            {account.account_name} ({account.account_kind}) ·{' '}
            {formatPaiseINR(account.balance_paise)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const emptyCash = { name: '', date: '', amount: '', evidence: '', account: '', counted: false };

export default function FinanceReview({ client, role }) {
  const [donations, setDonations] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [forms, setForms] = useState({});
  const [cash, setCash] = useState(emptyCash);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const operations = useRef(new Map());
  const isTreasurer = role === 'treasurer';

  const load = useCallback(async () => {
    const calls = [
      client.rpc('list_actionable_expenses'),
      client.rpc('list_finance_accounts'),
      isTreasurer ? client.rpc('list_pending_one_time_donations') : { data: [] },
    ];
    const [nextExpenses, nextAccounts, nextDonations] = await Promise.all(calls);
    const failure = nextExpenses.error || nextAccounts.error || nextDonations.error;
    if (failure) throw failure;
    setExpenses(nextExpenses.data ?? []);
    setAccounts((nextAccounts.data ?? []).filter((account) => account.active));
    setDonations(nextDonations.data ?? []);
  }, [client, isTreasurer]);

  useEffect(() => {
    let active = true;
    load()
      .catch((cause) => {
        if (active) setError(userMessage(cause, 'Could not load the review queue.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [load]);

  function form(id) {
    return forms[id] ?? {};
  }
  function update(id, patch) {
    setForms((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  }

  // Retrying identical input reuses the operation ID, so a lost response cannot post twice.
  async function execute(name, args, message) {
    setBusy(true);
    setError('');
    setNotice('');
    const key = `${name}:${JSON.stringify(args)}`;
    const operationId = operations.current.get(key) ?? Crypto.randomUUID();
    operations.current.set(key, operationId);
    try {
      const { error: failure } = await client.rpc(name, { ...args, p_operation_id: operationId });
      if (failure) throw failure;
      operations.current.delete(key);
    } catch (cause) {
      setError(userMessage(cause));
      setBusy(false);
      return false;
    }
    setNotice(message);
    try {
      await load();
    } catch {
      setError('Saved, but the list could not refresh. Reopen it before another action.');
    }
    setBusy(false);
    return true;
  }

  function confirmPost(title, amountPaise, onConfirm) {
    Alert.alert(title, `${formatPaiseINR(amountPaise)} will be posted to the ledger.`, [
      { text: 'Go back', style: 'cancel' },
      { text: 'Post', onPress: onConfirm },
    ]);
  }

  function verifyDonation(item) {
    const entry = form(item.donation_id);
    try {
      if (!entry.account) throw new Error('Choose the account that received this donation.');
      const amount = parseINRToPaise(entry.amount?.trim() ?? '');
      confirmPost('Verify this donation?', amount, () =>
        execute(
          'decide_one_time_donation',
          {
            p_id: item.donation_id,
            p_decision: 'verify',
            p_actual_paise: amount,
            p_account_id: entry.account,
            p_reason: null,
          },
          'Actual amount verified and posted. A receipt code was created.',
        ),
      );
    } catch (cause) {
      setError(userMessage(cause));
    }
  }

  function payExpense(item) {
    const entry = form(item.expense_id);
    try {
      const chosen = accounts.find((account) => account.account_id === entry.account);
      if (!chosen) throw new Error('Choose the account used for this payment.');
      if (!entry.date || (entry.proof?.trim().length ?? 0) < 3)
        throw new Error('Enter the payment date and proof reference.');
      const amount = parseINRToPaise(entry.amount?.trim() ?? '');
      confirmPost('Record this payment?', amount, () =>
        execute(
          'post_expense_payment',
          {
            p_id: item.expense_id,
            p_account_id: chosen.account_id,
            p_amount_paise: amount,
            p_method: chosen.account_kind,
            p_date: entry.date,
            p_proof: entry.proof.trim(),
          },
          'Payment posted against the approved expense.',
        ),
      );
    } catch (cause) {
      setError(userMessage(cause));
    }
  }

  function postCash() {
    try {
      if (!cash.counted) throw new Error('Confirm that the cash was physically counted.');
      if (!cash.account) throw new Error('Choose the Cash account.');
      if (!cash.name.trim() || !cash.date || cash.evidence.trim().length < 3)
        throw new Error('Enter the donor, date and numbered slip.');
      const amount = parseINRToPaise(cash.amount.trim());
      confirmPost('Post counted cash?', amount, async () => {
        if (
          await execute(
            'post_direct_treasurer_cash',
            {
              p_name: cash.name.trim(),
              p_kind: 'other',
              p_referrer_id: null,
              p_date: cash.date,
              p_amount_paise: amount,
              p_evidence: cash.evidence.trim(),
              p_account_id: cash.account,
            },
            'Cash posted once to the selected account. Its receipt is valid.',
          )
        )
          setCash(emptyCash);
      });
    } catch (cause) {
      setError(userMessage(cause));
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Donation and expense review</Text>
      <Text style={styles.muted}>
        Verify only money actually received. Approving an expense does not post a payment.
      </Text>
      {loading && <Text style={styles.muted}>Loading review queue…</Text>}
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

      {isTreasurer && (
        <View style={styles.section}>
          <Text style={styles.subheading}>Pending one-time donations</Text>
          {!loading && donations.length === 0 && (
            <Text style={styles.muted}>No pending donations.</Text>
          )}
          {donations.map((item) => {
            const entry = form(item.donation_id);
            return (
              <View key={item.donation_id} style={styles.item}>
                <Text style={styles.title}>{item.donor_name}</Text>
                <Text style={styles.muted}>
                  {item.donation_date} · {item.payment_method} · claimed{' '}
                  {formatPaiseINR(item.claimed_amount_paise)}
                </Text>
                <Text style={styles.muted}>Evidence: {item.evidence_reference}</Text>
                <Field
                  label="Actual received (₹)"
                  keyboardType="decimal-pad"
                  value={entry.amount ?? ''}
                  onChangeText={(amount) => update(item.donation_id, { amount })}
                />
                <AccountChoice
                  label="Receiving account"
                  accounts={accounts.filter((a) => a.account_kind === item.payment_method)}
                  value={entry.account}
                  onChange={(account) => update(item.donation_id, { account })}
                />
                <Button
                  label="Verify received amount"
                  disabled={busy}
                  onPress={() => verifyDonation(item)}
                />
                <Field
                  label="Rejection reason"
                  maxLength={240}
                  value={entry.reason ?? ''}
                  onChangeText={(reason) => update(item.donation_id, { reason })}
                />
                <Button
                  label="Reject claim"
                  secondary
                  disabled={busy || (entry.reason?.trim().length ?? 0) < 3}
                  onPress={() =>
                    execute(
                      'decide_one_time_donation',
                      {
                        p_id: item.donation_id,
                        p_decision: 'reject',
                        p_actual_paise: null,
                        p_account_id: null,
                        p_reason: entry.reason.trim(),
                      },
                      'Donation claim rejected. No money was posted.',
                    )
                  }
                />
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.subheading}>Expenses needing action</Text>
        {!loading && expenses.length === 0 && (
          <Text style={styles.muted}>No expenses need action.</Text>
        )}
        {expenses.map((item) => {
          const entry = form(item.expense_id);
          return (
            <View key={item.expense_id} style={styles.item}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.muted}>{item.description}</Text>
              <Text style={styles.muted}>
                {item.category} · requested {formatPaiseINR(item.requested_amount_paise)} · paid{' '}
                {formatPaiseINR(item.effective_paid_paise)} · {item.status.replaceAll('_', ' ')}
              </Text>
              <Text style={styles.muted}>
                {item.bill_reference
                  ? `Bill: ${item.bill_reference}`
                  : `Missing bill: ${item.missing_bill_reason}`}
              </Text>
              {item.status === 'submitted' && (
                <>
                  <Button
                    label="Approve"
                    disabled={busy}
                    onPress={() =>
                      execute(
                        'decide_expense_request',
                        { p_id: item.expense_id, p_decision: 'approve', p_reason: null },
                        'Expense approved. The Treasurer may record a payment.',
                      )
                    }
                  />
                  <Field
                    label="Rejection reason"
                    maxLength={500}
                    value={entry.reason ?? ''}
                    onChangeText={(reason) => update(item.expense_id, { reason })}
                  />
                  <Button
                    label="Reject"
                    secondary
                    disabled={busy || (entry.reason?.trim().length ?? 0) < 3}
                    onPress={() =>
                      execute(
                        'decide_expense_request',
                        {
                          p_id: item.expense_id,
                          p_decision: 'reject',
                          p_reason: entry.reason.trim(),
                        },
                        'Expense rejected without payment.',
                      )
                    }
                  />
                </>
              )}
              {isTreasurer && ['approved', 'partially_paid'].includes(item.status) && (
                <>
                  <AccountChoice
                    label="Pay from account"
                    accounts={accounts}
                    value={entry.account}
                    onChange={(account) => update(item.expense_id, { account })}
                  />
                  <Field
                    label="Payment (₹)"
                    keyboardType="decimal-pad"
                    value={entry.amount ?? ''}
                    onChangeText={(amount) => update(item.expense_id, { amount })}
                  />
                  <DateField
                    label="Payment date in India"
                    max={indiaToday()}
                    value={entry.date ?? ''}
                    onChange={(date) => update(item.expense_id, { date })}
                  />
                  <Field
                    label="Proof reference"
                    maxLength={240}
                    value={entry.proof ?? ''}
                    onChangeText={(proof) => update(item.expense_id, { proof })}
                  />
                  <Button
                    label="Record actual payment"
                    disabled={busy}
                    onPress={() => payExpense(item)}
                  />
                </>
              )}
            </View>
          );
        })}
      </View>

      {isTreasurer && (
        <View style={styles.section}>
          <Text style={styles.subheading}>Post counted cash directly</Text>
          <Text style={styles.muted}>
            For a named cash donation you counted yourself. It posts once and issues a receipt.
          </Text>
          <Field
            label="Donor name"
            maxLength={200}
            value={cash.name}
            onChangeText={(name) => setCash((current) => ({ ...current, name }))}
          />
          <DateField
            label="Donation date in India"
            max={indiaToday()}
            value={cash.date}
            onChange={(date) => setCash((current) => ({ ...current, date }))}
          />
          <Field
            label="Cash counted (₹)"
            keyboardType="decimal-pad"
            value={cash.amount}
            onChangeText={(amount) => setCash((current) => ({ ...current, amount }))}
          />
          <Field
            label="Numbered cash slip"
            maxLength={240}
            value={cash.evidence}
            onChangeText={(evidence) => setCash((current) => ({ ...current, evidence }))}
          />
          <AccountChoice
            label="Cash account"
            accounts={accounts.filter((account) => account.account_kind === 'cash')}
            value={cash.account}
            onChange={(account) => setCash((current) => ({ ...current, account }))}
          />
          <View style={styles.confirm}>
            <Switch
              value={cash.counted}
              onValueChange={(counted) => setCash((current) => ({ ...current, counted }))}
              accessibilityLabel="Confirm the cash was physically counted"
            />
            <Text style={styles.body}>I counted this cash and checked the numbered slip.</Text>
          </View>
          <Button label="Post cash" disabled={busy} onPress={postCash} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: '#d9e1d9',
  },
  section: { borderTopWidth: 1, borderTopColor: '#d9e1d9', paddingTop: 14, gap: 10 },
  item: { borderTopWidth: 1, borderTopColor: '#d9e1d9', paddingTop: 12, gap: 9 },
  heading: { fontSize: 21, fontWeight: '700', color: '#182e2a' },
  subheading: { fontSize: 17, fontWeight: '700', color: '#182e2a' },
  title: { fontSize: 16, fontWeight: '700', color: '#182e2a' },
  muted: { color: '#5e6e68', fontSize: 14, lineHeight: 21 },
  body: { color: '#182e2a', flexShrink: 1, lineHeight: 21 },
  group: { gap: 6 },
  label: { color: '#182e2a', fontWeight: '600', fontSize: 14 },
  input: {
    borderWidth: 1,
    borderColor: '#d9e1d9',
    borderRadius: 10,
    padding: 13,
    fontSize: 16,
    color: '#182e2a',
  },
  choice: { padding: 12, borderWidth: 1, borderColor: '#d9e1d9', borderRadius: 10 },
  selected: { backgroundColor: '#e8f3ed', borderColor: '#145b49' },
  confirm: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  button: { backgroundColor: '#145b49', padding: 13, borderRadius: 10, alignItems: 'center' },
  secondary: { backgroundColor: '#e8f3ed' },
  buttonText: { color: '#fff', fontWeight: '700' },
  secondaryText: { color: '#145b49', fontWeight: '700' },
  disabled: { opacity: 0.55 },
  error: { color: '#a32b28' },
  notice: { color: '#145b49' },
});
