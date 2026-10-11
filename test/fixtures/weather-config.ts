// Builders for config tests, valid by default so a test expresses only what it
// breaks. Every call returns fresh objects, so rows replace values rather than
// mutating them. The one deliberate sharing is `beta` in makeConfig, held by
// both pages so their coordinates can't drift apart. Mutating it in place
// would change both.
import {
  DisplayConfig,
  LocationConfig,
  PageConfig,
  WeatherConfig,
} from '../../src/config/weather.config';

export const defaultDisplay: DisplayConfig = {
  units: { temperature: 'F', wind: 'mph', precipitation: 'in' },
  current: ['condition', 'temperature'],
  forecastDays: 3,
};

export const makeLocation = (
  overrides?: Partial<LocationConfig>,
): LocationConfig => ({
  id: 'alpha',
  label: 'Alpha',
  latitude: 10,
  longitude: 20,
  ...overrides,
});

export const makePage = (overrides?: Partial<PageConfig>): PageConfig => ({
  slug: 'page',
  title: 'Page',
  locations: [makeLocation()],
  display: { ...defaultDisplay },
  ...overrides,
});

export const makeConfig = (
  overrides?: Partial<WeatherConfig>,
): WeatherConfig => {
  const beta = makeLocation({
    id: 'beta',
    label: 'Beta',
    latitude: 30,
    longitude: 40,
  });

  return {
    source: 'open-meteo',
    schedule: { intervalMinutes: 60 },
    pages: [
      makePage({ slug: 'page-1', locations: [makeLocation(), beta] }),
      makePage({
        slug: 'page-2',
        locations: [
          beta,
          makeLocation({
            id: 'gamma',
            label: 'Gamma',
            latitude: 50,
            longitude: 60,
          }),
        ],
        display: { ...defaultDisplay, forecastDays: 5 },
      }),
    ],
    ...overrides,
  };
};
