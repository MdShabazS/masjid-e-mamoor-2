import { fireEvent, render } from "@testing-library/react-native";
import { Text } from "react-native";

import {
  AppButton,
  BrandedPageHeader,
  Divider,
  EmptyState,
  ErrorState,
  InformationCard,
  ListRow,
  LoadingState,
  MetricCard,
  SectionHeader,
  StatusChip,
} from "./InstitutionalUI";

describe("InstitutionalUI", () => {
  it("renders the shared information hierarchy", async () => {
    const view = await render(
      <>
        <BrandedPageHeader
          description="Operational overview"
          eyebrow="Masjid E Mamoor 2"
          title="Dashboard"
        />
        <SectionHeader description="Current account position" title="Summary" />
        <InformationCard emphasis>
          <Text>Trusted information</Text>
        </InformationCard>
        <MetricCard helper="Verified records" label="Total" value={12} />
        <StatusChip label="Active" tone="success" />
        <Divider />
      </>,
    );

    expect(view.getByRole("header", { name: "Dashboard" })).toBeTruthy();
    expect(view.getByRole("header", { name: "Summary" })).toBeTruthy();
    expect(view.getByText("Trusted information")).toBeTruthy();
    expect(view.getByText("12")).toBeTruthy();
    expect(view.getByLabelText("Status: Active")).toBeTruthy();
  });

  it("exposes reusable actions with disabled and loading states", async () => {
    const onPress = jest.fn();
    const view = await render(
      <>
        <AppButton label="Continue" onPress={onPress} />
        <AppButton disabled label="Unavailable" onPress={onPress} variant="secondary" />
        <AppButton label="Saving" loading onPress={onPress} />
      </>,
    );

    fireEvent.press(view.getByRole("button", { name: "Continue" }));
    fireEvent.press(view.getByRole("button", { name: "Unavailable" }));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(view.getByRole("button", { name: "Unavailable" }).props.accessibilityState).toEqual({
      busy: false,
      disabled: true,
    });
    expect(view.getByRole("button", { name: "Saving" }).props.accessibilityState).toEqual({
      busy: true,
      disabled: true,
    });
  });

  it("supports actionable and static list rows", async () => {
    const onPress = jest.fn();
    const view = await render(
      <>
        <ListRow onPress={onPress} subtitle="Open details" title="Committee task" />
        <ListRow meta="Read only" title="Account status" />
      </>,
    );

    fireEvent.press(view.getByRole("button", { name: /committee task/i }));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(view.getByText("Read only")).toBeTruthy();
  });

  it("renders consistent empty, loading, and error states", async () => {
    const view = await render(
      <>
        <EmptyState description="No records are available." title="No records" />
        <LoadingState label="Loading accounts" />
        <ErrorState description="Please try again." />
      </>,
    );

    expect(view.getByRole("header", { name: "No records" })).toBeTruthy();
    expect(view.getByRole("progressbar", { name: "Loading accounts" })).toBeTruthy();
    expect(view.getByRole("alert")).toBeTruthy();
  });
});
