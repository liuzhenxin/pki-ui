import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

const input = process.argv.slice(2);
const suite = input.shift();
if (suite === 'all-mock') {
  for (const child of ['unit', 'e2e', 'a11y', 'visual', 'security']) {
    const result = spawnSync(process.execPath, ['scripts/run-csp-suite.mjs', child, ...input], { shell: false, stdio: 'inherit' });
    if (result.error || result.status !== 0) process.exit(result.status || 1);
  }
  process.exit(0);
}
const suites = ['unit', 'e2e', 'a11y', 'visual', 'security', 'contract'];
if (!suites.includes(suite)) throw new Error('Unknown CSP suite');
let required;
while (input.length && input[0] !== '--') {
  if (input.shift() !== '--require' || !input.length) throw new Error('Unknown wrapper option');
  required = input.shift();
}
if (input.shift() !== '--') throw new Error('Runner arguments must follow --');
if (input.some((arg) => /reporter|outputFile|output-file|config|pass-with-no-tests|--list|--help/.test(arg))) {
  throw new Error('Runner may not override configuration or report ownership');
}
const id = randomUUID();
const directory = resolve('test-results/csp', suite, id);
mkdirSync(directory, { recursive: true });
const report = resolve(directory, 'report.json');
const unit = suite === 'unit';
const executable = resolve('node_modules', unit ? 'vitest/vitest.mjs' : '@playwright/test/cli.js');
const args = unit
  ? [executable, 'run', '--config', 'vitest.csp.config.ts', '--reporter=json', `--outputFile=${report}`, ...input]
  : [
      executable,
      'test',
      '--config',
      suite === 'contract' ? 'playwright.csp.live.config.ts' : 'playwright.csp.config.ts',
      '--reporter=json',
      ...(input.length ? input : [`tests/csp/${suite}`])
    ];
const startedAt = Date.now();
const runnerArgs = unit ? args : [...args, `--output=${resolve(directory, 'artifacts')}`];
const result = spawnSync(process.execPath, runnerArgs, {
  shell: false,
  stdio: 'inherit',
  env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: report }
});
if (result.error || result.status !== 0) process.exit(result.status || 1);
writeFileSync(
  resolve(directory, 'receipt.json'),
  JSON.stringify({
    id,
    suite,
    report,
    startedAt,
    evidenceKind: { unit: 'unit', e2e: 'mock', a11y: 'a11y', visual: 'visual', security: 'security', contract: 'live' }[suite]
  }),
  { flag: 'wx' }
);
const guard = spawnSync(
  process.execPath,
  ['scripts/verify-csp-results.mjs', '--report', report, '--suite', suite, ...(required ? ['--require', required] : [])],
  { shell: false, stdio: 'inherit' }
);
process.exit(guard.status || (guard.error ? 1 : 0));
