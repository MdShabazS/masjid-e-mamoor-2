import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
  type StyleProp,
} from "react-native";

import { colors } from "../theme/colors";
import {
  borders,
  iconSizes,
  radii,
  shadows,
  spacing,
  touchTargets,
  typography,
} from "../theme/tokens";

type SemanticTone = "neutral" | "success" | "warning" | "danger" | "info";

const toneStyles: Record<SemanticTone, { backgroundColor: string; color: string }> = {
  neutral: { backgroundColor: colors.surfaceMuted, color: colors.secondary },
  success: { backgroundColor: colors.successSurface, color: colors.success },
  warning: { backgroundColor: colors.warningSurface, color: colors.warning },
  danger: { backgroundColor: colors.dangerSurface, color: colors.danger },
  info: { backgroundColor: colors.infoSurface, color: colors.info },
};

export function BrandedPageHeader({
  action,
  description,
  eyebrow,
  title,
}: {
  action?: ReactNode;
  description?: string;
  eyebrow?: string;
  title: string;
}) {
  return (
    <View style={styles.pageHeader}>
      <View style={styles.headerCopy}>
        {eyebrow ? (
          <View style={styles.eyebrowRow}>
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={styles.brandMark}
            />
            <Text style={styles.eyebrow}>{eyebrow}</Text>
          </View>
        ) : null}
        <Text accessibilityRole="header" style={styles.pageTitle}>
          {title}
        </Text>
        {description ? <Text style={styles.pageDescription}>{description}</Text> : null}
      </View>
      {action ? <View style={styles.headerAction}>{action}</View> : null}
    </View>
  );
}

export function SectionHeader({
  action,
  description,
  title,
}: {
  action?: ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.headerCopy}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          {title}
        </Text>
        {description ? <Text style={styles.sectionDescription}>{description}</Text> : null}
      </View>
      {action ? <View style={styles.headerAction}>{action}</View> : null}
    </View>
  );
}

export function InformationCard({
  children,
  emphasis = false,
  style,
}: {
  children: ReactNode;
  emphasis?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, emphasis && styles.cardEmphasis, style]}>{children}</View>;
}

export function MetricCard({
  helper,
  label,
  style,
  tone = "neutral",
  value,
}: {
  helper?: string;
  label: string;
  style?: StyleProp<ViewStyle>;
  tone?: SemanticTone;
  value: string | number;
}) {
  const palette = toneStyles[tone];

  return (
    <View style={[styles.metricCard, style]}>
      <View style={[styles.metricIndicator, { backgroundColor: palette.color }]} />
      <Text style={styles.metricLabel}>{label}</Text>
      <Text
        style={[
          styles.metricValue,
          { color: tone === "neutral" ? colors.textStrong : palette.color },
        ]}
      >
        {value}
      </Text>
      {helper ? <Text style={styles.metricHelper}>{helper}</Text> : null}
    </View>
  );
}

export function StatusChip({ label, tone = "neutral" }: { label: string; tone?: SemanticTone }) {
  const palette = toneStyles[tone];

  return (
    <View
      accessibilityLabel={`Status: ${label}`}
      style={[styles.statusChip, { backgroundColor: palette.backgroundColor }]}
    >
      <View style={[styles.statusDot, { backgroundColor: palette.color }]} />
      <Text style={[styles.statusText, { color: palette.color }]}>{label}</Text>
    </View>
  );
}

export function AppButton({
  disabled = false,
  icon,
  label,
  loading = false,
  onPress,
  variant = "primary",
}: {
  disabled?: boolean;
  icon?: ReactNode;
  label: string;
  loading?: boolean;
  onPress: NonNullable<PressableProps["onPress"]>;
  variant?: "primary" | "secondary";
}) {
  const unavailable = disabled || loading;
  const primary = variant === "primary";

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: unavailable }}
      disabled={unavailable}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary ? styles.primaryButton : styles.secondaryButton,
        pressed && !unavailable && styles.buttonPressed,
        unavailable && styles.buttonDisabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={primary ? colors.surface : colors.deepEmerald} size="small" />
      ) : (
        <>
          {icon ? <View style={styles.buttonIcon}>{icon}</View> : null}
          <Text style={primary ? styles.primaryButtonText : styles.secondaryButtonText}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

export function ListRow({
  leading,
  meta,
  onPress,
  subtitle,
  title,
  trailing,
}: {
  leading?: ReactNode;
  meta?: string;
  onPress?: PressableProps["onPress"];
  subtitle?: string;
  title: string;
  trailing?: ReactNode;
}) {
  const content = (
    <>
      {leading ? <View style={styles.listLeading}>{leading}</View> : null}
      <View style={styles.listCopy}>
        <Text style={styles.listTitle}>{title}</Text>
        {subtitle ? <Text style={styles.listSubtitle}>{subtitle}</Text> : null}
        {meta ? <Text style={styles.listMeta}>{meta}</Text> : null}
      </View>
      {trailing ?? (onPress ? <Text style={styles.chevron}>›</Text> : null)}
    </>
  );

  if (!onPress) return <View style={styles.listRow}>{content}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.listRow, pressed && styles.listRowPressed]}
    >
      {content}
    </Pressable>
  );
}

