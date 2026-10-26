/** Shared browser/Android-compatible client. Only a publishable-key,
 * authenticated Supabase client may be injected here; authorization is SQL-side.
 */
export function parseINRToPaise(value) {
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value)) {
    throw new Error('invalid_inr_amount');
  }
  const [rupees, fraction = ''] = value.split('.');
  const paise = BigInt(rupees) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (paise <= 0n || paise > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('invalid_inr_amount');
  }
  return Number(paise);
}

/** Format a bigint/decimal-string amount without converting ledger paise to float. */
export function formatPaiseINR(value) {
  if (
    typeof value !== 'string' &&
    typeof value !== 'bigint' &&
    !(typeof value === 'number' && Number.isSafeInteger(value))
  )
    throw new Error('invalid_paise_amount');
  if (typeof value === 'string' && !/^-?(?:0|[1-9]\d*)$/.test(value))
    throw new Error('invalid_paise_amount');
  const paise = BigInt(value);
  const absolute = paise < 0n ? -paise : paise;
  const rupees = absolute / 100n;
  const digits = rupees.toString();
  const head =
    digits.length > 3 ? digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' : '';
  const grouped = head + digits.slice(-3);
  return `${paise < 0n ? '-' : ''}₹${grouped}.${(absolute % 100n).toString().padStart(2, '0')}`;
}

async function call(client, name, args) {
  const { data, error } = await client.rpc(name, args);
  if (error) throw error;
  return data;
}

function requireOperationId(value) {
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value ?? ''))
    throw new Error('operation_id_required');
  return value;
}

function positivePaiseText(value) {
  if (typeof value === 'number' && !Number.isSafeInteger(value))
    throw new Error('invalid_expected_amount');
  const text = String(value);
  if (!/^[1-9][0-9]*$/.test(text)) throw new Error('invalid_expected_amount');
  return text;
}

function staffReason(value) {
  const reason = value?.trim() ?? '';
  if (reason.length < 3 || reason.length > 240) throw new Error('invalid_staff_reason');
  return reason;
}

export function createManagementApi(authenticatedClient) {
  if (!authenticatedClient || typeof authenticatedClient.rpc !== 'function') {
    throw new Error('authenticated_client_required');
  }
  return {
    getMyRole: () => call(authenticatedClient, 'current_app_role', {}),
    listMonthlyDonors: () => call(authenticatedClient, 'list_monthly_donors', {}),
    listPendingMonthlyClaims: () => call(authenticatedClient, 'list_pending_monthly_claims', {}),
    listActiveMasjidAccounts: () => call(authenticatedClient, 'list_active_masjid_accounts', {}),
    submitMonthlyClaim: ({ donorId, periodDate, transactionId }) =>
      call(authenticatedClient, 'submit_monthly_claim', {
        p_donor_id: donorId,
        p_period_date: periodDate,
        p_transaction_id: transactionId,
      }),
    verifyMonthlyClaim: ({ claimId, accountId, actualAmountINR, operationId }) => {
      return call(authenticatedClient, 'verify_monthly_claim', {
        p_claim_id: claimId,
        p_account_id: accountId,
        p_actual_amount_paise: parseINRToPaise(actualAmountINR),
        p_operation_id: requireOperationId(operationId),
      });
    },
    rejectMonthlyClaim: ({ claimId, reason, operationId }) => {
      const trimmedReason = reason?.trim() ?? '';
      if (trimmedReason.length < 3 || trimmedReason.length > 500)
        throw new Error('invalid_rejection_reason');
      return call(authenticatedClient, 'reject_monthly_claim', {
        p_claim_id: claimId,
        p_reason: trimmedReason,
        p_operation_id: requireOperationId(operationId),
      });
    },
    updateMonthlyDonorSuggestion: ({
      donorId,
      expectedAmountPaise,
      newAmountINR,
      reason,
      operationId,
    }) =>
      call(authenticatedClient, 'update_monthly_donor_suggestion', {
        p_donor_id: donorId,
        p_expected_amount_paise: positivePaiseText(expectedAmountPaise),
        p_new_amount_paise: parseINRToPaise(newAmountINR),
        p_reason: staffReason(reason),
        p_operation_id: requireOperationId(operationId),
      }),
    optOutMonthlyDonor: ({ donorId, sourceReference, operationId }) =>
      call(authenticatedClient, 'staff_opt_out_monthly_donor', {
        p_donor_id: donorId,
        p_source_reference: staffReason(sourceReference),
        p_operation_id: requireOperationId(operationId),
      }),
  };
}
