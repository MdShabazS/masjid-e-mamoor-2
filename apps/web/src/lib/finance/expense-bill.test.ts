import { describe, expect, it } from "vitest";
import { billExtension } from "./expense-bill";

describe("expense bill attachment validation", () => {
  it("accepts permitted types only when bytes and MIME agree", () => {
    expect(billExtension("image/jpeg", 10, new Uint8Array([255, 216, 255]))).toBe("jpg");
    expect(billExtension("image/png", 10, new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]))).toBe("png");
    expect(billExtension("application/pdf", 10, new Uint8Array([37, 80, 68, 70, 45]))).toBe("pdf");
    expect(billExtension("application/pdf", 10, new Uint8Array([255, 216, 255]))).toBeNull();
    expect(billExtension("image/svg+xml", 10, new Uint8Array([37, 80, 68, 70, 45]))).toBeNull();
  });
  it("rejects empty and oversized attachments", () => {
    const header = new Uint8Array([37, 80, 68, 70, 45]);
    expect(billExtension("application/pdf", 0, header)).toBeNull();
    expect(billExtension("application/pdf", 5 * 1024 * 1024 + 1, header)).toBeNull();
  });
});
