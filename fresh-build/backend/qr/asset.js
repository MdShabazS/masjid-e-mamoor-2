import { createHash } from 'node:crypto';
import sharp from 'sharp';

export const MAX_QR_BYTES = 5 * 1024 * 1024;
export const MAX_QR_REQUEST_BYTES = MAX_QR_BYTES + 256 * 1024;

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export async function inspectQrAsset(bytes, declaredType) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 32 || bytes.length > MAX_QR_BYTES)
    throw new Error('INVALID_QR_IMAGE');
  let contentType;
  let extension;
  if (
    declaredType === 'image/png' &&
    bytes.subarray(0, 8).equals(PNG_SIGNATURE) &&
    bytes.toString('ascii', 12, 16) === 'IHDR' &&
    bytes.readUInt32BE(16) > 0 &&
    bytes.readUInt32BE(20) > 0 &&
    bytes.subarray(-8, -4).toString('ascii') === 'IEND'
  ) {
    contentType = 'image/png';
    extension = 'png';
  } else if (
    declaredType === 'image/jpeg' &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff &&
    bytes[bytes.length - 2] === 0xff &&
    bytes[bytes.length - 1] === 0xd9
  ) {
    contentType = 'image/jpeg';
    extension = 'jpg';
  } else {
    throw new Error('INVALID_QR_IMAGE');
  }
  try {
    const decoder = sharp(bytes, { failOn: 'error', limitInputPixels: 4096 * 4096 });
    const metadata = await decoder.metadata();
    if (
      metadata.format !== extension.replace('jpg', 'jpeg') ||
      !metadata.width ||
      !metadata.height ||
      metadata.width > 4096 ||
      metadata.height > 4096 ||
      metadata.pages > 1
    )
      throw new Error('INVALID_QR_IMAGE');
    await decoder.raw().toBuffer();
  } catch {
    throw new Error('INVALID_QR_IMAGE');
  }
  return {
    contentType,
    extension,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

export async function readBoundedRequest(request) {
  const claimed = Number(request.headers.get('content-length'));
  if (Number.isFinite(claimed) && claimed > MAX_QR_REQUEST_BYTES)
    throw new Error('QR_IMAGE_TOO_LARGE');
  if (!request.body) throw new Error('INVALID_QR_INPUT');
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_QR_REQUEST_BYTES) throw new Error('QR_IMAGE_TOO_LARGE');
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, size);
}
