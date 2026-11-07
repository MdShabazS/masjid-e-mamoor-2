import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { monthReport, yearReport } from '../../../packages/api-client/report-period.js';
import { userMessage } from '../../../packages/api-client/messages.js';
import { MemberPicker, MonthField, indiaToday } from './Pickers';

function Choice({ label, selected, onPress }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.choice, selected && styles.selected]}
    >
      <Text style={selected ? styles.selectedText : styles.choiceText}>{label}</Text>
    </Pressable>
  );
}

function Line({ label, points, detail }) {
  return (
    <View style={styles.line}>
      <View style={styles.fill}>
        <Text style={styles.body}>{label}</Text>
        <Text style={styles.muted}>{detail}</Text>
      </View>
      <Text style={styles.points}>{points}</Text>
    </View>
  );
}

/** One member's Activity points for a month or year. There is deliberately no ranking. */
export default function ActivityPoints({ client, actorId, role }) {
  const [memberId, setMemberId] = useState(role === 'system_admin' ? '' : actorId);
  const [kind, setKind] = useState('month');
  const [month, setMonth] = useState(`${indiaToday().slice(0, 7)}-01`);
  const [year, setYear] = useState(Number(indiaToday().slice(0, 4)));
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setResult(null);
    setError('');
    if (!memberId) return;
    const period = kind === 'month' ? monthReport(month) : yearReport(year);
    const { data, error: failure } = await client.rpc('member_activity', {
      p_member_id: memberId,
      p_start: period.p_start,
      p_end_exclusive: period.p_end_exclusive,
    });
    if (failure) throw failure;
    setResult(data?.[0] ?? null);
  }, [client, memberId, kind, month, year]);

  useEffect(() => {
    load().catch((cause) => setError(userMessage(cause, 'Could not load activity points.')));
  }, [load]);

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Activity points</Text>
      <Text style={styles.muted}>
        A count of verified work, attended meetings and referred monthly support. It is not a
        measure of anyone’s faith or worth.
      </Text>
      <MemberPicker
        client={client}
        label="Member"
        placeholder={memberId === actorId ? 'You (tap to choose someone else)' : 'Choose member'}
        value={memberId === actorId ? '' : memberId}
        onChange={(value) => setMemberId(value || (role === 'system_admin' ? '' : actorId))}
      />
      <View style={styles.row}>
        <Choice label="Month" selected={kind === 'month'} onPress={() => setKind('month')} />
        <Choice label="Year" selected={kind === 'year'} onPress={() => setKind('year')} />
      </View>
      {kind === 'month' ? (
        <MonthField label="Month" value={month} onChange={setMonth} />
      ) : (
        <View style={styles.row}>
          <Choice label="‹" selected={false} onPress={() => setYear(year - 1)} />
          <Text style={[styles.fill, styles.year]}>{year}</Text>
          <Choice label="›" selected={false} onPress={() => setYear(year + 1)} />
        </View>
      )}
      {!memberId && <Text style={styles.muted}>Choose a member to see their points.</Text>}
      {!!error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      {result && (
        <View style={styles.group}>
          <Text style={styles.title}>
            {result.username} · {result.role.replaceAll('_', ' ')}
          </Text>
          <Line
            label="Tasks"
            points={result.task_points}
            detail={`${result.task_points} completed and accepted · ${result.tasks_joined} joined`}
          />
          <Line
            label="Meetings"
            points={result.meeting_points}
            detail={`${result.meeting_points} attended of ${result.meetings_finalized} finalized · ${result.meetings_declined} declined · ${result.meetings_absent} absent`}
          />
          <Line
            label="Referrals"
            points={result.referral_points}
            detail={`${result.referral_points} paid months of ${result.referral_months_requested} requested from referred donors`}
          />
          <View style={[styles.line, styles.total]}>
            <Text style={[styles.fill, styles.title]}>Total activity points</Text>
            <Text style={styles.points}>{result.activity_points}</Text>
          </View>
          <Text style={styles.muted}>
            Tasks + meetings + referrals. Only finalized meetings count, and a voided payment or
            cancelled task removes its point.
          </Text>
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
  heading: { fontSize: 21, fontWeight: '700', color: '#182e2a' },
  title: { fontSize: 16, fontWeight: '700', color: '#182e2a' },
  body: { color: '#182e2a', fontWeight: '600', fontSize: 15 },
  muted: { color: '#5e6e68', fontSize: 14, lineHeight: 21 },
  group: { gap: 10 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  fill: { flex: 1 },
  year: { textAlign: 'center', fontSize: 18, fontWeight: '700', color: '#182e2a' },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  total: { borderTopWidth: 1, borderTopColor: '#d9e1d9', paddingTop: 10 },
  points: { fontSize: 22, fontWeight: '800', color: '#145b49', minWidth: 36, textAlign: 'right' },
  choice: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#d9e1d9',
    borderRadius: 10,
  },
  selected: { backgroundColor: '#e8f3ed', borderColor: '#145b49' },
  choiceText: { color: '#182e2a' },
  selectedText: { color: '#145b49', fontWeight: '700' },
  error: { color: '#a32b28' },
});
