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

export interface DisplayConfig {
  units: {
    temperature: 'F' | 'C';
    wind: 'mph' | 'kph';
    precipitation: 'in' | 'mm';
  };
  current: CurrentField[]; // array order is display order
  forecastDays: number; // includes today
}

export interface PageConfig {
  slug: string; // URL path segment: served at /<slug>/
  title: string; // <title> and page heading
  locations: LocationConfig[]; // array order is display order
  display: DisplayConfig;
}

export interface WeatherConfig {
  source: 'open-meteo';
  schedule: { intervalMinutes: number };
  pages: PageConfig[]; // array order is root index order
}

export const config: WeatherConfig = {
  source: 'open-meteo',

  schedule: { intervalMinutes: 60 },

  pages: [
    {
      slug: 'bill',
      title: "Bill's Weather",
      locations: [
        {
          id: 'centreville',
          label: 'Centreville, VA',
          latitude: 38.84,
          longitude: -77.43,
        },
        {
          id: 'astoria',
          label: 'Astoria, NY',
          latitude: 40.77,
          longitude: -73.92,
        },
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
    },
  ],
};
