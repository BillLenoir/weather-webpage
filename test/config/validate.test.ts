import { validateAndResolve } from '../../src/config/validate';
import {
  config as projectConfig,
  PageConfig,
  WeatherConfig,
} from '../../src/config/weather.config';
import {
  defaultDisplay,
  makeConfig,
  makeLocation,
  makePage,
} from '../fixtures/weather-config';

const pageWithDays = (slug: string, forecastDays: number): PageConfig =>
  makePage({ slug, display: { ...defaultDisplay, forecastDays } });

// The reported problems, without the "Invalid weather config:" header. Empty
// when the config is valid.
const messagesFrom = (config: WeatherConfig): string[] => {
  try {
    validateAndResolve(config);
    return [];
  } catch (error) {
    return (error as Error).message.split('\n').slice(1);
  }
};

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

  // Each row breaks exactly one rule, which the length assertion enforces: a
  // config that trips a second rule fails here rather than passing quietly.
  // Patterns pin the rule text, not the page[n] prefix. The collect-every-error
  // test below owns the format.
  it.each<[string, WeatherConfig, RegExp]>([
    ['no pages', makeConfig({ pages: [] }), /at least one page required/],
    [
      'a page with no locations',
      makeConfig({ pages: [makePage({ locations: [] })] }),
      /at least one location required/,
    ],
    [
      'a malformed slug',
      makeConfig({ pages: [makePage({ slug: 'Bad Slug' })] }),
      /slug must be lowercase kebab-case/,
    ],
    [
      'a duplicate slug',
      makeConfig({
        pages: [makePage({ slug: 'dup' }), makePage({ slug: 'dup' })],
      }),
      /slug already used/,
    ],
    [
      'an empty title',
      makeConfig({ pages: [makePage({ title: '   ' })] }),
      /title must not be empty/,
    ],
    [
      'a fractional forecastDays',
      makeConfig({ pages: [pageWithDays('page', 3.5)] }),
      /forecastDays 3\.5 must be a whole number between 1 and 7/,
    ],
    [
      'a forecastDays one past the ceiling',
      makeConfig({ pages: [pageWithDays('page', 8)] }),
      /forecastDays 8 must be a whole number between 1 and 7/,
    ],
    [
      'a forecastDays below the floor',
      makeConfig({ pages: [pageWithDays('page', 0)] }),
      /forecastDays 0 must be a whole number between 1 and 7/,
    ],
    [
      'an empty display.current',
      makeConfig({
        pages: [makePage({ display: { ...defaultDisplay, current: [] } })],
      }),
      /display\.current must list at least one field/,
    ],
    [
      'a duplicated display.current field',
      makeConfig({
        pages: [
          makePage({
            display: {
              ...defaultDisplay,
              current: ['temperature', 'temperature'],
            },
          }),
        ],
      }),
      /display\.current has duplicate "temperature"/,
    ],
    [
      'an id repeated within a page',
      makeConfig({
        pages: [makePage({ locations: [makeLocation(), makeLocation()] })],
      }),
      /id "alpha" already used on this page/,
    ],
    [
      'an empty label',
      makeConfig({
        pages: [makePage({ locations: [makeLocation({ label: '' })] })],
      }),
      /label must not be empty/,
    ],
    [
      'a latitude out of range',
      makeConfig({
        pages: [makePage({ locations: [makeLocation({ latitude: 200 })] })],
      }),
      /latitude 200 must be between -90 and 90/,
    ],
    [
      'a longitude out of range',
      makeConfig({
        pages: [makePage({ locations: [makeLocation({ longitude: -500 })] })],
      }),
      /longitude -500 must be between -180 and 180/,
    ],
    [
      'one id meaning two places',
      makeConfig({
        pages: [
          makePage({ slug: 'p1', locations: [makeLocation({ latitude: 10 })] }),
          makePage({ slug: 'p2', locations: [makeLocation({ latitude: 30 })] }),
        ],
      }),
      /id "alpha" is 10,20 on page\[0\] "p1" but 30,20 here/,
    ],
  ])('rejects %s', (_name, config, pattern) => {
    const messages = messagesFrom(config);

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatch(pattern);
  });

  it('reports every problem in one throw, prefixed by location', () => {
    // One page-level and two location-level problems, so both prefix shapes
    // appear. The config-level shape can't join them: it only fires when there
    // are no pages, and then no page or location rule can run.
    const config = makeConfig({
      pages: [
        makePage({
          slug: 'Bad Slug',
          locations: [
            makeLocation({ label: '' }),
            makeLocation({ id: 'beta', latitude: 200 }),
          ],
        }),
      ],
    });

    expect(messagesFrom(config)).toEqual([
      'page[0] "Bad Slug": slug must be lowercase kebab-case',
      'page[0] "Bad Slug" location[0] "alpha": label must not be empty',
      'page[0] "Bad Slug" location[1] "beta": latitude 200 must be between -90 and 90',
    ]);
  });
});

// Not a unit test of validateAndResolve but of the config this repo ships, so a
// bad edit fails here as well as at synth. A fork that breaks its own config
// sees this test fail too, which is the point.
describe('the project config', () => {
  it('passes validation', () => {
    expect(() => validateAndResolve(projectConfig)).not.toThrow();
  });
});
