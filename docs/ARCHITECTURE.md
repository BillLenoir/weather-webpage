# Architecture

This file records the decisions behind the code and the reasons for them. It exists because most of them are cheap to "simplify" into something that looks equivalent and isn't — switching the provider's unit parameters, labelling a day "Today", or converting a timestamp. If you fork this repository, read this before changing anything in `src/`.

For deployment steps see [SETUP.md](SETUP.md). For what the project is, see the [README](../README.md).

## Pipeline

An EventBridge Scheduler rule runs the fetcher hourly. The fetcher calls the weather provider, normalizes the response to a `Snapshot`, and writes it to the data bucket as `latest.json` plus a timestamped copy under a history prefix. That write raises an S3 event, which invokes the renderer. The renderer reads the snapshot, writes one HTML page per configured page to the site bucket, and CloudFront serves them.

There is no direct invoke and no Step Functions between the two Lambdas. The S3 object is the contract: either a valid snapshot exists or it doesn't, and the renderer can be run against any snapshot, including an old one from the history prefix.

**On failure, write nothing.** If a fetch fails the fetcher throws, no snapshot is written, the renderer never runs, and the previous pages stay up with their original timestamps. A stale page with a visible timestamp is a better failure mode than a page that is blank or half-updated. This is why the page-level timestamp is load-bearing rather than decoration, and why a CloudWatch alarm on renderer errors matters: a failed render is invisible by design.

The history prefix is kept for a future forecast-accuracy comparison — what was predicted for a day versus what happened. That's also why a snapshot records the coordinates and elevation the provider returned rather than the ones that were configured: an old snapshot has to be self-describing.

## Data model

`Snapshot` (`src/shared/model.ts`) is a page-agnostic map of location id to weather, not a page model. The fetcher takes the union of every page's locations and dedupes by id, so a location shared by two pages is fetched once, and adding a page needs no refetch. Location ids are global: two pages using the same id must mean the same place.

**The snapshot is metric. Units are converted at render time, per page.** This is the decision most likely to be "simplified" by setting the provider's unit parameters instead, which would be wrong twice over: one fetch has to serve pages that may ask for different units, and the history files have to stay comparable across future config changes.

**Times are stored exactly as the provider returns them** — local ISO strings with no offset for `current.time`, `sunrise` and `sunset`, and `YYYY-MM-DD` dates. They are never parsed into `Date` objects anywhere in the pipeline; formatters slice strings and index lookup tables. Each location's `daily[0]` is that location's own local today, which can differ from another location's in the same snapshot. `fetchedAt` is the one UTC instant in the model.

The adapter normalizes provider conventions — `is_day` 0/1 becomes an `isDay` boolean — so provider vocabulary never reaches the renderer. Field names carry their units: `temperatureC`, `windKph`, `precipitationMm`.

Zod validates at the runtime boundaries: the provider response in the fetcher, and the snapshot read from S3 in the renderer. Types are derived with `z.infer` rather than hand-written alongside the schemas. Provider schemas model only the fields that are consumed and stay non-strict, so a new field from the provider never fails a fetch.

## Configuration

Everything a fork changes lives in three places: `src/config/site.config.ts` (account, region, domain, subdomain, project name, copyright owner), `src/config/weather.config.ts` (source, fetch interval, and the pages, each with a slug, title, locations and display settings), and `bootstrap/*.json` (GitHub owner/repo and account id). Personal values stay out of every other source file.

Config is TypeScript, not JSON, so the compiler checks its shape. What the compiler cannot check is validated at handler startup by `src/config/validate.ts`: that slugs are unique and URL-safe, that every page's location ids resolve and one id never means two coordinate pairs, and that the fetch depth covers the largest `forecastDays` across pages. These are fetcher constraints rather than renderer ones — if they fail, a bad snapshot is written before the renderer ever runs.

The fetch interval is consumed twice: by the stack, as the schedule, and by the renderer, as the `meta refresh` interval. Array order in config is display order, for pages, locations and current fields alike.

## Presentation

**Two timestamps, labelled differently.** Each location block shows `Observed 5:15 PM` from that location's `current.time` — the provider's observation time, already local, so no timezone math. The footer shows `Updated 2026-09-23 21:15 UTC` from `fetchedAt`, as plain UTC with no conversion. They answer different questions, and without the page-level one there is no single freshness signal: a location whose observation happens to be recent could otherwise sit beside a stale one with nothing to distinguish them.

**Weekday names, never "Today" or "Tomorrow".** The page can be up to an hour stale at any time of day, and a stale "Today" is confidently wrong. A stale weekday name is visibly wrong instead.

**One emoji per display group, never a pair.** Pairs don't combine into a single glyph and they break cell alignment. Where emoji cannot distinguish two conditions — drizzle from rain, or freezing rain — the text label carries it. Weather emoji are written with the `U+FE0F` variation selector (`'☀️'`, not `'☀'`) so legacy symbols render in color rather than as monochrome text glyphs. `describeCondition` returns `{ label, icon }` either way, so moving to inline SVG later doesn't change its callers.

**Rounding happens in the formatters, never in a template:** whole degrees, whole mph, one decimal for inches. Halves round toward positive infinity, which is plain `Math.round`, so `-2.5` becomes `-2`. Weather sources don't agree on half-rounding and a degree either way is noise. `-0` is normalized to `0`, since `Math.round` produces it for anything in `[-0.5, 0)` and it interpolates as `"-0"`.

**Wind direction uses 8 compass points**, each spanning 45°, rounded to the nearest — so N covers 337.5° to 22.5°.

**Every interpolated string is escaped by default**, with an explicit opt-out for the few that are known-safe markup. The alternative — a list of which values need escaping — is a list someone will forget to extend.

**No client-side JavaScript.** Pages refresh themselves with `<meta http-equiv="refresh">`, derived from the fetch interval rather than a separate constant. Styles are inlined in a single `<style>` block, so a page is one object with one cache policy.

## Delivery

The rendered HTML is uploaded with a short `Cache-Control` max-age (around 300 seconds), set on the `PutObject` call. There are no per-render CloudFront invalidations: the distribution uses a cache policy that honors origin `Cache-Control` (`CachingOptimized`), so the page expires on its own. Don't switch it to `CachingDisabled`.

A CloudFront Function on viewer request appends `index.html` to URIs ending in `/`. This is required rather than optional: `defaultRootObject` only applies at the root, so `/<slug>/` would otherwise return 403 against an origin-access-control origin.

Everything deploys to `us-east-1` because CloudFront requires its ACM certificate there. The Route 53 hosted zone lives outside the stack; the stack looks it up by name and adds records, and never creates or deletes the zone.

## Testing

Tests cover pure functions. Provider adapters are tested against recorded responses in `test/fixtures`; the recordings deliberately span a local date boundary and a day/night split, because several tests depend on both. Renderer fixtures are *derived* — built by running a provider fixture through `toSnapshot` — rather than recorded, so they cannot drift from what the adapter actually produces.

Renderer tests assert on content, not markup: that the Fahrenheit value appears, that three day cards are present, that two locations show different weekdays. Markup changes in a styling pass shouldn't break them.

Handlers stay thin and are not tested. Stack tests use targeted `Template` assertions against a dummy account rather than snapshots of the synthesized template.
