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

Config is TypeScript, not JSON, so the compiler checks its shape. What the compiler cannot check is checked by `validateAndResolve` in `src/config/validate.ts`: that there is at least one page and every page has at least one location, that slugs are unique and URL-safe, that ids are unique within a page and one id never means two different coordinate pairs, that `forecastDays` is a whole number between 1 and 7, that coordinates are in range, that `display.current` is non-empty and duplicate-free, and that titles and labels are non-empty. Every problem is collected and reported in one error: a config with three mistakes should cost one round of fixing, not three.

The same call also *derives* what the handlers need — the deduplicated union of locations in request order, and the fetch depth as the largest `forecastDays` across pages — so validation and derivation can't drift apart.

**It runs at synth time, not only at startup.** Nothing in `WeatherConfig` arrives at runtime; it is a TypeScript literal compiled into both bundles. So the stack calls `validateAndResolve` as it builds, which means a bad config fails `npx projen build`, fails CI, and fails `cdk deploy` — rather than passing a green deploy and surfacing as a Lambda init error. The handlers call it again at startup as a backstop. These are mostly fetcher constraints: if they failed at runtime, a bad snapshot would be written before the renderer ever ran.

The fetch interval is consumed twice: by the stack, as the schedule, and by the renderer, as the `meta refresh` interval. Array order in config is display order, for pages, locations and current fields alike.

## Presentation

**Minimal by default: every element on the page has to earn its place.** The test for anything new is whether a reader would miss it. That is why there is no unit legend — a page is read by people who know whether they think in Fahrenheit or Celsius, and printing `°F` beside every number tells them nothing they didn't already know. The two timestamps survive this test because they are the only evidence that the pipeline ran; decoration doesn't.

**Two timestamps, labelled differently.** Each location block shows `Observed 5:15 PM` from that location's `current.time` — the provider's observation time, already local, so no timezone math. The footer shows `Updated 2026-09-23 21:15 UTC` from `fetchedAt`, as plain UTC with no conversion. They answer different questions, and without the page-level one there is no single freshness signal: a location whose observation happens to be recent could otherwise sit beside a stale one with nothing to distinguish them.

**Weekday names, never "Today" or "Tomorrow".** The page can be up to an hour stale at any time of day, and a stale "Today" is confidently wrong. A stale weekday name is visibly wrong instead. Names are three letters (`Mon`), and `forecastDays` is capped at 7 — ours, not the provider's limit of 16 — because an eighth card would repeat a weekday and the cards carry no date.

**One emoji per display group, never a pair.** Pairs don't combine into a single glyph and they break cell alignment. `describeCondition` returns `{ label, icon }`, so moving to inline SVG later doesn't change its callers.

**Icons are per group; labels are per code.** `src/renderer/conditions.ts` maps all 28 WMO codes Open-Meteo reports, and several share an icon because emoji cannot tell drizzle from rain or light snow from heavy. The label carries what the icon can't, including the intensity — `Light drizzle`, `Drizzle`, `Heavy drizzle` all show 🌦️. Labels are sentence case.

**Only the clear-sky codes vary by `isDay`** — rain at night is still rain. Clear and Mainly clear show 🌙, and Partly cloudy shows ☁️, because the question those rows answer at night is whether you'll see the stars. That makes Partly cloudy and Overcast share ☁️ after dark, distinguished by label alone, which is the same trade as drizzle against rain.

Weather emoji carry the `U+FE0F` variation selector only where the glyph needs it: ☀️ ☁️ ⛈️ and several of the `U+1F3xx` symbols are text-presentation by default, while 🌙, ⛅ and ❓ are emoji by default and take no selector. A test asserts each icon is exactly one glyph that renders in color, which is what catches a pasted pair.

**An unrecognized WMO code falls back rather than throwing.** It is the one place in the renderer that doesn't fail loudly on unexpected input: a provider adding a code should cost one odd-looking cell, not the whole page. The code is logged and appears in the label — `Unknown (101)` — so a gap in the table is findable later rather than silent. Everything else the renderer can't make sense of — a missing location id, too few days — throws, because those mean the page would be wrong rather than incomplete.

