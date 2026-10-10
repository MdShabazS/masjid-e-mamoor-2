import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppButton, Divider, SectionHeader } from "./InstitutionalUI";
import { FormTextInput } from "./Screen";
import { colors } from "../theme/colors";
import { borders, radii, spacing, touchTargets, typography } from "../theme/tokens";
import type {
  CommitteeAssigneeOption,
  CommitteeTaskDraft,
  CommitteeTaskPriority,
} from "../modules/work";
import { shouldShowAssigneeRole, taskPriorityLabels } from "../modules/work-presentation";
import { formatIsoDateInput, isoDateInputError } from "../lib/date-input";

export function CommitteeTaskForm({
  draft,
  options,
  pending,
  showAssignees = true,
  submitLabel,
  onChange,
  onSubmit,
}: {
  draft: CommitteeTaskDraft;
  options: CommitteeAssigneeOption[];
  pending: boolean;
  showAssignees?: boolean;
  submitLabel: string;
  onChange: (draft: CommitteeTaskDraft) => void;
  onSubmit: () => void;
}) {
  const set = <K extends keyof CommitteeTaskDraft>(key: K, value: CommitteeTaskDraft[K]) =>
    onChange({ ...draft, [key]: value });

  const dueDateError = isoDateInputError(draft.dueDate);

  const toggleAssignee = (applicationUserId: string) => {
    set(
      "assigneeIds",
      draft.assigneeIds.includes(applicationUserId)
        ? draft.assigneeIds.filter((id) => id !== applicationUserId)
        : [...draft.assigneeIds, applicationUserId],
    );
  };

  return (
    <>
      <SectionHeader
        description="Clear information helps assigned volunteers act confidently."
        title="Task definition"
      />

      <Field label="Title" required>
        <FormTextInput
          maxLength={200}
          onChangeText={(value) => set("title", value)}
          placeholder="Task title"
          placeholderTextColor="#93A099"
          style={styles.input}
          value={draft.title}
        />
      </Field>

      <Field label="Description">
        <FormTextInput
          maxLength={5000}
          multiline
          onChangeText={(value) => set("description", value)}
          placeholder="What needs to be done?"
          placeholderTextColor="#93A099"
          style={[styles.input, styles.multiline]}
          textAlignVertical="top"
          value={draft.description}
        />
      </Field>

      <Text style={styles.label}>Priority</Text>
      <View style={styles.segmentRow}>
        {(["low", "normal", "high"] as CommitteeTaskPriority[]).map((priority) => (
          <Pressable
            key={priority}
            accessibilityRole="button"
            accessibilityState={{ selected: draft.priority === priority }}
            onPress={() => set("priority", priority)}
            style={[styles.segment, draft.priority === priority && styles.segmentSelected]}
          >
            <Text
              style={[
                styles.segmentText,
                draft.priority === priority && styles.segmentTextSelected,
              ]}
            >
              {taskPriorityLabels[priority]}
            </Text>
          </Pressable>
        ))}
      </View>

      <Field label="Due date (optional)">
        <FormTextInput
          autoCapitalize="none"
          keyboardType="number-pad"
          maxLength={10}
          onChangeText={(value) => set("dueDate", formatIsoDateInput(value, draft.dueDate))}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#93A099"
          style={styles.input}
          value={draft.dueDate}
        />
        {dueDateError ? (
          <Text accessibilityRole="alert" style={styles.fieldError}>
            {dueDateError}
          </Text>
        ) : null}
      </Field>

      {showAssignees ? (
        <View style={styles.assignmentSection}>
          <Divider />
          <SectionHeader
            description="Select one or more eligible active users."
            title="Assignment"
          />
          {options.map((option) => {
            const selected = draft.assigneeIds.includes(option.applicationUserId);
            return (
              <Pressable
                key={option.applicationUserId}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                onPress={() => toggleAssignee(option.applicationUserId)}
                style={[styles.option, selected && styles.optionSelected]}
              >
                <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                  <Text style={styles.checkmark}>{selected ? "✓" : ""}</Text>
                </View>
                <View style={styles.optionCopy}>
                  <Text style={styles.optionName}>{option.displayName}</Text>
                  {shouldShowAssigneeRole(option.displayName, option.roleLabel) ? (
                    <Text style={styles.optionRole}>{option.roleLabel}</Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View style={styles.submit}>
        <AppButton
          disabled={Boolean(dueDateError)}
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
  label: { color: colors.text, marginTop: spacing.xl, ...typography.label },
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
  fieldError: { color: colors.danger, marginTop: spacing.sm, ...typography.caption },
  segmentRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  segment: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.control,
    borderWidth: borders.width,
    flex: 1,
    minHeight: touchTargets.comfortable,
    justifyContent: "center",
  },
  segmentSelected: { backgroundColor: colors.deepEmerald, borderColor: colors.deepEmerald },
  segmentText: { color: colors.secondary, ...typography.label },
  segmentTextSelected: { color: colors.surface },
  assignmentSection: { gap: spacing.md, marginTop: spacing.section },
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
    borderRadius: 4,
    borderWidth: 1,
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
