import { Pressable, StyleSheet, Text, View } from "react-native";

import type { CommitteeMeetingDraft, CommitteeMeetingParticipantOption } from "../modules/meetings";
import { isValidMeetingDraft } from "../modules/meeting-presentation";
import { colors } from "../theme/colors";
import { borders, radii, spacing, touchTargets, typography } from "../theme/tokens";
import { AppButton, Divider, SectionHeader } from "./InstitutionalUI";
import { FormTextInput } from "./Screen";

export function CommitteeMeetingForm({
  draft,
  onChange,
  onSubmit,
  options,
  pending,
  submitLabel,
}: {
  draft: CommitteeMeetingDraft;
  onChange: (draft: CommitteeMeetingDraft) => void;
  onSubmit: () => void;
  options: CommitteeMeetingParticipantOption[];
  pending: boolean;
  submitLabel: string;
}) {
  const set = <K extends keyof CommitteeMeetingDraft>(key: K, value: CommitteeMeetingDraft[K]) =>
    onChange({ ...draft, [key]: value });

  const toggleParticipant = (applicationUserId: string) => {
    set(
      "participantIds",
      draft.participantIds.includes(applicationUserId)
        ? draft.participantIds.filter((id) => id !== applicationUserId)
        : [...draft.participantIds, applicationUserId],
    );
  };

  return (
    <>
      <SectionHeader
        description="Define the schedule and operational purpose clearly."
        title="Meeting details"
      />
      <Field label="Title" required>
        <FormTextInput
          maxLength={200}
          onChangeText={(value) => set("title", value)}
          placeholder="Meeting title"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          value={draft.title}
        />
      </Field>
      <Field label="Meeting type" required>
        <FormTextInput
          maxLength={100}
          onChangeText={(value) => set("meetingType", value)}
          placeholder="General, finance, planning..."
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          value={draft.meetingType}
        />
      </Field>
      <Field label="Agenda / details">
        <FormTextInput
          maxLength={5000}
          multiline
          onChangeText={(value) => set("details", value)}
          placeholder="Purpose, agenda, and preparation notes"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, styles.multiline]}
          textAlignVertical="top"
          value={draft.details}
        />
      </Field>
      <Field label="Location">
        <FormTextInput
          maxLength={300}
          onChangeText={(value) => set("location", value)}
          placeholder="Location (optional)"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          value={draft.location}
        />
      </Field>
      <Field label="Starts" required>
        <FormTextInput
          autoCapitalize="none"
          onChangeText={(value) => set("scheduledStart", value)}
          placeholder="2026-10-20T13:00:00+05:30"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          value={draft.scheduledStart}
        />
      </Field>
      <Field label="Ends">
        <FormTextInput
          autoCapitalize="none"
          onChangeText={(value) => set("scheduledEnd", value)}
          placeholder="Optional ISO date and time"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          value={draft.scheduledEnd}
        />
      </Field>

      <View style={styles.participantSection}>
        <Divider />
        <SectionHeader
          description="Select the authorized participants for this meeting."
          title="Participants"
        />
        {options.map((option) => {
          const selected = draft.participantIds.includes(option.applicationUserId);
          return (
            <Pressable
              key={option.applicationUserId}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              onPress={() => toggleParticipant(option.applicationUserId)}
              style={[styles.option, selected && styles.optionSelected]}
            >
              <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                <Text style={styles.checkmark}>{selected ? "✓" : ""}</Text>
              </View>
              <View style={styles.optionCopy}>
                <Text style={styles.optionName}>{option.displayName}</Text>
                <Text style={styles.optionRole}>{option.roleLabel}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.submit}>
        <AppButton
          disabled={!isValidMeetingDraft(draft)}
          label={submitLabel}
          loading={pending}
          onPress={onSubmit}
        />
      </View>
    </>
  );
}

function Field({
  children,
  label,
  required = false,
}: {
  children: React.ReactNode;
  label: string;
  required?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        {required ? " *" : ""}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginTop: spacing.xl },
  label: { color: colors.text, ...typography.label },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.control,
    borderWidth: borders.width,
    color: colors.text,
    fontSize: 16,
    marginTop: spacing.sm,
    minHeight: touchTargets.comfortable,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  multiline: { minHeight: 112 },
  participantSection: { gap: spacing.md, marginTop: spacing.section },
  option: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radii.control,
    borderWidth: borders.width,
    flexDirection: "row",
    minHeight: 60,
    padding: spacing.md,
  },
  optionSelected: { backgroundColor: colors.successSurface, borderColor: colors.deepEmerald },
  checkbox: {
    alignItems: "center",
    borderColor: colors.sage,
    borderRadius: radii.subtle,
    borderWidth: borders.width,
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  checkboxSelected: { backgroundColor: colors.deepEmerald, borderColor: colors.deepEmerald },
  checkmark: { color: colors.surface, fontSize: 14, fontWeight: "800" },
  optionCopy: { flex: 1, marginLeft: spacing.md },
  optionName: { color: colors.text, ...typography.cardTitle },
  optionRole: { color: colors.secondary, marginTop: spacing.xs, ...typography.caption },
  submit: { marginTop: spacing.section },
});
