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
