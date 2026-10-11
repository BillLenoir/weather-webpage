import { validateAndResolve } from '../../src/config/validate';
import { PageConfig } from '../../src/config/weather.config';
import {
  defaultDisplay,
  makeConfig,
  makeLocation,
  makePage,
} from '../fixtures/weather-config';

const pageWithDays = (slug: string, forecastDays: number): PageConfig =>
  makePage({ slug, display: { ...defaultDisplay, forecastDays } });

describe('validateAndResolve', () => {
  it('dedupes locations by id, keeping first-seen order', () => {
    const { locations } = validateAndResolve(makeConfig());

    // page-1: alpha, beta — page-2: beta, gamma. Four entries in, three out.
    // Covers both orderings: alpha before beta is intra-page, beta before
    // gamma is inter-page. Order is the contract, since toSnapshot pairs
    // response entries to these by position.
    expect(locations.map((l) => l.id)).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('derives forecastDays as the max across pages', () => {
    // The max sits in the middle, so neither "first page" nor "last page"
    // would pass.
    const config = makeConfig({
      pages: [pageWithDays('a', 2), pageWithDays('b', 5), pageWithDays('c', 3)],
    });

    expect(validateAndResolve(config).forecastDays).toBe(5);
  });

  it('keeps the first occurrence when a later page repeats an id', () => {
    const config = makeConfig({
      pages: [
        makePage({
          slug: 'first',
          locations: [makeLocation({ label: 'First' })],
        }),
        makePage({
          slug: 'second',
          locations: [makeLocation({ label: 'Second' })],
        }),
      ],
    });

    const { locations } = validateAndResolve(config);

    expect(locations).toHaveLength(1);
    expect(locations[0].label).toBe('First');
  });

  it('passes pages through by reference', () => {
    const config = makeConfig();

    // Not copied, filtered or sorted: the renderer reads these in config order.
    expect(validateAndResolve(config).pages).toBe(config.pages);
  });
});
