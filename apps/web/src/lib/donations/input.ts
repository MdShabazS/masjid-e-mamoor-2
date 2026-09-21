export function parseRupeesToPaise(
  raw: string,
): number | null {
  const value = raw.trim();

  if (!/^\d+(\.\d{1,2})?$/.test(value)) {
    return null;
  }

  const [rupees, fraction = ""] = value.split(".");

  try {
    const paise =
      BigInt(rupees) * BigInt(100) +
      BigInt(fraction.padEnd(2, "0"));

    if (paise > BigInt(Number.MAX_SAFE_INTEGER)) {
      return null;
    }

    return Number(paise);
  } catch {
    return null;
  }
}

export const DONATION_PROOF_BUCKET =
  "donation-payment-proofs";

export const DONATION_PROOF_MAX_BYTES =
  5 * 1024 * 1024;

const proofMimeTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["application/pdf", "pdf"],
]);

export function donationProofExtension(
  mimeType: string,
): string | null {
  return proofMimeTypes.get(mimeType) ?? null;
}

export function validateDonationProofFile(
  file: File,
): string | null {
  if (file.size < 1) {
    return "Proof file is empty.";
  }

  if (file.size > DONATION_PROOF_MAX_BYTES) {
    return "Proof file must not exceed 5 MiB.";
  }

  if (!donationProofExtension(file.type)) {
    return "Proof must be JPEG, PNG, or PDF.";
  }

  return null;
}

export function validateDonationProofBytes(
  mimeType: string,
  bytes: Uint8Array,
): string | null {
  if (mimeType === "image/jpeg") {
    const valid =
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff;

    return valid
      ? null
      : "Proof content does not match its JPEG type.";
  }

  if (mimeType === "image/png") {
    const signature = [
      0x89,
      0x50,
      0x4e,
      0x47,
      0x0d,
      0x0a,
      0x1a,
      0x0a,
    ];

    const valid =
      bytes.length >= signature.length &&
      signature.every(
        (value, index) => bytes[index] === value,
      );

    return valid
      ? null
      : "Proof content does not match its PNG type.";
  }

  if (mimeType === "application/pdf") {
    const signature = [0x25, 0x50, 0x44, 0x46, 0x2d];

    const valid =
      bytes.length >= signature.length &&
      signature.every(
        (value, index) => bytes[index] === value,
      );

    return valid
      ? null
      : "Proof content does not match its PDF type.";
  }

  return "Unsupported proof type.";
}
