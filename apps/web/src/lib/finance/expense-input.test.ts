import { describe, expect, it } from "vitest";
import { parseExpenseAmount, parseExpenseFields } from "./expense-input";

describe("expense inputs", () => {
  it("converts rupees to integer paise without floating point rounding", () => {
    expect(parseExpenseAmount("1.05")).toBe(105);
    expect(parseExpenseAmount("999999.99")).toBe(99999999);
    for (const value of ["0", "0.00", "-1", "1.234", "1e3", "1,000", "90071992547410.00"]) {
      expect(parseExpenseAmount(value)).toBeNull();
    }
  });

  it("rejects invalid calendar dates and short missing bill explanations", () => {
    const form = new FormData();
    form.set("financeAccountId", "d374d1b7-1234-4321-9876-843ad6e922e2");
    form.set("amount", "120.50");
    form.set("description", "Materials");
    form.set("businessDate", "2026-02-30");
    expect(parseExpenseFields(form)).toBeNull();
    form.set("businessDate", "2026-02-28");
    form.set("missingBillReason", "missing");
    expect(parseExpenseFields(form)).toBeNull();
    form.set("missingBillReason", "Vendor did not issue a bill");
    expect(parseExpenseFields(form)?.amountPaise).toBe(12050);
  });
});
