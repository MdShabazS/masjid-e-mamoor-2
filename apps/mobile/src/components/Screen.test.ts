import { fireEvent, render } from "@testing-library/react-native";
import { createElement } from "react";
import { StyleSheet, Text } from "react-native";
import { fontFamilies } from "../theme/tokens";
import { FormTextInput, Screen } from "./Screen";

jest.mock("react-native-keyboard-controller", () => {
  const ReactNative = jest.requireActual("react-native");

  return {
    KeyboardAwareScrollView: ReactNative.ScrollView,
  };
});

describe("Screen", () => {
  it("preserves FormTextInput focus callbacks", async () => {
    const onFocus = jest.fn();

    const view = await render(
      createElement(FormTextInput, {
        testID: "field",
        onFocus,
      }),
    );

    fireEvent(view.getByTestId("field"), "focus");

    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(StyleSheet.flatten(view.getByTestId("field").props.style).fontFamily).toBe(
      fontFamilies.regular,
    );
  });

  it("renders keyboard-aware scroll content", async () => {
    const view = await render(
      createElement(
        Screen,
        {
          keyboardAware: true,
          scroll: true,
        } as Parameters<typeof Screen>[0],
        createElement(Text, null, "Keyboard aware content"),
      ),
    );

    expect(view.getByText("Keyboard aware content")).toBeTruthy();
  });
});
