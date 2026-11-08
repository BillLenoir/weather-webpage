// A Snapshot derived by running the recorded provider response through the
// adapter, rather than a snapshot recorded on its own. A recorded one would be
// free to drift from whatever toSnapshot actually produces, with nothing to
// catch it; this one can't.
//
// A function, not a const: every call returns fresh objects, so a test that
// mutates what it gets back — nulling a probability, dropping a day — can't
// change another test's input. The structuredClone keeps the imported JSON out
// of reach too, since an ES module import is a single cached object shared by
// every suite that imports it.
//
// The recording spans two local dates and a day/night split: Centreville and
// Astoria at 2026-09-23T17:15 (is_day 1), Dongtan at 2026-09-24T06:15, five
// minutes before its 06:20 sunrise (is_day 0). Three forecast days each.
// Renderer tests depend on all of that.
import { locations } from './locations';
import raw from './open-meteo.json';
import {
  parseResponse,
  toSnapshot,
} from '../../src/fetcher/providers/open-meteo';
import { Snapshot } from '../../src/shared/model';

// Fixed rather than defaulted, so the footer's `Updated <date> <time> UTC` is
// assertable at all. Assert the exact string: 21:15 UTC is 17:15 in New York,
// which is also the observation time, so a renderer that wrongly converted
// fetchedAt would produce something that still looks plausible.
export const FETCHED_AT = '2026-09-23T21:15:00.000Z';

export const makeSnapshot = (): Snapshot =>
  toSnapshot({
    parsed: parseResponse(structuredClone(raw)),
    locations,
    fetchedAt: FETCHED_AT,
  });
