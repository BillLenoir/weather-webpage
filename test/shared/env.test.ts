import { ENV, requireEnv } from '../../src/shared/env';

describe('requireEnv', () => {
  const name = ENV.dataBucket;
  const original = process.env[name];

  // process.env is global to the worker, so put back whatever was there
  // rather than leaving this suite's value for the next one.
  afterEach(() => {
    if (original === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = original;
    }
  });

  it('returns the value when the variable is set', () => {
    process.env[name] = 'weather-data-bucket';

    expect(requireEnv(name)).toBe('weather-data-bucket');
  });

  it('throws, naming the variable, when it is missing', () => {
    delete process.env[name];

    expect(() => requireEnv(name)).toThrow(
      'Missing environment variable DATA_BUCKET',
    );
  });

  it('treats an empty string as missing', () => {
    process.env[name] = '';

    expect(() => requireEnv(name)).toThrow(
      'Missing environment variable DATA_BUCKET',
    );
  });
});

describe('ENV', () => {
  // Two settings sharing a name would silently read the same value.
  it('gives every setting its own variable', () => {
    const names = Object.values(ENV);

    expect(new Set(names).size).toBe(names.length);
  });
});
