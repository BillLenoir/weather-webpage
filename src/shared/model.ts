import { z } from 'zod';

export const DayForecastSchema = z.object({
  date: z.iso.date(), // 'YYYY-MM-DD', the location's local date
  conditionCode: z.number(),
  maxC: z.number(),
  minC: z.number(),
  precipProbability: z.number().nullable(),
  sunrise: z.iso.datetime({ local: true }), // local ISO, no offset
  sunset: z.iso.datetime({ local: true }),
});
export type DayForecast = z.infer<typeof DayForecastSchema>;

export const CurrentWeatherSchema = z.object({
  time: z.iso.datetime({ local: true }), // local ISO, no offset
  conditionCode: z.number(),
  isDay: z.boolean(), // API sends 0/1; normalize here
  temperatureC: z.number(),
  apparentTemperatureC: z.number(),
  humidity: z.number(), // %
  windKph: z.number(),
  windDirection: z.number(), // degrees
  precipitationMm: z.number(),
});
export type CurrentWeather = z.infer<typeof CurrentWeatherSchema>;

export const LocationWeatherSchema = z.object({
  id: z.string(),
  latitude: z.number(), // as returned: snapped to the model grid
  longitude: z.number(),
  elevation: z.number(),
  timezone: z.string(), // IANA, e.g. 'Asia/Seoul'
  current: CurrentWeatherSchema,
  daily: z.array(DayForecastSchema),
});
export type LocationWeather = z.infer<typeof LocationWeatherSchema>;

export const SnapshotSchema = z.object({
  fetchedAt: z.iso.datetime(), // ISO UTC
  source: z.literal('open-meteo'),
  locations: z.record(z.string(), LocationWeatherSchema),
});
export type Snapshot = z.infer<typeof SnapshotSchema>;
