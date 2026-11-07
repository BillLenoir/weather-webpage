import type { DisplayConfig } from '../../src/config/weather.config';
import { toHtmlString } from '../../src/renderer/html';
import {
  renderCurrentTable,
  renderForecastTable,
  renderLocation,
  renderTable,
} from '../../src/renderer/render';
import { locations } from '../fixtures/locations';
import { makeSnapshot } from '../fixtures/snapshot';
import { defaultDisplay } from '../fixtures/weather-config';

// Centreville's three recorded days: 2026-09-23 (Wed, code 53 drizzle, 17/12.3,
// 52%), 2026-09-24 (Thu, code 3 overcast, 16.1/10.9, 0%) and 2026-09-25 (Fri,
// code 3, 22.2/8.6, 0%).
const centrevilleDaily = () => makeSnapshot().locations.centreville.daily;

const metricDisplay = {
  ...defaultDisplay,
  units: { ...defaultDisplay.units, temperature: 'C' as const },
};

const forecast = ({
  daily = centrevilleDaily(),
  display = defaultDisplay,
} = {}) => toHtmlString(renderForecastTable({ daily, display }));

// Row headers rather than <tr> counts: a styling pass can restructure rows, but
// the row header is what associates a day with its cells.
const rowHeaders = (markup: string): string[] =>
  [...markup.matchAll(/<th scope="row">([^<]*)<\/th>/g)].map(
    ([, text]) => text,
  );

const colHeaders = (markup: string): string[] =>
  [...markup.matchAll(/<th scope="col">([^<]*)<\/th>/g)].map(([, text]) =>
    text.trim(),
  );

// Data cell text with tags stripped, so the assertions track what a reader
// sees rather than the markup around it — a styling pass is free to wrap a
// value in an element. The first <td> is the header row's empty corner cell.
const cellText = (markup: string): string[] =>
  [...markup.matchAll(/<td>([\s\S]*?)<\/td>/g)]
    .map(([, inner]) => inner.replace(/<[^>]*>/g, '').trim())
    .slice(1);

describe('renderTable', () => {
  const table = () =>
    toHtmlString(
      renderTable({
        caption: 'Caption',
        columns: ['First', 'Second'],
        rows: [{ header: 'Row', cells: ['one', 'two'] }],
      }),
    );

  it('heads both axes and leaves the corner cell empty', () => {
    const markup = table();

    expect(colHeaders(markup)).toEqual(['First', 'Second']);
    expect(rowHeaders(markup)).toEqual(['Row']);
    expect(markup).toContain('<td></td>');
  });

  it('escapes a cell value', () => {
    const markup = toHtmlString(
      renderTable({
        caption: 'Caption',
        columns: ['First'],
        rows: [{ header: 'Row', cells: ['<script>'] }],
      }),
    );

    expect(markup).toContain('&lt;script&gt;');
    expect(markup).not.toContain('<script>');
  });

  // Unreachable from either table today — both build their cells from the same
  // column list — so this is the only thing holding the invariant in place for
  // the next caller.
  it('throws when a row has the wrong number of cells', () => {
    expect(() =>
      renderTable({
        caption: 'Current',
        columns: ['First', 'Second'],
        rows: [{ header: 'Now', cells: ['only one'] }],
      }),
    ).toThrow('Table "Current" row "Now" has 1 cells for 2 columns');
  });
});

describe('renderForecastTable', () => {
  it('renders one row per day it is given', () => {
    expect(rowHeaders(forecast())).toEqual(['Wed', 'Thu', 'Fri']);
  });

  it('renders only the days it is given', () => {
    expect(
      rowHeaders(forecast({ daily: centrevilleDaily().slice(0, 2) })),
    ).toEqual(['Wed', 'Thu']);
  });

  it('names the table and heads every column', () => {
    const markup = forecast();

    expect(markup).toContain('Forecast');
    for (const column of ['Condition', 'High', 'Low', 'Precip']) {
      expect(markup).toContain(`<th scope="col">${column}</th>`);
    }
  });

  it('converts the high and the low to the configured units', () => {
    // 17°C and 12.3°C.
    expect(forecast()).toContain('63°');
    expect(forecast()).toContain('54°');
  });

  it('renders metric temperatures unconverted', () => {
    const markup = forecast({ display: metricDisplay });

    expect(markup).toContain('17°');
    expect(markup).toContain('12°');
    expect(markup).not.toContain('63°');
  });

  it('renders the precipitation probability as a percentage', () => {
    expect(forecast()).toContain('52%');
  });

  it('keeps a zero probability distinct from a missing one', () => {
    const daily = centrevilleDaily();
    daily[0].precipProbability = null;

    const markup = forecast({ daily });

    expect(markup).toContain('—'); // Wednesday, now missing
    expect(markup).toContain('0%'); // Thursday, a real zero
  });

  it('pairs the condition label with an emoji hidden from assistive tech', () => {
    // Code 53 is Drizzle; the label carries the intensity the icon can't.
    expect(forecast()).toContain(
      '<td><span aria-hidden="true">🌦️</span> Drizzle</td>',
    );
  });

  it('uses the day icon for forecast rows, never the night variant', () => {
    const daily = centrevilleDaily();
    daily[0].conditionCode = 0; // Clear: ☀️ by day, 🌙 at night

    const markup = forecast({ daily });

    expect(markup).toContain('☀️');
    expect(markup).not.toContain('🌙');
  });
});

