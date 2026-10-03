import { z } from 'zod';
import { LocationConfig } from '../../config/weather.config';
import { Snapshot } from '../../shared/model';

const OpenMeteoLocationSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  elevation: z.number(),
  timezone: z.string(),
  location_id: z.number().optional(), // absent when 0
  current: z.object({
    time: z.string(),
    temperature_2m: z.number(),
    weather_code: z.number(),
    apparent_temperature: z.number(),
    relative_humidity_2m: z.number(),
    wind_speed_10m: z.number(),
    wind_direction_10m: z.number(),
    is_day: z.number(),
    precipitation: z.number(),
  }),
  daily: z.object({
    time: z.array(z.string()),
    weather_code: z.array(z.number()),
    temperature_2m_max: z.array(z.number()),
    temperature_2m_min: z.array(z.number()),
    precipitation_probability_max: z.array(z.number().nullable()),
    sunrise: z.array(z.string()),
    sunset: z.array(z.string()),
  }),
});
export const OpenMeteoResponseSchema = z.array(OpenMeteoLocationSchema);
export type OpenMeteoResponse = z.infer<typeof OpenMeteoResponseSchema>;

type OpenMeteoLocation = z.infer<typeof OpenMeteoLocationSchema>;
type CurrentKey = Exclude<keyof OpenMeteoLocation['current'], 'time'>;
type DailyKey = Exclude<keyof OpenMeteoLocation['daily'], 'time'>;

export const CURRENT_FIELDS = [
  'temperature_2m',
  'weather_code',
  'apparent_temperature',
  'relative_humidity_2m',
  'wind_speed_10m',
  'wind_direction_10m',
  'is_day',
  'precipitation',
] as const satisfies readonly CurrentKey[];

export const DAILY_FIELDS = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'precipitation_probability_max',
  'sunrise',
  'sunset',
] as const satisfies readonly DailyKey[];

const API_URL = 'https://api.open-meteo.com/v1/forecast';

export const buildUrl = (
  locations: LocationConfig[],
  forecastDays: number,
): URL => {
  if (locations.length === 0) {
    throw new Error('No locations to fetch');
  }

  const url = new URL(API_URL);
  url.searchParams.set('latitude', locations.map((l) => l.latitude).join(','));
  url.searchParams.set(
    'longitude',
    locations.map((l) => l.longitude).join(','),
  );
  url.searchParams.set('current', CURRENT_FIELDS.join(','));
  url.searchParams.set('daily', DAILY_FIELDS.join(','));
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('forecast_days', String(forecastDays));
  return url;
};

// Open-Meteo returns a bare object for one location, an array for several.
export const parseResponse = (json: unknown): OpenMeteoResponse =>
  OpenMeteoResponseSchema.parse(Array.isArray(json) ? json : [json]);

export const toSnapshot = (
  parsed: OpenMeteoResponse,
  locations: LocationConfig[],
  fetchedAt = new Date().toISOString(),
): Snapshot => {
  if (parsed.length !== locations.length) {
    throw new Error(
      `Expected ${locations.length} locations, got ${parsed.length}`,
    );
  }

  const entries = parsed.map((loc, index) => {
    const config = locations[index];

    // Position is the contract; location_id (absent when 0) only cross-checks it.
    if (loc.location_id !== undefined && loc.location_id !== index) {
      throw new Error(`location_id ${loc.location_id} at position ${index}`);
    }

    const n = loc.daily.time.length;
    if (DAILY_FIELDS.some((f) => loc.daily[f].length !== n)) {
      throw new Error(`Ragged daily arrays for ${config.id}`);
    }

    const daily = loc.daily.time.map((date, i) => ({
      date,
      conditionCode: loc.daily.weather_code[i],
      maxC: loc.daily.temperature_2m_max[i],
      minC: loc.daily.temperature_2m_min[i],
      precipProbability: loc.daily.precipitation_probability_max[i],
      sunrise: loc.daily.sunrise[i],
      sunset: loc.daily.sunset[i],
    }));

    return [
      config.id,
      {
        id: config.id,
        latitude: loc.latitude,
        longitude: loc.longitude,
        elevation: loc.elevation,
        timezone: loc.timezone,
        current: {
          time: loc.current.time,
          conditionCode: loc.current.weather_code,
          isDay: loc.current.is_day === 1,
          temperatureC: loc.current.temperature_2m,
          apparentTemperatureC: loc.current.apparent_temperature,
          humidity: loc.current.relative_humidity_2m,
          windKph: loc.current.wind_speed_10m,
          windDirection: loc.current.wind_direction_10m,
          precipitationMm: loc.current.precipitation,
        },
        daily,
      },
    ] as const;
  });

  // Object.fromEntries would silently keep the last of a repeated key.
  if (new Set(entries.map(([id]) => id)).size !== entries.length) {
    throw new Error('Response contained duplicate location ids');
  }

  return {
    fetchedAt,
    source: 'open-meteo',
    locations: Object.fromEntries(entries),
  };
};

export const fetchWeather = async (
  locations: LocationConfig[],
  // Global fetch depth: pass the maximum forecastDays across all pages. One
  // snapshot serves every page, and each renderer slices the days it shows.
  forecastDays: number,
): Promise<Snapshot> => {
  const res = await fetch(buildUrl(locations, forecastDays), {
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}: ${await res.text()}`);

  return toSnapshot(parseResponse(await res.json()), locations);
};
