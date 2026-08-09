#!/usr/bin/env node
/**
 * scan-gupy.mjs — zero-token Gupy scanner via gupy-job-scrapper
 *
 * Delegates all HTTP against gupy.io to the sibling project so career-ops
 * never speaks directly to Gupy's API.  Two runner modes:
 *   package  — spawns scripts/gupy-bridge.py (python3, fastest, no daemon)
 *   api      — calls the Django REST API when the stack is up (docker compose up)
 *   auto     — probes package first, falls back to api
 *
 * Usage:
 *   node scan-gupy.mjs
 *   node scan-gupy.mjs --dry-run
 *   node scan-gupy.mjs --debug
 *   node scan-gupy.mjs --keyword "AI Engineer" --keyword "Backend"
 *   node scan-gupy.mjs --since 7
 *   node scan-gupy.mjs --runner api
 *   node scan-gupy.mjs --json
 */

import { spawn } from 'child_process';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import yaml from 'js-yaml';
import {
  appendToPipeline,
  appendToScanHistory,
  appendScanRunSummary,
  loadSeenUrls,
  loadSeenCompanyRoles,
  loadBlacklist,
  buildTitleFilter,
  buildLocationFilter,
  buildPostingAgeFilter,
  buildCompanyCanonicalizer,
  companyRoleDedupKey,
  normalizeUrlForDedup,
  parseSinceDays,
} from './scan.mjs';
import { normalizeCompany } from './tracker-utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Constants ───────────────────────────────────────────────────────────────

const PORTALS_PATH    = 'portals.yml';
const BRIDGE_SCRIPT   = resolve(__dirname, 'scripts/gupy-bridge.py');
const DEFAULT_API_URL = 'http://localhost:8000';
const API_POLL_MS     = 3000;
const API_POLL_MAX    = 60;

const DEFAULT_KEYWORDS = [
  'Full Stack',
  'Backend',
  'Software Engineer',
  'Desenvolvedor',
  'Engenheiro de Software',
];

// ── Args ────────────────────────────────────────────────────────────────────

const rawArgs = process.argv.slice(2);
const VALID_RUNNERS = new Set(['auto', 'package', 'api']);
const FLAG_OPTIONS = new Set(['--dry-run', '--debug', '--json', '--help']);
const VALUE_OPTIONS = new Set(['--keyword', '--since', '--runner']);

export function validateCliArgs(args) {
  let runnerCount = 0;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (FLAG_OPTIONS.has(arg) || arg.startsWith('--since=')) continue;
    if (VALUE_OPTIONS.has(arg)) {
      if (arg === '--runner') runnerCount++;
      const value = args[i + 1];
      if (value == null || value.startsWith('--')) {
        throw new Error(`${arg} requires a non-empty value`);
      }
      if (arg === '--keyword' && !value.trim()) {
        throw new Error('--keyword requires a non-empty value');
      }
      i++;
      continue;
    }
    throw new Error(`unknown option: ${arg}`);
  }
  if (runnerCount > 1) throw new Error('--runner must be passed at most once');
}

function argFlag(flag) { return rawArgs.includes(flag); }
function argValues(flag) {
  const vals = [];
  for (let i = 0; i < rawArgs.length; i++) {
    if (rawArgs[i] === flag && rawArgs[i + 1] && !rawArgs[i + 1].startsWith('--')) {
      vals.push(rawArgs[i + 1]);
    }
  }
  return vals;
}
function argValue(flag) {
  const i = rawArgs.indexOf(flag);
  if (i === -1 || rawArgs[i + 1] === undefined || rawArgs[i + 1].startsWith('--')) return null;
  return rawArgs[i + 1];
}

