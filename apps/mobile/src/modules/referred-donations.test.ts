import { Buffer } from "node:buffer";
import { StorageAccessFramework } from "expo-file-system/legacy";
import { supabase } from "../lib/supabase";
import { saveReferredDonationReceipt, submitReferredDonation, decideReferredDonation,
  voidVerifiedReferredDonation } from "./referred-donations";

jest.mock("expo-crypto", () => ({ randomUUID: () => "request-123" }));
jest.mock("../lib/supabase", () => ({ supabase: {
  rpc: jest.fn(), functions: { invoke: jest.fn() },
} }));
jest.mock("expo-file-system/legacy", () => ({
  EncodingType: { Base64: "base64" },
  StorageAccessFramework: {
    requestDirectoryPermissionsAsync: jest.fn(), createFileAsync: jest.fn(), writeAsStringAsync: jest.fn(),
  },
}));
const id = "d3000000-0000-0000-0000-000000000001";
const rpc = supabase.rpc as jest.Mock;
const invoke = supabase.functions.invoke as jest.Mock;
const permissions = StorageAccessFramework.requestDirectoryPermissionsAsync as jest.Mock;
const createFile = StorageAccessFramework.createFileAsync as jest.Mock;
const writeFile = StorageAccessFramework.writeAsStringAsync as jest.Mock;
beforeEach(() => jest.clearAllMocks());

test("submits named donations in integer paise through the trusted RPC", async () => {
  rpc.mockResolvedValue({ error: null });
  await submitReferredDonation(" Ahmed ", "1000.25", "upi", id, "General donation", "2026-10-14", "", "UPI-123");
  expect(rpc).toHaveBeenCalledWith("submit_referred_donor_contribution", {
    p_donor_name: "Ahmed", p_amount_paise: 100025, p_payment_method: "upi", p_operation_id: "request-123",
    p_referrer_application_user_id: id, p_purpose: "General donation", p_donation_date: "2026-10-14",
    p_donor_phone: null, p_payment_reference: "UPI-123", p_replaces_contribution_id: null,
  });
  await expect(submitReferredDonation("", "1.00", "cash", id, "General donation", "2026-10-14", "", ""))
    .rejects.toThrow("invalid_donation");
  expect(rpc).toHaveBeenCalledTimes(1);
});

test("requires an account for verification and a reason for rejection", async () => {
  await expect(decideReferredDonation(id, true, null, "2026-10-14", null)).rejects.toThrow("invalid_decision");
  await expect(decideReferredDonation(id, false, null, null, "")).rejects.toThrow("invalid_decision");
  expect(rpc).not.toHaveBeenCalled();
});

test("voids a verified receipt through the Treasurer RPC with an audit reason", async () => {
  await expect(voidVerifiedReferredDonation(id, "short")).rejects.toThrow("invalid_void");
  expect(rpc).not.toHaveBeenCalled();
  rpc.mockResolvedValue({ error: null });
  await voidVerifiedReferredDonation(id, " Incorrect total ");
  expect(rpc).toHaveBeenCalledWith("void_referred_donor_contribution", {
    p_contribution_id: id, p_reason: "Incorrect total", p_operation_id: "request-123",
  });
});

test("saves only validated PDF receipts to a user-selected folder", async () => {
  const bytes = Uint8Array.from([37, 80, 68, 70, 45, 49, 50, 51]);
  invoke.mockResolvedValue({ data: { arrayBuffer: async () => bytes.buffer }, error: null });
  permissions.mockResolvedValue({ granted: true, directoryUri: "content://folder" });
  createFile.mockResolvedValue("content://folder/receipt.pdf");
  await expect(saveReferredDonationReceipt(id, "MEM2-2026-00000001")).resolves.toBe(true);
  expect(invoke).toHaveBeenCalledWith("render-referred-donor-receipt", { body: { id } });
  expect(writeFile).toHaveBeenCalledWith("content://folder/receipt.pdf", Buffer.from(bytes).toString("base64"), { encoding: "base64" });
  jest.clearAllMocks();
  invoke.mockResolvedValue({ data: { arrayBuffer: async () => Uint8Array.from([1, 2, 3, 4, 5, 6]).buffer }, error: null });
  await expect(saveReferredDonationReceipt(id, "MEM2-2026-00000001")).rejects.toThrow("invalid_receipt_pdf");
  expect(permissions).not.toHaveBeenCalled();
});
