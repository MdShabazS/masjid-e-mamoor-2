#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { evaluateHealth } from '../backend/ops/health.js';

try {
  if (process.argv.length !== 3)
    throw new Error('usage: node scripts/ops_health.js <redacted-snapshot.json>');
  const result = evaluateHealth(JSON.parse(readFileSync(process.argv[2], 'utf8')));
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  if (result.status !== 'healthy') process.exitCode = 1;
} catch {
  // Never echo a malformed snapshot; it might contain private fields.
  process.stderr.write('Health snapshot unavailable or invalid\n');
  process.exitCode = 2;
}