**Rounding happens in the formatters, never in a template:** whole degrees, whole units of wind speed, one decimal for inches and whole millimetres. Halves round toward positive infinity, which is plain `Math.round`, so `-2.5` becomes `-2`. Weather sources don't agree on half-rounding and a degree either way is noise. `-0` is normalized to `0`, since `Math.round` produces it for anything in `[-0.5, 0)` and it interpolates as `"-0"`.

**A missing value is an em dash, never a zero.** `precipProbability` is the one nullable field in the model, and a 0% chance of rain and no forecast at all are different facts — so the check is `=== null`, not a falsy test that would collapse them. Values outside 0–100 are shown as they arrive rather than clamped: a 120 from the provider is worth seeing on the page rather than quietly massaged into something plausible.

**Formatters carry symbols but not unit words.** `formatTemperature` gives `72°`, `formatHumidity` gives `76%`, `formatWind` gives `14 NW` — never `72°F`, `14 mph` or `0.1 in`. A degree sign or a percent sign is part of reading the number; spelling out the unit tells readers what they already know, and `°` deliberately doesn't say which scale. Precipitation amounts have no symbol, so they appear as a bare number with the row label doing the work. There is one formatter per dimension — temperature, wind, precipitation and percentages — rather than a generic dispatcher, because each owns its own conversion, rounding and shape. Percentages have two formatters rather than one: humidity is always present, while precipitation probability is the model's one nullable field, so they differ in signature rather than in output.

**Dates and weekdays are built from string slices and fixed name arrays**, never `toLocaleDateString`. The one permitted use of `Date` in the whole pipeline is computing a weekday: `new Date(Date.UTC(y, m - 1, d)).getUTCDay()`. That is safe because it is constructed from integers and read in UTC — it never parses an offsetless string as if it were an instant, which is what the no-`Date` rule exists to prevent.

**Wind direction uses 8 compass points**, each spanning 45°, rounded to the nearest. An exact boundary falls in the clockwise sector — 22.5° is NE, not N — which is the same half-up rule the rounding uses everywhere else, so N covers 337.5° up to but not including 22.5°. When the speed rounds to zero the direction is dropped entirely and the page shows `0`: a bearing is meaningless at a standstill, and printing one implies a precision the reading doesn't have.

**Every interpolated string is escaped by default.** Markup is built with a tagged template that escapes plain strings and passes `SafeHtml` through untouched — the type its own output carries. So a nested fragment composes without being escaped twice, and the opt-out is the type rather than a `raw()` helper somebody will reach for by habit. The alternative, a list of which values need escaping, is a list someone will forget to extend.

**No client-side JavaScript.** Pages refresh themselves with `<meta http-equiv="refresh">`, derived from the fetch interval rather than a separate constant. Styles are inlined in a single `<style>` block, so a page is one object with one cache policy.

## Delivery

The rendered HTML is uploaded with a short `Cache-Control` max-age (around 300 seconds), set on the `PutObject` call. There are no per-render CloudFront invalidations: the distribution uses a cache policy that honors origin `Cache-Control` (`CachingOptimized`), so the page expires on its own. Don't switch it to `CachingDisabled`.

A CloudFront Function on viewer request appends `index.html` to URIs ending in `/`. This is required rather than optional: `defaultRootObject` only applies at the root, so `/<slug>/` would otherwise return 403 against an origin-access-control origin.

Everything deploys to `us-east-1` because CloudFront requires its ACM certificate there. The Route 53 hosted zone lives outside the stack; the stack looks it up by name and adds records, and never creates or deletes the zone.

## Testing

Tests cover pure functions. Provider adapters are tested against recorded responses in `test/fixtures`; the recordings deliberately span a local date boundary and a day/night split, because several tests depend on both. Renderer fixtures are *derived* — built by running a provider fixture through `toSnapshot` — rather than recorded, so they cannot drift from what the adapter actually produces.

Renderer tests assert on content, not markup: that the Fahrenheit value appears, that three day cards are present, that two locations show different weekdays. Markup changes in a styling pass shouldn't break them.

Handlers stay thin and are not tested. Stack tests use targeted `Template` assertions against a dummy account rather than snapshots of the synthesized template.
