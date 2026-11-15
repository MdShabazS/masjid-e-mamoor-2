import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { formatPaiseINR, parseINRToPaise } from '../../../packages/api-client/index.js';
import { userMessage } from '../../../packages/api-client/messages.js';
import { DateField, MonthField, indiaToday } from './Pickers';

const SALARY_MANAGERS = new Set(['president', 'treasurer']);
const ADVANCE_REQUESTERS = new Set([
  'president',
  'vice_president',
  'secretary',
  'treasurer',
  'committee_member',
  'member',
]);
const ADVANCE_DECIDERS = new Set(['president', 'vice_president']);
const roleLabels = { hafiz: 'Hafiz', muezzin: 'Muezzin', other: 'Other staff' };

function Button({ label, onPress, disabled = false, secondary = false, selected = false }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        secondary && styles.secondary,
        selected && styles.selected,
        disabled && styles.disabled,
      ]}
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

function AccountChoice({ accounts, value, onChange, label = 'Pay from account' }) {
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      {accounts.length === 0 && <Text style={styles.error}>No active account.</Text>}
      {accounts.map((account) => (
        <Pressable
          key={account.account_id}
          accessibilityRole="radio"
          accessibilityState={{ selected: value === account.account_id }}
          onPress={() => onChange(account.account_id)}
          style={[styles.choice, value === account.account_id && styles.chosen]}
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

/** One retrying command runner: identical input reuses its operation ID. */
function useCommand(client, setBusy, setError, setNotice, refresh) {
  const operations = useRef(new Map());
  return async function run(name, args, success, confirmPaise = null) {
    const go = async () => {
      setBusy(true);
      setError('');
      setNotice('');
      const key = `${name}:${JSON.stringify(args)}`;
      const operationId = operations.current.get(key) ?? Crypto.randomUUID();
      operations.current.set(key, operationId);
      try {
        const { error } = await client.rpc(name, { ...args, p_operation_id: operationId });
        if (error) throw error;
        operations.current.delete(key);
      } catch (cause) {
        setError(userMessage(cause));
        setBusy(false);
        return false;
      }
      setNotice(success);
      try {
        await refresh();
      } catch {
        setError('Saved, but the list could not refresh. Reopen it before another action.');
      }
      setBusy(false);
      return true;
    };
    if (confirmPaise === null) return go();
    return new Promise((resolve) =>
      Alert.alert('Post this payment?', `${formatPaiseINR(confirmPaise)} will leave the account.`, [
        { text: 'Go back', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Post', onPress: () => go().then(resolve) },
      ]),
    );
  };
}

export function SalaryRecords({ client, role }) {
  const [month, setMonth] = useState(`${indiaToday().slice(0, 7)}-01`);
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('checking');
  const [accounts, setAccounts] = useState([]);
  const [forms, setForms] = useState({});
  const [staff, setStaff] = useState({ name: '', role: 'hafiz', amount: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const manager = SALARY_MANAGERS.has(role);

  const load = useCallback(async () => {
    const { data, error: failure } = await client.rpc('list_salary_records', { p_month: month });
    if (failure) {
      setStatus(failure.code === '42501' ? 'hidden' : 'unavailable');
      return;
    }
    setRows(data ?? []);
    setStatus('ready');
    if (role === 'treasurer') {
      const { data: list } = await client.rpc('list_finance_accounts');
      setAccounts((list ?? []).filter((a) => a.active && a.account_kind !== 'advance'));
    }
  }, [client, month, role]);

  useEffect(() => {
    load().catch(() => setStatus('unavailable'));
  }, [load]);

  const run = useCommand(client, setBusy, setError, setNotice, load);
  const form = (id) => forms[id] ?? {};
  const update = (id, patch) =>
    setForms((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  const clear = (id) => (saved) => {
    if (saved) setForms((current) => ({ ...current, [id]: {} }));
  };

  if (status === 'hidden')
    return (
      <View style={styles.card}>
        <Text style={styles.heading}>Staff salaries</Text>
        <Text style={styles.muted}>
          Salary details will appear here after the Board approves showing them to members.
        </Text>
      </View>
    );

  async function addStaff() {
    try {
      const args = {
        p_name: staff.name.trim(),
        p_role: staff.role,
        p_monthly_amount_paise: parseINRToPaise(staff.amount.trim()),
      };
      if (await run('add_salary_staff', args, 'Staff member added.'))
        setStaff({ name: '', role: 'hafiz', amount: '' });
    } catch (cause) {
      setError(userMessage(cause));
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Staff salaries</Text>
      <MonthField label="Month" value={month} onChange={setMonth} />
      {status === 'unavailable' && <Text style={styles.error}>Could not load salaries.</Text>}
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
      {status === 'ready' && rows.length === 0 && (
        <Text style={styles.muted}>No staff on the salary list.</Text>
      )}
      {rows.map((row) => {
        const entry = form(row.staff_id);
        return (
          <View key={row.staff_id} style={styles.item}>
            <Text style={styles.title}>
              {row.staff_name} · {roleLabels[row.staff_role]}
              {row.active ? '' : ' · inactive'}
            </Text>
            <Text style={styles.muted}>
              Monthly {formatPaiseINR(row.monthly_amount_paise)} ·{' '}
              {row.paid_amount_paise
                ? `Paid ${formatPaiseINR(row.paid_amount_paise)} on ${row.payment_date} by ${row.payment_method}`
                : 'Not paid for this month'}
            </Text>
            {role === 'treasurer' && !row.paid_amount_paise && row.active && (
              <View style={styles.group}>
                <AccountChoice
                  accounts={accounts}
                  value={entry.account}
                  onChange={(account) => update(row.staff_id, { account })}
                />
                <Field
                  label="Amount paid (₹)"
                  keyboardType="decimal-pad"
                  value={entry.amount ?? ''}
                  onChangeText={(amount) => update(row.staff_id, { amount })}
                />
                <DateField
                  label="Payment date"
                  max={indiaToday()}
                  value={entry.date ?? ''}
                  onChange={(date) => update(row.staff_id, { date })}
                />
                <Field
                  label="Proof reference"
                  maxLength={240}
                  value={entry.proof ?? ''}
                  onChangeText={(proof) => update(row.staff_id, { proof })}
                />
                <Button
                  label="Record salary payment"
                  disabled={busy}
                  onPress={() => {
                    try {
                      if (!entry.account || !entry.date || (entry.proof?.trim().length ?? 0) < 3)
                        throw new Error('Choose the account, date and proof reference.');
                      const amount = parseINRToPaise(entry.amount?.trim() ?? '');
                      run(
                        'record_salary_payment',
                        {
                          p_staff_id: row.staff_id,
                          p_month: month,
                          p_account_id: entry.account,
                          p_amount_paise: amount,
                          p_date: entry.date,
                          p_proof: entry.proof.trim(),
                        },
                        'Salary payment posted.',
                        amount,
                      ).then(clear(row.staff_id));
                    } catch (cause) {
                      setError(userMessage(cause));
                    }
                  }}
                />
              </View>
            )}
            {manager && (
              <View style={styles.group}>
                <Field
                  label="New monthly amount (₹)"
                  keyboardType="decimal-pad"
                  value={entry.newAmount ?? ''}
                  onChangeText={(newAmount) => update(row.staff_id, { newAmount })}
                />
                <Field
                  label="Reason for the change"
                  maxLength={240}
                  value={entry.reason ?? ''}
                  onChangeText={(reason) => update(row.staff_id, { reason })}
                />
                <Button
                  label={row.active ? 'Save amount' : 'Save amount and reactivate'}
                  secondary
                  disabled={busy || (entry.reason?.trim().length ?? 0) < 3}
                  onPress={() => {
                    try {
                      run(
                        'update_salary_staff',
                        {
                          p_staff_id: row.staff_id,
                          p_monthly_amount_paise: parseINRToPaise(entry.newAmount?.trim() ?? ''),
                          p_active: true,
                          p_reason: entry.reason.trim(),
                        },
                        'Salary amount updated. Earlier payments are unchanged.',
                      ).then(clear(row.staff_id));
                    } catch (cause) {
                      setError(userMessage(cause));
                    }
                  }}
                />
                {row.active && (
                  <Button
                    label="Stop salary (staff left)"
                    secondary
                    disabled={busy || (entry.reason?.trim().length ?? 0) < 3}
                    onPress={() =>
                      run(
                        'update_salary_staff',
                        {
                          p_staff_id: row.staff_id,
                          p_monthly_amount_paise: Number(row.monthly_amount_paise),
                          p_active: false,
                          p_reason: entry.reason.trim(),
                        },
                        'Salary stopped. History is kept.',
                      ).then(clear(row.staff_id))
                    }
                  />
                )}
              </View>
            )}
          </View>
        );
      })}
      {manager && (
        <View style={styles.item}>
          <Text style={styles.title}>Add a staff member</Text>
          <Field
            label="Name"
            maxLength={120}
            value={staff.name}
            onChangeText={(name) => setStaff((current) => ({ ...current, name }))}
          />
          <View style={styles.row}>
            {Object.entries(roleLabels).map(([id, label]) => (
              <View key={id} style={styles.fill}>
                <Button
                  label={label}
                  secondary={staff.role !== id}
                  onPress={() => setStaff((current) => ({ ...current, role: id }))}
                />
              </View>
            ))}
          </View>
          <Field
            label="Monthly salary (₹)"
            keyboardType="decimal-pad"
            value={staff.amount}
            onChangeText={(amount) => setStaff((current) => ({ ...current, amount }))}
          />
          <Button
            label="Add staff member"
            disabled={busy || !staff.name.trim()}
            onPress={addStaff}
          />
        </View>
      )}
    </View>
  );
}

const statusLabels = {
  submitted: 'Waiting for approval',
  approved: 'Approved, not paid',
  rejected: 'Rejected',
  paid: 'Paid, awaiting bills or return',
  settled: 'Settled',
};

export function Advances({ client, role }) {
  const [rows, setRows] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [forms, setForms] = useState({});
  const [request, setRequest] = useState({ recipient: '', purpose: '', amount: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    const { data, error: failure } = await client.rpc('list_advances');
    if (failure) throw failure;
    setRows(data ?? []);
    if (role === 'treasurer') {
      const { data: list } = await client.rpc('list_finance_accounts');
      setAccounts((list ?? []).filter((a) => a.active && a.account_kind !== 'advance'));
    }
  }, [client, role]);

  useEffect(() => {
    load().catch((cause) => setError(userMessage(cause, 'Could not load advances.')));
  }, [load]);

  const run = useCommand(client, setBusy, setError, setNotice, load);
  const form = (id) => forms[id] ?? {};
  const update = (id, patch) =>
    setForms((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  const clear = (id) => (saved) => {
    if (saved) setForms((current) => ({ ...current, [id]: {} }));
  };

  async function submit() {
    try {
      const args = {
        p_recipient: request.recipient.trim(),
        p_purpose: request.purpose.trim(),
        p_amount_paise: parseINRToPaise(request.amount.trim()),
      };
      if (await run('submit_advance_request', args, 'Advance request sent for approval.'))
        setRequest({ recipient: '', purpose: '', amount: '' });
    } catch (cause) {
      setError(userMessage(cause));
    }
  }

  function settle(row, kind) {
    const entry = form(row.advance_id);
    try {
      if ((entry.reference?.trim().length ?? 0) < 3)
        throw new Error('Enter the bill or receipt reference.');
      if (kind === 'return' && !entry.account)
        throw new Error('Choose the account the money went into.');
      const amount = parseINRToPaise(entry.amount?.trim() ?? '');
      run(
        'settle_advance',
        {
          p_id: row.advance_id,
          p_kind: kind,
          p_amount_paise: amount,
          p_account_id: kind === 'return' ? entry.account : null,
          p_reference: entry.reference.trim(),
        },
        kind === 'bill' ? 'Bills recorded as spending.' : 'Returned money recorded.',
      ).then(clear(row.advance_id));
    } catch (cause) {
      setError(userMessage(cause));
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Advances</Text>
      <Text style={styles.muted}>
        An advance is not spending until bills are recorded. Unused money must be returned.
      </Text>
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
      {ADVANCE_REQUESTERS.has(role) && (
        <View style={styles.group}>
          <Text style={styles.title}>Request an advance</Text>
          <Field
            label="Who receives the money"
            maxLength={120}
            value={request.recipient}
            onChangeText={(recipient) => setRequest((current) => ({ ...current, recipient }))}
          />
          <Field
            label="What it is for"
            maxLength={500}
            multiline
            value={request.purpose}
            onChangeText={(purpose) => setRequest((current) => ({ ...current, purpose }))}
          />
          <Field
            label="Amount (₹)"
            keyboardType="decimal-pad"
            value={request.amount}
            onChangeText={(amount) => setRequest((current) => ({ ...current, amount }))}
          />
          <Button label="Send for approval" disabled={busy} onPress={submit} />
        </View>
      )}
      {rows.length === 0 && <Text style={styles.muted}>No advances yet.</Text>}
      {rows.map((row) => {
        const entry = form(row.advance_id);
        return (
          <View key={row.advance_id} style={styles.item}>
            <Text style={styles.title}>
              {row.recipient_name} · {formatPaiseINR(row.amount_paise)}
            </Text>
            <Text style={styles.muted}>{row.purpose}</Text>
            <Text style={styles.muted}>
              {statusLabels[row.status]} · requested by {row.requested_by_username}
              {['paid', 'settled'].includes(row.status)
                ? ` · bills ${formatPaiseINR(row.bills_paise)} · returned ${formatPaiseINR(row.returned_paise)} · outstanding ${formatPaiseINR(row.outstanding_paise)}`
                : ''}
            </Text>
            {!!row.rejection_reason && (
              <Text style={styles.error}>Reason: {row.rejection_reason}</Text>
            )}
            {ADVANCE_DECIDERS.has(role) && row.status === 'submitted' && !row.is_mine && (
              <View style={styles.group}>
                <Button
                  label="Approve"
                  disabled={busy}
                  onPress={() =>
                    run(
                      'decide_advance_request',
                      { p_id: row.advance_id, p_decision: 'approve', p_reason: null },
                      'Advance approved. The Treasurer can pay it.',
                    )
                  }
                />
                <Field
                  label="Rejection reason"
                  maxLength={500}
                  value={entry.reason ?? ''}
                  onChangeText={(reason) => update(row.advance_id, { reason })}
                />
                <Button
                  label="Reject"
                  secondary
                  disabled={busy || (entry.reason?.trim().length ?? 0) < 3}
                  onPress={() =>
                    run(
                      'decide_advance_request',
                      { p_id: row.advance_id, p_decision: 'reject', p_reason: entry.reason.trim() },
                      'Advance rejected.',
                    )
                  }
                />
              </View>
            )}
            {role === 'treasurer' && row.status === 'approved' && (
              <View style={styles.group}>
                <AccountChoice
                  accounts={accounts}
                  value={entry.account}
                  onChange={(account) => update(row.advance_id, { account })}
                />
                <DateField
                  label="Payment date"
                  max={indiaToday()}
                  value={entry.date ?? ''}
                  onChange={(date) => update(row.advance_id, { date })}
                />
                <Field
                  label="Proof reference"
                  maxLength={240}
                  value={entry.proof ?? ''}
                  onChangeText={(proof) => update(row.advance_id, { proof })}
                />
                <Button
                  label="Pay advance"
                  disabled={
                    busy || !entry.account || !entry.date || (entry.proof?.trim().length ?? 0) < 3
                  }
                  onPress={() =>
                    run(
                      'pay_advance',
                      {
                        p_id: row.advance_id,
                        p_account_id: entry.account,
                        p_date: entry.date,
                        p_proof: entry.proof.trim(),
                      },
                      'Advance paid. It stays outstanding until settled.',
                      Number(row.amount_paise),
                    ).then(clear(row.advance_id))
                  }
                />
              </View>
            )}
            {role === 'treasurer' && row.status === 'paid' && (
              <View style={styles.group}>
                <Field
                  label="Amount (₹)"
                  keyboardType="decimal-pad"
                  value={entry.amount ?? ''}
                  onChangeText={(amount) => update(row.advance_id, { amount })}
                />
                <Field
                  label="Bill or receipt reference"
                  maxLength={240}
                  value={entry.reference ?? ''}
                  onChangeText={(reference) => update(row.advance_id, { reference })}
                />
                <Button label="Record bills" disabled={busy} onPress={() => settle(row, 'bill')} />
                <AccountChoice
                  label="Return into account"
                  accounts={accounts}
                  value={entry.account}
                  onChange={(account) => update(row.advance_id, { account })}
                />
                <Button
                  label="Record money returned"
                  secondary
                  disabled={busy}
                  onPress={() => settle(row, 'return')}
                />
              </View>
            )}
          </View>
        );
      })}
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
  item: { borderTopWidth: 1, borderTopColor: '#d9e1d9', paddingTop: 12, gap: 9 },
  heading: { fontSize: 21, fontWeight: '700', color: '#182e2a' },
  title: { fontSize: 16, fontWeight: '700', color: '#182e2a' },
  muted: { color: '#5e6e68', fontSize: 14, lineHeight: 21 },
  body: { color: '#182e2a', flexShrink: 1, lineHeight: 21 },
  group: { gap: 8 },
  row: { flexDirection: 'row', gap: 8 },
  fill: { flex: 1 },
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
  chosen: { backgroundColor: '#e8f3ed', borderColor: '#145b49' },
  button: { backgroundColor: '#145b49', padding: 13, borderRadius: 10, alignItems: 'center' },
  secondary: { backgroundColor: '#e8f3ed' },
  selected: { borderWidth: 2, borderColor: '#145b49' },
  buttonText: { color: '#fff', fontWeight: '700' },
  secondaryText: { color: '#145b49', fontWeight: '700' },
  disabled: { opacity: 0.55 },
  error: { color: '#a32b28' },
  notice: { color: '#145b49' },
});