if (argFlag('--help')) {
  console.log(`Usage: node scan-gupy.mjs [options]

Options:
  --dry-run              Fetch and filter but do not write to pipeline or history
  --debug                Extra diagnostics
  --keyword <kw>         Add a search keyword (repeatable; overrides portals.yml)
  --since <n>            Only include offers newer than N days (overrides portals.yml)
  --runner <mode>        Runner: auto | package | api  (default: auto)
  --json                 Output structured JSON summary instead of text
  --help                 Show this message

Configuration lives in portals.yml under the 'gupy:' key.
`);
  process.exit(0);
}

try {
  validateCliArgs(rawArgs);
} catch (error) {
  console.error(`ERROR: ${error.message}`);
  process.exit(1);
}

const DRY_RUN   = argFlag('--dry-run');
const DEBUG     = argFlag('--debug');
const JSON_OUT  = argFlag('--json');
const CLI_RUNNER = argValue('--runner');
const CLI_KWS    = argValues('--keyword').map(keyword => keyword.trim()).filter(Boolean);

export function validateRunner(value) {
  const runner = String(value || 'auto').trim().toLowerCase();
  if (!VALID_RUNNERS.has(runner)) {
    throw new Error(`runner must be one of auto, package, api; got "${value}"`);
  }
  return runner;
}

function readIntegerConfig(value, fallback, { name, min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const candidate = value ?? fallback;
  const parsed = typeof candidate === 'number'
    ? candidate
    : typeof candidate === 'string' && /^\d+$/.test(candidate.trim())
      ? Number(candidate)
      : Number.NaN;
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`gupy.${name} must be an integer from ${min} to ${max}; got ${JSON.stringify(candidate)}`);
  }
  return parsed;
}

function readStringList(value, fallback, name) {
  const candidate = value ?? fallback;
  if (!Array.isArray(candidate) || candidate.some(item => typeof item !== 'string')) {
    throw new Error(`gupy.${name} must be a list of strings`);
  }
  return candidate.map(item => item.trim()).filter(Boolean);
}

function readOptionalString(value, name) {
  if (value == null) return '';
  if (typeof value !== 'string') throw new Error(`gupy.${name} must be a string`);
  return value.trim();
}

function readApiUrl(value) {
  const candidate = readOptionalString(value, 'api_url') || DEFAULT_API_URL;
  let parsed;
  try { parsed = new URL(candidate); } catch { throw new Error(`gupy.api_url is not a valid URL: ${candidate}`); }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('gupy.api_url must use http or https');
  }
  return parsed.href.replace(/\/+$/, '');
}

export function resolveSinceDays(args, configuredValue = 14) {
  const parsed = parseSinceDays(args);
  if (parsed.error) throw new Error(parsed.error);
  if (parsed.days != null) return parsed.days;
  const configured = readIntegerConfig(configuredValue, 14, { name: 'since_days' });
  if (configured === 0) return 0;
  const checked = parseSinceDays(['--since', String(configured)]);
  if (checked.error) throw new Error(`gupy.since_days is invalid: ${checked.error}`);
  return checked.days;
}

// ── Config ──────────────────────────────────────────────────────────────────

