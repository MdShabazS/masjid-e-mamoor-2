import { colors } from "./colors";

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 28,
  section: 32,
  page: 24,
} as const;

export const radii = {
  subtle: 4,
  control: 8,
  panel: 8,
  card: 8,
  pill: 999,
} as const;

export const touchTargets = {
  minimum: 44,
  comfortable: 48,
} as const;

export const borders = {
  width: 1,
  strongWidth: 2,
  color: colors.border,
  strongColor: colors.borderStrong,
} as const;

export const typography = {
  display: { fontSize: 30, fontWeight: "700" as const, lineHeight: 36 },
  eyebrow: { fontSize: 11, fontWeight: "800" as const, letterSpacing: 0, lineHeight: 15 },
  pageTitle: { fontSize: 28, fontWeight: "700" as const, lineHeight: 34 },
  sectionTitle: { fontSize: 19, fontWeight: "700" as const, lineHeight: 25 },
  cardTitle: { fontSize: 16, fontWeight: "700" as const, lineHeight: 22 },
  body: { fontSize: 15, lineHeight: 22 },
  bodySmall: { fontSize: 13, lineHeight: 19 },
  label: { fontSize: 13, fontWeight: "700" as const, lineHeight: 18 },
  caption: { fontSize: 12, lineHeight: 17 },
  action: { fontSize: 14, fontWeight: "700" as const, lineHeight: 20 },
  metric: { fontSize: 26, fontWeight: "700" as const, lineHeight: 32 },
} as const;

export const iconSizes = {
  small: 16,
  medium: 20,
  large: 24,
  feature: 32,
} as const;

export const shadows = {
  subtle: {
    elevation: 1,
    shadowColor: colors.darkEmerald,
    shadowOffset: { height: 1, width: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  elevated: {
    elevation: 3,
    shadowColor: colors.darkEmerald,
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
} as const;
