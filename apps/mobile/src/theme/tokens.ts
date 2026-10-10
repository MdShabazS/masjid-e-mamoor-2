import { Platform } from "react-native";

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
  subtle: 6,
  control: 12,
  panel: 16,
  card: 18,
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

const systemSans = Platform.select({ android: "sans-serif", default: "System" });

export const typography = {
  display: { fontFamily: systemSans, fontSize: 30, fontWeight: "700" as const, lineHeight: 36 },
  eyebrow: { fontFamily: systemSans, fontSize: 11, fontWeight: "800" as const, letterSpacing: 0, lineHeight: 15 },
  pageTitle: { fontFamily: systemSans, fontSize: 28, fontWeight: "700" as const, lineHeight: 34 },
  sectionTitle: { fontFamily: systemSans, fontSize: 19, fontWeight: "700" as const, lineHeight: 25 },
  cardTitle: { fontFamily: systemSans, fontSize: 16, fontWeight: "700" as const, lineHeight: 22 },
  body: { fontFamily: systemSans, fontSize: 15, lineHeight: 22 },
  bodySmall: { fontFamily: systemSans, fontSize: 13, lineHeight: 19 },
  label: { fontFamily: systemSans, fontSize: 13, fontWeight: "700" as const, lineHeight: 18 },
  caption: { fontFamily: systemSans, fontSize: 12, lineHeight: 17 },
  action: { fontFamily: systemSans, fontSize: 14, fontWeight: "700" as const, lineHeight: 20 },
  metric: { fontFamily: systemSans, fontSize: 26, fontWeight: "700" as const, lineHeight: 32 },
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
