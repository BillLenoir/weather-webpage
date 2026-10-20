import type { DisplayConfig } from '../config/weather.config';

type TemperatureUnits = DisplayConfig['units']['temperature'];

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
