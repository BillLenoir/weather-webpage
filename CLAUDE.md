# Weather Webpage

## Working agreement

- I write the code. Advise, review, and explain; don't edit files unless I explicitly ask.
- Peer-level: I'm an experienced TS/AWS developer. Skip fundamentals.
- Default to simple. Only add complexity a competent reviewer would expect
  (tests, IaC, separation of concerns). Flag polish as polish.

## What this is

Personal static weather page at weather.bill-lenoir.com. Scheduled Lambda fetches
weather, a second Lambda renders static HTML to S3, served via CloudFront.
No client-side JS. Not a portfolio piece: working and maintainable over polished.

## Architecture decisions (and why)

- Fetcher normalizes provider responses to `Snapshot` (src/shared/model.ts).
  Renderer never sees provider shapes — other sources may be added later.
- Fetcher → S3 data bucket → S3 event → renderer. No direct invoke, no Step Functions.
- On fetch failure, throw and write nothing; stale page + "as of" timestamp is the signal.
- index.html gets Cache-Control max-age ~300. No per-render CloudFront invalidations.
- Locations/variables/source are app config; schedule interval is infra config
  (both in src/config/weather.config.ts, interval consumed by the stack).
- Everything in us-east-1 (ACM for CloudFront).

## Projen rules

- package.json, tsconfig*, eslint, .github/workflows are generated.
  Change .projenrc.ts, then run `npx projen`. Never suggest hand-edits to those.
- `*-function.ts` next to `*.lambda.ts` files are generated.

## Commands

- `npx projen build`: compile, test, synth
- `npx projen test`
- `npx projen deploy`

## Testing

Jest. Test pure functions (provider adapters against fixtures in test/fixtures,
render against Snapshot fixtures). Handlers stay thin and untested.

## VS Code Usage

I will be using the Source Control tab to execute git actions.
