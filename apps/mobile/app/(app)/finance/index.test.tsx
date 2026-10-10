import { useQuery } from "@tanstack/react-query";
import { act, fireEvent, render } from "@testing-library/react-native";
import { router } from "expo-router";

import { useAuth } from "../../../src/auth/AuthProvider";
import type { MobileCapabilities } from "../../../src/modules/capabilities";
import FinanceHomeScreen from "./index";

jest.mock("@tanstack/react-query", () => ({ useQuery: jest.fn() }));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("../../../src/auth/AuthProvider", () => ({ useAuth: jest.fn() }));
jest.mock("../../../src/modules/capabilities", () => ({ loadCapabilities: jest.fn() }));
jest.mock("react-native-keyboard-controller", () => {
  const ReactNative = jest.requireActual("react-native");
  return { KeyboardAwareScrollView: ReactNative.ScrollView };
});

const mockUseQuery = useQuery as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;
const mockPush = router.push as jest.Mock;
const refetch = jest.fn();

const account = {
  id: "account-1",
  authUserId: "auth-1",
  username: "qa.finance",
  status: "active" as const,
  role: "finance" as const,
  mustChangePassword: false,
  memberProfile: null,
};

const noFinanceAccess = {
  canReadFinanceAccounts: false,
  canManageFinanceAccounts: false,
  canReadFinanceMonthlyReports: false,
  canManageFinanceMonthlyReports: false,
  canReadFinanceTransactions: false,
  canCreateFinanceTransfers: false,
  canApproveFinanceTransfers: false,
  canCreateFinanceExpenses: false,
  canApproveFinanceExpenses: false,
  canCreateFinanceCorrections: false,
  canCreateFinanceReversals: false,
  canReadFinanceReconciliation: false,
  canManageFinanceReconciliation: false,
} as MobileCapabilities;

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue({ account });
  mockUseQuery.mockReturnValue(queryResult(noFinanceAccess));
});

describe("Finance workspace", () => {
  it("shows and navigates only capability-authorized Finance workflows", async () => {
    mockUseQuery.mockReturnValue(
      queryResult({
        ...noFinanceAccess,
        canReadFinanceAccounts: true,
        canApproveFinanceExpenses: true,
        canReadFinanceMonthlyReports: true,
      }),
    );

    const view = await render(<FinanceHomeScreen />);

    expect(view.getByText("Finance accounts")).toBeTruthy();
    expect(view.getByText("Expenses")).toBeTruthy();
    expect(view.getByText("Monthly reports")).toBeTruthy();
    expect(view.queryByText("Internal transfers")).toBeNull();
    expect(view.queryByText("Reconciliation")).toBeNull();

    await act(async () => fireEvent.press(view.getByText("Expenses")));
    expect(mockPush).toHaveBeenCalledWith("/finance/expenses");
  });

  it("does not infer Finance access from the account role", async () => {
    const view = await render(<FinanceHomeScreen />);

    expect(view.getByText("Finance unavailable")).toBeTruthy();
    expect(view.queryByText("Financial operations")).toBeNull();
  });

  it("renders loading and recoverable error states", async () => {
    mockUseQuery.mockReturnValue({ ...queryResult(undefined), isLoading: true });
    const loading = await render(<FinanceHomeScreen />);
    expect(loading.getByRole("progressbar", { name: "Loading Finance workspace..." })).toBeTruthy();
    await loading.unmount();

    mockUseQuery.mockReturnValue({ ...queryResult(undefined), isError: true });
    const error = await render(<FinanceHomeScreen />);
    expect(error.getByRole("alert")).toBeTruthy();
    await act(async () => fireEvent.press(error.getByRole("button", { name: "Retry" })));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

function queryResult<T>(data: T | undefined) {
  return {
    data,
    isError: false,
    isLoading: false,
    isRefetching: false,
    refetch,
  };
}
