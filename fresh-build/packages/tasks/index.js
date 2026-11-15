const active = new Set(['confirmed', 'completion_submitted', 'returned', 'verified']);
const roles = new Set(['president', 'vice_president', 'secretary']);

export function createTask(input) {
  const { creator, totalCap, invitedCap, volunteerCap, mode } = input;
  if (!creator?.active || !roles.has(creator.role)) throw new Error('creator_not_authorized');
  if (
    !['direct', 'open', 'mixed'].includes(mode) ||
    !Number.isSafeInteger(totalCap) ||
    totalCap < 1 ||
    !Number.isSafeInteger(invitedCap) ||
    invitedCap < 0 ||
    !Number.isSafeInteger(volunteerCap) ||
    volunteerCap < 0 ||
    totalCap > invitedCap + volunteerCap ||
    (mode === 'direct' && volunteerCap !== 0) ||
    (mode === 'open' && invitedCap !== 0) ||
    (mode === 'mixed' && (invitedCap === 0 || volunteerCap === 0))
  )
    throw new Error('invalid_task_capacity');
  if (!input.title?.trim() || !input.description?.trim()) throw new Error('invalid_task');
  return {
    id: input.id,
    creatorId: creator.id,
    title: input.title.trim(),
    description: input.description.trim(),
    mode,
    totalCap,
    invitedCap,
    volunteerCap,
    status: 'active',
    participants: [],
  };
}

function occupied(task, source) {
  return task.participants.filter((p) => active.has(p.status) && (!source || p.source === source))
    .length;
}
function hasSpace(task, source) {
  return (
    occupied(task) < task.totalCap &&
    occupied(task, source) < (source === 'invited' ? task.invitedCap : task.volunteerCap)
  );
}
function copy(task) {
  return structuredClone(task);
}
function assertActor(task, actor) {
  if (task.status !== 'active') throw new Error('task_not_active');
  if (!actor?.active || !actor.id || actor.id === task.creatorId) throw new Error('not_eligible');
}

export function invite(task, creator, member) {
  if (
    task.status !== 'active' ||
    creator?.active !== true ||
    creator.id !== task.creatorId ||
    !member?.active ||
    !member.id ||
    member.role === 'system_admin' ||
    member.id === creator.id ||
    task.invitedCap === 0
  )
    throw new Error('invitation_not_authorized');
  if (task.participants.some((p) => p.memberId === member.id))
    throw new Error('already_participating');
  const next = copy(task);
  next.participants.push({
    memberId: member.id,
    source: 'invited',
    status: 'invited',
    queueNo: null,
  });
  return next;
}

export function join(task, actor, source, queueNo) {
  assertActor(task, actor);
  if (!Number.isSafeInteger(queueNo) || queueNo < 1) throw new Error('invalid_queue');
  const next = copy(task);
  let p = next.participants.find((item) => item.memberId === actor.id);
  if (source === 'invited') {
    if (!p || p.status !== 'invited') throw new Error('invitation_required');
  } else if (source === 'volunteer') {
    if (!['open', 'mixed'].includes(task.mode) || p) throw new Error('volunteer_not_eligible');
    p = { memberId: actor.id, source, status: 'invited', queueNo: null };
    next.participants.push(p);
  } else throw new Error('invalid_source');
  p.status = hasSpace(next, source) ? 'confirmed' : 'waitlisted';
  p.queueNo = queueNo;
  return next;
}

export function release(task, actor) {
  assertActor(task, actor);
  const next = copy(task);
  const p = next.participants.find((item) => item.memberId === actor.id);
  if (!p || !['invited', 'confirmed', 'waitlisted'].includes(p.status))
    throw new Error('not_releasable');
  const frees = p.status === 'confirmed';
  p.status = p.status === 'invited' ? 'declined' : 'withdrawn';
  if (frees) promote(next);
  return next;
}

function promote(task) {
  while (occupied(task) < task.totalCap) {
    const candidate = task.participants
      .filter((p) => p.status === 'waitlisted' && hasSpace(task, p.source))
      .sort((a, b) => a.queueNo - b.queueNo)[0];
    if (!candidate) break;
    candidate.status = 'confirmed';
  }
}

export function submitCompletion(task, actor, note = null) {
  assertActor(task, actor);
  const next = copy(task);
  const p = next.participants.find((item) => item.memberId === actor.id);
  if (!p || !['confirmed', 'returned'].includes(p.status)) throw new Error('not_confirmed');
  p.status = 'completion_submitted';
  p.note = note?.trim() || null;
  return next;
}

export function reviewCompletion(task, creator, memberId, decision, reason = null) {
  if (
    task.status !== 'active' ||
    creator?.active !== true ||
    creator.id !== task.creatorId ||
    creator.id === memberId ||
    !['accept', 'return'].includes(decision) ||
    (decision === 'return' && !reason?.trim())
  )
    throw new Error('review_not_authorized');
  const next = copy(task);
  const p = next.participants.find((item) => item.memberId === memberId);
  if (!p || p.status !== 'completion_submitted') throw new Error('not_submitted');
  p.status = decision === 'accept' ? 'verified' : 'returned';
  p.reviewReason = decision === 'return' ? reason.trim() : null;
  return next;
}

export function taskPoints(tasks, memberId) {
  return tasks.reduce(
    (sum, t) =>
      sum +
      t.participants.filter(
        (p) => p.memberId === memberId && p.status === 'verified' && t.status === 'active',
      ).length,
    0,
  );
}
