import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { ComponentProps } from "react";
import type { ColorValue } from "react-native";

import { colors } from "../theme/colors";
import { iconSizes } from "../theme/tokens";

export type AppIconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

export function AppIcon({ accessibilityLabel, color = colors.textMuted, name, size = iconSizes.medium }: {
  accessibilityLabel?: string;
  color?: ColorValue;
  name: AppIconName;
  size?: number;
}) {
  return (
    <MaterialCommunityIcons
      accessibilityElementsHidden={!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      accessible={Boolean(accessibilityLabel)}
      color={color}
      importantForAccessibility={accessibilityLabel ? "yes" : "no-hide-descendants"}
      name={name}
      size={size}
    />
  );
}
