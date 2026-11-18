// Many virtual phones using the Masjid app at once, through the same web and database endpoints
// a phone uses. Local stack only: never point it at staging or production.
// Results of the 18 Nov 2026 run: docs/LOAD_TEST_2026-11-18.md
// Needs: supabase start, apps/web/.env.local for the local stack, `next start -p 3000`, and the
// first System Admin's password file from bootstrap_system_admin.py --local saved as sysadmin.txt
// in LOAD_TEST_DIR (default: the current folder).
//   node backend/scripts/phone_load_test.mjs setup 50       President, Treasurer and 50 members
//   node backend/scripts/phone_load_test.mjs run 10 45 [burst]   10 phones for 45 s (burst = no pauses)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = process.env.LOAD_TEST_DIR ?? process.cwd() + '/';
const web = 'http://127.0.0.1:3000';
const envFile = fileURLToPath(new URL('../../apps/web/.env.local', import.meta.url));
const env = Object.fromEntries(
  readFileSync(envFile, 'utf8').split('\n').filter(Boolean).map((l) => l.split(/=(.*)/s).slice(0, 2)),
);
const api = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const stateFile = dir + 'state.json';

async function identity(path, body, token) {
  const res = await fetch(`${web}/api/v1${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} ${res.status} ${json?.error?.code ?? ''}`);
  return json.data;
}
async function rpc(token, name, args = {}) {
  const res = await fetch(`${api}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: anonKey, authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(args),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${name} ${res.status} ${text.slice(0, 120)}`);
  return text ? JSON.parse(text) : null;
}
async function firstSignIn(username, temporary, chosen) {
  const first = await identity('/session', { username, password: temporary });
  await identity('/session/change-password', { refreshToken: first.session.refresh_token, newPassword: chosen }, first.session.access_token);
  return (await identity('/session', { username, password: chosen })).session;
}
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

async function setup(count) {
  const tmp = readFileSync(dir + 'sysadmin.txt', 'utf8').match(/Temporary password: (\S+)/)[1];
  const admin = await firstSignIn('sys.admin', tmp, 'Load-Test-Admin-2026');
  const people = [];
  const make = async (username, role) => {
    const made = await identity('/users', { username, role }, admin.access_token);
    const session = await firstSignIn(username, made.temporaryPassword, `Load-Test-${username}-26`);
    people.push({ username, role, token: session.access_token, id: made.userId });
  };
  await make('load.president', 'president');
  await make('load.treasurer', 'treasurer');
  for (let i = 1; i <= count; i += 1) {
    await make(`load.m${String(i).padStart(2, '0')}`, 'member');
    if (i % 25 === 0) await new Promise((r) => setTimeout(r, 61000)); // account creation: 30 a minute per address
  }
  const president = people.find((p) => p.role === 'president');
  await rpc(president.token, 'create_work_task', {
    p_title: 'Eid preparation volunteers', p_description: 'Load test task', p_date: null, p_location: null,
    p_mode: 'open', p_total: 40, p_invited: 0, p_volunteer: 40, p_operation_id: crypto.randomUUID(),
  });
  writeFileSync(stateFile, JSON.stringify({ people, createdAt: Date.now() }));
  console.log(`setup: ${people.length} accounts, task with 40 places`);
}

async function run(phones, seconds, burst) {
  const { people } = JSON.parse(readFileSync(stateFile, 'utf8'));
  const members = people.filter((p) => p.role === 'member').slice(0, phones);
  const stats = new Map();
  const record = (name, ms, ok, why) => {
    const s = stats.get(name) ?? { times: [], errors: 0, why: new Map() };
    if (ok) s.times.push(ms); else { s.errors += 1; s.why.set(why, (s.why.get(why) ?? 0) + 1); }
    stats.set(name, s);
  };
  const timed = async (name, fn) => {
    const t = performance.now();
    try { const v = await fn(); record(name, performance.now() - t, true); return v; }
    catch (e) { record(name, performance.now() - t, false, String(e.message).slice(0, 80)); return null; }
  };
  const pause = () => (burst ? null : new Promise((r) => setTimeout(r, 1000 + Math.random() * 2000)));
  const end = Date.now() + seconds * 1000;
  let donations = 0;
  async function phone(person, index) {
    let joined = false;
    let step = 0;
    while (Date.now() < end) {
      step += 1;
      await timed('open Home page', async () => { const r = await fetch(`${web}/home`); await r.text(); if (!r.ok) throw new Error(r.status); });
      await timed('role check', () => rpc(person.token, 'current_app_role'));
      await pause();
      const tasks = await timed('Tasks list', () => rpc(person.token, 'list_visible_work_tasks'));
      if (!joined && tasks?.length) {
        const ok = await timed('join task (40 places)', () => rpc(person.token, 'join_work_task', { p_task_id: tasks[0].task_id, p_operation_id: crypto.randomUUID() }));
        joined = ok !== null;
      }
      await pause();
      await timed('Meetings list', () => rpc(person.token, 'list_visible_committee_meetings'));
      await timed('Notifications', () => rpc(person.token, 'list_my_member_inbox', { p_limit: 25 }));
      await pause();
      await timed('Activity points', () => rpc(person.token, 'member_activity', { p_member_id: person.id, p_start: `${today.slice(0, 7)}-01`, p_end_exclusive: '2027-01-01' }));
      if (step % 3 === 1) {
        const ok = await timed('submit donation', () => rpc(person.token, 'submit_one_time_donation', {
          p_name: `Load donor ${index}-${step}`, p_kind: 'other', p_referrer_id: null, p_date: today,
          p_method: 'cash', p_amount_paise: 10000 + step, p_evidence: `Load slip ${index}-${step}`, p_operation_id: crypto.randomUUID(),
        }));
        if (ok !== null) donations += 1;
      }
      await pause();
    }
  }
  const started = performance.now();
  await Promise.all(members.map((m, i) => phone(m, i)));
  const elapsed = (performance.now() - started) / 1000;
  let total = 0; let errors = 0;
  const pct = (arr, p) => (arr.length ? arr.sort((a, b) => a - b)[Math.min(arr.length - 1, Math.floor(arr.length * p))] : 0);
  const rows = [];
  for (const [name, s] of stats) {
    total += s.times.length + s.errors; errors += s.errors;
    rows.push({ name, ok: s.times.length, errors: s.errors, p50: Math.round(pct(s.times, 0.5)), p95: Math.round(pct(s.times, 0.95)), max: Math.round(Math.max(0, ...s.times)), why: [...s.why].map(([w, n]) => `${n}× ${w}`).join('; ') });
  }
  const summary = { phones, seconds, burst: !!burst, requests: total, errors, perSecond: +(total / elapsed).toFixed(1), donations, rows };
  console.log(JSON.stringify(summary, null, 1));
  const all = existsSync(dir + 'results.json') ? JSON.parse(readFileSync(dir + 'results.json', 'utf8')) : [];
  all.push(summary); writeFileSync(dir + 'results.json', JSON.stringify(all));
}

const [mode, a, b, c] = process.argv.slice(2);
if (mode === 'setup') await setup(Number(a));
else if (mode === 'run') await run(Number(a), Number(b), c === 'burst');
