// @ts-check
import { fetchJsonWithRetry } from './_http.mjs';
import { resolveProfileKeywords } from './_profile-keywords.mjs';

/** @typedef {import('./_types.js').Provider} Provider */

// Gupy provider — board-wide aggregator over the Brazilian Gupy platform:
// https://employability-portal.gupy.io/api/v1/jobs (public, zero-auth).
// Response shape: { data: [ { name, jobUrl, careerPageName, city, state,
//   country, workplaceType, publishedDate, description, ... } ],
//   pagination: { total, offset, limit } }
//
// Unlike the per-company ATS providers (greenhouse, lever, ashby), Gupy is
// searched by KEYWORD across the whole platform — there is no company slug.
// One sweep therefore runs per entry keyword and the results are merged, so
// the board surfaces employers that are not in tracked_companies at all.
//
// Paginated via offset/limit (limit caps at 100 server-side — limit=200 is a
// 400). Every keyword is swept independently and results are deduped by posting
// URL, since one posting commonly matches several keywords.
//
// `pagination.total` is NOT usable as a stop condition. The field reports the
// page size, not the result-set size, so at limit=100 it answers 100 at every
// offset however deep the feed goes (measured 2026-08-13: jobName=Desenvolvedor
// returns 370 postings across 4 pages, and every one of those pages reports
// total=100). Reading it the way a16z-speedrun-talent reads `total_pages` — a
// page count, which is honest — broke the sweep after page 0 for every keyword
// with 100+ results: 343 of 548 deduped postings returned, 14 of them inside the
// active 14-day window, with `max_pages` never binding and the truncation
// warning never printing. A short page is the only end-of-feed signal this API
// gives, so it is the only one used below.
//
// Header note: the endpoint answers the project's default user-agent with no
// Origin/Referer and no sec-ch-ua block (verified 2026-08-13 against all three
// header sets). No browser impersonation is needed here.
//
// The feed is ordered publishedDate-descending and that ordering holds ACROSS
// pages (verified 2026-08-13: page 0 ends on the same date page 1 opens with),
// so a recency window can stop a sweep early — the workday.mjs pattern. The
// window comes from `ctx.sinceMs` (the run's --since/--posted-after) or, when
// the run states none, from this entry's own `since_days`.
//
// Wire in via a `job_boards:` entry with `provider: gupy`, or point
// `careers_url` at https://portal.gupy.io (auto-detected). Recognized entry
// keys: `keywords` (falls back to config/profile.yml target_roles), `q`,
// `since_days`, `max_pages`, `workplace_types`, `job_types`, `state`,
// `country`.
//
// ── Reading the provider contract here ───────────────────────────────────────
// One entry, but N independent queries: every keyword is its own complete
// result set, not a slice of a shared one. Provider conventions written for
// single-source boards are DEFAULTS here, not constraints — where the literal
// reading produces a worse outcome, deviate on purpose and say why in the code.
// Three deviations exist so far:
//
//   - `ctx.maxPages` is a total page budget for the call, not pages per sweep,
//     counting pages ATTEMPTED. The per-sweep reading lets one probe issue one
//     request per keyword.
//   - A failed page ends its own sweep and the others continue (workday's
//     policy), instead of failing the whole entry (a16z's). Sweeps 1-6 are
//     complete and correct when sweep 7 dies.
//   - `max_pages` is per keyword, so the entry's real ceiling is
//     max_pages × keywords.length.
//
// What does NOT get an exception: the security conventions (host allowlist,
// `redirect: 'error'`), the normalized Job shape, and zero-token/zero-auth.
// Those hold for every provider regardless of shape.

const API_BASE = 'https://employability-portal.gupy.io/api/v1/jobs';
const API_HOST = 'employability-portal.gupy.io';
const PER_PAGE = 100; // server-side maximum
const DEFAULT_MAX_PAGES = 5; // × PER_PAGE = 500 postings per keyword
// Runaway bound, not a coverage target — same policy as a16z-speedrun-talent
// and workday. Iteration stops on a short page, so on an honest feed this costs
// nothing: the measured 10-keyword sweep needs 13 requests and no keyword gets
// past page 4.
const MAX_PAGES_CAP = 200;
// Resolving the canonical employer name requires one SSR career-page read per
// distinct Gupy board. Keep that fan-out bounded: a broad keyword can surface
// dozens of employers, and issuing all page reads at once needlessly hammers
// Gupy even though the lookups are independent.
const COMPANY_NAME_CONCURRENCY = 6;

