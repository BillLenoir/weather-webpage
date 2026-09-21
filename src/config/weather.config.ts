// src/config/weather.config.ts

export interface LocationConfig {
  id: string; // stable key: links config to Snapshot, used as HTML anchor
  label: string; // heading text
  latitude: number;
  longitude: number;
}

export type CurrentField =
  | 'condition'
  | 'temperature'
  | 'apparentTemperature'
  | 'humidity'
  | 'wind'
  | 'precipitation';

export interface WeatherConfig {
  source: 'open-meteo';
  schedule: { intervalMinutes: number };
  locations: LocationConfig[];
  display: {
    units: {
      temperature: 'F' | 'C';
      wind: 'mph' | 'kph';
      precipitation: 'in' | 'mm';
    };
    current: CurrentField[]; // array order is display order
    forecastDays: number; // includes today
  };
}

export const config: WeatherConfig = {
  source: 'open-meteo',

  schedule: { intervalMinutes: 60 },

  locations: [
    {
      id: 'centreville',
      label: 'Centreville, VA',
      latitude: 38.84,
      longitude: -77.43,
    },
    { id: 'astoria', label: 'Astoria, NY', latitude: 40.77, longitude: -73.92 },
    {
      id: 'dongtan',
      label: 'Dongtan, Hwaseong',
      latitude: 37.19,
      longitude: 127.12,
    },
  ],

  display: {
    units: { temperature: 'F', wind: 'mph', precipitation: 'in' },
    current: [
      'condition',
      'temperature',
      'apparentTemperature',
      'humidity',
      'wind',
    ],
    forecastDays: 3,
  },
};
