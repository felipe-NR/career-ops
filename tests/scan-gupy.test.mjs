// tests/scan-gupy.test.mjs — unit tests for scan-gupy.mjs pure functions.
// No network calls: all functions under test are exported and operate on fixtures.
import { pass, fail } from './helpers.mjs';
import { pathToFileURL } from 'url';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { readFileSync } from 'fs';
import { spawnSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

console.log('\nscan-gupy — pure-function unit tests');

const {
  buildLocation,
  normalizeGupyJob,
  isSafeGupyUrl,
  buildBridgeRequest,
  limitOffers,
  resolveSinceDays,
  validateCliArgs,
  validateRunner,
  waitForSearchCompletion,
} = await import(
  pathToFileURL(join(ROOT, 'scan-gupy.mjs')).href
);

// ── CLI/config validation ──────────────────────────────────────────────────

{
  try {
    validateCliArgs(['--keyword', 'Backend', '--since=7', '--runner', 'api']);
    pass('validateCliArgs: accepts repeatable/value options in supported forms');
  } catch (error) { fail(`validateCliArgs: valid arguments threw: ${error.message}`); }
}

{
  const bridge = spawnSync('python3', [join(ROOT, 'scripts', 'gupy-bridge.py')], {
    input: '[]',
    encoding: 'utf8',
  });
  let payload = null;
  try { payload = JSON.parse(bridge.stdout); } catch { /* assertion below reports it */ }
  if (bridge.status === 1 && payload?.ok === false && /JSON object/.test(payload.error)) {
    pass('gupy bridge: malformed request fails with JSON-only stdout');
  } else {
    fail(`gupy bridge: malformed-request contract mismatch: ${JSON.stringify({ status: bridge.status, stdout: bridge.stdout, stderr: bridge.stderr })}`);
  }
}

{
  try {
    validateCliArgs(['--runer', 'api']);
    fail('validateCliArgs: unknown option must be rejected');
  } catch (error) {
    if (/unknown option/.test(error.message)) pass('validateCliArgs: unknown option is rejected');
    else fail(`validateCliArgs: unexpected error: ${error.message}`);
  }
}

{
  try {
    const days = resolveSinceDays(['--since', '7'], 14);
    if (days === 7) pass('resolveSinceDays: CLI value overrides configuration');
    else fail(`resolveSinceDays: expected 7, got ${days}`);
  } catch (error) { fail(`resolveSinceDays: valid value threw: ${error.message}`); }
}

{
  try {
    resolveSinceDays(['--since', 'not-a-number'], 14);
    fail('resolveSinceDays: malformed CLI value must fail closed');
  } catch (error) {
    if (/positive number/.test(error.message)) pass('resolveSinceDays: malformed CLI value fails closed');
    else fail(`resolveSinceDays: unexpected error: ${error.message}`);
  }
}

{
  try {
    validateRunner('typo');
    fail('validateRunner: unknown runner must be rejected');
  } catch (error) {
    if (/auto, package, api/.test(error.message)) pass('validateRunner: unknown runner is rejected');
    else fail(`validateRunner: unexpected error: ${error.message}`);
  }
}

// ── pipeline fan-out limits ─────────────────────────────────────────────────

{
  const offers = [
    { company: 'A', title: 'old', postedAt: 1 },
    { company: 'A', title: 'new', postedAt: 4 },
    { company: 'A', title: 'mid', postedAt: 3 },
    { company: 'B', title: 'other', postedAt: 2 },
  ];
  const { selected, skipped } = limitOffers(offers, { maxTotal: 3, maxPerCompany: 2 });
  if (selected.map(o => o.title).join(',') === 'new,mid,other' && skipped[0]?.title === 'old') {
    pass('limitOffers: newest-first total and per-company caps');
  } else {
    fail(`limitOffers: unexpected selection ${selected.map(o => o.title).join(',')}`);
  }
}

{
  const source = readFileSync(join(ROOT, 'scan-gupy.mjs'), 'utf8');
  if (!/appendToScanHistory\(capSkipped/.test(source)) {
    pass('run cap is non-destructive: limited offers remain eligible next scan');
  } else {
    fail('run cap persists limited offers as seen and can suppress them forever');
  }
}

{
  const offers = [
    { company: '', title: 'One', url: 'https://one.gupy.io/jobs/1', postedAt: 2 },
    { company: '', title: 'Two', url: 'https://two.gupy.io/jobs/2', postedAt: 1 },
  ];
  const { selected } = limitOffers(offers, { maxTotal: 2, maxPerCompany: 1 });
  if (selected.length === 2) pass('limitOffers: missing company names do not share one company cap');
  else fail(`limitOffers: unrelated unknown companies collapsed to ${selected.length} result(s)`);
}

// ── buildLocation ────────────────────────────────────────────────────────────

{
  const loc = buildLocation({
    workplace_types: ['remote'],
    city: 'Porto Alegre', state: 'RS', country: 'Brasil',
  });
  if (loc === 'Remoto, Porto Alegre, RS, Brasil') pass('buildLocation: remote with city/state/country');
  else fail(`buildLocation: remote with city/state/country → "${loc}"`);
}

{
  const loc = buildLocation({ workplace_types: ['hybrid'], city: 'São Paulo', state: '', country: '' });
  if (loc === 'Híbrido, São Paulo') pass('buildLocation: hybrid with city only');
  else fail(`buildLocation: hybrid with city only → "${loc}"`);
}

{
  const loc = buildLocation({ workplace_types: [], city: '', state: '', country: '' });
  if (loc === '') pass('buildLocation: all empty → empty string');
  else fail(`buildLocation: all empty → "${loc}"`);
}

{
  const loc = buildLocation({ workplace_types: ['remote', 'hybrid'], city: 'Floripa', state: 'SC', country: 'Brasil' });
  if (loc === 'Remoto/Híbrido, Floripa, SC, Brasil') pass('buildLocation: two workplace_types');
  else fail(`buildLocation: two workplace_types → "${loc}"`);
}

{
  const loc = buildLocation({ workplace_types: ['on-site'], city: 'RJ', state: 'RJ', country: 'Brasil' });
  if (loc === 'Presencial, RJ, RJ, Brasil') pass('buildLocation: on-site maps to Presencial');
  else fail(`buildLocation: on-site → "${loc}"`);
}

{
  const loc = buildLocation({ workplace_types: 'remote', city: 'Recife' });
  if (loc === 'Recife') pass('buildLocation: malformed workplace_types degrades safely');
  else fail(`buildLocation: malformed workplace_types → "${loc}"`);
}

// ── normalizeGupyJob ─────────────────────────────────────────────────────────

{
  // normalizeGupyJob receives the bridge's already-mapped output:
  // career_page_name → company, job_url → url (done inside gupy-bridge.py)
  const raw = {
    job_id: '123',
    company: 'ACME Corp',
    name: 'Senior Backend Engineer',
    url: 'https://acme.gupy.io/jobs/123',
    type: 'vacancy_type_effective',
    city: 'Remoto',
    state: '',
    country: 'Brasil',
    workplace_types: ['remote'],
    published_date: '2026-07-15T10:00:00+00:00',
    description: 'Build cool stuff.',
  };
  const offer = normalizeGupyJob(raw);
  if (offer.source === 'gupy') pass('normalizeGupyJob: source is gupy');
  else fail(`normalizeGupyJob: source → "${offer.source}"`);
  if (offer.company === 'ACME Corp') pass('normalizeGupyJob: company from career_page_name');
  else fail(`normalizeGupyJob: company → "${offer.company}"`);
  if (offer.title === 'Senior Backend Engineer') pass('normalizeGupyJob: title from name');
  else fail(`normalizeGupyJob: title → "${offer.title}"`);
  if (offer.url === 'https://acme.gupy.io/jobs/123') pass('normalizeGupyJob: url correct');
  else fail(`normalizeGupyJob: url → "${offer.url}"`);
  if (typeof offer.postedAt === 'number' && offer.postedAt > 0) pass('normalizeGupyJob: postedAt is epoch ms');
  else fail(`normalizeGupyJob: postedAt → ${offer.postedAt}`);
  if (offer.location.includes('Remoto')) pass('normalizeGupyJob: location contains Remoto');
  else fail(`normalizeGupyJob: location → "${offer.location}"`);
}

{
  const raw = {
    job_id: '99',
    company: 'No Date Corp',
    name: 'Dev',
    url: 'https://nd.gupy.io/jobs/99',
    type: '',
    city: '',
    state: '',
    country: '',
    workplace_types: [],
    published_date: '',
    description: '',
  };
  const offer = normalizeGupyJob(raw);
  if (offer.postedAt === undefined) pass('normalizeGupyJob: missing date → postedAt undefined');
  else fail(`normalizeGupyJob: missing date → postedAt ${offer.postedAt}`);
  if (offer.location === '') pass('normalizeGupyJob: all empty → empty location');
  else fail(`normalizeGupyJob: empty location → "${offer.location}"`);
}

{
  const offer = normalizeGupyJob(null);
  if (offer.url === '' && offer.company === '' && offer.title === '' && offer.location === '') {
    pass('normalizeGupyJob: non-object bridge row degrades safely');
  } else {
    fail(`normalizeGupyJob: non-object row → ${JSON.stringify(offer)}`);
  }
}

{
  const accepted = isSafeGupyUrl('https://acme.gupy.io/jobs/123');
  const rejected = [
    'http://acme.gupy.io/jobs/123',
    'https://gupy.io.example.com/jobs/123',
    'javascript:alert(1)',
    'not a url',
  ].every(value => !isSafeGupyUrl(value));
  if (accepted && rejected) pass('isSafeGupyUrl: allows only HTTPS gupy.io hosts');
  else fail('isSafeGupyUrl: URL allowlist mismatch');
}

// ── buildBridgeRequest ───────────────────────────────────────────────────────

{
  const req = buildBridgeRequest({
    repoPath: '/some/path',
    keywords: ['Backend', 'Full Stack'],
    sinceDays: 14,
    cfg: {
      workplace_types: ['remote'],
      job_types: ['vacancy_type_effective'],
      country: '',
      state: '',
      exclude_keywords: [],
      description_required_keywords: [],
      description_chars: 4000,
    },
  });
  if (req.repo_path === '/some/path') pass('buildBridgeRequest: repo_path passthrough');
  else fail(`buildBridgeRequest: repo_path → "${req.repo_path}"`);
  if (Array.isArray(req.keywords) && req.keywords[0] === 'Backend') pass('buildBridgeRequest: keywords array');
  else fail(`buildBridgeRequest: keywords → ${JSON.stringify(req.keywords)}`);
  if (typeof req.date_start === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.date_start)) pass('buildBridgeRequest: date_start is ISO date');
  else fail(`buildBridgeRequest: date_start → "${req.date_start}"`);
  if (req.description_chars === 4000) pass('buildBridgeRequest: description_chars passthrough');
  else fail(`buildBridgeRequest: description_chars → ${req.description_chars}`);
}


// ── API search lifecycle ────────────────────────────────────────────────────

{
  const statuses = [{ status: 'running' }, { status: 'completed' }];
  try {
    await waitForSearchCompletion(12, {
      getStatus: async () => statuses.shift(),
      sleep: async () => {},
      maxPolls: 2,
    });
    pass('waitForSearchCompletion: returns only after completed status');
  } catch (error) { fail(`waitForSearchCompletion: completed search threw: ${error.message}`); }
}

{
  try {
    await waitForSearchCompletion(13, {
      getStatus: async () => ({ status: 'error', error_message: 'scraper failed' }),
      sleep: async () => {},
      maxPolls: 1,
    });
    fail('waitForSearchCompletion: API error status must reject');
  } catch (error) {
    if (/scraper failed/.test(error.message)) pass('waitForSearchCompletion: API error preserves detail');
    else fail(`waitForSearchCompletion: unexpected API error: ${error.message}`);
  }
}

{
  try {
    await waitForSearchCompletion(14, {
      getStatus: async () => ({ status: 'running' }),
      sleep: async () => {},
      maxPolls: 2,
    });
    fail('waitForSearchCompletion: polling exhaustion must reject');
  } catch (error) {
    if (/timed out after 2 polls/.test(error.message)) pass('waitForSearchCompletion: polling exhaustion is explicit');
    else fail(`waitForSearchCompletion: unexpected timeout error: ${error.message}`);
  }
}

{
  const req = buildBridgeRequest({
    repoPath: '/p',
    keywords: ['X'],
    sinceDays: 0,
    cfg: { description_chars: 2000 },
  });
  if (req.date_start === null) pass('buildBridgeRequest: sinceDays=0 → date_start null');
  else fail(`buildBridgeRequest: sinceDays=0 date_start → "${req.date_start}"`);
}

// ── DRF pagination normalisation (inline, no network) ────────────────────────

{
  // Verify that the shape produced by normalizeGupyJob is compatible with
  // what appendToPipeline expects: url, company, title, source, optional postedAt.
  const offer = normalizeGupyJob({
    job_id: '1', company: 'X', name: 'Y',
    url: 'https://x.gupy.io/jobs/1', type: '',
    city: '', state: '', country: '', workplace_types: [],
    published_date: '2026-07-01T00:00:00Z', description: 'hi',
  });
  const required = ['url', 'company', 'title', 'source'];
  const missing = required.filter(k => !(k in offer));
  if (missing.length === 0) pass('normalizeGupyJob: output has all fields required by appendToPipeline');
  else fail(`normalizeGupyJob: missing fields: ${missing.join(', ')}`);
}

console.log();
