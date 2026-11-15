import type { ColorValue } from "react-native";

import { AppIcon, type AppIconName } from "./AppIcon";

type TabIconName = "home" | "community" | "work" | "meetings" | "donations" | "finance" | "accounts" | "notifications" | "profile" | "more";

const iconNames: Record<TabIconName, AppIconName> = {
  home: "home-outline",
  community: "account-group-outline",
  work: "clipboard-check-outline",
  meetings: "calendar-month-outline",
  donations: "hand-heart-outline",
  finance: "bank-outline",
  accounts: "account-cog-outline",
  notifications: "bell-outline",
  profile: "account-circle-outline",
  more: "dots-horizontal-circle-outline",
};

export function TabIcon({ color, name, size = 24 }: { color: ColorValue; name: TabIconName; size?: number }) {
  return <AppIcon color={color} name={iconNames[name]} size={size} />;
}