export function EmptyState({
  action,
  description,
  title,
}: {
  action?: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <View style={styles.feedbackState}>
      <View style={styles.emptyMark} />
      <Text accessibilityRole="header" style={styles.feedbackTitle}>
        {title}
      </Text>
      <Text style={styles.feedbackDescription}>{description}</Text>
      {action ? <View style={styles.feedbackAction}>{action}</View> : null}
    </View>
  );
}

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <View
      accessibilityLabel={label}
      accessibilityRole="progressbar"
      accessible
      style={styles.loadingState}
    >
      <ActivityIndicator color={colors.deepEmerald} />
      <Text style={styles.loadingLabel}>{label}</Text>
    </View>
  );
}

export function ErrorState({
  action,
  description,
  title = "Something went wrong",
}: {
  action?: ReactNode;
  description: string;
  title?: string;
}) {
  return (
    <View style={[styles.feedbackState, styles.errorState]}>
      <View accessibilityLabel={`${title}. ${description}`} accessibilityRole="alert" accessible>
        <Text style={[styles.feedbackTitle, styles.errorTitle]}>{title}</Text>
        <Text style={styles.feedbackDescription}>{description}</Text>
      </View>
      {action ? <View style={styles.feedbackAction}>{action}</View> : null}
    </View>
  );
}

export function Divider() {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.divider}
    />
  );
}

const styles = StyleSheet.create({
  pageHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.lg,
    justifyContent: "space-between",
  },
  headerCopy: { flex: 1 },
  eyebrowRow: { alignItems: "center", flexDirection: "row", gap: spacing.sm },
  brandMark: {
    backgroundColor: colors.gold,
    borderRadius: radii.subtle,
    height: 10,
    transform: [{ rotate: "45deg" }],
    width: 10,
  },
  eyebrow: { color: colors.deepEmerald, textTransform: "uppercase", ...typography.eyebrow },
  pageTitle: { color: colors.textStrong, marginTop: spacing.sm, ...typography.pageTitle },
  pageDescription: { color: colors.secondary, marginTop: spacing.sm, ...typography.body },
  headerAction: { flexShrink: 0 },
  sectionHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  sectionTitle: { color: colors.text, ...typography.sectionTitle },
  sectionDescription: { color: colors.secondary, marginTop: spacing.xs, ...typography.bodySmall },
  card: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: borders.width,
    padding: spacing.lg,
    ...shadows.subtle,
  },
  cardEmphasis: { borderLeftColor: colors.gold, borderLeftWidth: 3 },
  metricCard: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: borders.width,
    minHeight: 128,
    padding: spacing.lg,
    position: "relative",
  },
  metricIndicator: { height: 3, left: spacing.lg, position: "absolute", top: 0, width: 32 },
  metricLabel: { color: colors.secondary, ...typography.label },
  metricValue: { marginTop: spacing.sm, ...typography.metric },
  metricHelper: { color: colors.textMuted, marginTop: spacing.xs, ...typography.caption },
  statusChip: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 28,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  statusDot: { borderRadius: 3, height: 6, width: 6 },
  statusText: { ...typography.label },
  button: {
    alignItems: "center",
    borderRadius: radii.control,
    flexDirection: "row",
    justifyContent: "center",
    minHeight: touchTargets.comfortable,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  primaryButton: {
    backgroundColor: colors.deepEmerald,
    borderColor: colors.deepEmerald,
    borderWidth: 1,
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderColor: colors.deepEmerald,
    borderWidth: 1,
  },
  primaryButtonText: { color: colors.surface, ...typography.action },
  secondaryButtonText: { color: colors.deepEmerald, ...typography.action },
  buttonIcon: { marginRight: spacing.sm },
  buttonPressed: { opacity: 0.82 },
  buttonDisabled: { opacity: 0.55 },
  listRow: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: borders.width,
    flexDirection: "row",
    minHeight: 64,
    paddingVertical: spacing.md,
  },
  listRowPressed: { backgroundColor: colors.surfaceMuted },
  listLeading: {
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
    minWidth: iconSizes.large,
  },
  listCopy: { flex: 1 },
  listTitle: { color: colors.text, ...typography.cardTitle },
  listSubtitle: { color: colors.secondary, marginTop: spacing.xs, ...typography.bodySmall },
  listMeta: { color: colors.textMuted, marginTop: spacing.xs, ...typography.caption },
  chevron: { color: colors.gold, fontSize: 26, lineHeight: 28, marginLeft: spacing.md },
  feedbackState: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: borders.width,
    padding: spacing.xxl,
  },
  emptyMark: {
    borderColor: colors.gold,
    borderRadius: radii.subtle,
    borderWidth: 2,
    height: iconSizes.large,
    marginBottom: spacing.lg,
    transform: [{ rotate: "45deg" }],
    width: iconSizes.large,
  },
  feedbackTitle: { color: colors.text, textAlign: "center", ...typography.sectionTitle },
  feedbackDescription: {
    color: colors.secondary,
    marginTop: spacing.sm,
    maxWidth: 360,
    textAlign: "center",
    ...typography.body,
  },
  feedbackAction: { marginTop: spacing.xl, minWidth: 160 },
  errorState: { backgroundColor: colors.dangerSurface, borderColor: colors.danger },
  errorTitle: { color: colors.danger },
  loadingState: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "center",
    minHeight: 96,
    padding: spacing.xl,
  },
  loadingLabel: { color: colors.secondary, ...typography.body },
  divider: { backgroundColor: colors.border, height: borders.width, width: "100%" },
});
