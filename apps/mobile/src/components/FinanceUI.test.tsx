import { render } from "@testing-library/react-native";

import { FinancePageHeader, FinanceStatusChip } from "./FinanceUI";

describe("FinanceUI", () => {
  it("renders the institutional Finance hierarchy", async () => {
    const view = await render(
      <FinancePageHeader description="Authoritative financial history" title="Transactions" />,
    );

    expect(view.getByText("Finance")).toBeTruthy();
    expect(view.getByRole("header", { name: "Transactions" })).toBeTruthy();
    expect(view.getByText("Authoritative financial history")).toBeTruthy();
  });

  it("keeps lifecycle meaning available without relying on color", async () => {
    const view = await render(
      <>
        <FinanceStatusChip label="Submitted" status="submitted" />
        <FinanceStatusChip label="Posted" status="posted" />
        <FinanceStatusChip label="Rejected" status="rejected" />
      </>,
    );

    expect(view.getByLabelText("Status: Submitted")).toBeTruthy();
    expect(view.getByLabelText("Status: Posted")).toBeTruthy();
    expect(view.getByLabelText("Status: Rejected")).toBeTruthy();
  });
});
