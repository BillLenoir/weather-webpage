import { LocationConfig } from '../../../src/config/weather.config';
import {
  buildUrl,
  CURRENT_FIELDS,
  DAILY_FIELDS,
  OpenMeteoResponseSchema,
  parseResponse,
  toSnapshot,
} from '../../../src/fetcher/providers/open-meteo';
import { SnapshotSchema } from '../../../src/shared/model';
import raw from '../../fixtures/open-meteo.json';

const FETCHED_AT = '2026-09-23T21:15:00.000Z';

// The recorded response deliberately spans two local dates and a day/night
// split: Centreville and Astoria at 2026-09-23T17:15 (is_day 1), Dongtan at
// 2026-09-24T06:15, five minutes before its 06:20 sunrise (is_day 0). Tests
// below depend on both. If you re-record the fixture, capture a moment that
// keeps them, or update those tests.
//
// Nothing here depends on the machine's timezone; the adapter never constructs
// a Date from provider strings.
const rawResponse = () => structuredClone(raw);
const response = () => parseResponse(rawResponse());

// Same order as the recorded response's entries, so each entry's location_id
// indexes into this array. Entry 0's location_id is absent, entries 1 and 2
// carry 1 and 2, so a single-location test must use entry 0.
const locations: LocationConfig[] = [
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
];

// Two pages using one id for different places is a config mistake; the fetcher
// dedupes by id upstream, and toSnapshot is the backstop.
const locationsDuplicateId: LocationConfig[] = [
  locations[0],
  { ...locations[1], id: 'centreville' },
  locations[2],
];

const locationsTooFew = locations.slice(0, 2);
const locationsOne: LocationConfig[] = [locations[2]];
const locationsReordered: LocationConfig[] = [
  locations[2],
  locations[0],
  locations[1],
];

const keysOf = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.flatMap(keysOf)
    : value && typeof value === 'object'
      ? Object.entries(value).flatMap(([k, v]) => [k, ...keysOf(v)])
      : [];

// Provider vocabulary that must not reach the renderer. sunrise/sunset are
// excluded: they're the model's names too.
const PROVIDER_ONLY = [
  ...CURRENT_FIELDS,
  ...DAILY_FIELDS,
  'location_id',
  'generationtime_ms',
  'current_units',
  'daily_units',
  'utc_offset_seconds',
  'timezone_abbreviation',
].filter((k) => k !== 'sunrise' && k !== 'sunset');

