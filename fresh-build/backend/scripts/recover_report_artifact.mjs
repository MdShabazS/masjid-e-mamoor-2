#!/usr/bin/env node
// Server-side maintenance only. Dry run unless --apply and exact confirmation are supplied.
import { createClient } from '@supabase/supabase-js';
import {
  inspectReportArtifactRecovery,
  recoverReportArtifact,
} from '../reports/artifact-recovery.js';

function argument(name) {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  return value && !value.startsWith('--') ? value : undefined;
}

async function main() {
  const runId = argument('--run');
  const format = argument('--format');
  const apply = process.argv.includes('--apply');
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
    throw new Error('service_credentials_required');
  if (apply && process.env.REPORT_ARTIFACT_RECOVERY_ENABLED !== 'true')
    throw new Error('artifact_recovery_disabled');
  if (apply && argument('--confirm') !== `${runId}/${format}`)
    throw new Error('exact_recovery_confirmation_required');
  const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const result = apply
    ? await recoverReportArtifact({ client, runId, format, operatorNote: argument('--operator') })
    : await inspectReportArtifactRecovery({ client, runId, format });
  process.stdout.write(`${JSON.stringify({ mode: apply ? 'applied' : 'dry_run', ...result })}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
