// scan.mjs — invocation safety and run-to-history lifecycle contract.
//
// A prior `node scan.mjs --help` silently ran a real scan. These tests keep
// usage/typo invocations non-mutating and prove that a completed run identifies
// its exact history rows rather than relying on whichever scan-runs row was
// already present.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SCRIPT = join(ROOT, 'scan.mjs');

function run(args, cwd, env = {}) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd,
    encoding: 'utf-8',
    timeout: 30_000,
    env: { ...process.env, ...env },
  });
}

test('--help exits successfully without creating scan state', () => {
  const dir = mkdtempSync(join(tmpdir(), 'scan-help-'));
  try {
    const result = run(['--help'], dir);
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Usage: node scan\.mjs/);
    assert.equal(existsSync(join(dir, 'data')), false, 'help must not create scan state');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('unknown flags fail before scanning or creating state', () => {
  const dir = mkdtempSync(join(tmpdir(), 'scan-unknown-'));
  try {
    const result = run(['--definitely-not-a-scan-option'], dir);
    assert.equal(result.error, undefined);
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}${result.stderr}`, /unknown option: --definitely-not-a-scan-option/);
    assert.equal(existsSync(join(dir, 'data')), false, 'an invalid invocation must not create scan state');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('completed run links scan-runs and added history rows through one run_id', () => {
  const dir = mkdtempSync(join(tmpdir(), 'scan-lifecycle-'));
  try {
    mkdirSync(join(dir, 'data'), { recursive: true });
    writeFileSync(join(dir, 'data', 'applications.md'), `# Applications Tracker

| # | Date | Company | Role | Score | Status | PDF | Report | Notes |
|---|------|---------|------|-------|--------|-----|--------|-------|
`);
    // Reproduce an installation created before run_id existed. The scanner must
    // widen the headers without losing the legacy rows before appending this run.
    writeFileSync(join(dir, 'data', 'scan-runs.tsv'), 'timestamp\tstatus\tcompanies\tboards\tfound\tfiltered_title\tfiltered_tier\tfiltered_location\tfiltered_posting_age\tfiltered_salary\tfiltered_content\tfiltered_cooldown\tdupes\tnew_added\terrors\tfiltered_blacklist\tfiltered_visa\tfiltered_posted_date\tfiltered_country_eligibility\nlegacy\tcompleted\t1\t0\t0\t0\t0\t0\t0\t0\t0\t0\t0\t0\t0\t0\t0\t0\t0\n');
    writeFileSync(join(dir, 'data', 'scan-history.tsv'), 'url\tfirst_seen\tportal\ttitle\tcompany\tstatus\tlocation\nhttps://legacy.example/job\t2026-01-01\tfixture\tLegacy\tLegacy\tadded\tRemote\n');
    writeFileSync(join(dir, 'portals.yml'), `title_filter:
  positive:
    - "Strategic Finance"
tracked_companies:
  - name: Fixture Defense
    careers_url: https://boards.example.com/fixture
    parser:
      command: node
      script: tests/fixtures/three-city-board.mjs
`);

    const output = execFileSync(process.execPath, [SCRIPT], {
      cwd: dir,
      encoding: 'utf-8',
      timeout: 30_000,
      env: { ...process.env },
    });
    const runId = output.match(/^Run ID: (scan-[^\s]+)$/m)?.[1];
    assert.ok(runId, `scan output must expose its run id: ${output}`);

    const runLines = readFileSync(join(dir, 'data', 'scan-runs.tsv'), 'utf-8').trim().split('\n');
    const runHeader = runLines[0].split('\t');
    const runIdColumn = runHeader.indexOf('run_id');
    assert.ok(runIdColumn >= 0, 'scan-runs header must name run_id');
    const completed = runLines.slice(1).map(line => line.split('\t'))
      .find(row => row[runHeader.indexOf('status')] === 'completed' && row[runIdColumn] === runId);
    assert.ok(completed, 'one completed summary must belong to the emitted run id');

    const historyLines = readFileSync(join(dir, 'data', 'scan-history.tsv'), 'utf-8').trim().split('\n');
    const historyHeader = historyLines[0].split('\t');
    const historyRunIdColumn = historyHeader.indexOf('run_id');
    assert.ok(historyRunIdColumn >= 0, 'scan-history header must name run_id');
    const added = historyLines.slice(1).map(line => line.split('\t'))
      .filter(row => row[historyHeader.indexOf('status')] === 'added' && row[historyRunIdColumn] === runId);
    assert.ok(added.length > 0, `the completed run must identify its own added URLs: ${JSON.stringify(historyLines)}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
