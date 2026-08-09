// tests/scan-gupy.test.mjs — unit tests for scan-gupy.mjs pure functions.
// No network calls: all functions under test are exported and operate on fixtures.
import { pass, fail } from './helpers.mjs';
import { pathToFileURL } from 'url';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

console.log('\nscan-gupy — pure-function unit tests');

const { buildLocation, normalizeGupyJob, buildBridgeRequest, limitOffers } = await import(
  pathToFileURL(join(ROOT, 'scan-gupy.mjs')).href
);

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
