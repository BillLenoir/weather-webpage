import type { DisplayConfig } from '../config/weather.config';

type TemperatureUnits = DisplayConfig['units']['temperature'];
type PrecipitationUnits = DisplayConfig['units']['precipitation'];
type WindUnits = DisplayConfig['units']['wind'];

const round = (value: number): number => {
  const rounded = Math.round(value);
  return Object.is(rounded, -0) ? 0 : rounded;
};

const convertTemperature = ({
  celsius,
  units,
}: {
  celsius: number;
  units: TemperatureUnits;
}): number => (units === 'F' ? (celsius * 9) / 5 + 32 : celsius);

export const formatTemperature = ({
  celsius,
  units,
}: {
  celsius: number;
  units: TemperatureUnits;
}): string => `${round(convertTemperature({ celsius, units }))}°`;

const convertPrecipitation = ({
  mm,
  units,
}: {
  mm: number;
  units: PrecipitationUnits;
}): number => (units === 'in' ? mm / 25.4 : mm);

// How much precipitation fell or is expected — not the chance of any. See
// formatPrecipProbability below.
export const formatPrecipitation = ({
  mm,
  units,
}: {
  mm: number;
  units: PrecipitationUnits;
}): string => {
  const precipitation = convertPrecipitation({ mm, units });
  return units === 'in'
    ? (round(precipitation * 10) / 10).toFixed(1)
    : String(round(precipitation));
};

// U+2014 em dash, for a value the provider didn't supply.
const NO_VALUE = '—';

// The chance of precipitation, not the amount — see formatPrecipitation above.
// `=== null` deliberately, not a falsy check: 0 is a real probability and must
// not collapse into NO_VALUE. Values aren't clamped, so an out-of-range number
// from the provider shows on the page rather than being quietly massaged.
export const formatPrecipProbability = (value: number | null): string =>
  value === null ? NO_VALUE : `${round(value)}%`;

export const formatHumidity = (value: number): string => `${round(value)}%`;

// Clockwise from north, 45° each. Math.round puts an exact boundary in the
// clockwise sector — 22.5° is NE, not N — the same half-up rule the other
// formatters use. The modulo wraps 337.5° and above back to N.
const COMPASS_POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

export const windCompass = (degrees: number): string =>
  COMPASS_POINTS[Math.round(degrees / 45) % 8];

const convertWind = ({
  kph,
  units,
}: {
  kph: number;
  units: WindUnits;
}): number => (units === 'mph' ? kph / 1.609344 : kph);

export const formatWind = ({
  kph,
  degrees,
  units,
}: {
  kph: number;
  degrees: number;
  units: WindUnits;
}): string => {
  const speed = round(convertWind({ kph, units }));

  // A direction is meaningless at a standstill, so calm wind is the speed
  // alone.
  return speed === 0 ? '0' : `${speed} ${windCompass(degrees)}`;
};

// The three functions below slice their input rather than parsing it. That is
// safe because SnapshotSchema has already validated the shape at the renderer's
// read boundary: current.time and the sunrise/sunset times as local ISO with no
// offset, fetchedAt as ISO UTC, and daily[].date as a real calendar date.

// From a local wall-clock string like '2026-09-23T17:15'. Hours lose their
// leading zero, minutes keep both digits, and hour 0 and 12 both display as 12
// — the edge the % 12 arithmetic gets wrong if written as `hour % 12`.
export const formatTime = (localIso: string): string => {
  const hour24 = Number(localIso.slice(11, 13));
  const minutes = localIso.slice(14, 16);
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;

  return `${hour12}:${minutes} ${hour24 < 12 ? 'AM' : 'PM'}`;
};

// From an ISO UTC instant like '2026-09-23T21:15:00.000Z'. 'UTC' is deliberate
// and not a unit word: without it the instant is ambiguous in a way that `72°`
// is not. Don't convert it to a local zone — its audience is whoever is
// checking that the pipeline ran.
export const formatFetchedAt = (iso: string): string =>
  `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;

// Sunday first, because getUTCDay() returns 0 for Sunday.
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

// The one permitted Date in the pipeline: built from integers and read in UTC,
// never parsing an offsetless string as an instant and never formatted. That is
// what the no-Date rule exists to prevent; day-of-week arithmetic doesn't
// follow from slicing.
export const weekday = (date: string): string => {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));

  return WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
};
