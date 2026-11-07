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
import {
  formatHumidity,
  formatPrecipitation,
  formatPrecipProbability,
  formatTemperature,
  formatTime,
  formatWind,
  weekday,
} from './format';
import { html, SafeHtml } from './html';
import type {
  CurrentField,
  DisplayConfig,
  LocationConfig,
} from '../config/weather.config';
import type {
  CurrentWeather,
  DayForecast,
  LocationWeather,
} from '../shared/model';

// A cell holds a value, not markup: renderTable owns every <td>, <th> and
// scope, so the accessible structure lives in one place. A plain string is
// escaped on the way in; SafeHtml is passed through, which is how the
// condition cell gets its hidden emoji.
type Cell = string | SafeHtml;

export interface TableRow {
  readonly header: string;
  readonly cells: readonly Cell[];
}

// The one table renderer. Callers decide what the columns mean; this decides
// how a table is built.
//
// The empty corner cell is the standard pattern for a table with both column
// and row headers: it belongs to neither axis, so it is a <td>, not a <th>.
//
// Exported because it owns the accessible structure both tables depend on, so
// that structure and its one invariant are asserted here rather than inferred
// from two callers' output.
export const renderTable = ({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: readonly string[];
  rows: readonly TableRow[];
}): SafeHtml => {
  // A row whose cells don't line up with the headers is a malformed table, and
  // a screen reader would pair values with the wrong columns. Cheaper to fail
  // here than to ship a page that reads plausibly and is wrong.
  for (const row of rows) {
    if (row.cells.length !== columns.length) {
      throw new Error(
        `Table "${caption}" row "${row.header}" has ${row.cells.length} cells for ${columns.length} columns`,
      );
    }
  }

  return html`<table>
    <caption>
      ${caption}
    </caption>
    <thead>
      <tr>
        <td></td>
        ${columns.map((column) => html`<th scope="col">${column}</th>`)}
      </tr>
    </thead>
    <tbody>
      ${rows.map(
        (row) =>
          html`<tr>
            <th scope="row">${row.header}</th>
            ${row.cells.map((cell) => html`<td>${cell}</td>`)}
          </tr>`,
      )}
    </tbody>
  </table>`;
};

// The emoji is decorative: screen readers announce it by its Unicode name
// ('sun behind small cloud'), which at best repeats the label beside it and at
// worst contradicts it. The label is always present, so the icon is hidden.
const conditionContent = ({
  code,
  isDay,
}: {
  code: number;
  isDay: boolean;
}): SafeHtml => {
  const { label, icon } = describeCondition({ code, isDay });

  return html`<span aria-hidden="true">${icon}</span> ${label}`;
};

const FORECAST_COLUMNS = ['Condition', 'High', 'Low', 'Precip'] as const;

// isDay is true for every forecast row: a daily summary describes the daylight
// hours, and DayForecast carries no isDay of its own to consult.
const forecastRow = ({
  day,
  display,
}: {
  day: DayForecast;
  display: DisplayConfig;
}): TableRow => {
  const units = display.units.temperature;

  return {
    header: weekday(day.date),
    cells: [
      conditionContent({ code: day.conditionCode, isDay: true }),
      formatTemperature({ celsius: day.maxC, units }),
      formatTemperature({ celsius: day.minC, units }),
      formatPrecipProbability(day.precipProbability),
    ],
  };
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
  renderTable({
    caption: 'Forecast',
    columns: FORECAST_COLUMNS,
    rows: daily.map((day) => forecastRow({ day, display })),
  });

// One entry per CurrentField, holding both the column header and the cell that
// fills it. A single record rather than a label table beside a switch, so the
// compiler can't accept a new field that has a header but renders nothing —
// or renders but has no header.
//
// Headers name the quantity, never the unit: `Temp`, not `Temp (°F)`. The
// formatters carry the symbol where there is one, and `Precip` is deliberately
// bare, since no symbol distinguishes inches from millimetres.
const CURRENT_COLUMNS: Record<
  CurrentField,
  {
    readonly label: string;
    readonly cell: (args: {
      current: CurrentWeather;
      display: DisplayConfig;
    }) => Cell;
  }
> = {
  condition: {
    label: 'Condition',
    // The only cell that reads the observation's own isDay, which is why the
    // clear-sky codes can show the moon here but never in the forecast.
    cell: ({ current }) =>
      conditionContent({ code: current.conditionCode, isDay: current.isDay }),
  },
  temperature: {
    label: 'Temp',
    cell: ({ current, display }) =>
      formatTemperature({
        celsius: current.temperatureC,
        units: display.units.temperature,
      }),
  },
  apparentTemperature: {
    label: 'Feels',
    cell: ({ current, display }) =>
      formatTemperature({
        celsius: current.apparentTemperatureC,
        units: display.units.temperature,
      }),
  },
  humidity: {
    label: 'Humidity',
    cell: ({ current }) => formatHumidity(current.humidity),
  },
  wind: {
    label: 'Wind',
    cell: ({ current, display }) =>
      formatWind({
        kph: current.windKph,
        degrees: current.windDirection,
        units: display.units.wind,
      }),
  },
  precipitation: {
    label: 'Precip',
    cell: ({ current, display }) =>
      formatPrecipitation({
        mm: current.precipitationMm,
        units: display.units.precipitation,
      }),
  },
};

// display.current is both the column set and the column order, resolved once
// here so the headers and the cells are built from the same list and can't
// disagree. validateAndResolve has already proved it non-empty and
// duplicate-free.
export const renderCurrentTable = ({
  current,
  display,
}: {
  current: CurrentWeather;
  display: DisplayConfig;
}): SafeHtml => {
  const columns = display.current.map((field) => CURRENT_COLUMNS[field]);

  return renderTable({
    caption: 'Current',
    columns: columns.map((column) => column.label),
    rows: [
      {
        header: 'Now',
        cells: columns.map((column) => column.cell({ current, display })),
      },
    ],
  });
};

// One location: its heading, when it was observed, and the two tables.
//
// The id is the location id, so a page can be linked straight to one location;
// validateAndResolve has already proved the ids URL-safe. data-period is the
// day/night signal: with no client-side JS the stylesheet needs it as an
// attribute, and it carries the fact that it is dark out without spending a
// row on it.
//
// Observed is this location's own wall clock, which is why it sits here rather
// than in the footer — three locations in one snapshot can be in three
// different hours, and the footer's single Updated line can't say that.
//
// The day-count backstop lives here because this is where the slice happens.
// The other one — a page naming a location the snapshot lacks — belongs to
// renderPage, which does the lookup and can name the page alongside the id.
export const renderLocation = ({
  location,
  weather,
  display,
}: {
  location: LocationConfig;
  weather: LocationWeather;
  display: DisplayConfig;
}): SafeHtml => {
  if (weather.daily.length < display.forecastDays) {
    throw new Error(
      `Location "${location.id}" has ${weather.daily.length} forecast days, page asks for ${display.forecastDays}`,
    );
  }

  return html`<section
    id="${location.id}"
    data-period="${weather.current.isDay ? 'day' : 'night'}"
  >
    <h2>${location.label}</h2>
    <p>Observed ${formatTime(weather.current.time)}</p>
    ${renderCurrentTable({ current: weather.current, display })}
    ${renderForecastTable({
      daily: weather.daily.slice(0, display.forecastDays),
      display,
    })}
  </section>`;
};
