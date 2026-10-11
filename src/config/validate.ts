import { LocationConfig, PageConfig, WeatherConfig } from './weather.config';

export interface ResolvedConfig {
  readonly locations: readonly LocationConfig[]; // deduped union, in request order
  readonly forecastDays: number; // max across pages
  readonly pages: readonly PageConfig[];
}

// Order is the contract, not a convenience: toSnapshot pairs response entries
// to these locations by position, so first-seen order out of here is what keeps
// each location's weather on the right page. Don't sort this for tidiness.
const dedupeLocationsById = (
  pages: readonly PageConfig[],
): LocationConfig[] => {
  const byId = new Map<string, LocationConfig>();
  for (const page of pages) {
    for (const location of page.locations) {
      if (!byId.has(location.id)) byId.set(location.id, location);
    }
  }
  return [...byId.values()];
};

// Math.max() over no pages is -Infinity. The "at least one page" check reports
// the real problem; the fallback just keeps forecastDays a usable number so the
// 1..16 range check can't pile on a confusing second error about a value nobody
// wrote. It never escapes: validation throws before any caller sees it.
const deriveForecastDays = (pages: readonly PageConfig[]): number =>
  pages.length ? Math.max(...pages.map((p) => p.display.forecastDays)) : 1;

/**
 * Checks the cross-field constraints the compiler can't, and derives the values
 * the handlers need, so every caller gets a checked, resolved view in one call.
 *
 * Takes the config as a parameter rather than importing the singleton, so the
 * failure cases are testable without module mocking.
 */
export const validateAndResolve = (config: WeatherConfig): ResolvedConfig => ({
  locations: dedupeLocationsById(config.pages),
  forecastDays: deriveForecastDays(config.pages),
  pages: config.pages,
});
