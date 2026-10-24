import {
  formatFetchedAt,
  formatHumidity,
  formatPrecipitation,
  formatPrecipProbability,
  formatTemperature,
  formatTime,
  formatWind,
  weekday,
  windCompass,
} from '../../src/renderer/format';

describe('formatTemperature', () => {
  it('formats zero Celsius in metric units', () => {
    expect(formatTemperature({ celsius: 0, units: 'C' })).toBe('0°');
  });

  it('formats zero Celsius in imperial units', () => {
    expect(formatTemperature({ celsius: 0, units: 'F' })).toBe('32°');
  });

  it('formats and rounds a negative metric temperature', () => {
    expect(formatTemperature({ celsius: -1.2, units: 'C' })).toBe('-1°');
  });

  it('uses Math.round behavior for negative halves', () => {
    expect(formatTemperature({ celsius: -2.5, units: 'C' })).toBe('-2°');
  });

  it('normalizes a rounded negative zero', () => {
    expect(formatTemperature({ celsius: -0.1, units: 'C' })).toBe('0°');
  });

  it('converts before rounding imperial output', () => {
    expect(formatTemperature({ celsius: 0.4, units: 'F' })).toBe('33°');
  });
});

describe('formatPrecipitation', () => {
  it('rounds metric millimeters to a whole number without a symbol', () => {
    expect(formatPrecipitation({ mm: 2.6, units: 'mm' })).toBe('3');
  });

  it('formats imperial inches to one decimal place without a symbol', () => {
    expect(formatPrecipitation({ mm: 25.4, units: 'in' })).toBe('1.0');
  });

  it('converts millimeters before rounding imperial output', () => {
    expect(formatPrecipitation({ mm: 36.81, units: 'in' })).toBe('1.4');
  });
});

describe('formatPrecipProbability', () => {
  // The distinction the em dash exists for: a real 0% and "no data" must not
  // look alike, which a falsy check would collapse.
  it('keeps zero distinct from a missing value', () => {
    expect(formatPrecipProbability(0)).toBe('0%');
    expect(formatPrecipProbability(null)).toBe('—');
  });

  it('formats a probability', () => {
    expect(formatPrecipProbability(56)).toBe('56%');
  });

  it('rounds a fractional probability', () => {
    expect(formatPrecipProbability(76.6)).toBe('77%');
  });

  it('shows an out-of-range value rather than clamping it', () => {
    expect(formatPrecipProbability(120)).toBe('120%');
  });
});

describe('formatHumidity', () => {
  it('formats a humidity', () => {
    expect(formatHumidity(76)).toBe('76%');
  });

  it('rounds a fractional humidity', () => {
    expect(formatHumidity(76.4)).toBe('76%');
  });

  it.each([
    [0, '0%'],
    [100, '100%'],
  ])('formats the %i boundary', (value, expected) => {
    expect(formatHumidity(value)).toBe(expected);
  });
});

describe('windCompass', () => {
  // Exact sector boundaries, where an off-by-one would live. Each belongs to
  // the clockwise sector, so 22.5° is NE rather than N.
  it.each<[number, string]>([
    [22.5, 'NE'],
    [67.5, 'E'],
    [112.5, 'SE'],
    [157.5, 'S'],
    [202.5, 'SW'],
    [247.5, 'W'],
    [292.5, 'NW'],
    [337.5, 'N'],
  ])('puts %p° in the clockwise sector, %s', (degrees, expected) => {
    expect(windCompass(degrees)).toBe(expected);
  });

  it('places a mid-sector bearing', () => {
    expect(windCompass(315)).toBe('NW');
  });

  it('wraps past the last sector back to north', () => {
    expect(windCompass(359)).toBe('N');
  });

  it('reads due north as N', () => {
    expect(windCompass(0)).toBe('N');
  });
});

describe('formatWind', () => {
  it('formats a metric speed with its direction', () => {
    expect(formatWind({ kph: 14.4, degrees: 315, units: 'kph' })).toBe('14 NW');
  });

  it('converts before rounding imperial speed', () => {
    // 8.5 kph is 5.28 mph, which rounds to 5. Rounding first would give 9 kph
    // and so 6 mph.
    expect(formatWind({ kph: 8.5, degrees: 0, units: 'mph' })).toBe('5 N');
  });

  // A direction is meaningless at a standstill.
  it('drops the direction when the wind is calm', () => {
    expect(formatWind({ kph: 0, degrees: 0, units: 'kph' })).toBe('0');
  });

  it('drops the direction when the speed rounds to zero', () => {
    expect(formatWind({ kph: 0.4, degrees: 180, units: 'kph' })).toBe('0');
  });
});

describe('formatTime', () => {
  it.each<[string, string]>([
    ['2026-09-23T17:15', '5:15 PM'],
    ['2026-09-23T00:15', '12:15 AM'], // midnight, not 0:15 AM
    ['2026-09-23T12:15', '12:15 PM'], // noon, not 0:15 PM
    ['2026-09-23T09:05', '9:05 AM'], // hour loses its leading zero
    ['2026-09-23T23:59', '11:59 PM'],
    ['2026-09-23T00:00', '12:00 AM'],
    ['2026-09-23T12:00', '12:00 PM'],
  ])('renders %s as %s', (localIso, expected) => {
    expect(formatTime(localIso)).toBe(expected);
  });
});

describe('formatFetchedAt', () => {
  it('renders an ISO UTC instant as a date, a time and UTC', () => {
    expect(formatFetchedAt('2026-09-23T21:15:00.000Z')).toBe(
      '2026-09-23 21:15 UTC',
    );
  });

  it('does not shift the instant into another zone', () => {
    // The fixture's 21:15 UTC is 17:15 in New York; neither appears converted.
    expect(formatFetchedAt('2026-09-24T02:05:09.000Z')).toBe(
      '2026-09-24 02:05 UTC',
    );
  });
});

describe('weekday', () => {
  it.each<[string, string]>([
    ['2026-09-23', 'Wed'], // the recorded fixture's date
    ['2026-09-30', 'Wed'], // month boundary
    ['2026-10-01', 'Thu'],
    ['2026-12-31', 'Thu'], // year boundary
    ['2027-01-01', 'Fri'],
    ['2028-02-28', 'Mon'], // leap day: Mon, Tue, Wed proves no day is
    ['2028-02-29', 'Tue'], // skipped or repeated across 29 February
    ['2028-03-01', 'Wed'],
  ])('names %s as %s', (date, expected) => {
    expect(weekday(date)).toBe(expected);
  });

  it('uses Sunday-first names, matching getUTCDay', () => {
    expect(weekday('2026-09-27')).toBe('Sun');
    expect(weekday('2026-09-28')).toBe('Mon');
  });
});