let portalsConfig;
let startupConfig;
try {
  portalsConfig = existsSync(PORTALS_PATH)
    ? (yaml.load(readFileSync(PORTALS_PATH, 'utf-8')) || {})
    : {};
  if (!portalsConfig || typeof portalsConfig !== 'object' || Array.isArray(portalsConfig)) {
    throw new Error('portals.yml must contain a YAML mapping');
  }
  const gupyCfg = portalsConfig.gupy ?? {};
  if (!gupyCfg || typeof gupyCfg !== 'object' || Array.isArray(gupyCfg)) {
    throw new Error('gupy configuration must be a YAML mapping');
  }

  if (gupyCfg.searches != null && !Array.isArray(gupyCfg.searches)) {
    throw new Error('gupy.searches must be a list');
  }
  const rawSearches = gupyCfg.searches || [];
  const configuredKeywords = rawSearches.length > 0
    ? rawSearches
        .map(search => search && typeof search === 'object' ? search.keyword : '')
        .filter(keyword => typeof keyword === 'string' && keyword.trim())
        .map(keyword => keyword.trim())
    : DEFAULT_KEYWORDS;
  const keywords = CLI_KWS.length > 0 ? CLI_KWS : configuredKeywords;
  if (keywords.length === 0) {
    throw new Error('gupy.searches must contain at least one non-empty keyword');
  }

  startupConfig = {
    repoPath: resolve(process.env.CAREER_OPS_GUPY_REPO || gupyCfg.repo_path || '../gupy-job-scrapper'),
    apiUrl: readApiUrl(gupyCfg.api_url),
    timeoutMs: readIntegerConfig(gupyCfg.timeout_ms, 180_000, { name: 'timeout_ms', min: 1 }),
    sinceDays: resolveSinceDays(rawArgs, gupyCfg.since_days),
    descriptionChars: readIntegerConfig(gupyCfg.description_chars, 4000, { name: 'description_chars', min: 1, max: 100_000 }),
    maxNewPerRun: readIntegerConfig(gupyCfg.max_new_per_run, 20, { name: 'max_new_per_run' }),
    maxPerCompany: readIntegerConfig(gupyCfg.max_per_company, 3, { name: 'max_per_company' }),
    runner: validateRunner(CLI_RUNNER || gupyCfg.runner || 'auto'),
    workplaceTypes: readStringList(gupyCfg.workplace_types, ['remote', 'hybrid'], 'workplace_types'),
    jobTypes: readStringList(gupyCfg.job_types, ['vacancy_type_effective', 'vacancy_legal_entity'], 'job_types'),
    country: readOptionalString(gupyCfg.country, 'country'),
    state: readOptionalString(gupyCfg.state, 'state'),
    excludeKeywords: readStringList(gupyCfg.exclude_keywords, [], 'exclude_keywords'),
    requiredDescriptionKeywords: readStringList(gupyCfg.description_required_keywords, [], 'description_required_keywords'),
    keywords,
  };
} catch (error) {
  console.error(`ERROR: invalid Gupy scanner configuration: ${error.message}`);
  process.exit(1);
}

const {
  repoPath: REPO_PATH,
  apiUrl: API_URL,
  timeoutMs: TIMEOUT_MS,
  sinceDays: SINCE_DAYS,
  descriptionChars: DESC_CHARS,
  maxNewPerRun: MAX_NEW_PER_RUN,
  maxPerCompany: MAX_PER_COMPANY,
  runner: RUNNER_CFG,
  workplaceTypes: WORKPLACE_TYPES,
  jobTypes: JOB_TYPES,
  country: COUNTRY,
  state: STATE,
  excludeKeywords: EXCLUDE_KWS,
  requiredDescriptionKeywords: REQ_DESC_KWS,
  keywords: KEYWORDS,
} = startupConfig;

// Date threshold from since_days
const sinceEpochMs = SINCE_DAYS > 0 ? Date.now() - SINCE_DAYS * 86_400_000 : null;

// ── Filters (reuse scan.mjs builders) ───────────────────────────────────────

const titleFilter    = buildTitleFilter(portalsConfig.title_filter   || {});
const locationFilter = buildLocationFilter(portalsConfig.location_filter || {});
const ageFilter      = sinceEpochMs != null ? buildPostingAgeFilter(SINCE_DAYS) : null;

function checkTitle(title)        { return titleFilter(title); }
function checkLocation(offer)     { return locationFilter(offer.location, offer.url, offer.title); }
function checkAge(postedEpochMs)  {
  if (!ageFilter || !postedEpochMs) return true;
  return ageFilter(postedEpochMs);
}

