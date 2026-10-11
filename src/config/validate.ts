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

// One prefix vocabulary for every message, built here rather than at each call
// site so the three shapes can't drift. Indices are 0-based, matching the
// arrays a reader will be looking at.
const atPage = ({ index, page }: { index: number; page: PageConfig }): string =>
  `page[${index}] "${page.slug}"`;

const atLocation = ({
  index,
  page,
  locationIndex,
  location,
}: {
  index: number;
  page: PageConfig;
  locationIndex: number;
  location: LocationConfig;
}): string =>
  `${atPage({ index, page })} location[${locationIndex}] "${location.id}"`;

// Rejects '', uppercase, spaces, leading and trailing dashes, and doubled
// dashes — so no separate non-empty or lowercase rule is needed.
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const firstDuplicate = <T>(values: readonly T[]): T | undefined => {
  const seen = new Set<T>();
  for (const value of values) {
    if (seen.has(value)) return value;
    seen.add(value);
  }
  return undefined;
};

/**
 * Checks the cross-field constraints the compiler can't, and derives the values
 * the handlers need, so every caller gets a checked, resolved view in one call.
 *
 * Takes the config as a parameter rather than importing the singleton, so the
 * failure cases are testable without module mocking.
 *
 * Collects every problem and throws once: a config with three mistakes should
 * report three, not cost three rounds of fixing.
 */
export const validateAndResolve = (config: WeatherConfig): ResolvedConfig => {
  const errors: string[] = [];
  const fail = ({
    prefix,
    message,
  }: {
    prefix: string;
    message: string;
  }): void => {
    errors.push(`${prefix}: ${message}`);
  };

  if (config.pages.length === 0) {
    fail({ prefix: 'config', message: 'at least one page required' });
  }

  // Cross-page accumulators. The per-page equivalents live inside the loop:
  // repeating an id across pages is the point of dedupe, repeating one within a
  // page is a copy-paste error.
  const slugs = new Map<string, number>();
  const firstSeen = new Map<
    string,
    { index: number; page: PageConfig; location: LocationConfig }
  >();

  config.pages.forEach((page, index) => {
    const prefix = atPage({ index, page });

    if (page.locations.length === 0) {
      fail({ prefix, message: 'at least one location required' });
    }

    // The prefix already quotes the slug, so don't repeat it here.
    if (!SLUG.test(page.slug)) {
      fail({ prefix, message: 'slug must be lowercase kebab-case' });
    }

    const firstSlugAt = slugs.get(page.slug);
    if (firstSlugAt === undefined) {
      slugs.set(page.slug, index);
    } else {
      fail({ prefix, message: `slug already used by page[${firstSlugAt}]` });
    }

    if (page.title.trim() === '') {
      fail({ prefix, message: 'title must not be empty' });
    }

    const days = page.display.forecastDays;
    if (!Number.isInteger(days) || days < 1 || days > 16) {
      fail({
        prefix,
        message: `forecastDays ${days} must be a whole number between 1 and 16`,
      });
    }

    if (page.display.current.length === 0) {
      fail({ prefix, message: 'display.current must list at least one field' });
    }
    const duplicateField = firstDuplicate(page.display.current);
    if (duplicateField !== undefined) {
      fail({
        prefix,
        message: `display.current has duplicate "${duplicateField}"`,
      });
    }

    const idsInPage = new Set<string>();

    page.locations.forEach((location, locationIndex) => {
      const where = atLocation({ index, page, locationIndex, location });

      if (idsInPage.has(location.id)) {
        fail({
          prefix: where,
          message: `id "${location.id}" already used on this page`,
        });
      }
      idsInPage.add(location.id);

      if (location.label.trim() === '') {
        fail({ prefix: where, message: 'label must not be empty' });
      }

      // NaN fails these comparisons too, so no separate isFinite check.
      if (!(location.latitude >= -90 && location.latitude <= 90)) {
        fail({
          prefix: where,
          message: `latitude ${location.latitude} must be between -90 and 90`,
        });
      }
      if (!(location.longitude >= -180 && location.longitude <= 180)) {
        fail({
          prefix: where,
          message: `longitude ${location.longitude} must be between -180 and 180`,
        });
      }

      const seen = firstSeen.get(location.id);
      if (seen === undefined) {
        firstSeen.set(location.id, { index, page, location });
      } else if (
        seen.location.latitude !== location.latitude ||
        seen.location.longitude !== location.longitude
      ) {
        fail({
          prefix: where,
          message:
            `id "${location.id}" is ${seen.location.latitude},${seen.location.longitude} ` +
            `on ${atPage({ index: seen.index, page: seen.page })} but ${location.latitude},${location.longitude} here`,
        });
      }
    });
  });

  if (errors.length > 0) {
    throw new Error(`Invalid weather config:\n${errors.join('\n')}`);
  }

  // Derive only after validating: dedupe on a config where one id means two
  // places would silently pick a winner in the case just reported as an error.
  return {
    locations: dedupeLocationsById(config.pages),
    forecastDays: deriveForecastDays(config.pages),
    pages: config.pages,
  };
};
