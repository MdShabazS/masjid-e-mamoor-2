import { Text, type TextProps } from "react-native";

import { fontFamilies } from "../theme/tokens";

export function AppText({ style, ...props }: TextProps) {
  return <Text {...props} style={[{ fontFamily: fontFamilies.regular }, style]} />;
}
