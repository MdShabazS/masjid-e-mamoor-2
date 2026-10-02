import { fireEvent, render } from "@testing-library/react-native";
import { createElement } from "react";
import { Text } from "react-native";
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
  });

  it("renders keyboard-aware scroll content", async () => {
    const view = await render(
      createElement(
        Screen,
        {
          keyboardAware: true,
          scroll: true,
        },
        createElement(Text, null, "Keyboard aware content"),
      ),
    );

    expect(view.getByText("Keyboard aware content")).toBeTruthy();
  });
});
