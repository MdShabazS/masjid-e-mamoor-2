import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const app = resolve('apps/web');
for (const name of ['.env', '.env.local', '.env.production', '.env.production.local'])
  if (existsSync(resolve(app, name)))
    throw new Error('Smoke requires an unconfigured web checkout');
const port = await new Promise((resolvePort, reject) => {
  const server = createServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    if (!address || typeof address === 'string') {
      reject(new Error('Smoke server did not bind to a TCP port'));
      server.close();
      return;
    }
    const value = address.port;
    server.close(() => resolvePort(value));
  });
});
const env = { ...process.env };
for (const key of Object.keys(env))
  if (/^(SUPABASE_|NEXT_PUBLIC_SUPABASE_|META_|QUEUE_CRON_SECRET)/.test(key)) delete env[key];
const canaries = (process.env.BUNDLE_SECRET_CANARIES ?? '').split(',').filter(Boolean);
const server = spawn(
  process.execPath,
  [
    resolve(app, 'node_modules/next/dist/bin/next'),
    'start',
    '--port',
    String(port),
    '--hostname',
    '127.0.0.1',
  ],
  { cwd: app, env, stdio: 'ignore' },
);
const base = `http://127.0.0.1:${port}`;
try {
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    if (server.exitCode !== null) throw new Error('Web process exited before ready');
    try {
      const response = await fetch(base + '/login');
      if (response.status === 200) {
        ready = true;
        break;
      }
    } catch {
      /* startup is in progress */
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  if (!ready) throw new Error('Web process did not become ready');
  for (const path of ['/', '/announcements', '/login']) {
    const response = await fetch(base + path);
    if (response.status !== 200 || !response.headers.get('content-type')?.includes('text/html'))
      throw new Error(`Unexpected public page: ${path} ${response.status}`);
    const html = await response.text();
    if (canaries.some((canary) => html.includes(canary)))
      throw new Error(`Server-only canary reached public HTML: ${path}`);
  }
  const identity = await fetch(base + '/api/v1/me');
  if (
    identity.status !== 503 ||
    !identity.headers.get('content-type')?.includes('application/json') ||
    identity.headers.get('cache-control') !== 'no-store' ||
    (await identity.json()).error.code !== 'SERVICE_UNAVAILABLE'
  )
    throw new Error('Unconfigured identity route did not fail closed');
  for (const path of [
    '/api/jobs/tick',
    '/api/jobs/report-artifacts/tick',
    '/api/management/enroll-donor',
    '/api/management/payment-qr',
    '/api/public/receipt',
    '/api/whatsapp/webhook',
  ]) {
    const response = await fetch(base + path, { method: 'POST' });
    if (response.status !== 503)
      throw new Error(`Unconfigured server route: ${path} ${response.status}`);
  }
  for (const path of ['/api/management/report-csv', '/api/management/report-pdf']) {
    const response = await fetch(base + path);
    if (response.status !== 503 || (await response.json()).error.code !== 'SERVICE_UNAVAILABLE')
      throw new Error(`Unconfigured private report route: ${path} ${response.status}`);
  }
  const capabilities = await fetch(base + '/api/management/report-capabilities');
  if (
    capabilities.status !== 200 ||
    JSON.stringify(await capabilities.json()) !==
      JSON.stringify({ exportsApproved: false, artifactMode: false })
  )
    throw new Error('Unconfigured report capabilities must be disabled');
  const webhookChallenge = await fetch(base + '/api/whatsapp/webhook');
  if (webhookChallenge.status !== 403)
    throw new Error('Unconfigured WhatsApp verification must be denied');
  const qrRead = await fetch(
    base + '/api/management/payment-qr?accountId=11111111-1111-4111-8111-111111111111',
  );
  if (qrRead.status !== 503 || (await qrRead.json()).error.code !== 'SERVICE_UNAVAILABLE')
    throw new Error('Unconfigured private QR read did not fail closed');
  console.log(
    'Public pages 200; identity, jobs, management, receipt, WhatsApp and private QR/report routes fail closed without configuration',
  );
} finally {
  if (server.exitCode === null && server.signalCode === null) {
    server.kill('SIGTERM');
    await new Promise((done) => server.once('exit', done));
  }
}
