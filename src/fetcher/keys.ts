// The S3 key for a snapshot's history copy: the prefix, then the snapshot's own
// fetchedAt with its colons replaced by '-', e.g.
// history/2026-11-23T14-00-03.123Z.json.
//
// Nothing but time is in the key, because one object holds every location.
// It is built from the snapshot's fetchedAt rather than a fresh clock, so the
// key and the contents can't disagree.
//
// Key order is chronological order only because fetchedAt comes from
// toISOString, which always emits the same fixed-width UTC form; a day or a
// month lists with a plain prefix. Colons are legal in S3 keys, but they are
// percent-encoded in URLs and break downloads on Windows and some tools.
//
// The prefix comes from the stack as an environment variable and is passed
// without a trailing slash.
export const historyKey = ({
  prefix,
  fetchedAt,
}: {
  prefix: string;
  fetchedAt: string;
}): string => `${prefix}/${fetchedAt.replaceAll(':', '-')}.json`;
