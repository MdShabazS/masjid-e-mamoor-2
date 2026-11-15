// Builds the web app's home-screen icons from one square SVG.
// Usage: node scripts/make_app_icons.mjs [logo.svg]
// Without an argument it draws the placeholder (dome and crescent on masjid green).
// Replace it with the masjid logo once the committee provides one.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const GREEN = '#145b49';

// The artwork sits inside the central 60% so the "maskable" crop never cuts it.
const PLACEHOLDER = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${GREEN}"/>
  <g fill="#ffffff">
    <path d="M256 150c-58 34-92 78-92 128v14h184v-14c0-50-34-94-92-128z"/>
    <rect x="164" y="300" width="184" height="62" rx="6"/>
    <path d="M236 362v-26a20 20 0 0 1 40 0v26z" fill="${GREEN}"/>
    <rect x="252" y="112" width="8" height="40" rx="4"/>
  </g>
  <path d="M268 96a20 20 0 1 1-12-34 16 16 0 1 0 12 34z" fill="#f2c94c"/>
</svg>`;

const source = process.argv[2] ? readFileSync(process.argv[2]) : Buffer.from(PLACEHOLDER);
const out = new URL('../apps/web/public/', import.meta.url);
const app = new URL('../apps/web/app/', import.meta.url);
mkdirSync(out, { recursive: true });

async function png(size, target) {
  writeFileSync(target, await sharp(source).resize(size, size).png().toBuffer());
}

await png(192, new URL('icon-192.png', out));
await png(512, new URL('icon-512.png', out));
await png(512, new URL('icon-maskable-512.png', out));
await png(180, new URL('apple-icon.png', app));
await png(48, new URL('icon.png', app));
console.log('Icons written to apps/web/public and apps/web/app');
