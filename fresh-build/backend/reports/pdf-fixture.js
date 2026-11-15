export const sample = {
  runId: '9871a273-7389-44af-ae1f-cb3d0dcd07be',
  metadata: {
    period_kind: 'month',
    start_date: '2026-10-01',
    end_exclusive_date: '2026-11-01',
    cutoff_at: '2026-10-21T00:00:00Z',
    include_proofs: false,
  },
  lines: [
    {
      effect_id: 'e1',
      account_id: 'a1',
      source_type: 'account_opening',
      source_id: 'o1',
      leg: 1,
      category: 'opening',
      amount_paise: '12345',
      occurred_at: '2026-10-20T00:00:00Z',
      description: 'मस्जिद opening',
    },
  ],
  balances: [
    {
      account_id: 'a1',
      account_name: 'Cash',
      opening_paise: '0',
      period_openings_paise: '12345',
      income_paise: '0',
      expense_paise: '0',
      transfer_paise: '0',
      closing_paise: '12345',
    },
  ],
};
