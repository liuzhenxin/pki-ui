import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import assert from 'node:assert/strict';

const options = {};
const input = process.argv.slice(2);
while (input.length) {
  const key = input.shift();
  assert(['--report', '--suite', '--require'].includes(key) && input.length, 'Invalid guard option');
  options[key.slice(2)] = input.shift();
}
assert(options.report && options.suite, 'Explicit current report and suite required');
const manifest = JSON.parse(readFileSync('tests/csp/manifest.json', 'utf8'));
const suite = manifest[options.suite];
assert(suite, 'Unknown suite');
const path = resolve(options.report);
const receipt = JSON.parse(readFileSync(resolve(dirname(path), 'receipt.json'), 'utf8'));
assert.equal(receipt.report, path);
assert.equal(receipt.suite, options.suite);
assert.equal(receipt.evidenceKind, suite.evidenceKind);
assert.equal(dirname(path), resolve('test-results/csp', options.suite, receipt.id));
assert(statSync(path).mtimeMs >= receipt.startedAt, 'Stale report');
const report = JSON.parse(readFileSync(path, 'utf8'));
const executed = [];
if (options.suite === 'unit') {
  assert(report.numTotalTests > 0 && report.numPassedTests === report.numTotalTests, 'All collected tests must pass');
  assert.equal(report.numFailedTests, 0);
  assert.equal(report.numPendingTests, 0);
  assert.equal(report.numTodoTests ?? 0, 0);
  assert.equal(report.success, true);
  for (const file of report.testResults)
    for (const test of file.assertionResults) {
      assert(resolve(file.name).startsWith(resolve('tests/csp/unit') + '/'), 'Incorrect unit evidence source');
      assert.equal(test.status, 'passed');
      executed.push(test.fullName);
    }
} else {
  assert.equal((report.errors ?? []).length, 0);
  assert.equal(report.stats.unexpected, 0);
  assert.equal(report.stats.skipped, 0);
  assert.equal(report.stats.flaky, 0);
  const visit = (node) => {
    for (const spec of node.specs ?? [])
      for (const test of spec.tests) {
        const expectedDirectory = options.suite === 'contract' ? 'contract' : options.suite;
        const specPath = spec.file.replaceAll('\\', '/');
        assert(
          specPath.startsWith(`${expectedDirectory}/`) || specPath.includes(`/tests/csp/${expectedDirectory}/`),
          'Incorrect browser evidence source'
        );
        assert.equal(test.expectedStatus, 'passed');
        assert.equal(test.status, 'expected');
        assert.equal(test.results.length, 1);
        assert.equal(test.results[0].status, 'passed');
        executed.push(spec.title);
      }
    for (const child of node.suites ?? []) visit(child);
  };
  visit(report);
  assert(executed.length > 0 && executed.length === report.stats.expected, 'Nonzero actual passing tests required');
}
const requirements = options.require ? options.require.split(',') : Object.keys(suite.required);
for (const name of requirements) {
  assert(suite.required[name], `Unknown required scenario ${name}`);
  assert(
    executed.some((title) => title.includes(suite.required[name])),
    `Missing executed scenario ${name}`
  );
}
for (const name of ['unit-smoke', 'e2e-smoke']) {
  if (requirements.includes(name))
    assert.equal(executed.filter((title) => title.includes(suite.required[name])).length, 1, 'Bootstrap smoke must run exactly once');
}
const scan = (directory) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = resolve(directory, entry.name);
    if (entry.isDirectory()) scan(file);
    else if (/\.(test|spec)\.ts$/.test(entry.name)) {
      const source = readFileSync(file, 'utf8');
      assert(!/\.(only|skip|fixme)\s*\(/.test(source), 'Focused or skipped tests forbidden');
      assert(!/\breturn\s*;/.test(source), 'Early return forbidden in CSP tests');
    }
  }
};
scan('tests/csp');
assert(!/passWithNoTests\s*:\s*true/.test(readFileSync('vitest.csp.config.ts', 'utf8')));
writeFileSync(resolve(dirname(path), 'verified.json'), JSON.stringify({ ...receipt, collected: executed.length, passed: executed.length }), {
  flag: 'wx'
});
console.log(`CSP ${options.suite}: collected=${executed.length}, passed=${executed.length}, evidence=${suite.evidenceKind}`);