// Centreville's observation: 2026-09-23T17:15, is_day 1, code 3 (overcast),
// 16.9°C, feels 15.6°C, 76% humidity, 14.4 kph from 37°, 0 mm.
const centrevilleCurrent = () => makeSnapshot().locations.centreville.current;
const dongtanCurrent = () => makeSnapshot().locations.dongtan.current;

// Every field, so one assertion can cover the whole row. defaultDisplay asks
// for condition and temperature only.
const allFields: DisplayConfig = {
  ...defaultDisplay,
  current: [
    'condition',
    'temperature',
    'apparentTemperature',
    'humidity',
    'wind',
    'precipitation',
  ],
};

const allFieldsMetric: DisplayConfig = {
  ...allFields,
  units: { temperature: 'C', wind: 'kph', precipitation: 'mm' },
};

const currentTable = ({
  current = centrevilleCurrent(),
  display = allFields,
} = {}) => toHtmlString(renderCurrentTable({ current, display }));

describe('renderCurrentTable', () => {
  it('heads one column per configured field, in configured order', () => {
    expect(colHeaders(currentTable())).toEqual([
      'Condition',
      'Temp',
      'Feels',
      'Humidity',
      'Wind',
      'Precip',
    ]);
  });

  it('follows config order when the fields are reordered', () => {
    const display: DisplayConfig = {
      ...allFields,
      current: ['wind', 'condition', 'humidity'],
    };

    expect(colHeaders(currentTable({ display }))).toEqual([
      'Wind',
      'Condition',
      'Humidity',
    ]);
  });

  it('omits a field the page does not ask for', () => {
    const markup = currentTable({ display: defaultDisplay });

    expect(colHeaders(markup)).toEqual(['Condition', 'Temp']);
    expect(markup).not.toContain('76%'); // the humidity it didn't ask for
  });

  it('names the table and labels its one row', () => {
    const markup = currentTable();

    expect(markup).toContain('Current');
    expect(rowHeaders(markup)).toEqual(['Now']);
  });

  it('formats every field in the configured imperial units', () => {
    expect(cellText(currentTable())).toEqual([
      '☁️ Overcast',
      '62°',
      '60°',
      '76%',
      '9 NE',
      '0.0',
    ]);
  });

  it('formats every field in metric units', () => {
    expect(cellText(currentTable({ display: allFieldsMetric }))).toEqual([
      '☁️ Overcast',
      '17°',
      '16°',
      '76%',
      '14 NE',
      '0',
    ]);
  });

  it('shows the night icon when the observation is at night', () => {
    const current = dongtanCurrent(); // recorded at 06:15, is_day 0
    current.conditionCode = 0; // Clear: ☀️ by day, 🌙 at night

    expect(currentTable({ current })).toContain('🌙');
  });

  it('shows the day icon for the same code by day', () => {
    const current = centrevilleCurrent(); // 17:15, is_day 1
    current.conditionCode = 0;

    expect(currentTable({ current })).toContain('☀️');
  });
});

// Centreville and Dongtan sit in the same snapshot at different local hours —
// 17:15 with is_day 1, 06:15 with is_day 0 — which is what makes them the pair
// for the per-location clock and for the day/night attribute.
const centrevilleConfig = locations[0];
const dongtanConfig = locations[2];

const centrevilleWeather = () => makeSnapshot().locations.centreville;
const dongtanWeather = () => makeSnapshot().locations.dongtan;

const section = ({
  location = centrevilleConfig,
  weather = centrevilleWeather(),
  display = defaultDisplay,
} = {}) => toHtmlString(renderLocation({ location, weather, display }));

describe('renderLocation', () => {
  it('heads the section with the configured label', () => {
    expect(section()).toMatch(/<h2>\s*Centreville, VA\s*<\/h2>/);
  });

  it('anchors the section with the location id', () => {
    expect(section()).toContain('id="centreville"');
  });

  it('shows each location on its own clock', () => {
    expect(section()).toMatch(/Observed\s+5:15 PM/);
    expect(
      section({ location: dongtanConfig, weather: dongtanWeather() }),
    ).toMatch(/Observed\s+6:15 AM/);
  });

  it('marks a daytime observation', () => {
    expect(section()).toContain('data-period="day"');
  });

  it('marks a night observation', () => {
    expect(
      section({ location: dongtanConfig, weather: dongtanWeather() }),
    ).toContain('data-period="night"');
  });

  // Both tables, in order, from one assertion: 'Now' is the current table's
  // row header and the weekdays are the forecast's.
  it('holds the current row and then one row per forecast day', () => {
    expect(rowHeaders(section())).toEqual(['Now', 'Wed', 'Thu', 'Fri']);
  });

  it('shows only as many days as the page asks for', () => {
    const display: DisplayConfig = { ...defaultDisplay, forecastDays: 2 };

    expect(rowHeaders(section({ display }))).toEqual(['Now', 'Wed', 'Thu']);
  });

  it('throws when the snapshot has fewer days than the page asks for', () => {
    const weather = centrevilleWeather();
    weather.daily = weather.daily.slice(0, 2);

    expect(() => section({ weather })).toThrow(
      'Location "centreville" has 2 forecast days, page asks for 3',
    );
  });
});
