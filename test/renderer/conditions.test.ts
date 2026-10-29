import { CONDITIONS, describeCondition } from '../../src/renderer/conditions';

// One glyph, rendered in color: either a character that is emoji by default,
// or one followed by the U+FE0F variation selector. The anchors are what catch
// a pasted pair, which a length check can't — a correctly written '☀️' is two
// code points.
const ONE_EMOJI = /^(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F)$/u;

describe('CONDITIONS', () => {
  it('covers the 28 codes Open-Meteo reports', () => {
    expect(CONDITIONS.size).toBe(28);
  });

  it.each([...CONDITIONS.entries()])(
    'code %i has a sentence case label and single icons',
    (_code, condition) => {
      expect(condition.label.trim()).not.toBe('');
      expect(condition.label[0]).toBe(condition.label[0]?.toUpperCase());
      expect(condition.icon).toMatch(ONE_EMOJI);

      if (condition.nightIcon !== undefined) {
        expect(condition.nightIcon).toMatch(ONE_EMOJI);
      }
    },
  );

  it('gives codes sharing an icon different labels', () => {
    const light = CONDITIONS.get(51);
    const heavy = CONDITIONS.get(55);

    // The whole point of per-code labels: the icon can't tell these apart.
    expect(light?.icon).toBe(heavy?.icon);
    expect(light?.label).not.toBe(heavy?.label);
  });

  it('gives a night icon only to the clear-sky codes', () => {
    const withNightIcon = [...CONDITIONS.entries()]
      .filter(([, condition]) => condition.nightIcon !== undefined)
      .map(([code]) => code);

    expect(withNightIcon).toEqual([0, 1, 2]);
  });
});

describe('describeCondition', () => {
  it('swaps the icon at night for a clear-sky code', () => {
    const day = describeCondition({ code: 0, isDay: true });
    const night = describeCondition({ code: 0, isDay: false });

    expect(day).toEqual({ label: 'Clear', icon: '☀️' });
    expect(night).toEqual({ label: 'Clear', icon: '🌙' });
  });

  it('shows a cloud for Partly cloudy at night, not the moon', () => {
    // Someone reading at 2am wants to know whether they'll see the stars.
    expect(describeCondition({ code: 2, isDay: false })).toEqual({
      label: 'Partly cloudy',
      icon: '☁️',
    });
  });

  it('distinguishes Partly cloudy at night from Overcast by label alone', () => {
    const partly = describeCondition({ code: 2, isDay: false });
    const overcast = describeCondition({ code: 3, isDay: false });

    expect(partly.icon).toBe(overcast.icon);
    expect(partly.label).not.toBe(overcast.label);
  });

  it('keeps the same icon day and night for a code without a night variant', () => {
    const day = describeCondition({ code: 63, isDay: true });
    const night = describeCondition({ code: 63, isDay: false });

    expect(night).toEqual(day);
    expect(day).toEqual({ label: 'Rain', icon: '🌧️' });
  });

  describe('an unrecognized code', () => {
    let logged: jest.SpyInstance;

    beforeEach(() => {
      logged = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      logged.mockRestore();
    });

    it('falls back instead of throwing', () => {
      expect(describeCondition({ code: 101, isDay: true })).toEqual({
        label: 'Unknown (101)',
        icon: '❓',
      });
    });

    it('logs the code so it can be added to the table', () => {
      describeCondition({ code: 101, isDay: true });

      expect(logged).toHaveBeenCalledWith('conditions: unknown WMO code 101');
    });

    it('falls back the same way at night', () => {
      expect(describeCondition({ code: 101, isDay: false })).toEqual({
        label: 'Unknown (101)',
        icon: '❓',
      });
    });
  });
});
