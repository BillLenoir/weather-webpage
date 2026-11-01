import { toHtmlString } from '../../src/renderer/html';
import { renderForecastTable } from '../../src/renderer/render';
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
