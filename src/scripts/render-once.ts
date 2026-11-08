// Dev script: npx ts-node src/scripts/render-once.ts [snapshot.json]
//
// Renders the real config against a saved Snapshot and writes the pages to
// tmp/site, laid out with the same keys the renderer will write to S3:
// <slug>/index.html per page, index.html at the root. The layout is the point
// — it is what the CloudFront Function's '/' rule depends on.
//
// Reads a file rather than fetching, so a styling pass is instant and doesn't
// hit Open-Meteo. Run `npx projen fetch:fixture` once to produce the input.
//
// Opening tmp/site/<slug>/index.html in a browser works; the root index's
// links won't, because they are absolute paths and file:// resolves them
// against the filesystem root. That is the production shape, not a bug here.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { validateAndResolve } from '../config/validate';
import { config } from '../config/weather.config';
import { renderIndex, renderPage } from '../renderer/render';
import { SnapshotSchema } from '../shared/model';

const INPUT = process.argv[2] ?? 'tmp/snapshot.json';
const OUT_DIR = 'tmp/site';

// The backstop the handlers run at module scope, rehearsed here: a bad config
// fails before anything is written.
validateAndResolve(config);

if (!existsSync(INPUT)) {
  console.error(`No Snapshot at ${INPUT}. Run: npx projen fetch:fixture`);
  process.exit(1);
}

// The renderer's read boundary, rehearsed: the handler parses S3's bytes with
// this same schema, so a Snapshot this script accepts is one the Lambda would.
const snapshot = SnapshotSchema.parse(JSON.parse(readFileSync(INPUT, 'utf8')));

const write = ({ key, markup }: { key: string; markup: string }): void => {
  const file = join(OUT_DIR, key);

  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, markup);
  console.log(file);
};

for (const page of config.pages) {
  write({
    key: `${page.slug}/index.html`,
    markup: renderPage({
      page,
      snapshot,
      // The second of the fetch interval's two consumers, the first being the
      // stack's schedule.
      intervalMinutes: config.schedule.intervalMinutes,
    }),
  });
}

write({ key: 'index.html', markup: renderIndex(config.pages) });