export function limitOffers(offers, { maxTotal = 20, maxPerCompany = 3 } = {}) {
  const totalCap = Number.isInteger(maxTotal) && maxTotal >= 0 ? maxTotal : 20;
  const companyCap = Number.isInteger(maxPerCompany) && maxPerCompany >= 0 ? maxPerCompany : 3;
  const sorted = [...offers].sort((a, b) => (b.postedAt || 0) - (a.postedAt || 0));
  const selected = [];
  const skipped = [];
  const companyCounts = new Map();

  for (const offer of sorted) {
    // Missing company labels must not collapse unrelated postings into one
    // synthetic employer and exhaust the per-company allowance together.
    const company = normalizeCompany(offer.company || '')
      || `unknown:${normalizeUrlForDedup(offer.url || offer.title || String(selected.length))}`;
    const count = companyCounts.get(company) || 0;
    if (selected.length >= totalCap || count >= companyCap) {
      skipped.push(offer);
      continue;
    }
    selected.push(offer);
    companyCounts.set(company, count + 1);
  }
  return { selected, skipped };
}

// ── Offer normaliser ─────────────────────────────────────────────────────────

export function buildLocation(job) {
  const parts = [];
  const workplaceTypes = Array.isArray(job?.workplace_types) ? job.workplace_types : [];
  if (workplaceTypes.length > 0) {
    const label = workplaceTypes
      .map(w => ({ remote: 'Remoto', hybrid: 'Híbrido', 'on-site': 'Presencial' }[w] || String(w)))
      .join('/');
    parts.push(label);
  }
  if (job?.city)    parts.push(String(job.city));
  if (job?.state)   parts.push(String(job.state));
  if (job?.country) parts.push(String(job.country));
  return parts.join(', ');
}

export function normalizeGupyJob(job) {
  const source = job && typeof job === 'object' ? job : {};
  const postedAt = source.published_date
    ? new Date(source.published_date).getTime()
    : undefined;
  return {
    url:      typeof source.url === 'string' ? source.url.trim() : '',
    company:  String(source.company || '').trim(),
    title:    String(source.name || '').trim(),
    location: buildLocation(source),
    source:   'gupy',
    postedAt: Number.isFinite(postedAt) ? postedAt : undefined,
    description: typeof source.description === 'string' ? source.description : '',
  };
}

export function isSafeGupyUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    return parsed.protocol === 'https:' && (host === 'gupy.io' || host.endsWith('.gupy.io'));
  } catch {
    return false;
  }
}

// ── Bridge request builder (exported for tests) ──────────────────────────────

export function buildBridgeRequest({ repoPath, keywords, sinceDays, cfg }) {
  const dateStart = sinceDays > 0
    ? new Date(Date.now() - sinceDays * 86_400_000).toISOString().slice(0, 10)
    : null;
  return {
    repo_path:                       repoPath,
    keywords,
    date_start:                      dateStart,
    description_required_keywords:   cfg.description_required_keywords || [],
    workplace_types:                 cfg.workplace_types || [],
    exclude_keywords:                cfg.exclude_keywords || [],
    state:                           cfg.state || '',
    country:                         cfg.country || '',
    job_types:                       cfg.job_types || [],
    description_chars:               cfg.description_chars ?? 4000,
  };
}

// ── Runner: package (python3 subprocess) ─────────────────────────────────────

