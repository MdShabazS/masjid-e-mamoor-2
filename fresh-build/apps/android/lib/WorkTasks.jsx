import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { buildWorkTaskArgs } from '../../../packages/api-client/work-tasks.js';

const creators = new Set(['president', 'vice_president', 'secretary']);
const emptyDraft = {
  title: '',
  description: '',
  date: '',
  location: '',
  mode: 'open',
  total: '10',
  invited: '0',
  volunteer: '10',
};
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function WorkTasks({ client, role }) {
  const [tasks, setTasks] = useState([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [participants, setParticipants] = useState({});
  const [notes, setNotes] = useState({});
  const [reasons, setReasons] = useState({});
  const [invitees, setInvitees] = useState({});
  const [cancelReasons, setCancelReasons] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const operations = useRef(new Map());

  async function rpc(name, args = {}) {
    const { data, error: rpcError } = await client.rpc(name, args);
    if (rpcError) throw new Error(rpcError.message || 'Task action unavailable.');
    return data;
  }

  async function reload() {
    setTasks((await rpc('list_visible_work_tasks')) ?? []);
  }

  useEffect(() => {
    let active = true;
    client
      .rpc('list_visible_work_tasks')
      .then(({ data, error: rpcError }) => {
        if (!active) return;
        if (rpcError) setError(rpcError.message || 'Could not load tasks.');
        else setTasks(data ?? []);
        setLoading(false);
      })
      .catch((cause) => {
        if (active) {
          setError(cause.message);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [client]);

  async function action(name, args, key, success, taskId) {
    setBusy(true);
    setError('');
    setNotice('');
    const operationId = operations.current.get(key) ?? Crypto.randomUUID();
    operations.current.set(key, operationId);
    try {
      await rpc(name, { ...args, p_operation_id: operationId });
      operations.current.delete(key);
    } catch (cause) {
      setError(cause.message || 'Task action failed. Retry the same action.');
      setBusy(false);
      return false;
    }
    try {
      await reload();
      if (taskId) await showParticipants(taskId);
      setNotice(success);
    } catch {
      setError(
        'Action saved. Task list could not refresh; reopen this screen before another action.',
      );
    }
    setBusy(false);
    return true;
  }

  async function showParticipants(taskId) {
    try {
      const rows = await rpc('list_work_task_participants', { p_task_id: taskId });
      setParticipants((current) => ({ ...current, [taskId]: rows ?? [] }));
    } catch (cause) {
      setError(cause.message || 'Could not load participants.');
    }
  }

  function updateDraft(patch) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  async function createTask() {
    try {
      const args = buildWorkTaskArgs(draft);
      if (await action('create_work_task', args, `create:${JSON.stringify(args)}`, 'Task created.'))
        setDraft(emptyDraft);
    } catch (cause) {
      setError(cause.message);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Work tasks</Text>
      {loading && <Text style={styles.muted}>Loading tasks…</Text>}
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
      {creators.has(role) && (
        <View style={styles.group}>
          <Text style={styles.title}>Create a work task</Text>
          <Field
            label="Title"
            value={draft.title}
            maxLength={160}
            onChangeText={(value) => updateDraft({ title: value })}
          />
          <Field
            label="Description"
            value={draft.description}
            maxLength={2000}
            multiline
            onChangeText={(value) => updateDraft({ description: value })}
          />
          <Field
            label="Date (optional, YYYY-MM-DD)"
            value={draft.date}
            maxLength={10}
            onChangeText={(value) => updateDraft({ date: value })}
          />
          <Field
            label="Location (optional)"
            value={draft.location}
            maxLength={240}
            onChangeText={(value) => updateDraft({ location: value })}
          />
          <Text style={styles.label}>Participation</Text>
          <View style={styles.modes}>
            {['open', 'direct', 'mixed'].map((mode) => (
              <Pressable
                key={mode}
                accessibilityRole="radio"
                accessibilityState={{ selected: draft.mode === mode }}
                onPress={() =>
                  updateDraft({
                    mode,
                    invited: mode === 'open' ? '0' : mode === 'direct' ? '10' : '5',
                    volunteer: mode === 'direct' ? '0' : mode === 'open' ? '10' : '5',
                  })
                }
                style={[styles.choice, draft.mode === mode && styles.selected]}
              >
                <Text>
                  {mode === 'direct' ? 'Invitation' : mode === 'mixed' ? 'Mixed' : 'Open'}
                </Text>
              </Pressable>
            ))}
          </View>
          <Field
            label="Total places"
            value={draft.total}
            keyboardType="number-pad"
            onChangeText={(value) => updateDraft({ total: value })}
          />
          {draft.mode !== 'open' && (
            <Field
              label="Invited places"
              value={draft.invited}
              keyboardType="number-pad"
              onChangeText={(value) => updateDraft({ invited: value })}
            />
          )}
          {draft.mode !== 'direct' && (
            <Field
              label="Volunteer places"
              value={draft.volunteer}
              keyboardType="number-pad"
              onChangeText={(value) => updateDraft({ volunteer: value })}
            />
          )}
          <Button label={busy ? 'Creating…' : 'Create task'} disabled={busy} onPress={createTask} />
        </View>
      )}
      {!loading && tasks.length === 0 && <Text style={styles.muted}>No visible tasks.</Text>}
      {tasks.map((task) => {
        const active = task.status === 'active';
        const note = notes[task.task_id] ?? '';
        return (
          <View key={task.task_id} style={styles.task}>
            <Text style={styles.title}>{task.title}</Text>
            <Text style={styles.muted}>{task.description}</Text>
            <Text style={styles.muted}>
              {task.status} · {task.confirmed_count}/{task.total_cap} places
              {task.scheduled_date ? ` · ${task.scheduled_date}` : ''}
              {task.location ? ` · ${task.location}` : ''}
            </Text>
            <Text>My status: {task.my_status ?? 'Not joined'}</Text>
            {active && !task.is_creator && (!task.my_status || task.my_status === 'invited') && (
              <Button
                label={task.my_status === 'invited' ? 'Accept invitation' : 'Join or waitlist'}
                disabled={busy}
                onPress={() =>
                  action(
                    'join_work_task',
                    { p_task_id: task.task_id },
                    `join:${task.task_id}`,
                    'Participation updated.',
                  )
                }
              />
            )}
            {active && !task.is_creator && ['confirmed', 'returned'].includes(task.my_status) && (
              <View style={styles.group}>
                <Text style={styles.label}>Completion note (optional)</Text>
                <TextInput
                  style={styles.input}
                  value={note}
                  maxLength={2000}
                  multiline
                  onChangeText={(value) =>
                    setNotes((current) => ({ ...current, [task.task_id]: value }))
                  }
                />
                <Button
                  label="Submit completion"
                  disabled={busy}
                  onPress={async () => {
                    if (
                      await action(
                        'submit_work_task_completion',
                        { p_task_id: task.task_id, p_note: note.trim() || null },
                        `complete:${task.task_id}:${note.trim()}`,
                        'Completion sent to the task creator for review.',
                      )
                    )
                      setNotes((current) => ({ ...current, [task.task_id]: '' }));
                  }}
                />
              </View>
            )}
            {active &&
              !task.is_creator &&
              ['confirmed', 'waitlisted', 'invited'].includes(task.my_status) && (
                <Button
                  label={task.my_status === 'invited' ? 'Decline invitation' : 'Leave task'}
                  disabled={busy}
                  secondary
                  onPress={() =>
                    action(
                      'leave_work_task',
                      { p_task_id: task.task_id },
                      `leave:${task.task_id}`,
                      'Participation updated.',
                    )
                  }
                />
              )}
            {task.is_creator && (
              <View style={styles.group}>
                <Button
                  label="Review participants"
                  disabled={busy}
                  secondary
                  onPress={() => showParticipants(task.task_id)}
                />
                {(participants[task.task_id] ?? []).map((person) => {
                  const key = `${task.task_id}:${person.member_id}`;
                  const reason = reasons[key] ?? '';
                  return (
                    <View key={person.member_id} style={styles.person}>
                      <Text style={styles.muted}>
                        {person.member_id} · {person.source} · {person.status}
                      </Text>
                      {!!person.completion_note && <Text>Note: {person.completion_note}</Text>}
                      {!!person.review_reason && <Text>Returned: {person.review_reason}</Text>}
                      {active && person.status === 'completion_submitted' && (
                        <View style={styles.group}>
                          <Button
                            label="Accept completion"
                            disabled={busy}
                            onPress={() =>
                              action(
                                'review_work_task_completion',
                                {
                                  p_task_id: task.task_id,
                                  p_member_id: person.member_id,
                                  p_decision: 'accept',
                                  p_reason: null,
                                },
                                `accept:${key}`,
                                'Completion verified.',
                                task.task_id,
                              )
                            }
                          />
                          <Text style={styles.label}>Reason to return (3–500 characters)</Text>
                          <TextInput
                            style={styles.input}
                            value={reason}
                            maxLength={500}
                            onChangeText={(value) =>
                              setReasons((current) => ({ ...current, [key]: value }))
                            }
                          />
                          <Button
                            label="Return for changes"
                            disabled={busy || reason.trim().length < 3}
                            secondary
                            onPress={() =>
                              action(
                                'review_work_task_completion',
                                {
                                  p_task_id: task.task_id,
                                  p_member_id: person.member_id,
                                  p_decision: 'return',
                                  p_reason: reason.trim(),
                                },
                                `return:${key}:${reason.trim()}`,
                                'Completion returned for changes.',
                                task.task_id,
                              )
                            }
                          />
                        </View>
                      )}
                    </View>
                  );
                })}
                {active && (
                  <View style={styles.group}>
                    {task.mode !== 'open' && (
                      <View style={styles.group}>
                        <Field
                          label="Member account ID to invite"
                          value={invitees[task.task_id] ?? ''}
                          maxLength={36}
                          autoCapitalize="none"
                          onChangeText={(value) =>
                            setInvitees((current) => ({ ...current, [task.task_id]: value }))
                          }
                        />
                        <Button
                          label="Invite member"
                          disabled={busy || !uuidPattern.test(invitees[task.task_id] ?? '')}
                          onPress={async () => {
                            const memberId = invitees[task.task_id]?.trim();
                            if (
                              await action(
                                'invite_work_task_member',
                                { p_task_id: task.task_id, p_member_id: memberId },
                                `invite:${task.task_id}:${memberId}`,
                                'Member invited.',
                                task.task_id,
                              )
                            )
                              setInvitees((current) => ({ ...current, [task.task_id]: '' }));
                          }}
                        />
                      </View>
                    )}
                    <Field
                      label="Cancellation reason (3–500 characters)"
                      value={cancelReasons[task.task_id] ?? ''}
                      maxLength={500}
                      onChangeText={(value) =>
                        setCancelReasons((current) => ({ ...current, [task.task_id]: value }))
                      }
                    />
                    <Button
                      label="Cancel task"
                      secondary
                      disabled={busy || (cancelReasons[task.task_id]?.trim().length ?? 0) < 3}
                      onPress={() =>
                        Alert.alert(
                          'Cancel this task?',
                          'Members will no longer be able to participate. The cancellation is kept in the audit trail.',
                          [
                            { text: 'Keep task', style: 'cancel' },
                            {
                              text: 'Cancel task',
                              style: 'destructive',
                              onPress: () => {
                                const reason = cancelReasons[task.task_id]?.trim();
                                action(
                                  'cancel_work_task',
                                  { p_task_id: task.task_id, p_reason: reason },
                                  `cancel:${task.task_id}:${reason}`,
                                  'Task cancelled.',
                                );
                              },
                            },
                          ],
                        )
                      }
                    />
                  </View>
                )}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

function Button({ label, onPress, disabled = false, secondary = false }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, secondary && styles.secondary, disabled && styles.disabled]}
    >
      <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{label}</Text>
    </Pressable>
  );
}

function Field({ label, value, onChangeText, ...props }) {
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} value={value} onChangeText={onChangeText} {...props} />
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
  heading: { color: '#182e2a', fontSize: 21, fontWeight: '700' },
  task: { borderTopWidth: 1, borderColor: '#d9e1d9', paddingTop: 14, gap: 9 },
  title: { color: '#182e2a', fontSize: 17, fontWeight: '700' },
  muted: { color: '#5e6e68', fontSize: 14, lineHeight: 21 },
  label: { color: '#182e2a', fontWeight: '600' },
  group: { gap: 9 },
  modes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { padding: 10, borderWidth: 1, borderColor: '#d9e1d9', borderRadius: 10 },
  selected: { backgroundColor: '#e8f3ed', borderColor: '#145b49' },
  person: { borderTopWidth: 1, borderColor: '#d9e1d9', paddingTop: 9, gap: 7 },
  input: {
    borderWidth: 1,
    borderColor: '#d9e1d9',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: '#182e2a',
  },
  button: { backgroundColor: '#145b49', padding: 13, borderRadius: 10, alignItems: 'center' },
  secondary: { backgroundColor: '#e8f3ed' },
  buttonText: { color: '#fff', fontWeight: '700' },
  secondaryText: { color: '#145b49' },
  disabled: { opacity: 0.55 },
  error: { color: '#a32b28' },
  notice: { color: '#145b49' },
});
