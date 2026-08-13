// tests/providers/gupy.test.mjs
import { pass, fail, ROOT } from '../helpers.mjs';
import { join } from 'path';
import { pathToFileURL } from 'url';

console.log('\nProvider — gupy');

try {
  const mod = await import(pathToFileURL(join(ROOT, 'providers/gupy.mjs')).href);
  const provider = mod.default;
  const { normalizeGupyApiJob, buildGupyLocation } = mod;

  if (provider.id === 'gupy') pass('gupy.id is "gupy"');
  else fail(`gupy.id is ${JSON.stringify(provider.id)}`);

  // ── normalizeGupyApiJob ──────────────────────────────────────────────────
  const full = normalizeGupyApiJob({
    name: '  Desenvolvedor Backend Sênior  ',
    jobUrl: 'https://acme.gupy.io/job/abc123',
    careerPageName: '  Acme  ',
    workplaceType: 'remote',
    city: 'Porto Alegre',
    state: 'Rio Grande do Sul',
    country: 'Brasil',
    description: 'JD body',
    publishedDate: '2026-08-01T12:00:00.000Z',
  });
  if (full && full.title === 'Desenvolvedor Backend Sênior'
      && full.url === 'https://acme.gupy.io/job/abc123'
      && full.company === 'Acme'
      && full.location === 'Remoto, Porto Alegre, Rio Grande do Sul, Brasil'
      && full.description === 'JD body'
      && full.postedAt === Date.parse('2026-08-01T12:00:00.000Z')) {
    pass('normalizeGupyApiJob maps name/jobUrl/careerPageName/location/description + publishedDate → postedAt');
  } else {
    fail(`normalizeGupyApiJob full row = ${JSON.stringify(full)}`);
  }

  // The raw API exposes workplaceType as a SINGULAR string. The retired Python
  // bridge read the plural `workplaceTypes`, which does not exist in the
  // payload, so every hybrid posting was silently dropped (44% of the platform
  // in a 2026-08-13 measurement). This pins the singular reader.
  const hybrid = buildGupyLocation({ workplaceType: 'hybrid', city: 'Porto Alegre' });
  const onsite = buildGupyLocation({ workplaceType: 'on-site', city: 'São Paulo' });
  const remote = buildGupyLocation({ workplaceType: 'remote', country: 'Brasil' });
  if (hybrid === 'Híbrido, Porto Alegre' && onsite === 'Presencial, São Paulo' && remote === 'Remoto, Brasil') {
    pass('buildGupyLocation reads the SINGULAR workplaceType (hybrid/on-site/remote), not the nonexistent plural');
  } else {
    fail(`buildGupyLocation workplaceType = ${JSON.stringify({ hybrid, onsite, remote })}`);
  }

  const fallback = buildGupyLocation({ isRemoteWork: true, country: 'Brasil' });
  const unknownType = buildGupyLocation({ workplaceType: 'satellite', city: 'Recife' });
  const bare = buildGupyLocation({ city: 'Curitiba', state: 'Paraná' });
  if (fallback === 'Remoto, Brasil' && unknownType === 'satellite, Recife' && bare === 'Curitiba, Paraná') {
    pass('buildGupyLocation falls back to isRemoteWork, passes unknown types through, and tolerates no type at all');
  } else {
    fail(`buildGupyLocation fallbacks = ${JSON.stringify({ fallback, unknownType, bare })}`);
  }

  // postedAt omitted when absent/unparseable; description key absent when empty.
  const noDate = normalizeGupyApiJob({ name: 'T', jobUrl: 'https://a.gupy.io/job/1' });
  const badDate = normalizeGupyApiJob({ name: 'T', jobUrl: 'https://a.gupy.io/job/2', publishedDate: 'not-a-date' });
  if (noDate && !('postedAt' in noDate) && badDate && !('postedAt' in badDate)) {
    pass('normalizeGupyApiJob omits postedAt when publishedDate is absent or unparseable');
  } else {
    fail(`normalizeGupyApiJob date handling = ${JSON.stringify({ noDate, badDate })}`);
  }
  if (noDate && !('description' in noDate)) pass('normalizeGupyApiJob omits the description key when the payload carries none');
  else fail(`normalizeGupyApiJob description key = ${JSON.stringify(noDate)}`);

  // Missing company survives as '' — scan.mjs fills it downstream rather than
  // dropping the posting.
  const noCompany = normalizeGupyApiJob({ name: 'T', jobUrl: 'https://a.gupy.io/job/3' });
  if (noCompany && noCompany.company === '') pass('normalizeGupyApiJob keeps the posting when careerPageName is absent (company = "")');
  else fail(`normalizeGupyApiJob no-company = ${JSON.stringify(noCompany)}`);

  // Host-lock + drops.
  const drops = [
    normalizeGupyApiJob({ name: 'Off host', jobUrl: 'https://evil.example/job/x' }),
    normalizeGupyApiJob({ name: 'Lookalike', jobUrl: 'https://notgupy.io/job/x' }),
    normalizeGupyApiJob({ name: 'Insecure', jobUrl: 'http://a.gupy.io/job/x' }),
    normalizeGupyApiJob({ name: 'No URL' }),
    normalizeGupyApiJob({ name: '', jobUrl: 'https://a.gupy.io/job/x' }),
    normalizeGupyApiJob(null),
    normalizeGupyApiJob('string'),
  ];
  if (drops.every((r) => r === null)) {
    pass('normalizeGupyApiJob host-locks to *.gupy.io and drops off-host/lookalike/non-https/no-url/empty-title/non-object');
  } else {
    fail(`normalizeGupyApiJob drops = ${JSON.stringify(drops)}`);
  }

  const apex = normalizeGupyApiJob({ name: 'T', jobUrl: 'https://gupy.io/job/apex' });
  if (apex && apex.url === 'https://gupy.io/job/apex') pass('normalizeGupyApiJob accepts the apex gupy.io host, not only subdomains');
  else fail(`normalizeGupyApiJob apex = ${JSON.stringify(apex)}`);

  // ── detect() ─────────────────────────────────────────────────────────────
  const hit = provider.detect({ careers_url: 'https://portal.gupy.io' });
  const hitApex = provider.detect({ careers_url: 'https://gupy.io' });
  const hitApi = provider.detect({ api: 'https://employability-portal.gupy.io/api/v1/jobs' });
  const missHost = provider.detect({ careers_url: 'https://job-boards.greenhouse.io/acme' });
  const missLookalike = provider.detect({ careers_url: 'https://notgupy.io' });
  const missNone = provider.detect({ name: 'no urls' });
  if (hit?.url && hitApex?.url && hitApi?.url && missHost === null && missLookalike === null && missNone === null) {
    pass('detect() claims gupy.io careers_url/api (apex + subdomain) and ignores other hosts');
  } else {
    fail(`detect() = ${JSON.stringify({ hit, hitApex, hitApi, missHost, missLookalike, missNone })}`);
  }

  // ── fetch() ──────────────────────────────────────────────────────────────
  const mk = (i, company = `Co ${i}`) => ({
    name: `Role ${i}`,
    jobUrl: `https://acme.gupy.io/job/x${i}`,
    careerPageName: company,
    workplaceType: 'remote',
    country: 'Brasil',
    publishedDate: '2026-08-01T00:00:00.000Z',
  });

  // One sweep per keyword — Gupy's jobName matches titles narrowly, so terms
  // must NOT be joined into a single query the way a16z-speedrun-talent does.
  const kwCalls = [];
  const kwCtx = {
    fetchJson: async (url) => {
      kwCalls.push(url);
      return { data: [mk(kwCalls.length)], pagination: { total: 1 } };
    },
  };
  const kwJobs = await provider.fetch({ name: 'Gupy', keywords: ['Backend', 'Full Stack'], max_pages: 3 }, kwCtx);
  const kwNames = kwCalls.map((u) => new URL(u).searchParams.get('jobName'));
  if (kwCalls.length === 2 && kwNames[0] === 'Backend' && kwNames[1] === 'Full Stack' && kwJobs.length === 2) {
    pass('fetch() sweeps each keyword separately instead of joining them into one query');
  } else {
    fail(`fetch() keyword sweeps = ${JSON.stringify({ kwNames, jobs: kwJobs.length })}`);
  }

  // The same posting routinely matches several keywords — dedup by URL.
  const dupCtx = { fetchJson: async () => ({ data: [mk(1), mk(1)], pagination: { total: 2 } }) };
  const dupJobs = await provider.fetch({ keywords: ['A', 'B'], max_pages: 1 }, dupCtx);
  if (dupJobs.length === 1) pass('fetch() dedups by posting URL across keywords and within a page');
  else fail(`fetch() dedup = ${JSON.stringify(dupJobs.map((j) => j.url))}`);

  // offset/limit pagination, stopping once offset covers pagination.total.
  const pageCalls = [];
  const pageCtx = {
    fetchJson: async (url) => {
      pageCalls.push(url);
      const offset = Number(new URL(url).searchParams.get('offset'));
      const data = Array.from({ length: offset === 0 ? 100 : 20 }, (_, i) => mk(offset + i));
      return { data, pagination: { total: 120 } };
    },
  };
  const paged = await provider.fetch({ keywords: ['X'], max_pages: 5 }, pageCtx);
  const offsets = pageCalls.map((u) => new URL(u).searchParams.get('offset'));
  const limits = pageCalls.map((u) => new URL(u).searchParams.get('limit'));
  if (pageCalls.length === 2 && offsets[0] === '0' && offsets[1] === '100'
      && limits.every((l) => l === '100') && paged.length === 120) {
    pass('fetch() paginates by offset/limit=100 and stops on a short page');
  } else {
    fail(`fetch() pagination = ${JSON.stringify({ offsets, limits, jobs: paged.length })}`);
  }

  // REGRESSION (2026-08-13): pagination.total reports the PAGE SIZE, not the
  // result-set size — the live API answers total=100 at every offset of a
  // 370-posting keyword. Trusting it (the way a16z-speedrun-talent trusts
  // `total_pages`, which is an honest page count) broke every sweep after page
  // 0 and dropped 205 of 548 deduped postings in silence, 14 of them inside the
  // active window. A short page is the only end-of-feed signal this API gives.
  const lyingCalls = [];
  const lyingCtx = {
    fetchJson: async (url) => {
      lyingCalls.push(url);
      const offset = Number(new URL(url).searchParams.get('offset'));
      const remaining = Math.max(0, 370 - offset);
      const data = Array.from({ length: Math.min(100, remaining) }, (_, i) => mk(offset + i));
      return { data, pagination: { total: 100, limit: 100, offset } };
    },
  };
  const lying = await provider.fetch({ keywords: ['Desenvolvedor'], max_pages: 5 }, lyingCtx);
  if (lyingCalls.length === 4 && lying.length === 370) {
    pass('fetch() ignores a pagination.total that reports the page size and paginates until a short page');
  } else {
    fail(`fetch() lying-total = ${JSON.stringify({ calls: lyingCalls.length, jobs: lying.length })}`);
  }

  // verify-portals.mjs probes with ctx.maxPages:1 under a 4-request sentinel.
  // This provider paginates per (keyword × page), so the budget must be a TOTAL
  // for the call: read per keyword, a 10-keyword entry would spend 10 requests
  // on a 1-page probe, trip the sentinel, and get a live board reported as a
  // cut-off.
  const probeCalls = [];
  const probeWarnings = [];
  let probed;
  const beforeProbe = console.error;
  try {
    console.error = (...args) => probeWarnings.push(args.join(' '));
    probed = await provider.fetch({ keywords: ['A', 'B', 'C', 'D', 'E'], max_pages: 5 }, {
      maxPages: 1,
      fetchJson: async (url) => {
        probeCalls.push(url);
        return { data: Array.from({ length: 100 }, (_, i) => mk(i)), pagination: { total: 100 } };
      },
    });
  } finally {
    console.error = beforeProbe;
  }
  if (probeCalls.length === 1 && probed.length === 100) {
    pass('fetch() honors ctx.maxPages as a total page budget across keyword sweeps');
  } else {
    fail(`fetch() ctx.maxPages = ${JSON.stringify({ calls: probeCalls.length, jobs: probed?.length })}`);
  }
  if (probeWarnings.length === 0) pass('fetch() stays quiet when ctx.maxPages truncates — a probe is not a misconfiguration');
  else fail(`probe emitted warnings: ${JSON.stringify(probeWarnings)}`);

  // max_pages caps the sweep and warns.
  const capCalls = [];
  const capCtx = {
    fetchJson: async (url) => {
      capCalls.push(url);
      return { data: Array.from({ length: 100 }, (_, i) => mk(capCalls.length * 1000 + i)), pagination: { total: 5000 } };
    },
  };
  const capWarnings = [];
  const realConsoleError = console.error;
  let capped;
  try {
    console.error = (...args) => capWarnings.push(args.join(' '));
    capped = await provider.fetch({ keywords: ['X'], max_pages: 2 }, capCtx);
  } finally {
    console.error = realConsoleError;
  }
  if (capCalls.length === 2 && capped.length === 200) pass('fetch() stops a never-ending feed at max_pages');
  else fail(`fetch() cap = ${JSON.stringify({ calls: capCalls.length, jobs: capped?.length })}`);
  if (capWarnings.some((w) => w.includes('truncated at max_pages=2'))) pass('fetch() warns when max_pages truncates a keyword sweep');
  else fail(`truncation warning missing; captured = ${JSON.stringify(capWarnings)}`);

  // Optional filters ride along as comma-joined params; unset ones are absent.
  const paramCalls = [];
  const paramCtx = { fetchJson: async (url) => { paramCalls.push(url); return { data: [], pagination: { total: 0 } }; } };
  await provider.fetch({
    keywords: ['X'],
    workplace_types: ['remote', 'hybrid'],
    job_types: ['vacancy_type_effective'],
    state: 'RS',
    country: 'Brasil',
    max_pages: 1,
  }, paramCtx);
  const p = new URL(paramCalls[0]).searchParams;
  if (p.get('workplaceTypes') === 'remote,hybrid' && p.get('jobTypes') === 'vacancy_type_effective'
      && p.get('state') === 'RS' && p.get('country') === 'Brasil') {
    pass('fetch() sends workplace_types/job_types comma-joined plus state/country');
  } else {
    fail(`fetch() params = ${JSON.stringify(Object.fromEntries(p))}`);
  }

  const bareCalls = [];
  const bareCtx = { fetchJson: async (url) => { bareCalls.push(url); return { data: [], pagination: { total: 0 } }; } };
  await provider.fetch({ keywords: ['X'], workplace_types: [], max_pages: 1 }, bareCtx);
  const bp = new URL(bareCalls[0]).searchParams;
  if (!bp.has('workplaceTypes') && !bp.has('jobTypes') && !bp.has('state') && !bp.has('country')) {
    pass('fetch() omits optional params entirely when unset or empty');
  } else {
    fail(`fetch() bare params = ${JSON.stringify(Object.fromEntries(bp))}`);
  }

  // Empty feed returns [] after one call per keyword.
  const emptyCalls = [];
  const emptyCtx = { fetchJson: async (url) => { emptyCalls.push(url); return { data: [], pagination: { total: 0 } }; } };
  const empty = await provider.fetch({ keywords: ['X'], max_pages: 3 }, emptyCtx);
  if (emptyCalls.length === 1 && empty.length === 0) pass('fetch() returns [] after one call on an empty feed');
  else fail(`empty feed = ${JSON.stringify({ calls: emptyCalls.length, jobs: empty.length })}`);

  // A malformed payload must throw loudly rather than return a silent partial.
  let threw = null;
  try {
    await provider.fetch({ keywords: ['X'], max_pages: 1 }, { fetchJson: async () => ({ unexpected: true }) });
  } catch (err) {
    threw = err.message;
  }
  if (threw && threw.includes('unexpected API response')) pass('fetch() throws on a malformed payload instead of returning a silent partial');
  else fail(`malformed payload handling = ${JSON.stringify(threw)}`);

  // Default keyword keeps an entry with no keywords/q usable.
  const defCalls = [];
  const defCtx = { fetchJson: async (url) => { defCalls.push(url); return { data: [], pagination: { total: 0 } }; } };
  await provider.fetch({ name: 'Gupy', max_pages: 1 }, defCtx);
  if (defCalls.length === 1 && new URL(defCalls[0]).searchParams.get('jobName') === 'Desenvolvedor') {
    pass('fetch() falls back to the default keyword when neither keywords[] nor q: is set');
  } else {
    fail(`default keyword = ${JSON.stringify(defCalls.map((u) => new URL(u).searchParams.get('jobName')))}`);
  }

  // q: accepted as a single-keyword form.
  const qCalls = [];
  const qCtx = { fetchJson: async (url) => { qCalls.push(url); return { data: [], pagination: { total: 0 } }; } };
  await provider.fetch({ q: 'AI Engineer', max_pages: 1 }, qCtx);
  if (new URL(qCalls[0]).searchParams.get('jobName') === 'AI Engineer') pass('fetch() accepts q: as a single-keyword form');
  else fail(`q form = ${JSON.stringify(new URL(qCalls[0]).searchParams.get('jobName'))}`);

  // Every request must hit the pinned API host over HTTPS (SSRF guard).
  if (qCalls.every((u) => u.startsWith('https://employability-portal.gupy.io/api/v1/jobs?'))) {
    pass('fetch() pins every request to https://employability-portal.gupy.io/api/v1/jobs');
  } else {
    fail(`api host = ${JSON.stringify(qCalls)}`);
  }
} catch (err) {
  fail(`gupy provider test threw: ${err.message}`);
}
