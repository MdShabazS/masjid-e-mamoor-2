/** Narrow finance capabilities for the first fresh-build commands.
 * All callers must use a backend-authenticated actor, never a client role claim.
 */
export function canEnrollContributor(actor) {
  return (
    actor?.active === true &&
    [
      'president',
      'vice_president',
      'secretary',
      'treasurer',
      'committee_member',
      'data_entry',
    ].includes(actor.role)
  );
}

export function canReadDetailedFinance(actor) {
  return (
    actor?.active === true &&
    ['system_admin', 'president', 'vice_president', 'secretary', 'treasurer'].includes(actor.role)
  );
}

export function canDecideExpense(actor, expense) {
  if (
    actor?.active !== true ||
    expense?.status !== 'submitted' ||
    !actor.id ||
    actor.id === expense.requesterId
  )
    return false;
  if (!expense.requesterRoleAtSubmission) return false;
  return expense.requesterRoleAtSubmission === 'president'
    ? actor.role === 'treasurer'
    : actor.role === 'president';
}

export function canPayApprovedExpense(actor, expense) {
  return actor?.active === true && actor.role === 'treasurer' && expense?.status === 'approved';
}
