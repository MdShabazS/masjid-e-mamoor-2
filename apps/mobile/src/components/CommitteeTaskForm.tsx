import { Pressable, StyleSheet, Text, View } from "react-native";
import { FormTextInput } from "./Screen";
import { colors } from "../theme/colors";
import { spacing, touchTargets } from "../theme/tokens";
import type {
  CommitteeAssigneeOption,
  CommitteeTaskDraft,
  CommitteeTaskPriority,
} from "../modules/work";
import {
  shouldShowAssigneeRole,
  taskPriorityLabels,
} from "../modules/work-presentation";
import {
  formatIsoDateInput,
  isoDateInputError,
} from "../lib/date-input";


export function CommitteeTaskForm({
  draft,
  options,
  pending,
  submitLabel,
  onChange,
  onSubmit,
}: {
  draft: CommitteeTaskDraft;
  options: CommitteeAssigneeOption[];
  pending: boolean;
  submitLabel: string;
  onChange: (draft: CommitteeTaskDraft) => void;
  onSubmit: () => void;
}) {
  const set = <K extends keyof CommitteeTaskDraft>(
    key: K,
    value: CommitteeTaskDraft[K],
  ) => onChange({ ...draft, [key]: value });

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
      <Field label="Title">
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
        {(["low", "normal", "high"] as CommitteeTaskPriority[]).map(
          (priority) => (
            <Pressable
              key={priority}
              accessibilityRole="button"
              accessibilityState={{ selected: draft.priority === priority }}
              onPress={() => set("priority", priority)}
              style={[
                styles.segment,
                draft.priority === priority && styles.segmentSelected,
              ]}
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
          ),
        )}
      </View>

      <Field label="Due date (optional)">
        <FormTextInput
          autoCapitalize="none"
          keyboardType="number-pad"
          maxLength={10}
          onChangeText={(value) =>
            set("dueDate", formatIsoDateInput(value, draft.dueDate))
          }
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

      <Text style={styles.label}>Assignees</Text>
      <Text style={styles.help}>Select one or more eligible active users.</Text>
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
              {shouldShowAssigneeRole(
                option.displayName,
                option.roleLabel,
              ) ? (
                <Text style={styles.optionRole}>{option.roleLabel}</Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}

      <Pressable
        disabled={pending || Boolean(dueDateError)}
        onPress={onSubmit}
        style={[
          styles.submit,
          (pending || Boolean(dueDateError)) && styles.disabled,
        ]}
      >
        <Text style={styles.submitText}>
          {pending ? "Saving..." : submitLabel}
        </Text>
      </Pressable>
    </>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginTop: spacing.xl },
  label: { color: colors.text, fontSize: 13, fontWeight: "700", marginTop: spacing.xl },
  help: { color: colors.secondary, fontSize: 13, lineHeight: 19, marginTop: spacing.sm },
  input: { backgroundColor: colors.surface, borderColor: "#D9D3C6", borderRadius: 10, borderWidth: 1, color: colors.text, fontSize: 16, marginTop: spacing.sm, minHeight: touchTargets.comfortable, paddingHorizontal: 14, paddingVertical: 12 },
  multiline: { minHeight: 112 },
  fieldError: { color: colors.danger, fontSize: 12, marginTop: spacing.sm },
  segmentRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  segment: { alignItems: "center", backgroundColor: colors.surface, borderColor: "#D9D3C6", borderRadius: 10, borderWidth: 1, flex: 1, minHeight: touchTargets.minimum, justifyContent: "center" },
  segmentSelected: { backgroundColor: colors.deepEmerald, borderColor: colors.deepEmerald },
  segmentText: { color: colors.secondary, fontSize: 13, fontWeight: "700" },
  segmentTextSelected: { color: colors.surface },
  option: { alignItems: "center", backgroundColor: colors.surface, borderColor: "#D9D3C6", borderRadius: 10, borderWidth: 1, flexDirection: "row", marginTop: spacing.sm, minHeight: 56, padding: spacing.md },
  optionSelected: { borderColor: colors.deepEmerald },
  checkbox: { alignItems: "center", borderColor: colors.sage, borderRadius: 4, borderWidth: 1, height: 22, justifyContent: "center", width: 22 },
  checkboxSelected: { backgroundColor: colors.deepEmerald, borderColor: colors.deepEmerald },
  checkmark: { color: colors.surface, fontSize: 14, fontWeight: "800" },
  optionCopy: { flex: 1, marginLeft: spacing.md },
  optionName: { color: colors.text, fontSize: 15, fontWeight: "700" },
  optionRole: { color: colors.secondary, fontSize: 12, marginTop: 3 },
  submit: { alignItems: "center", backgroundColor: colors.deepEmerald, borderRadius: 10, justifyContent: "center", marginTop: spacing.section, minHeight: touchTargets.comfortable },
  submitText: { color: colors.surface, fontSize: 14, fontWeight: "700" },
  disabled: { opacity: 0.55 },
});
