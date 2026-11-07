import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { userMessage } from '../../../packages/api-client/messages.js';

const pad = (value) => String(value).padStart(2, '0');

export function indiaToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

function localDate(text) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text ?? '');
  return match ? new Date(+match[1], +match[2] - 1, +match[3]) : new Date();
}

function displayDate(text) {
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(localDate(text));
}

function Control({ label, text, placeholder, onPress, onClear = undefined }) {
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${text || placeholder}`}
          onPress={onPress}
          style={[styles.control, styles.fill]}
        >
          <Text style={text ? styles.value : styles.placeholder}>{text || placeholder}</Text>
        </Pressable>
        {!!text && !!onClear && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Clear ${label}`}
            onPress={onClear}
            style={styles.control}
          >
            <Text style={styles.value}>Clear</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

/** Value is a YYYY-MM-DD string, so existing validators and RPC arguments are unchanged. */
export function DateField({
  label,
  value,
  onChange,
  min = undefined,
  max = undefined,
  optional = false,
}) {
  return (
    <Control
      label={label}
      text={value ? displayDate(value) : ''}
      placeholder="Choose date"
      onClear={optional ? () => onChange('') : undefined}
      onPress={() =>
        DateTimePickerAndroid.open({
          mode: 'date',
          value: localDate(value || min || max),
          ...(min ? { minimumDate: localDate(min) } : {}),
          ...(max ? { maximumDate: localDate(max) } : {}),
          onValueChange: (_event, picked) => {
            if (picked)
              onChange(
                `${picked.getFullYear()}-${pad(picked.getMonth() + 1)}-${pad(picked.getDate())}`,
              );
          },
        })
      }
    />
  );
}

/** Value is a 24-hour HH:mm string. */
export function TimeField({ label, value, onChange }) {
  const [hour, minute] = /^\d{2}:\d{2}$/.test(value ?? '') ? value.split(':').map(Number) : [18, 0];
  return (
    <Control
      label={label}
      text={value}
      placeholder="Choose time"
      onPress={() => {
        const initial = new Date();
        initial.setHours(hour, minute, 0, 0);
        DateTimePickerAndroid.open({
          mode: 'time',
          is24Hour: true,
          value: initial,
          onValueChange: (_event, picked) => {
            if (picked) onChange(`${pad(picked.getHours())}:${pad(picked.getMinutes())}`);
          },
        });
      }}
    />
  );
}

/** Value is the first day of a month, YYYY-MM-01, as monthly claims require. */
export function MonthField({ label, value, onChange }) {
  const current = value || `${indiaToday().slice(0, 7)}-01`;
  const [year, month] = current.split('-').map(Number);
  const shift = (by) => {
    const next = new Date(year, month - 1 + by, 1);
    onChange(`${next.getFullYear()}-${pad(next.getMonth() + 1)}-01`);
  };
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          onPress={() => shift(-1)}
          style={styles.control}
        >
          <Text style={styles.value}>‹</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Use ${current}`}
          onPress={() => onChange(current)}
          style={[styles.control, styles.fill, !!value && styles.selected]}
        >
          <Text style={value ? styles.value : styles.placeholder}>
            {new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(
              new Date(year, month - 1, 1),
            )}
            {value ? '' : ' (tap to confirm)'}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          onPress={() => shift(1)}
          style={styles.control}
        >
          <Text style={styles.value}>›</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Loads the directory only when opened. Value is the chosen member's account ID. */
export function MemberPicker({
  client,
  label,
  value,
  onChange,
  excludeSelf = false,
  placeholder = 'Choose member',
}) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const chosen = members?.find((member) => member.member_id === value);

  async function toggle() {
    setOpen(!open);
    if (open || members) return;
    setError('');
    const { data, error: failure } = await client.rpc('list_active_members');
    if (failure) setError(userMessage(failure, 'Could not load members.'));
    else setMembers(data ?? []);
  }

  const shown = (members ?? [])
    .filter((member) => !(excludeSelf && member.is_self))
    .filter((member) => member.username.includes(query.trim().toLowerCase()))
    .slice(0, 30);

  return (
    <View style={styles.group}>
      <Control
        label={label}
        text={chosen ? `${chosen.username} · ${chosen.role.replaceAll('_', ' ')}` : ''}
        placeholder={placeholder}
        onPress={toggle}
        onClear={value ? () => onChange('') : undefined}
      />
      {open && (
        <View style={styles.list}>
          {!!error && (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          )}
          {!members && !error && <Text style={styles.placeholder}>Loading members…</Text>}
          {!!members && (
            <TextInput
              style={styles.search}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              placeholder="Search username"
              placeholderTextColor="#5e6e68"
              accessibilityLabel="Search username"
            />
          )}
          {!!members && shown.length === 0 && (
            <Text style={styles.placeholder}>No matching members.</Text>
          )}
          {shown.map((member) => (
            <Pressable
              key={member.member_id}
              accessibilityRole="radio"
              accessibilityState={{ selected: member.member_id === value }}
              onPress={() => {
                onChange(member.member_id);
                setOpen(false);
                setQuery('');
              }}
              style={[styles.control, member.member_id === value && styles.selected]}
            >
              <Text style={styles.value}>{member.username}</Text>
              <Text style={styles.placeholder}>{member.role.replaceAll('_', ' ')}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 6 },
  row: { flexDirection: 'row', gap: 8 },
  fill: { flex: 1 },
  label: { color: '#182e2a', fontWeight: '600', fontSize: 14 },
  control: {
    borderWidth: 1,
    borderColor: '#d9e1d9',
    borderRadius: 10,
    padding: 13,
    minHeight: 48,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  selected: { backgroundColor: '#e8f3ed', borderColor: '#145b49' },
  value: { color: '#182e2a', fontSize: 16 },
  placeholder: { color: '#5e6e68', fontSize: 14 },
  list: { gap: 8 },
  search: {
    borderWidth: 1,
    borderColor: '#d9e1d9',
    borderRadius: 10,
    padding: 13,
    fontSize: 16,
    color: '#182e2a',
  },
  error: { color: '#a32b28' },
});
