// @ts-check
import { fetchJsonWithRetry } from './_http.mjs';

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
// Wire in via a `job_boards:` entry with `provider: gupy`, or point
// `careers_url` at https://portal.gupy.io (auto-detected).

const API_BASE = 'https://employability-portal.gupy.io/api/v1/jobs';
const API_HOST = 'employability-portal.gupy.io';
const PER_PAGE = 100; // server-side maximum
const DEFAULT_MAX_PAGES = 5; // × PER_PAGE = 500 postings per keyword
// Runaway bound, not a coverage target — same policy as a16z-speedrun-talent
// and workday. Iteration stops on a short page, so on an honest feed this costs
// nothing: the measured 10-keyword sweep needs 13 requests and no keyword gets
// past page 4.
const MAX_PAGES_CAP = 200;

const DEFAULT_KEYWORDS = ['Desenvolvedor'];

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
 */
function resolveKeywords(entry) {
  if (Array.isArray(entry?.keywords)) {
    const list = entry.keywords.filter((k) => typeof k === 'string' && k.trim()).map((k) => k.trim());
    if (list.length > 0) return list;
  }
  if (typeof entry?.q === 'string' && entry.q.trim()) return [entry.q.trim()];
  return DEFAULT_KEYWORDS;
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
 *   - company:     `careerPageName` — the employer's own board label. Note this
 *                  is user-authored and employers do put recruiting slogans
 *                  here; portals.yml `company_aliases` maps those back.
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
    const pageBudget = Number.isInteger(ctx?.maxPages) && ctx.maxPages > 0 ? ctx.maxPages : Infinity;
    let pagesFetched = 0;

    // One posting routinely matches several keywords; the URL is the dedup key
    // so the merged result carries each posting exactly once.
    const seen = new Set();
    const out = [];

    for (const keyword of keywords) {
      if (pagesFetched >= pageBudget) break;
      for (let page = 0; page < maxPages; page++) {
        if (pagesFetched >= pageBudget) break;
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
        // redirect:'error' prevents SSRF via server-side redirects. Retried on
        // transient upstream failures so one blip mid-sweep cannot abort the
        // whole board and return nothing.
        const json = await fetchJsonWithRetry(ctx, url, { redirect: 'error' });
        pagesFetched++;
        if (!json || !Array.isArray(json.data)) {
          throw new Error(
            `gupy: unexpected API response for "${keyword}" page ${page} — expected { data: [...] }, got keys: [${json ? Object.keys(json).join(', ') : 'null'}]`,
          );
        }

        for (const raw of json.data) {
          const normalized = normalizeGupyApiJob(raw);
          if (!normalized || seen.has(normalized.url)) continue;
          seen.add(normalized.url);
          out.push(normalized);
        }

        // A short page is the end of the feed — see the header note on why
        // `pagination.total` cannot be used for this.
        if (json.data.length < PER_PAGE) break;
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
    return out;
  },
};