function spawnBridge(bridgeReq) {
  return new Promise((resolve, reject) => {
    if (!existsSync(BRIDGE_SCRIPT)) {
      return reject(new Error(`bridge script not found: ${BRIDGE_SCRIPT}`));
    }
    const scrPkg = `${REPO_PATH}/packages/scraper/gupy_scraper`;
    if (!existsSync(scrPkg)) {
      return reject(new Error(
        `gupy_scraper package not found at ${scrPkg}\n` +
        `  Fix: ensure ${REPO_PATH} is cloned and packages/scraper/gupy_scraper exists`
      ));
    }

    const child = spawn('python3', [BRIDGE_SCRIPT], { stdio: ['pipe', 'pipe', 'pipe'] });
    const outChunks = [];
    const errChunks = [];
    let settled = false;

    const settle = (fn, value) => {
      if (settled) return;
      settled = true;
      fn(value);
    };

    child.stdout.on('data', d => outChunks.push(d));
    child.stderr.on('data', d => errChunks.push(d));
    child.stdin.on('error', (error) => settle(reject, error));

    // write request and close stdin so python's json.load() unblocks
    child.stdin.write(JSON.stringify(bridgeReq), 'utf8');
    child.stdin.end();

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      settle(reject, new Error(`bridge timed out after ${TIMEOUT_MS}ms — increase timeout_ms in portals.yml gupy: block`));
    }, TIMEOUT_MS);

    child.on('close', (code) => {
      clearTimeout(timer);
      const stdout = Buffer.concat(outChunks).toString('utf8').trim();
      const stderr = Buffer.concat(errChunks).toString('utf8').trim();
      if (code !== 0) {
        let msg = `bridge exited ${code}`;
        try { const r = JSON.parse(stdout); if (r.error) msg = r.error; } catch {}
        if (stderr) msg += `\n  stderr: ${stderr.slice(0, 500)}`;
        return settle(reject, new Error(msg));
      }
      let result;
      try { result = JSON.parse(stdout); } catch (e) {
        return settle(reject, new Error(`bridge output is not valid JSON: ${stdout.slice(0, 200)}`));
      }
      if (!result.ok) return settle(reject, new Error(result.error || 'bridge returned ok=false'));
      if (!Array.isArray(result.jobs)) return settle(reject, new Error('bridge response jobs must be an array'));
      settle(resolve, result.jobs);
    });

    child.on('error', (e) => { clearTimeout(timer); settle(reject, e); });
  });
}

async function runPackage(bridgeReq) {
  if (DEBUG) console.error(`[debug] package runner: ${BRIDGE_SCRIPT}`);
  return spawnBridge(bridgeReq);
}

// ── Runner: api (Django REST) ────────────────────────────────────────────────

async function apiPost(path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
    signal:  AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json();
}

async function apiGet(path) {
  const res = await fetch(`${API_URL}${path}`, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`GET ${API_URL}${path} → ${res.status}`);
  return res.json();
}

async function runApi(bridgeReq) {
  if (DEBUG) console.error(`[debug] api runner: ${API_URL}`);
  const { keywords, date_start, description_required_keywords,
          workplace_types, exclude_keywords, state, country,
          job_types } = bridgeReq;

  // Create config
  const cfgBody = {
    name: `career-ops-${Date.now()}`,
    title_keywords: keywords.join(','),
    date_start: date_start || '',
    description_required_keywords: (description_required_keywords || []).join(','),
    workplace_types: (workplace_types || []).join(','),
    exclude_keywords: (exclude_keywords || []).join(','),
    state: state || '',
    country: country || '',
    job_types: (job_types || []).join(','),
  };
  const cfg = await apiPost('/api/configs/', cfgBody);

  // Trigger search
  const search = await apiPost('/api/searches/', { config: cfg.id });
  const searchId = search.id;
  if (searchId == null) throw new Error('API search response did not include an id');
  if (DEBUG) console.error(`[debug] api search id: ${searchId}`);

  await waitForSearchCompletion(searchId);

  // Collect vacancies (handle both paginated DRF and plain array)
  const jobs = [];
  let url = `/api/vacancies/?search_id=${searchId}`;
  const visitedPages = new Set();
  while (url) {
    if (visitedPages.has(url)) throw new Error(`API pagination loop detected at ${url}`);
    visitedPages.add(url);
    const page = await apiGet(url);
    const results = Array.isArray(page) ? page : (page.results || []);
    if (!Array.isArray(results)) throw new Error('API vacancies response results must be an array');
    jobs.push(...results);
    if (Array.isArray(page) || !page.next) {
      url = null;
    } else {
      const next = new URL(page.next, `${API_URL}/`);
      url = `${next.pathname}${next.search}`;
    }
  }

  // Normalize to the same shape as the bridge response
  return jobs.map(v => ({
    job_id:          String(v.job_id || v.id || ''),
    company:         String(v.career_page_name || v.company || ''),
    name:            String(v.name || v.title || ''),
    url:             String(v.job_url || v.url || ''),
    type:            String(v.type || ''),
    city:            String(v.city || ''),
    state:           String(v.state || ''),
    country:         String(v.country || ''),
    workplace_types: Array.isArray(v.workplace_types) ? v.workplace_types : [],
    published_date:  v.published_date || '',
    description:     v.description || '',
  }));
}

