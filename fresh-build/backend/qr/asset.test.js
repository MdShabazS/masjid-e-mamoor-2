import assert from 'node:assert/strict';
import { test } from 'node:test';
import sharp from 'sharp';
import { MAX_QR_BYTES, inspectQrAsset, readBoundedRequest } from './asset.js';

const png = await sharp({ create: { width: 64, height: 64, channels: 3, background: 'white' } })
  .png()
  .toBuffer();

test('QR bytes have an exact digest, detected type and size', async () => {
  const asset = await inspectQrAsset(png, 'image/png');
  assert.equal(asset.extension, 'png');
  assert.equal(asset.bytes, png.length);
  assert.match(asset.sha256, /^[a-f0-9]{64}$/);
  assert.equal(asset.sha256, (await inspectQrAsset(Buffer.from(png), 'image/png')).sha256);
});

test('QR inspection rejects claimed MIME mismatch, bogus bytes and oversize data', async () => {
  await assert.rejects(inspectQrAsset(png, 'image/jpeg'), /INVALID_QR_IMAGE/);
  await assert.rejects(inspectQrAsset(Buffer.alloc(80), 'image/png'), /INVALID_QR_IMAGE/);
  await assert.rejects(
    inspectQrAsset(Buffer.alloc(MAX_QR_BYTES + 1), 'image/jpeg'),
    /INVALID_QR_IMAGE/,
  );
  const damaged = Buffer.from(png);
  damaged[damaged.length - 16] ^= 1;
  await assert.rejects(inspectQrAsset(damaged, 'image/png'), /INVALID_QR_IMAGE/);
});

test('bounded reader rejects a streamed body that exceeds its limit', async () => {
  const request = new Request('http://local.invalid', {
    method: 'POST',
    body: Buffer.alloc(MAX_QR_BYTES + 256 * 1024 + 1),
    duplex: 'half',
  });
  await assert.rejects(readBoundedRequest(request), /QR_IMAGE_TOO_LARGE/);
});
