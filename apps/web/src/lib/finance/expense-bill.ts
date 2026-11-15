const MAX_BILL_BYTES = 5 * 1024 * 1024;

export function billExtension(mime: string, size: number, header: Uint8Array): string | null {
  if (!Number.isInteger(size) || size <= 0 || size > MAX_BILL_BYTES) return null;
  if (mime === "image/jpeg" && header.length >= 3 &&
    header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) return "jpg";
  if (mime === "image/png" && header.length >= 8 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => header[index] === byte)) return "png";
  if (mime === "application/pdf" && header.length >= 5 &&
    [37, 80, 68, 70, 45].every((byte, index) => header[index] === byte)) return "pdf";
  return null;
}
