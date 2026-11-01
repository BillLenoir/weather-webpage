// Markup for a page. Each location gets a section holding two tables: the
// current observation and the forecast. They are separate tables rather than
// one because their fields don't align — a day has a high and a low and a
// chance of precipitation, an observation has wind, humidity and an amount —
// and a single table would carry a hole in every row.
//
// Both are real data tables: column headers for the fields, a row header for
// the time, so a screen reader announces "Thu, High, 61 degrees" rather than
// reading cells with nothing to anchor them. The caption gives each table its
// accessible name.
import { describeCondition } from './conditions';
import { formatPrecipProbability, formatTemperature, weekday } from './format';
import { html, SafeHtml } from './html';
import type { DisplayConfig } from '../config/weather.config';
import type { DayForecast } from '../shared/model';

const FORECAST_COLUMNS = ['Condition', 'High', 'Low', 'Precip'] as const;

// The emoji is decorative: screen readers announce it by its Unicode name
// ('sun behind small cloud'), which at best repeats the label beside it and at
// worst contradicts it. The label is always present, so the icon is hidden.
const conditionCell = ({
  code,
  isDay,
}: {
  code: number;
  isDay: boolean;
}): SafeHtml => {
  const { label, icon } = describeCondition({ code, isDay });

  return html`<td><span aria-hidden="true">${icon}</span> ${label}</td>`;
};

// isDay is true for every forecast row: a daily summary describes the daylight
// hours, and DayForecast carries no isDay of its own to consult.
const renderForecastRow = ({
  day,
  display,
}: {
  day: DayForecast;
  display: DisplayConfig;
}): SafeHtml => {
  const units = display.units.temperature;

  return html`<tr>
    <th scope="row">${weekday(day.date)}</th>
    ${conditionCell({ code: day.conditionCode, isDay: true })}
    <td>${formatTemperature({ celsius: day.maxC, units })}</td>
    <td>${formatTemperature({ celsius: day.minC, units })}</td>
    <td>${formatPrecipProbability(day.precipProbability)}</td>
  </tr>`;
};

// Renders every day it is given. Slicing to display.forecastDays happens
// upstream, where the page and location are known and a snapshot with too few
// days can be named in the error.
export const renderForecastTable = ({
  daily,
  display,
}: {
  daily: readonly DayForecast[];
  display: DisplayConfig;
}): SafeHtml =>
  html`<table>
    <caption>
      Forecast
    </caption>
    <thead>
      <tr>
        <td></td>
        ${FORECAST_COLUMNS.map((column) => html`<th scope="col">${column}</th>`)}
      </tr>
    </thead>
    <tbody>
      ${daily.map((day) => renderForecastRow({ day, display }))}
    </tbody>
  </table>`;
