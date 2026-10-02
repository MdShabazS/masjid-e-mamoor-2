export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  section: 32,
} as const;

export const radii = {
  control: 10,
  panel: 12,
  card: 14,
  pill: 999,
} as const;

export const touchTargets = {
  minimum: 44,
  comfortable: 48,
} as const;

export const borders = {
  width: 1,
  color: "#D9D3C6",
} as const;

export const typography = {
  eyebrow: { fontSize: 11, fontWeight: "800" as const, letterSpacing: 1.2 },
  pageTitle: { fontSize: 28, fontWeight: "700" as const },
  sectionTitle: { fontSize: 19, fontWeight: "700" as const },
  body: { fontSize: 14, lineHeight: 21 },
  label: { fontSize: 13, fontWeight: "700" as const },
  action: { fontSize: 14, fontWeight: "700" as const },
} as const;
