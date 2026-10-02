import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
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
import {
  SafeAreaView,
  type Edge,
} from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { spacing } from "../theme/tokens";

const defaultEdges: Edge[] = ["top", "left", "right"];
const defaultKeyboardClearance = spacing.xxl;
const FocusedInputContext = createContext<(target: number) => void>(() => undefined);

interface KeyboardScrollResponder {
  scrollResponderScrollNativeHandleToKeyboard: (
    nodeHandle: number,
    additionalOffset?: number,
    preventNegativeScrollOffset?: boolean,
  ) => void;
}

interface KeyboardScrollable {
  getScrollResponder?: () => KeyboardScrollResponder | null | undefined;
  scrollResponderScrollNativeHandleToKeyboard?: KeyboardScrollResponder["scrollResponderScrollNativeHandleToKeyboard"];
}

export function revealFocusedInput(
  scrollable: KeyboardScrollable | null,
  target: number | null,
  clearance: number = defaultKeyboardClearance,
) {
  if (!scrollable || target == null) return;
  const responder = scrollable.scrollResponderScrollNativeHandleToKeyboard
    ? scrollable
    : scrollable.getScrollResponder?.();
  responder?.scrollResponderScrollNativeHandleToKeyboard?.(
    target,
    clearance,
    true,
  );
}

export function useFocusedInputVisibility<T>(
  enabled = true,
  clearance: number = defaultKeyboardClearance,
) {
  const scrollRef = useRef<T | null>(null);
  const focusedTarget = useRef<number | null>(null);

  const revealCurrent = useCallback(() => {
    if (!enabled) return;
    revealFocusedInput(
      scrollRef.current as KeyboardScrollable | null,
      focusedTarget.current,
      clearance,
    );
  }, [clearance, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const subscription = Keyboard.addListener("keyboardDidShow", revealCurrent);
    return () => subscription.remove();
  }, [enabled, revealCurrent]);

  const onInputFocus = useCallback(
    (target: number) => {
      focusedTarget.current = target;
      if (Keyboard.isVisible()) revealCurrent();
    },
    [revealCurrent],
  );

  const setScrollRef = useCallback((node: T | null) => {
    scrollRef.current = node;
  }, []);

  return { onInputFocus, setScrollRef };
}

export function FocusedInputProvider({
  children,
  onInputFocus,
}: {
  children?: ReactNode;
  onInputFocus: (target: number) => void;
}) {
  return (
    <FocusedInputContext.Provider value={onInputFocus}>
      {children}
    </FocusedInputContext.Provider>
  );
}

export function FormTextInput({ onFocus, ...props }: TextInputProps) {
  const onInputFocus = useContext(FocusedInputContext);
  return (
    <TextInput
      {...props}
      onFocus={(event) => {
        onInputFocus(event.nativeEvent.target);
        onFocus?.(event);
      }}
    />
  );
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
  const { onInputFocus, setScrollRef } = useFocusedInputVisibility<ScrollView>(
    keyboardAware && scroll,
    keyboardClearance,
  );
  const content = scroll ? (
    <FocusedInputProvider onInputFocus={onInputFocus}>
      <ScrollView
        automaticallyAdjustKeyboardInsets={keyboardAware && Platform.OS === "ios"}
        contentContainerStyle={[styles.content, contentContainerStyle]}
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={(event) => {
          if (keyboardAware) Keyboard.dismiss();
          onScrollBeginDrag?.(event);
        }}
        ref={setScrollRef}
        {...remainingScrollViewProps}
      >
        {children}
      </ScrollView>
    </FocusedInputProvider>
  ) : (
    <View style={[styles.content, styles.fill, contentContainerStyle]}>{children}</View>
  );

  return (
    <SafeAreaView edges={edges} style={[styles.safeArea, { backgroundColor }]}>
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
