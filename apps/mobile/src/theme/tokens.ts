import { colors } from "./colors";

export const fontFamilies = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
} as const;

export const spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 28, section: 32, page: 20,
} as const;

export const radii = { subtle: 6, control: 12, panel: 16, card: 18, pill: 999 } as const;
export const touchTargets = { minimum: 44, comfortable: 48 } as const;
export const borders = { width: 1, strongWidth: 1, color: colors.border, strongColor: colors.borderStrong } as const;

export const typography = {
  display: { fontFamily: fontFamilies.bold, fontSize: 30, lineHeight: 37 },
  eyebrow: { fontFamily: fontFamilies.bold, fontSize: 11, letterSpacing: 0, lineHeight: 15 },
  pageTitle: { fontFamily: fontFamilies.bold, fontSize: 28, lineHeight: 35 },
  sectionTitle: { fontFamily: fontFamilies.semibold, fontSize: 19, lineHeight: 25 },
  cardTitle: { fontFamily: fontFamilies.semibold, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: fontFamilies.regular, fontSize: 15, lineHeight: 22 },
  bodySmall: { fontFamily: fontFamilies.regular, fontSize: 13, lineHeight: 19 },
  label: { fontFamily: fontFamilies.semibold, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fontFamilies.regular, fontSize: 12, lineHeight: 17 },
  action: { fontFamily: fontFamilies.semibold, fontSize: 14, lineHeight: 20 },
  metric: { fontFamily: fontFamilies.bold, fontSize: 26, lineHeight: 32 },
} as const;

export const iconSizes = { small: 16, medium: 20, large: 24, feature: 32 } as const;
export const shadows = {
  subtle: { elevation: 1, shadowColor: colors.textStrong, shadowOffset: { height: 1, width: 0 }, shadowOpacity: 0.05, shadowRadius: 4 },
  elevated: { elevation: 3, shadowColor: colors.textStrong, shadowOffset: { height: 3, width: 0 }, shadowOpacity: 0.08, shadowRadius: 8 },
} as const;