describe('open-meteo', () => {
  describe('buildUrl', () => {
    it('joins latitudes and longitudes in config order', () => {
      const url = buildUrl(locations, 3);

      expect(url.searchParams.get('latitude')).toBe('38.84,40.77,37.19');
      expect(url.searchParams.get('longitude')).toBe('-77.43,-73.92,127.12');
    });

    it('targets the Open-Meteo forecast endpoint', () => {
      const url = buildUrl(locations, 3);

      expect(`${url.origin}${url.pathname}`).toBe(
        'https://api.open-meteo.com/v1/forecast',
      );
    });

    it('requests the configured current and daily fields', () => {
      const url = buildUrl(locations, 3);

      // Literal, not CURRENT_FIELDS.join(','): changing the request should be a
      // deliberate edit here too, since the schema and mapping must change with it.
      expect(url.searchParams.get('current')?.split(',')).toEqual([
        'temperature_2m',
        'weather_code',
        'apparent_temperature',
        'relative_humidity_2m',
        'wind_speed_10m',
        'wind_direction_10m',
        'is_day',
        'precipitation',
      ]);

      expect(url.searchParams.get('daily')?.split(',')).toEqual([
        'weather_code',
        'temperature_2m_max',
        'temperature_2m_min',
        'precipitation_probability_max',
        'sunrise',
        'sunset',
      ]);
    });

    it('sets timezone=auto and forecast_days', () => {
      const url = buildUrl(locations, 5);

      // auto = each location's own local time; the model stores these verbatim.
      expect(url.searchParams.get('timezone')).toBe('auto');
      expect(url.searchParams.get('forecast_days')).toBe('5');
    });

    it('throws when given no locations', () => {
      expect(() => buildUrl([], 3)).toThrow('No locations to fetch');
    });
  });

  describe('parseResponse', () => {
    it('wraps a single-location object in an array', () => {
      // Entry 0 has no location_id, which is what a single-location response
      // actually looks like.
      const [entry] = rawResponse();
      const parsed = parseResponse(entry);

      expect(parsed).toHaveLength(1);
      expect(parsed[0].timezone).toBe('America/New_York');
      expect(parsed[0].location_id).toBeUndefined();
    });

    it('returns a multi-location array unchanged', () => {
      const parsed = parseResponse(rawResponse());

      expect(parsed).toHaveLength(3);
      expect(parsed.map((e) => e.timezone)).toEqual([
        'America/New_York',
        'America/New_York',
        'Asia/Seoul',
      ]);
    });
  });

  describe('OpenMeteoResponseSchema', () => {
    it('accepts the recorded response', () => {
      const parsed = OpenMeteoResponseSchema.parse(rawResponse());
      expect(parsed).toHaveLength(3);
    });

    it('ignores fields it does not model', () => {
      const [entry] = OpenMeteoResponseSchema.parse(rawResponse());

      // The recording also has generationtime_ms, utc_offset_seconds,
      // timezone_abbreviation, current_units and daily_units.
      expect(Object.keys(entry).sort()).toEqual(
        [
          'latitude',
          'longitude',
          'elevation',
          'timezone',
          'current',
          'daily',
        ].sort(),
      );
      expect(entry.current).not.toHaveProperty('interval');

      // A field the provider adds later must not fail the parse.
      const withNewField = rawResponse();
      Object.assign(withNewField[0], { shiny_new_field: 1 });

      expect(() => OpenMeteoResponseSchema.parse(withNewField)).not.toThrow();
    });

    it('rejects a response missing a required field', () => {
      const broken = rawResponse();
      delete (broken[0].current as Record<string, unknown>).temperature_2m;

      const result = OpenMeteoResponseSchema.safeParse(broken);

      expect(result.success).toBe(false);
      expect(result.error?.issues).toEqual([
        expect.objectContaining({
          code: 'invalid_type',
          path: [0, 'current', 'temperature_2m'],
        }),
      ]);
    });
  });

  describe('toSnapshot', () => {
    it('produces a Snapshot that satisfies SnapshotSchema', () => {
      const snapshot = toSnapshot(response(), locations, FETCHED_AT);
      expect(SnapshotSchema.parse(snapshot)).toEqual(snapshot);
    });

    it('records the coordinates the provider returned, not the configured ones', () => {
      const snapshot = toSnapshot(response(), locations, FETCHED_AT);
      const { id, latitude, longitude, elevation, timezone } =
        snapshot.locations.centreville;

      expect({ id, latitude, longitude, elevation, timezone }).toEqual({
        id: 'centreville',
        latitude: 38.850048,
        longitude: -77.42939,
        elevation: 106,
        timezone: 'America/New_York',
      });

      // The provider snaps to its model grid, so these differ from the config.
      expect(latitude).not.toBe(locations[0].latitude);
      expect(longitude).not.toBe(locations[0].longitude);
    });

    it('maps current fields to their Snapshot names', () => {
      const snapshot = toSnapshot(response(), locations, FETCHED_AT);

      expect(snapshot.locations.centreville.current).toEqual({
        time: '2026-09-23T17:15',
        conditionCode: 3,
        isDay: true,
        temperatureC: 16.9,
        apparentTemperatureC: 15.6,
        humidity: 76,
        windKph: 14.4,
        windDirection: 37,
        precipitationMm: 0,
      });
    });

    it('normalizes is_day 0/1 to a boolean', () => {
      const { locations: byId } = toSnapshot(response(), locations, FETCHED_AT);

      expect(byId.centreville.current.isDay).toBe(true);
      expect(byId.dongtan.current.isDay).toBe(false); // recorded at 06:15, sunrise 06:20
    });

    it('keys locations by config id', () => {
      const snapshot = toSnapshot(response(), locations, FETCHED_AT);

      expect(Object.keys(snapshot.locations).sort()).toEqual([
        'astoria',
        'centreville',
        'dongtan',
      ]);

      for (const [key, location] of Object.entries(snapshot.locations)) {
        expect(location.id).toBe(key);
      }
    });

    it('zips daily arrays index by index', () => {
      const { daily } = toSnapshot(response(), locations, FETCHED_AT).locations
        .centreville;

      expect(daily).toHaveLength(3);
      expect(daily[1]).toEqual({
        date: '2026-09-24',
        conditionCode: 3,
        maxC: 16.1,
        minC: 10.9,
        precipProbability: 0,
        sunrise: '2026-09-24T06:59',
        sunset: '2026-09-24T19:03',
      });
    });

    it("keeps each location's own local first day", () => {
      const { locations: byId } = toSnapshot(response(), locations, FETCHED_AT);

      expect(byId.centreville.daily[0].date).toBe('2026-09-23');
      expect(byId.dongtan.daily[0].date).toBe('2026-09-24');
      expect(byId.dongtan.current.time).toBe('2026-09-24T06:15');
    });

    it('preserves a null precipitation probability', () => {
      const parsed = response();
      parsed[0].daily.precipitation_probability_max[1] = null;

      const { daily } = toSnapshot(parsed, locations, FETCHED_AT).locations
        .centreville;

      expect(daily[1].precipProbability).toBeNull();
      expect(daily[0].precipProbability).toBe(52); // neighbours untouched
    });

    it('pairs each response entry with its configured location', () => {
      const parsed = response();
      const snapshot = toSnapshot(parsed, locations, FETCHED_AT);

      locations.forEach((config, i) => {
        const entry = parsed[i];
        const located = snapshot.locations[config.id];
        expect(located).toBeDefined();

        // Fields that come from the response and differ for all three entries.
        expect({
          id: config.id,
          latitude: located.latitude,
          longitude: located.longitude,
          timezone: located.timezone,
          sunrise: located.daily[0].sunrise,
        }).toEqual({
          id: config.id,
          latitude: entry.latitude,
          longitude: entry.longitude,
          timezone: entry.timezone,
          sunrise: entry.daily.sunrise[0],
        });
      });
    });

    it('throws when location_id disagrees with its position', () => {
      const parsed = response();
      parsed[1].location_id = 2;

      expect(() => toSnapshot(parsed, locations, FETCHED_AT)).toThrow(
        /location_id 2 at position 1/,
      );
    });

    it('throws when two entries resolve to the same location id', () => {
      expect(() =>
        toSnapshot(response(), locationsDuplicateId, FETCHED_AT),
      ).toThrow('Response contained duplicate location ids');
    });

    it('throws when the response location count differs from the config', () => {
      // Fewer configured locations than the response returned.
      expect(() => toSnapshot(response(), locationsTooFew, FETCHED_AT)).toThrow(
        'Expected 2 locations, got 3',
      );

      // And the other way round.
      expect(() =>
        toSnapshot(response().slice(0, 2), locations, FETCHED_AT),
      ).toThrow('Expected 3 locations, got 2');
    });

    it('throws naming the location when daily arrays are ragged', () => {
      const parsed = response();
      parsed[0].daily.precipitation_probability_max.pop();

      expect(() => toSnapshot(parsed, locations, FETCHED_AT)).toThrow(
        'Ragged daily arrays for centreville',
      );
    });

    it('uses the fetchedAt it is given', () => {
      const snapshot = toSnapshot(response(), locations, FETCHED_AT);

      expect(snapshot.fetchedAt).toBe(FETCHED_AT);
    });

    it('leaves no provider field names in the output', () => {
      const snapshot = toSnapshot(response(), locations, FETCHED_AT);

      const leaked = keysOf(snapshot).filter((k) => PROVIDER_ONLY.includes(k));
      expect(leaked).toEqual([]);
    });
  });
});
