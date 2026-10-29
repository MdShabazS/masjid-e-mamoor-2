import { parseINRToPaise } from '../api-client/index.js';

const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DRAFTS = 20;
// SecureStore keys accept letters, digits, '.', '-', and '_'.
const PREFIX = 'mem2_drafts_v1_';

function text(value, min, max) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max)
    throw new Error('invalid_draft');
  return value.trim();
}

function date(value) {
  if (
    !DATE.test(value ?? '') ||
    Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ||
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value
  )
    throw new Error('invalid_draft');
  return value;
}

function fields(input, names) {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some((key) => !names.includes(key))
  )
    throw new Error('invalid_draft');
}

export function validateDraft(kind, input) {
  if (kind === 'donation') {
    fields(input, ['name', 'kind', 'date', 'method', 'amountINR', 'evidence', 'referrerId']);
    if (
      !['member', 'other'].includes(input.kind) ||
      !['cash', 'upi', 'bank'].includes(input.method) ||
      (input.referrerId != null && !UUID.test(input.referrerId))
    )
      throw new Error('invalid_draft');
    return {
      name: text(input.name, 1, 200),
      kind: input.kind,
      date: date(input.date),
      method: input.method,
      amountPaise: parseINRToPaise(input.amountINR),
      evidence: text(input.evidence, 3, 240),
      referrerId: input.referrerId ?? null,
    };
  }
  if (kind === 'expense') {
    fields(input, ['title', 'description', 'category', 'amountINR', 'bill', 'missingReason']);
    const bill = input.bill?.trim() || null,
      missingReason = input.missingReason?.trim() || null;
    if (!bill && !missingReason) throw new Error('invalid_draft');
    return {
      title: text(input.title, 1, 160),
      description: text(input.description, 1, 2000),
      category: text(input.category, 1, 80),
      amountPaise: parseINRToPaise(input.amountINR),
      bill: bill ? text(bill, 3, 240) : null,
      missingReason: missingReason ? text(missingReason, 3, 500) : null,
    };
  }
  if (kind === 'task') {
    fields(input, [
      'title',
      'description',
      'date',
      'location',
      'mode',
      'total',
      'invited',
      'volunteer',
    ]);
    const { mode, total, invited, volunteer } = input;
    if (
      !['direct', 'open', 'mixed'].includes(mode) ||
      ![total, invited, volunteer].every((n) => Number.isInteger(n) && n >= 0 && n <= 10000) ||
      total < 1 ||
      total > invited + volunteer ||
      (mode === 'direct' && (invited === 0 || volunteer !== 0)) ||
      (mode === 'open' && (invited !== 0 || volunteer === 0)) ||
      (mode === 'mixed' && (invited === 0 || volunteer === 0))
    )
      throw new Error('invalid_draft');
    return {
      title: text(input.title, 1, 160),
      description: text(input.description, 1, 2000),
      date: date(input.date),
      location: input.location ? text(input.location, 1, 240) : null,
      mode,
      total,
      invited,
      volunteer,
    };
  }
  throw new Error('offline_action_not_allowed');
}

export function rpcForDraft(draft) {
  const p = draft.payload,
    p_operation_id = draft.id;
  if (draft.kind === 'donation')
    return [
      'submit_one_time_donation',
      {
        p_name: p.name,
        p_kind: p.kind,
        p_referrer_id: p.referrerId,
        p_date: p.date,
        p_method: p.method,
        p_amount_paise: p.amountPaise,
        p_evidence: p.evidence,
        p_operation_id,
      },
    ];
  if (draft.kind === 'expense')
    return [
      'submit_expense_request',
      {
        p_title: p.title,
        p_description: p.description,
        p_category: p.category,
        p_amount_paise: p.amountPaise,
        p_bill: p.bill,
        p_missing_reason: p.missingReason,
        p_operation_id,
      },
    ];
  if (draft.kind === 'task')
    return [
      'create_work_task',
      {
        p_title: p.title,
        p_description: p.description,
        p_date: p.date,
        p_location: p.location,
        p_mode: p.mode,
        p_total: p.total,
        p_invited: p.invited,
        p_volunteer: p.volunteer,
        p_operation_id,
      },
    ];
  throw new Error('offline_action_not_allowed');
}

