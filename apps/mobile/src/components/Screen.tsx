import type { ReactNode } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  type ScrollViewProps,
  StyleSheet,
  View,
  type ViewStyle,
  type StyleProp,
} from "react-native";
import {
  SafeAreaView,
  type Edge,
} from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { spacing } from "../theme/tokens";

const defaultEdges: Edge[] = ["top", "left", "right"];

interface ScreenProps {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  edges?: Edge[];
  keyboardAware?: boolean;
  scroll?: boolean;
  scrollViewProps?: Omit<ScrollViewProps, "contentContainerStyle">;
}

export function Screen({
  children,
  contentContainerStyle,
  edges = defaultEdges,
  keyboardAware = false,
  scroll = false,
  scrollViewProps,
}: ScreenProps) {
  const content = scroll ? (
    <ScrollView
      automaticallyAdjustKeyboardInsets={keyboardAware && Platform.OS === "ios"}
      contentContainerStyle={[styles.content, contentContainerStyle]}
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      keyboardShouldPersistTaps="handled"
      onScrollBeginDrag={keyboardAware ? Keyboard.dismiss : undefined}
      {...scrollViewProps}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, styles.fill, contentContainerStyle]}>{children}</View>
  );

  return (
    <SafeAreaView edges={edges} style={styles.safeArea}>
      {keyboardAware ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.fill}
        >
          {content}
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.ivory, flex: 1 },
  fill: { flex: 1 },
  content: { paddingBottom: spacing.xxl },
});
