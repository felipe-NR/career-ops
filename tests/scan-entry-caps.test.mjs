// tests/scan-entry-caps.test.mjs
//
// Covers limitOffersPerEntry — the per-entry fan-out cap added to scan.mjs on
// 2026-08-13 when the Gupy bridge was internalized as providers/gupy.mjs.
// The retired bridge applied max_new_per_run / max_per_company itself; nothing
// in scan.mjs did, so board-wide sweeps could flood data/pipeline.md.
import { pass, fail, ROOT } from './helpers.mjs';
import { join } from 'path';
import { pathToFileURL } from 'url';

console.log('\nscan.mjs — per-entry fan-out caps');

try {
  const { limitOffersPerEntry } = await import(pathToFileURL(join(ROOT, 'scan.mjs')).href);

  const mk = (entry, company, url, postedAt) => ({ _entryName: entry, company, url, title: 'T', postedAt });

  // Opt-in: an entry with neither key set is never capped, so every existing
  // per-company config keeps its current behavior.
  const uncapped = limitOffersPerEntry([mk('A', 'X', 'u1', 3), mk('A', 'Y', 'u2', 2)], () => ({}));
  if (uncapped.selected.length === 2 && uncapped.skipped.length === 0) {
    pass('limitOffersPerEntry leaves an entry with no caps untouched (opt-in)');
  } else {
    fail(`uncapped = ${JSON.stringify({ sel: uncapped.selected.length, skip: uncapped.skipped.length })}`);
  }

  // maxTotal trims the overflow and keeps the newest.
  const total = limitOffersPerEntry(
    [mk('A', 'X', 'u1', 1), mk('A', 'Y', 'u2', 3), mk('A', 'Z', 'u3', 2)],
    () => ({ maxTotal: 2 }),
  );
  if (total.selected.length === 2 && total.skipped.length === 1
      && total.selected[0].postedAt === 3 && total.selected[1].postedAt === 2) {
    pass('limitOffersPerEntry honors maxTotal and keeps the newest postings');
  } else {
    fail(`maxTotal = ${JSON.stringify(total.selected.map((o) => o.postedAt))}`);
  }

  // maxPerCompany stops one employer from taking the whole budget.
  const perCo = limitOffersPerEntry(
    [mk('A', 'X', 'u1', 3), mk('A', 'X', 'u2', 2), mk('A', 'Y', 'u3', 1)],
    () => ({ maxPerCompany: 1 }),
  );
  if (perCo.selected.length === 2 && perCo.skipped.length === 1
      && perCo.selected.filter((o) => o.company === 'X').length === 1) {
    pass('limitOffersPerEntry honors maxPerCompany so one employer cannot dominate');
  } else {
    fail(`maxPerCompany = ${JSON.stringify(perCo.selected.map((o) => o.company))}`);
  }

  // Caps are per entry, never global — one board filling up must not starve
  // another source in the same run.
  const scoped = limitOffersPerEntry(
    [mk('A', 'X', 'u1', 3), mk('A', 'Y', 'u2', 2), mk('B', 'Z', 'u3', 1)],
    (name) => (name === 'A' ? { maxTotal: 1 } : {}),
  );
  const fromA = scoped.selected.filter((o) => o._entryName === 'A').length;
  const fromB = scoped.selected.filter((o) => o._entryName === 'B').length;
  if (fromA === 1 && fromB === 1) pass("limitOffersPerEntry scopes caps per entry — one entry's cap never starves another");
  else fail(`per-entry scoping = ${JSON.stringify({ fromA, fromB })}`);

  // A missing company label must not collapse unrelated employers into one
  // synthetic bucket that exhausts the per-company allowance together.
  const blank = limitOffersPerEntry(
    [mk('A', '', 'u1', 3), mk('A', '', 'u2', 2)],
    () => ({ maxPerCompany: 1 }),
  );
  if (blank.selected.length === 2) pass('limitOffersPerEntry does not collapse blank company labels into a single bucket');
  else fail(`blank company = ${JSON.stringify({ sel: blank.selected.length })}`);

  // Undated postings sort last rather than being dropped.
  const undated = limitOffersPerEntry(
    [{ _entryName: 'A', company: 'X', url: 'u1', title: 'T' }, mk('A', 'Y', 'u2', 5)],
    () => ({ maxTotal: 1 }),
  );
  if (undated.selected.length === 1 && undated.selected[0].postedAt === 5) {
    pass('limitOffersPerEntry sinks undated postings below dated ones instead of dropping them');
  } else {
    fail(`undated ordering = ${JSON.stringify(undated.selected)}`);
  }

  // Both caps together: the tighter one decides.
  const both = limitOffersPerEntry(
    [mk('A', 'X', 'u1', 5), mk('A', 'X', 'u2', 4), mk('A', 'Y', 'u3', 3), mk('A', 'Z', 'u4', 2)],
    () => ({ maxTotal: 3, maxPerCompany: 1 }),
  );
  if (both.selected.length === 3 && both.selected.filter((o) => o.company === 'X').length === 1) {
    pass('limitOffersPerEntry applies maxTotal and maxPerCompany together');
  } else {
    fail(`combined caps = ${JSON.stringify(both.selected.map((o) => o.company))}`);
  }

  // A zero cap is honored as "hold everything", distinct from an absent cap.
  const zero = limitOffersPerEntry([mk('A', 'X', 'u1', 1)], () => ({ maxTotal: 0 }));
  if (zero.selected.length === 0 && zero.skipped.length === 1) {
    pass('limitOffersPerEntry treats maxTotal: 0 as hold-everything, not as unset');
  } else {
    fail(`zero cap = ${JSON.stringify({ sel: zero.selected.length, skip: zero.skipped.length })}`);
  }

  // Held postings are RETURNED as skipped, never silently lost — scan.mjs must
  // be able to tell the user, and must not record them in scan-history (which
  // would suppress them forever instead of letting the next run pick them up).
  const held = limitOffersPerEntry(
    [mk('A', 'X', 'u1', 3), mk('A', 'Y', 'u2', 2), mk('A', 'Z', 'u3', 1)],
    () => ({ maxTotal: 1 }),
  );
  if (held.skipped.length === 2 && held.selected.length + held.skipped.length === 3) {
    pass('limitOffersPerEntry returns held postings as skipped so none are silently lost');
  } else {
    fail(`held accounting = ${JSON.stringify({ sel: held.selected.length, skip: held.skipped.length })}`);
  }

  // Input array is not mutated (scan.mjs reuses it).
  const input = [mk('A', 'X', 'u1', 1), mk('A', 'Y', 'u2', 2)];
  const before = input.map((o) => o.url).join(',');
  limitOffersPerEntry(input, () => ({ maxTotal: 1 }));
  if (input.map((o) => o.url).join(',') === before) pass('limitOffersPerEntry does not mutate or reorder its input array');
  else fail(`input mutated: ${before} → ${input.map((o) => o.url).join(',')}`);
} catch (err) {
  fail(`scan entry caps test threw: ${err.message}`);
}