// Same margin workday.mjs uses: stop a safe distance PAST the floor so a feed
// that is not perfectly monotonic can never strand an eligible posting on an
// unfetched page. Gupy's ordering measured strictly descending across pages on
// 2026-08-13, so this costs at most one extra page per keyword.
const EARLY_STOP_MARGIN_MS = 2 * 86_400_000;

/** Hosts a Gupy posting URL is allowed to live on. */
function isSafeGupyUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    return parsed.protocol === 'https:' && (host === 'gupy.io' || host.endsWith('.gupy.io'));
  } catch {
    return false;
  }
}

/** @param {string} url */
function assertApiUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`gupy: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`gupy: URL must use HTTPS: ${url}`);
  if (parsed.hostname !== API_HOST) {
    throw new Error(`gupy: untrusted hostname "${parsed.hostname}" — must be ${API_HOST}`);
  }
  return url;
}

/** Resolve the per-keyword page cap: a positive integer `max_pages`, capped. */
function resolveMaxPages(entry) {
  const v = entry?.max_pages;
  if (Number.isInteger(v) && v > 0) return Math.min(v, MAX_PAGES_CAP);
  return DEFAULT_MAX_PAGES;
}

/**
 * Keywords to sweep. Unlike a16z-speedrun-talent — which joins keywords into a
 * single full-text `q` — Gupy's jobName is a narrow title match, so each
 * keyword needs its own sweep or the terms would AND together and return ~0.
 *
 * Falls back to config/profile.yml's target_roles (the vdab.mjs pattern) when
 * the entry declares none. This used to be a hardcoded ['Desenvolvedor'] — a
 * pt-BR targeting decision baked into a system-layer file, which silently swept
 * one keyword for every user who had not filled the entry in.
 */
function resolveKeywords(entry) {
  if (Array.isArray(entry?.keywords)) {
    const list = entry.keywords.filter((k) => typeof k === 'string' && k.trim()).map((k) => k.trim());
    if (list.length > 0) return list;
  }
  if (typeof entry?.q === 'string' && entry.q.trim()) return [entry.q.trim()];
  return resolveProfileKeywords();
}

/**
 * This entry's own recency window in days, or null when unset.
 *
 * Exists because scan.mjs's `max_posting_age_days` is GLOBAL: switching on a
 * 14-day window for a board-wide sweep used to mean either narrowing every
 * tracked company to 14 days as well, or passing `--since 14` on the command
 * line for the whole run. A per-entry window is the same thing vdab.mjs's
 * `vdab.days` expresses, scoped where it belongs.
 */
function resolveSinceDays(entry) {
  const v = entry?.since_days;
  return Number.isInteger(v) && v > 0 ? v : null;
}

/**
 * Turn a day count into an absolute floor, truncated to UTC midnight.
 *
 * Truncated on purpose, to be byte-identical with what `--since` means:
 * scan.mjs's resolveEffectiveAfter does the same, "marginally more permissive,
 * which is the safe direction for a bound that also stops pagination". An exact
 * `now - days` timestamp would also make the same config return different
 * results depending on the hour the scan happened to run.
 *
 * Returns null for a day count large enough to leave the representable Date
 * range, rather than propagating an Invalid Date into the comparison.
 *
 * @param {number|null} days
 * @param {number} [now] - Injectable clock for tests.
 * @returns {number|null}
 */
export function sinceDaysToCutoffMs(days, now = Date.now()) {
  if (days === null) return null;
  const d = new Date(now - days * 86_400_000);
  if (Number.isNaN(d.getTime())) return null;
  return Date.parse(`${d.toISOString().slice(0, 10)}T00:00:00Z`);
}

/**
 * True once a page's oldest unambiguously-dated posting is past the window.
 *
 * Undated postings are invisible here (the `dated.length === 0` guard), so a
 * page of nothing but undated postings never stops pagination. Mirrors
 * workday.mjs's function of the same name. Exported for the test suite.
 *
 * @param {Array<{postedAt?: number}>} pageJobs
 * @param {number|null} cutoffMs
 */
export function pageIsPastWindow(pageJobs, cutoffMs) {
  if (typeof cutoffMs !== 'number') return false;
  const dated = pageJobs.map((j) => j?.postedAt).filter((v) => typeof v === 'number');
  if (dated.length === 0) return false;
  return Math.min(...dated) < cutoffMs - EARLY_STOP_MARGIN_MS;
}

/** Comma-joined list param, or null when unset — mirrors the platform's format. */
function listParam(value) {
  if (!Array.isArray(value)) return null;
  const list = value.filter((v) => typeof v === 'string' && v.trim()).map((v) => v.trim());
  return list.length > 0 ? list.join(',') : null;
}

// NaN-safe Date.parse — `|| undefined` would also coerce a valid epoch 0.
function toEpochMs(value) {
  if (typeof value !== 'string' || !value) return undefined;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * Extract the employer-facing name from a Gupy career page's SSR payload.
 *
 * The board-wide jobs API calls its field `careerPageName`, but that value is
 * actually the page's configurable publication label. For FCamara, for
 * example, the list API returns "VENHA SER #SANGUELARANJA 🧡🚀" while the
 * career page exposes:
 *
 *   careerPage.name            = "FCamara"
 *   careerPage.publicationName = "VENHA SER #SANGUELARANJA 🧡🚀"
 *
 * Gupy server-renders `careerPage.name` inside __NEXT_DATA__, so resolving one
 * page per distinct board gives us the real company label without a per-job
 * request. Invalid or changed markup returns an empty string and lets the
 * caller retain `careerPageName` as a fail-open fallback.
 *
 * @param {unknown} html
 * @returns {string}
 */
export function parseGupyCareerPageCompany(html) {
  if (typeof html !== 'string' || !html) return '';
  const match = html.match(/<script\b[^>]*\bid=(['"])__NEXT_DATA__\1[^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return '';
  try {
    const data = JSON.parse(match[2]);
    const name = data?.props?.pageProps?.careerPage?.name;
    return typeof name === 'string' ? name.trim() : '';
  } catch {
    return '';
  }
}

/** Fold a label for recruiting-copy detection without changing its output. */
function foldCompanyLabel(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Gupy exposes two user-authored labels, so neither is universally canonical.
 * Prefer the SSR page name when it removes obvious recruitment copy, or when
 * it is materially shorter without introducing such copy. Conversely, retain
 * the list label when the page name itself starts with "Carreiras", "Vagas",
 * "Seja", etc. This avoids turning good labels such as "Eletromidia" into
 * "Carreiras Eletromidia" while still fixing FCamara's publication slogan.
 *
 * @param {unknown} listLabel `careerPageName` from the board-wide API.
 * @param {unknown} pageName `careerPage.name` from the SSR page.
 * @returns {string}
 */
export function chooseGupyCompanyName(listLabel, pageName) {
  const list = typeof listLabel === 'string' ? listLabel.trim() : '';
  const page = typeof pageName === 'string' ? pageName.trim() : '';
  if (!page) return list;
  if (!list || list === page) return page;

  const looksRecruiting = (value) => {
    const folded = foldCompanyLabel(value);
    return /(?:^|\W)(?:carreiras?|vagas?|jobs?|vem ser|venha ser|faca parte|recrutamento para|seja)(?:\W|$)/.test(folded)
      || /jobs?$/.test(folded);
  };
  const listIsRecruiting = looksRecruiting(list);
  const pageIsRecruiting = looksRecruiting(page);
  if (listIsRecruiting !== pageIsRecruiting) return listIsRecruiting ? page : list;

  // When both labels look equally brand-like, a page name at least 20% shorter
  // usually removes a slogan/legal suffix ("Aviator, Asas para Voar." →
  // "Aviator"; "Cresol Oficial" → "Cresol"). Close calls retain the API label
  // rather than churning established history for cosmetic differences.
  if (!pageIsRecruiting && page.length <= list.length * 0.8) return page;
  return list;
}

/**
 * Resolve the canonical employer label once per distinct Gupy board.
 *
 * Origins come only from job URLs that normalizeGupyApiJob already host-locks
 * to HTTPS *.gupy.io, so this cannot turn API-controlled careerPageUrl data
 * into an SSRF target. Lookup failures are non-fatal: the list API's label is
 * still better than dropping the posting altogether.
 *
 * `ctx.maxPages` identifies a bounded health probe. Such probes only need to
 * prove the JSON feed is alive, so they deliberately skip this enrichment;
 * otherwise a one-page probe could fan out into dozens of HTML requests.
 *
 * @param {Array<{url: string, company: string}>} jobs
 * @param {any} ctx
 */
async function resolveCanonicalCompanies(jobs, ctx) {
  if (jobs.length === 0 || typeof ctx?.fetchText !== 'function') return;
  if (Number.isInteger(ctx?.maxPages) && ctx.maxPages > 0) return;

  /** @type {Map<string, Array<{url: string, company: string}>>} */
  const jobsByOrigin = new Map();
  for (const job of jobs) {
    let origin;
    try {
      // job.url has already passed isSafeGupyUrl; re-check defensively because
      // this function owns the network call and must not rely on its caller.
      if (!isSafeGupyUrl(job.url)) continue;
      origin = `${new URL(job.url).origin}/`;
    } catch {
      continue;
    }
    if (!jobsByOrigin.has(origin)) jobsByOrigin.set(origin, []);
    jobsByOrigin.get(origin).push(job);
  }

  const groups = [...jobsByOrigin.entries()];
  let cursor = 0;
  const worker = async () => {
    while (cursor < groups.length) {
      const index = cursor++;
      const [origin, boardJobs] = groups[index];
      try {
        const html = await ctx.fetchText(origin, {
          redirect: 'error',
          headers: { accept: 'text/html' },
        });
        const pageName = parseGupyCareerPageCompany(html);
        if (!pageName) continue;
        for (const job of boardJobs) job.company = chooseGupyCompanyName(job.company, pageName);
      } catch (err) {
        console.error(
          `⚠️  gupy: canonical company lookup failed for ${origin} — ${err?.message || String(err)}; keeping careerPageName`,
        );
      }
    }
  };
  const workerCount = Math.min(COMPANY_NAME_CONCURRENCY, groups.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
}

/**
 * Build the display location from the platform's separate fields.
 *
 * The raw API exposes `workplaceType` as a SINGULAR string (remote / hybrid /
 * on-site), unlike the Python bridge's normalized `workplace_types` array.
 * Labels stay in pt-BR to match what the Brazilian postings themselves say and
 * what `location_filter` in portals.yml is written against.
 *
 * @param {any} j
 */
export function buildGupyLocation(j) {
  const parts = [];
  const type = typeof j?.workplaceType === 'string' ? j.workplaceType.trim() : '';
  if (type) {
    parts.push({ remote: 'Remoto', hybrid: 'Híbrido', 'on-site': 'Presencial' }[type] || type);
  } else if (j?.isRemoteWork === true) {
    parts.push('Remoto');
  }
  for (const field of ['city', 'state', 'country']) {
    const v = j?.[field];
    if (typeof v === 'string' && v.trim()) parts.push(v.trim());
  }
  return parts.join(', ');
}

/**
 * Normalize one raw Gupy API posting. Exported for unit tests.
 *
 * Field mapping → the normalized Job shape:
 *   - title:       `name`, trimmed (postings without one are dropped).
 *   - url:         `jobUrl`, host-locked to *.gupy.io (dedup key).
 *   - company:     `careerPageName` as the list-level fallback. fetch() later
 *                  replaces it with the SSR career page's `careerPage.name`
 *                  once per distinct board; the API field is actually the
 *                  configurable publication label and may be a slogan.
 *   - location:    workplaceType + city/state/country (see buildGupyLocation).
 *   - description: shipped in the list payload for free, so content_filter and
 *                  the cross-listing SimHash both work without a second request.
 *   - postedAt:    `publishedDate` ISO → epoch ms (omitted when unparseable).
 *
 * @param {any} j
 * @returns {{ title: string, url: string, company: string, location: string, description?: string, postedAt?: number } | null}
 */
export function normalizeGupyApiJob(j) {
  if (!j || typeof j !== 'object') return null;

  const title = typeof j.name === 'string' ? j.name.trim() : '';
  if (!title) return null;

  const rawUrl = typeof j.jobUrl === 'string' ? j.jobUrl.trim() : '';
  if (!isSafeGupyUrl(rawUrl)) return null;

  /** @type {{ title: string, url: string, company: string, location: string, description?: string, postedAt?: number }} */
  const job = {
    title,
    url: rawUrl,
    company: typeof j.careerPageName === 'string' ? j.careerPageName.trim() : '',
    location: buildGupyLocation(j),
  };
  if (typeof j.description === 'string' && j.description) job.description = j.description;
  const postedAt = toEpochMs(j.publishedDate);
  if (postedAt !== undefined) job.postedAt = postedAt;
  return job;
}

/** @type {Provider} */
export default {
  id: 'gupy',

  detect(entry) {
    for (const candidate of [entry?.careers_url, entry?.api]) {
      if (typeof candidate !== 'string' || !candidate) continue;
      try {
        const parsed = new URL(candidate);
        const host = parsed.hostname.toLowerCase();
        if (parsed.protocol === 'https:' && (host === 'gupy.io' || host.endsWith('.gupy.io'))) {
          return { url: candidate };
        }
      } catch {
        // not a URL → not ours
      }
    }
    return null;
  },

  async fetch(entry, ctx) {
    assertApiUrl(API_BASE);
    const maxPages = resolveMaxPages(entry);
    const keywords = resolveKeywords(entry);
    if (keywords.length === 0) {
      throw new Error(
        `gupy: entry "${entry?.name || '(unnamed)'}" has no keywords[]/q: and no config/profile.yml target_roles to fall back to`,
      );
    }
    const workplaceTypes = listParam(entry?.workplace_types);
    const jobTypes = listParam(entry?.job_types);
    const state = typeof entry?.state === 'string' ? entry.state.trim() : '';
    const country = typeof entry?.country === 'string' ? entry.country.trim() : '';

    // Total page budget for this call, NOT pages per keyword. This provider's
    // unit of pagination is (keyword × page), so the per-sweep reading that
    // single-sweep providers use (remotli, alibaba) would let a 10-keyword entry
    // issue 10 requests under `ctx.maxPages: 1` — past verify-portals'
    // PROBE_REQUEST_BUDGET of 4, tripping the sentinel and reporting a live
    // board as a cut-off. With one keyword the two readings coincide.
    //
    // Latent, not live: verify-portals.mjs probes tracked_companies only today,
    // and Gupy is configured under job_boards. It becomes real the moment either
    // of those changes — the contract in providers/README.md asks for the hint
    // to be honored regardless, and this provider was ignoring it outright.
    // Counts pages ATTEMPTED, not pages returned: a failing sweep moves on to
    // the next keyword (see the per-sweep isolation below), so counting only
    // successes would let a probe against a broken board walk every keyword.
    const pageBudget = Number.isInteger(ctx?.maxPages) && ctx.maxPages > 0 ? ctx.maxPages : Infinity;
    let pagesAttempted = 0;

    // Recency window. `ctx.sinceMs` — the run's own window, from --since or
    // --posted-after — wins when present: an operator who widened the run to 30
    // days must not silently get this entry's 14. `since_days` is the entry's
    // default for the runs that state no window at all, which is most of them
    // (resolveEarlyStopMs returns null without a CLI flag).
    //
    // Only the entry's own window FILTERS. A ctx window is early-stop only,
    // exactly as workday.mjs treats it: scan.mjs applies postedDateFilter /
    // postingAgeFilter downstream, and re-deriving those floors here risks
    // sub-second clock drift dropping a boundary posting the scanner wanted.
    // Nothing downstream knows about since_days, so that one must filter.
    const ctxCutoff = typeof ctx?.sinceMs === 'number' ? ctx.sinceMs : null;
    const entryCutoff = sinceDaysToCutoffMs(resolveSinceDays(entry));
    const cutoffMs = ctxCutoff ?? entryCutoff;
    const filterCutoff = ctxCutoff === null ? entryCutoff : null;

    // One posting routinely matches several keywords; the URL is the dedup key
    // so the merged result carries each posting exactly once.
    const seen = new Set();
    const out = [];

    // Per-sweep failure isolation. Each keyword is an independent query, so a
    // dead page in sweep 7 says nothing about sweeps 1-6 — losing them would be
    // throwing away complete, correct results. This is the workday.mjs policy
    // (keep the pages in hand, warn, stop that unit) rather than the a16z one
    // (fail loudly), and _http.mjs is explicit that the choice is the caller's:
    // "that policy genuinely differs per provider".
    //
    // The a16z reasoning still applies WITHIN a sweep — a mid-sweep failure
    // leaves that keyword partial. Harmless here: the feed is newest-first, so a
    // partial sweep is "the freshest N pages of this keyword", exactly the shape
    // `max_pages` truncation already produces and already warns about.
    let firstError = null;
    let succeededOnce = false;

    for (const keyword of keywords) {
      if (pagesAttempted >= pageBudget) break;
      for (let page = 0; page < maxPages; page++) {
        if (pagesAttempted >= pageBudget) break;
        const params = new URLSearchParams({
          jobName: keyword,
          offset: String(page * PER_PAGE),
          limit: String(PER_PAGE),
        });
        if (workplaceTypes) params.set('workplaceTypes', workplaceTypes);
        if (jobTypes) params.set('jobTypes', jobTypes);
        if (state) params.set('state', state);
        if (country) params.set('country', country);

        const url = `${API_BASE}?${params}`;
        pagesAttempted++;
        let json;
        try {
          // redirect:'error' prevents SSRF via server-side redirects. Retried on
          // transient upstream failures so one blip mid-sweep cannot abort the
          // whole board and return nothing.
          json = await fetchJsonWithRetry(ctx, url, { redirect: 'error' });
          if (!json || !Array.isArray(json.data)) {
            // A shape change is systemic, so it will fail every sweep and reach
            // the all-failed rethrow below. Caught here so a one-off bad page
            // does not cost the sweeps that already succeeded.
            throw new Error(
              `gupy: unexpected API response for "${keyword}" page ${page} — expected { data: [...] }, got keys: [${json ? Object.keys(json).join(', ') : 'null'}]`,
            );
          }
        } catch (err) {
          if (firstError === null) firstError = err;
          console.error(`⚠️  gupy: sweep "${keyword}" stopped at page ${page} — ${err.message}`);
          break;
        }
        succeededOnce = true;

        const pageJobs = [];
        for (const raw of json.data) {
          const normalized = normalizeGupyApiJob(raw);
          if (!normalized) continue;
          pageJobs.push(normalized);
          if (seen.has(normalized.url)) continue;
          seen.add(normalized.url);
          // Undated postings pass the window — same "don't penalize missing
          // data" convention scan.mjs's date filters use.
          if (filterCutoff !== null && typeof normalized.postedAt === 'number'
              && normalized.postedAt < filterCutoff) {
            continue;
          }
          out.push(normalized);
        }

        // A short page is the end of the feed — see the header note on why
        // `pagination.total` cannot be used for this.
        if (json.data.length < PER_PAGE) break;
        // Newest-first ordering (verified stable across pages) means once a
        // whole page sits past the window, every later page does too.
        if (pageIsPastWindow(pageJobs, cutoffMs)) break;
        // Full page in hand with no budget left to read the next one: the feed
        // has more and this entry's config is what stopped us. Not warned when
        // `ctx.maxPages` did the cutting — that is a deliberate probe, not a
        // misconfiguration.
        if (page + 1 >= maxPages) {
          console.error(
            `⚠️  gupy: "${keyword}" truncated at max_pages=${maxPages} (${maxPages * PER_PAGE} postings read, feed has more) — raise max_pages on this entry for more`,
          );
        }
      }
    }

    // Not one sweep produced a page: there is no partial worth keeping, and the
    // cause is an outage, a moved endpoint or a changed payload — all of which
    // must reach scan.mjs's `Errors (N):` print and data/portal-health.tsv
    // instead of passing for a quiet zero. This is the half of the a16z policy
    // that survives per-sweep isolation.
    //
    // Rethrows the ORIGINAL error, never a wrapper: verify-portals'
    // classifyFetchError reads err.status and err.name to tell slug_gone from
    // auth from server from network, and wrapping would flatten all four to
    // 'unknown' — which is also what the portal-health streak escalates on.
    if (!succeededOnce && firstError !== null) throw firstError;
    await resolveCanonicalCompanies(out, ctx);
    return out;
  },
};
