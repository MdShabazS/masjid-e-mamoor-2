import type { ReactNode } from "react";
import {
  type ColorValue,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  type ScrollViewProps,
  StyleSheet,
  TextInput,
  type TextInputProps,
  View,
  type ViewStyle,
  type StyleProp,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import {
  SafeAreaView,
  type Edge,
} from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { spacing } from "../theme/tokens";

const defaultEdges: Edge[] = ["top", "left", "right"];
const defaultKeyboardClearance = spacing.xxl;

export function FormTextInput(props: TextInputProps) {
  return <TextInput {...props} />;
}

interface ScreenProps {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  edges?: Edge[];
  backgroundColor?: ColorValue;
  keyboardClearance?: number;
  keyboardAware?: boolean;
  scroll?: boolean;
  scrollViewProps?: Omit<ScrollViewProps, "contentContainerStyle">;
}

export function Screen({
  children,
  contentContainerStyle,
  edges = defaultEdges,
  backgroundColor = colors.ivory,
  keyboardClearance = defaultKeyboardClearance,
  keyboardAware = false,
  scroll = false,
  scrollViewProps,
}: ScreenProps) {
  const { onScrollBeginDrag, ...remainingScrollViewProps } = scrollViewProps ?? {};

  const sharedScrollProps = {
    contentContainerStyle: [styles.content, contentContainerStyle],
    keyboardDismissMode:
      Platform.OS === "ios" ? ("interactive" as const) : ("on-drag" as const),
    keyboardShouldPersistTaps: "handled" as const,
    onScrollBeginDrag: (
      event: Parameters<
        NonNullable<ScrollViewProps["onScrollBeginDrag"]>
      >[0],
    ) => {
      if (keyboardAware) Keyboard.dismiss();
      onScrollBeginDrag?.(event);
    },
    ...remainingScrollViewProps,
  };

  let content: ReactNode;

  if (scroll && keyboardAware) {
    content = (
      <KeyboardAwareScrollView
        {...sharedScrollProps}
        bottomOffset={keyboardClearance}
      >
        {children}
      </KeyboardAwareScrollView>
    );
  } else if (scroll) {
    content = <ScrollView {...sharedScrollProps}>{children}</ScrollView>;
  } else {
    content = (
      <View style={[styles.content, styles.fill, contentContainerStyle]}>
        {children}
      </View>
    );
  }

  return (
    <SafeAreaView edges={edges} style={[styles.safeArea, { backgroundColor }]}>
      {keyboardAware && !scroll ? (
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
  content: { paddingBottom: spacing.section },
});