export async function waitForSearchCompletion(searchId, {
  getStatus = id => apiGet(`/api/searches/${id}/status/`),
  sleep = ms => new Promise(resolveSleep => setTimeout(resolveSleep, ms)),
  pollMs = API_POLL_MS,
  maxPolls = API_POLL_MAX,
} = {}) {
  for (let i = 0; i < maxPolls; i++) {
    await sleep(pollMs);
    const response = await getStatus(searchId);
    const status = typeof response === 'string' ? response : response?.status;
    if (DEBUG) console.error(`[debug] poll ${i + 1}: ${status || 'unknown'}`);
    if (status === 'completed') return;
    if (status === 'error') {
      const detail = typeof response === 'object' && response?.error_message
        ? `: ${response.error_message}`
        : '';
      throw new Error(`API search ${searchId} failed${detail}`);
    }
  }
  throw new Error(`API search ${searchId} timed out after ${maxPolls} polls`);
}

// ── Runner: auto ──────────────────────────────────────────────────────────────

async function probePackage() {
  try {
    const scrPkg = `${REPO_PATH}/packages/scraper/gupy_scraper`;
    if (!existsSync(BRIDGE_SCRIPT) || !existsSync(scrPkg)) return false;
    const code = 'import sys; sys.path.insert(0, sys.argv[1]); '
      + "from gupy_scraper import JobScraperService; print('ok')";
    return await new Promise((res) => {
      const child = spawn('python3', ['-c', code, `${REPO_PATH}/packages/scraper`], {
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      let out = '';
      child.stdout.on('data', d => { out += d; });
      const timer = setTimeout(() => { child.kill(); res(false); }, 10_000);
      child.on('close', (c) => { clearTimeout(timer); res(c === 0 && out.trim() === 'ok'); });
      child.on('error', () => { clearTimeout(timer); res(false); });
    });
  } catch { return false; }
}

async function probeApi() {
  try {
    const res = await fetch(`${API_URL}/api/configs/`, { signal: AbortSignal.timeout(5_000) });
    return res.ok || res.status < 500;
  } catch { return false; }
}

async function fetchJobs(bridgeReq) {
  if (RUNNER_CFG === 'package') return { runner: 'package', jobs: await runPackage(bridgeReq) };
  if (RUNNER_CFG === 'api') return { runner: 'api', jobs: await runApi(bridgeReq) };

  const failures = [];
  if (await probePackage()) {
    try {
      return { runner: 'package', jobs: await runPackage(bridgeReq) };
    } catch (error) {
      failures.push(`package: ${error.message}`);
      if (DEBUG) console.error(`[debug] package runner failed; trying api: ${error.message}`);
    }
  } else {
    failures.push(`package: unavailable (${REPO_PATH}/packages/scraper)`);
  }

  if (await probeApi()) {
    try {
      return { runner: 'api', jobs: await runApi(bridgeReq) };
    } catch (error) {
      failures.push(`api: ${error.message}`);
    }
  } else {
    failures.push(`api: unavailable (${API_URL})`);
  }

  throw new Error(`auto runner failed:\n  ${failures.join('\n  ')}`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  mkdirSync('data', { recursive: true });

  const date = new Date().toISOString().slice(0, 10);
  const { seen } = loadSeenUrls();
  const canonicalizeCompany = buildCompanyCanonicalizer(portalsConfig.company_aliases);
  const seenCompanyRoles = loadSeenCompanyRoles(undefined, canonicalizeCompany);
  const blacklist = loadBlacklist();

  const bridgeReq = buildBridgeRequest({
    repoPath: REPO_PATH,
    keywords: KEYWORDS,
    sinceDays: SINCE_DAYS,
    cfg: {
      workplace_types: WORKPLACE_TYPES,
      job_types: JOB_TYPES,
      country: COUNTRY,
      state: STATE,
      exclude_keywords: EXCLUDE_KWS,
      description_required_keywords: REQ_DESC_KWS,
      description_chars: DESC_CHARS,
    },
  });

  if (!JSON_OUT) {
    console.log(`\nGupy Scan — ${date}`);
    console.log(`Keywords: ${KEYWORDS.join(', ')}`);
    console.log(`Since: ${SINCE_DAYS} days | Runner: ${RUNNER_CFG}`);
    console.log('━'.repeat(45));
  }

  let rawJobs = [];
  let runnerUsed = RUNNER_CFG;

  try {
    const result = await fetchJobs(bridgeReq);
    runnerUsed = result.runner;
    rawJobs = result.jobs;
    if (DEBUG && !JSON_OUT) console.log(`  runner resolved: ${runnerUsed}`);
  } catch (err) {
    const summary = {
      date, runner: runnerUsed, found: 0, added: 0,
      skipped_title: 0, skipped_location: 0, skipped_date: 0,
      skipped_blacklist: 0, skipped_dup: 0, skipped_invalid: 0,
      error: err.message,
    };
    if (JSON_OUT) { console.log(JSON.stringify(summary, null, 2)); process.exit(1); }
    console.error(`\nFatal: ${err.message}`);
    process.exit(1);
  }

  if (!JSON_OUT) console.log(`  Fetched: ${rawJobs.length} raw jobs from Gupy`);

  const newOffers          = [];
  const titleSkipped       = [];
  const locationSkipped    = [];
  const dateSkipped        = [];
  const blacklistSkipped   = [];
  const dupeSkipped        = [];
  const invalidSkipped     = [];

  for (const job of rawJobs) {
    const offer = normalizeGupyJob(job);
    if (!isSafeGupyUrl(offer.url) || !offer.title) {
      invalidSkipped.push(offer);
      continue;
    }

    if (!checkTitle(offer.title)) {
      seen.add(normalizeUrlForDedup(offer.url));
      titleSkipped.push(offer);
      continue;
    }
    if (!checkLocation(offer)) {
      seen.add(normalizeUrlForDedup(offer.url));
      locationSkipped.push(offer);
      continue;
    }
    if (!checkAge(offer.postedAt)) {
      seen.add(normalizeUrlForDedup(offer.url));
      dateSkipped.push(offer);
      continue;
    }
    const blEntry = blacklist.get(normalizeCompany(offer.company || ''));
    if (blEntry) {
      if (DEBUG && !JSON_OUT) console.log(`  [blacklist] ${offer.company}: ${blEntry.reason || 'no reason'}`);
      seen.add(normalizeUrlForDedup(offer.url));
      blacklistSkipped.push(offer);
      continue;
    }
    const dedupUrl = normalizeUrlForDedup(offer.url);
    const companyRoleKey = companyRoleDedupKey(offer.company, offer.title, canonicalizeCompany);
    if (seen.has(dedupUrl) || seenCompanyRoles.has(companyRoleKey)) {
      dupeSkipped.push(offer);
      continue;
    }
    seen.add(dedupUrl);
    seenCompanyRoles.add(companyRoleKey);
    newOffers.push(offer);
  }

  const { selected: selectedOffers, skipped: capSkipped } = limitOffers(newOffers, {
    maxTotal: MAX_NEW_PER_RUN,
    maxPerCompany: MAX_PER_COMPANY,
  });

  if (!DRY_RUN) {
    if (selectedOffers.length > 0)  await appendToPipeline(selectedOffers);
    if (selectedOffers.length > 0)  appendToScanHistory(selectedOffers, date, 'added');
    // Do not persist cap-limited rows as seen. The cap protects one run's
    // pipeline fan-out; persisting these rows would suppress them forever
    // instead of letting the next scan advance to the next page of matches.
    if (titleSkipped.length > 0)    appendToScanHistory(titleSkipped,    date, 'skipped_title');
    if (locationSkipped.length > 0) appendToScanHistory(locationSkipped, date, 'skipped_location');
    if (dateSkipped.length > 0)     appendToScanHistory(dateSkipped,     date, 'skipped_date');
    if (blacklistSkipped.length > 0) appendToScanHistory(blacklistSkipped, date, 'skipped_blacklist');
    if (dupeSkipped.length > 0)     appendToScanHistory(dupeSkipped,     date, 'skipped_dup');
    const invalidRowsWithUrls = invalidSkipped.filter(offer => offer.url);
    if (invalidRowsWithUrls.length > 0) appendToScanHistory(invalidRowsWithUrls, date, 'skipped_invalid_url');

    appendScanRunSummary({
      timestamp:              new Date().toISOString(),
      status:                 'completed',
      companies:              0,
      boards:                 1,
      found:                  rawJobs.length,
      filteredTitle:          titleSkipped.length,
      filteredTier:           0,
      filteredLocation:       locationSkipped.length,
      filteredPostingAge:     dateSkipped.length,
      filteredSalary:         0,
      filteredContent:        capSkipped.length + invalidSkipped.length,
      filteredCooldown:       0,
      dupes:                  dupeSkipped.length,
      newAdded:               selectedOffers.length,
      errors:                 0,
      filteredBlacklist:      blacklistSkipped.length,
      filteredVisa:           0,
      filteredPostedDate:     0,
      filteredCountryEligibility: 0,
    });
  }

  if (JSON_OUT) {
    console.log(JSON.stringify({
      date,
      runner:            runnerUsed,
      found:             rawJobs.length,
      added:             selectedOffers.length,
      skipped_title:     titleSkipped.length,
      skipped_location:  locationSkipped.length,
      skipped_date:      dateSkipped.length,
      skipped_blacklist: blacklistSkipped.length,
      skipped_dup:       dupeSkipped.length,
      skipped_invalid:   invalidSkipped.length,
      skipped_limit:     capSkipped.length,
      dry_run:           DRY_RUN,
      offers:            selectedOffers,
    }, null, 2));
    return;
  }

  console.log(`━`.repeat(45));
  console.log(`Fetched from Gupy:   ${rawJobs.length}`);
  console.log(`Filtered by title:   ${titleSkipped.length}`);
  console.log(`Filtered location:   ${locationSkipped.length}`);
  console.log(`Filtered by date:    ${dateSkipped.length}`);
  console.log(`Filtered blacklist:  ${blacklistSkipped.length}`);
  console.log(`Duplicates:          ${dupeSkipped.length}`);
  console.log(`Invalid rows/URLs:   ${invalidSkipped.length}`);
  console.log(`Limited out:         ${capSkipped.length}`);
  console.log(`New offers:          ${selectedOffers.length}`);

  if (selectedOffers.length > 0) {
    console.log('\nNew offers:');
    for (const o of selectedOffers) {
      console.log(`  + ${o.company} | ${o.title} | ${o.location || 'N/A'}`);
    }
    if (DRY_RUN) {
      console.log('\n(dry run — not saved)');
    } else {
      console.log('\nSaved to data/pipeline.md');
    }
  }

  console.log('\n→ Run /career-ops pipeline to evaluate new offers.');
}

// Guard so this module can be imported by tests without running main()
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(err => {
    console.error('Fatal:', err.message);
    process.exit(1);
  });
}
