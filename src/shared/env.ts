// The environment variables the stack sets on the Lambdas, named once. The
// stack and the handlers both import these, so a typo on either side is a
// compile error rather than a cold-start failure after a deploy. The values
// still come from the stack; only the names live here.
export const ENV = {
  dataBucket: 'DATA_BUCKET',
  siteBucket: 'SITE_BUCKET',
  latestKey: 'LATEST_KEY',
  historyPrefix: 'HISTORY_PREFIX',
} as const;

export type EnvName = (typeof ENV)[keyof typeof ENV];

// Reads a variable the stack is expected to set, and throws if it isn't there.
// Handlers call this at module scope, so a missing variable fails the cold
// start with its name in the error, rather than surfacing later as `undefined`
// in a bucket name or a key. An empty string counts as missing: no value the
// stack sets is legitimately empty.
export const requireEnv = (name: EnvName): string => {
  const value = process.env[name];

  if (value === undefined || value === '') {
    throw new Error(`Missing environment variable ${name}`);
  }

  return value;
};
