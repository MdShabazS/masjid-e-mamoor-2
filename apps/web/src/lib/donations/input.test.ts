import { describe, expect, it } from "vitest";

import {
  DONATION_PROOF_MAX_BYTES,
  donationProofExtension,
  parseRupeesToPaise,
  validateDonationProofBytes,
  validateDonationProofFile,
} from "./input";

describe("parseRupeesToPaise", () => {
  it("converts exact rupee values", () => {
    expect(parseRupeesToPaise("1")).toBe(100);
    expect(parseRupeesToPaise("1.5")).toBe(150);
    expect(parseRupeesToPaise("1.05")).toBe(105);
    expect(parseRupeesToPaise("0.01")).toBe(1);
  });

  it("rejects malformed or unsafe values", () => {
    expect(parseRupeesToPaise("")).toBeNull();
    expect(parseRupeesToPaise("-1")).toBeNull();
    expect(parseRupeesToPaise("1.001")).toBeNull();
    expect(parseRupeesToPaise("abc")).toBeNull();

    expect(
      parseRupeesToPaise(
        "999999999999999999999999",
      ),
    ).toBeNull();
  });
});

describe("donation proof input", () => {
  it("maps supported MIME types", () => {
    expect(
      donationProofExtension("image/jpeg"),
    ).toBe("jpg");

    expect(
      donationProofExtension("image/png"),
    ).toBe("png");

    expect(
      donationProofExtension("application/pdf"),
    ).toBe("pdf");

    expect(
      donationProofExtension("text/plain"),
    ).toBeNull();
  });

  it("rejects empty files", () => {
    const file = new File([], "proof.pdf", {
      type: "application/pdf",
    });

    expect(validateDonationProofFile(file)).toBe(
      "Proof file is empty.",
    );
  });

  it("rejects files above 5 MiB", () => {
    const file = new File(
      [
        new Uint8Array(
          DONATION_PROOF_MAX_BYTES + 1,
        ),
      ],
      "proof.pdf",
      {
        type: "application/pdf",
      },
    );

    expect(validateDonationProofFile(file)).toBe(
      "Proof file must not exceed 5 MiB.",
    );
  });

  it("validates supported file signatures", () => {
    expect(
      validateDonationProofBytes(
        "application/pdf",
        new Uint8Array([
          0x25,
          0x50,
          0x44,
          0x46,
          0x2d,
          0x31,
        ]),
      ),
    ).toBeNull();

    expect(
      validateDonationProofBytes(
        "image/jpeg",
        new Uint8Array([
          0xff,
          0xd8,
          0xff,
          0xe0,
        ]),
      ),
    ).toBeNull();

    expect(
      validateDonationProofBytes(
        "image/png",
        new Uint8Array([
          0x89,
          0x50,
          0x4e,
          0x47,
          0x0d,
          0x0a,
          0x1a,
          0x0a,
        ]),
      ),
    ).toBeNull();
  });

  it("rejects spoofed MIME content", () => {
    expect(
      validateDonationProofBytes(
        "application/pdf",
        new TextEncoder().encode("not a PDF"),
      ),
    ).not.toBeNull();

    expect(
      validateDonationProofBytes(
        "image/png",
        new Uint8Array([1, 2, 3, 4]),
      ),
    ).not.toBeNull();
  });
});
