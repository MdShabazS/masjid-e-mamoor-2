import { fireEvent, render } from "@testing-library/react-native";
import { createElement } from "react";
import { FocusedInputProvider, FormTextInput, revealFocusedInput } from "./Screen";

describe("focused input visibility", () => {
  it("reveals a focused input with keyboard clearance", () => {
    const scrollResponderScrollNativeHandleToKeyboard = jest.fn();

    revealFocusedInput(
      { scrollResponderScrollNativeHandleToKeyboard },
      42,
      24,
    );

    expect(scrollResponderScrollNativeHandleToKeyboard).toHaveBeenCalledWith(
      42,
      24,
      true,
    );
  });

  it("supports virtualized lists through their scroll responder", () => {
    const scrollResponderScrollNativeHandleToKeyboard = jest.fn();

    revealFocusedInput(
      {
        getScrollResponder: () => ({
          scrollResponderScrollNativeHandleToKeyboard,
        }),
      },
      7,
    );

    expect(scrollResponderScrollNativeHandleToKeyboard).toHaveBeenCalledWith(
      7,
      24,
      true,
    );
  });

  it("does nothing without a focused target", () => {
    const scrollResponderScrollNativeHandleToKeyboard = jest.fn();
    revealFocusedInput({ scrollResponderScrollNativeHandleToKeyboard }, null);
    expect(scrollResponderScrollNativeHandleToKeyboard).not.toHaveBeenCalled();
  });

  it("registers focus while preserving the input focus callback", async () => {
    const onInputFocus = jest.fn();
    const onFocus = jest.fn();
    const view = await render(
      createElement(
        FocusedInputProvider,
        { onInputFocus },
        createElement(FormTextInput, { onFocus, testID: "field" }),
      ),
    );

    const event = { nativeEvent: { target: 19 } };
    fireEvent(view.getByTestId("field"), "focus", event);

    expect(onInputFocus).toHaveBeenCalledWith(19);
    expect(onFocus).toHaveBeenCalledWith(event);
  });
});