/** Store interface is SecureStore's getItemAsync/setItemAsync/deleteItemAsync. */
export function createDraftQueue({ store, actorId, uuid, client }) {
  if (
    !UUID.test(actorId ?? '') ||
    !store?.getItemAsync ||
    !store?.setItemAsync ||
    !store?.deleteItemAsync ||
    typeof uuid !== 'function'
  )
    throw new Error('invalid_draft_store');
  const indexKey = `${PREFIX}${actorId}_index`;
  const key = (id) => `${PREFIX}${actorId}_${id}`;
  let busy = false;
  async function ids() {
    const raw = await store.getItemAsync(indexKey);
    if (!raw) return [];
    const value = JSON.parse(raw);
    if (!Array.isArray(value) || value.length > MAX_DRAFTS || !value.every((id) => UUID.test(id)))
      throw new Error('invalid_draft_index');
    return value;
  }
  async function list() {
    const result = [];
    for (const id of await ids()) {
      const raw = await store.getItemAsync(key(id));
      if (!raw) continue; // Crash after index write, before item write.
      const value = JSON.parse(raw);
      if (
        value.id !== id ||
        value.actorId !== actorId ||
        !['pending', 'conflict', 'rejected'].includes(value.state)
      )
        throw new Error('invalid_stored_draft');
      result.push(value);
    }
    return result;
  }
  async function add(kind, input) {
    if (busy) throw new Error('draft_queue_busy');
    busy = true;
    try {
      const payload = validateDraft(kind, input),
        existing = [];
      for (const candidate of await ids()) {
        if (await store.getItemAsync(key(candidate))) existing.push(candidate);
      }
      if (existing.length >= MAX_DRAFTS) throw new Error('draft_queue_full');
      const id = uuid();
      if (!UUID.test(id) || existing.includes(id)) throw new Error('invalid_operation_id');
      const draft = {
        id,
        actorId,
        kind,
        payload,
        state: 'pending',
        createdAt: new Date().toISOString(),
      };
      // Index first: a crash cannot yield an invisible orphan that replays later.
      await store.setItemAsync(indexKey, JSON.stringify([...existing, id]));
      await store.setItemAsync(key(id), JSON.stringify(draft));
      return draft;
    } finally {
      busy = false;
    }
  }
  async function remove(id) {
    if (busy) throw new Error('draft_queue_busy');
    busy = true;
    try {
      const existing = await ids();
      if (!existing.includes(id)) return false;
      // Delete private content first. If the index update fails, its stale ID
      // is skipped by list() and compacted by the next add().
      await store.deleteItemAsync(key(id));
      await store.setItemAsync(indexKey, JSON.stringify(existing.filter((x) => x !== id)));
      return true;
    } finally {
      busy = false;
    }
  }
  async function sync() {
    if (busy) return { state: 'busy' };
    if (!client?.rpc || !client?.auth?.getUser) throw new Error('authenticated_client_required');
    busy = true;
    const result = { sent: 0, pending: 0, conflict: 0, rejected: 0 };
    try {
      const { data, error } = await client.auth.getUser();
      if (error) return { state: 'offline' };
      if (data?.user?.id !== actorId) return { state: 'session_required' };
      for (const draft of await list()) {
        if (draft.state !== 'pending') continue;
        const [rpc, args] = rpcForDraft(draft);
        let response;
        try {
          response = await client.rpc(rpc, args);
        } catch {
          result.pending++;
          break;
        }
        if (
          !response ||
          response.error?.status >= 500 ||
          response.error?.status === 429 ||
          response.error?.message === 'Failed to fetch'
        ) {
          result.pending++;
          break;
        }
        if (!response.error) {
          const current = await ids();
          // Preserve the same crash ordering as remove(): a failed index write
          // must never leave an invisible copy of submitted private data.
          await store.deleteItemAsync(key(draft.id));
          await store.setItemAsync(indexKey, JSON.stringify(current.filter((x) => x !== draft.id)));
          result.sent++;
          continue;
        }
        const state =
          response.error.code === '23505'
            ? 'conflict'
            : ['22023', '42501', 'P0001', '23514'].includes(response.error.code)
              ? 'rejected'
              : 'pending';
        if (state === 'pending') {
          result.pending++;
          break;
        }
        draft.state = state;
        draft.reason = String(response.error.code);
        await store.setItemAsync(key(draft.id), JSON.stringify(draft));
        result[state]++;
      }
      return result;
    } finally {
      busy = false;
    }
  }
  return { add, list, remove, sync };
}
