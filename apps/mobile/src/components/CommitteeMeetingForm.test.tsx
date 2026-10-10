import { act, fireEvent, render } from "@testing-library/react-native";

import type { CommitteeMeetingDraft } from "../modules/meetings";
import { CommitteeMeetingForm } from "./CommitteeMeetingForm";

jest.mock("react-native-keyboard-controller", () => {
  const ReactNative = jest.requireActual("react-native");
  return { KeyboardAwareScrollView: ReactNative.ScrollView };
});

const validDraft: CommitteeMeetingDraft = {
  title: "Monthly committee meeting",
  meetingType: "general",
  details: "Review monthly operations",
  location: "Community hall",
  scheduledStart: "2026-10-20T13:00:00+05:30",
  scheduledEnd: "2026-10-20T14:00:00+05:30",
  participantIds: ["committee-1"],
};

const options = [
  {
    applicationUserId: "committee-1",
    displayName: "Committee One",
    roleLabel: "Committee Member",
  },
  {
    applicationUserId: "secretary-1",
    displayName: "Secretary One",
    roleLabel: "Secretary",
  },
];

describe("CommitteeMeetingForm", () => {
  it("renders existing fields and updates participant selection", async () => {
    const onChange = jest.fn();
    const view = await render(
      <CommitteeMeetingForm
        draft={validDraft}
        onChange={onChange}
        onSubmit={jest.fn()}
        options={options}
        pending={false}
        submitLabel="Save meeting"
      />,
    );

    expect(view.getByDisplayValue("Monthly committee meeting")).toBeTruthy();
    expect(view.getByDisplayValue("Community hall")).toBeTruthy();
    expect(view.getByText("Committee One")).toBeTruthy();
    expect(view.getByText("Secretary One")).toBeTruthy();

    await act(async () => fireEvent.press(view.getAllByRole("checkbox")[1]));
    expect(onChange).toHaveBeenCalledWith({
      ...validDraft,
      participantIds: ["committee-1", "secretary-1"],
    });
    await view.unmount();
  });

  it("blocks invalid or pending submissions and submits a valid form once", async () => {
    const onSubmit = jest.fn();
    const invalidView = await render(
      <CommitteeMeetingForm
        draft={{ ...validDraft, participantIds: [] }}
        onChange={jest.fn()}
        onSubmit={onSubmit}
        options={options}
        pending={false}
        submitLabel="Create meeting"
      />,
    );
    expect(
      invalidView.getByRole("button", { name: "Create meeting" }).props.accessibilityState.disabled,
    ).toBe(true);
    await invalidView.unmount();

    const validView = await render(
      <CommitteeMeetingForm
        draft={validDraft}
        onChange={jest.fn()}
        onSubmit={onSubmit}
        options={options}
        pending={false}
        submitLabel="Create meeting"
      />,
    );
    await act(async () =>
      fireEvent.press(validView.getByRole("button", { name: "Create meeting" })),
    );
    expect(onSubmit).toHaveBeenCalledTimes(1);
    await validView.unmount();

    const pendingView = await render(
      <CommitteeMeetingForm
        draft={validDraft}
        onChange={jest.fn()}
        onSubmit={onSubmit}
        options={options}
        pending
        submitLabel="Create meeting"
      />,
    );
    expect(
      pendingView.getByRole("button", { name: "Create meeting" }).props.accessibilityState.disabled,
    ).toBe(true);
    await pendingView.unmount();
  });
});
