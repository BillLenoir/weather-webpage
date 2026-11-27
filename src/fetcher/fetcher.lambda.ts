// The fetcher: fetch every configured location once, normalize to a Snapshot,
// and write it to the data bucket twice — a history copy, then latest.json.
// The latest.json write raises the S3 event that runs the renderer.
//
// Invoked by the schedule and by the deploy-time fetch. Neither sends anything
// the handler needs, so it takes no event.
//
// There is no try/catch on purpose. A failed fetch, a schema rejection or a
// failed first write throws before anything is written, which is the "on
// failure, write nothing" rule; the stale page and its footer are the signal.
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { historyKey } from './keys';
import { fetchWeather } from './providers/open-meteo';
import { validateAndResolve } from '../config/validate';
import { config } from '../config/weather.config';
import { ENV, requireEnv } from '../shared/env';

// The backstop. The stack already ran this at synth time, so a bad config
// fails the build long before it can reach here.
const { locations, forecastDays } = validateAndResolve(config);

// Set by the stack. The latest key is the same value the S3 event is filtered
// on; the history prefix has no trailing slash, which historyKey adds.
const DATA_BUCKET = requireEnv(ENV.dataBucket);
const LATEST_KEY = requireEnv(ENV.latestKey);
const HISTORY_PREFIX = requireEnv(ENV.historyPrefix);

// Created once per cold start, so warm invocations reuse its connections.
const s3 = new S3Client({});

const put = ({ key, body }: { key: string; body: string }) =>
  s3.send(
    new PutObjectCommand({
      Bucket: DATA_BUCKET,
      Key: key,
      Body: body,
      ContentType: 'application/json',
    }),
  );

export const handler = async (): Promise<void> => {
  const snapshot = await fetchWeather({ locations, forecastDays });

  // Serialized once, so the two copies are the same bytes.
  const body = JSON.stringify(snapshot);

  // From the snapshot's own fetchedAt, not a fresh clock, so the key and the
  // contents can't disagree.
  const history = historyKey({
    prefix: HISTORY_PREFIX,
    fetchedAt: snapshot.fetchedAt,
  });

  // History first, then latest.json, and sequentially: if the second write
  // fails, what's left is a history copy that was never rendered, rather than
  // a render whose snapshot was never kept.
  await put({ key: history, body });
  await put({ key: LATEST_KEY, body });

  console.log(`Wrote ${history} and ${LATEST_KEY}`);
};
