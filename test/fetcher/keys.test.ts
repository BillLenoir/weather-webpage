import { historyKey } from '../../src/fetcher/keys';

const key = (fetchedAt: string) => historyKey({ prefix: 'history', fetchedAt });

describe('historyKey', () => {
  it('builds the key from the prefix and fetchedAt, colons replaced', () => {
    expect(key('2026-11-23T14:00:03.123Z')).toBe(
      'history/2026-11-23T14-00-03.123Z.json',
    );
  });

  // S3 lists keys in byte order, so the history is chronological only if the
  // keys sort that way. These straddle the boundaries where a variable-width
  // or reordered format would go wrong: milliseconds within a second, an hour,
  // a month end and a year end.
  it('sorts chronologically', () => {
    const keys = [
      '2026-09-30T23:59:59.998Z',
      '2026-09-30T23:59:59.999Z',
      '2026-10-01T00:00:00.000Z',
      '2026-10-01T09:00:00.000Z',
      '2026-10-01T10:00:00.000Z',
      '2026-12-31T23:59:59.999Z',
      '2027-01-01T00:00:00.000Z',
    ].map(key);

    expect([...keys].reverse().sort()).toEqual(keys);
  });

  it('lists a single day with a plain prefix', () => {
    const keys = [
      '2026-11-22T23:00:00.000Z',
      '2026-11-23T00:00:00.000Z',
      '2026-11-23T23:00:00.000Z',
      '2026-11-24T00:00:00.000Z',
    ].map(key);

    expect(keys.filter((k) => k.startsWith('history/2026-11-23'))).toEqual([
      'history/2026-11-23T00-00-00.000Z.json',
      'history/2026-11-23T23-00-00.000Z.json',
    ]);
  });
});
