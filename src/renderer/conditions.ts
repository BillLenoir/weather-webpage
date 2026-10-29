// WMO weather codes as Open-Meteo reports them, mapped to what a page shows.
//
// Icons are per group, so several codes share one — emoji can't tell drizzle
// from rain, or light snow from heavy. Labels are per code and carry the
// intensity the icon can't. Labels are sentence case.
//
// Only the clear-sky codes vary by isDay: rain at night is still rain. At
// night, Clear and Mainly clear show the moon and Partly cloudy shows a cloud,
// because the question those rows answer is whether you'll see the stars.
//
// The variation selector U+FE0F appears only where the glyph needs it. Several
// of the U+1F3xx weather symbols are text-presentation by default, while 🌙,
// ⛅ and ❓ are emoji by default and take no selector.

export interface Condition {
  readonly label: string;
  readonly icon: string;
  readonly nightIcon?: string;
}

// A Map rather than a Record so `.get()` returns `Condition | undefined` and
// the unknown-code fallback is driven by the type rather than by a defensive
// check the compiler believes is unnecessary.
export const CONDITIONS: ReadonlyMap<number, Condition> = new Map([
  [0, { label: 'Clear', icon: '☀️', nightIcon: '🌙' }],
  [1, { label: 'Mainly clear', icon: '🌤️', nightIcon: '🌙' }],
  [2, { label: 'Partly cloudy', icon: '⛅', nightIcon: '☁️' }],
  [3, { label: 'Overcast', icon: '☁️' }],

  [45, { label: 'Fog', icon: '🌫️' }],
  [48, { label: 'Rime fog', icon: '🌫️' }],

  [51, { label: 'Light drizzle', icon: '🌦️' }],
  [53, { label: 'Drizzle', icon: '🌦️' }],
  [55, { label: 'Heavy drizzle', icon: '🌦️' }],

  [56, { label: 'Light freezing drizzle', icon: '🌧️' }],
  [57, { label: 'Heavy freezing drizzle', icon: '🌧️' }],

  [61, { label: 'Light rain', icon: '🌧️' }],
  [63, { label: 'Rain', icon: '🌧️' }],
  [65, { label: 'Heavy rain', icon: '🌧️' }],

  [66, { label: 'Light freezing rain', icon: '🌧️' }],
  [67, { label: 'Heavy freezing rain', icon: '🌧️' }],

  [71, { label: 'Light snow', icon: '🌨️' }],
  [73, { label: 'Snow', icon: '🌨️' }],
  [75, { label: 'Heavy snow', icon: '🌨️' }],
  [77, { label: 'Snow grains', icon: '🌨️' }],

  [80, { label: 'Light showers', icon: '🌦️' }],
  [81, { label: 'Showers', icon: '🌦️' }],
  [82, { label: 'Heavy showers', icon: '🌦️' }],

  [85, { label: 'Light snow showers', icon: '🌨️' }],
  [86, { label: 'Heavy snow showers', icon: '🌨️' }],

  [95, { label: 'Thunderstorm', icon: '⛈️' }],
  [96, { label: 'Thunderstorm with hail', icon: '⛈️' }],
  [99, { label: 'Thunderstorm with heavy hail', icon: '⛈️' }],
]);

/**
 * The label and icon for a WMO code, with the night icon where the code has
 * one.
 *
 * An unrecognized code falls back rather than throwing: this is the one place
 * the renderer doesn't fail loudly, because a code the provider added should
 * cost one odd-looking cell, not the whole page. The code is logged so it can
 * be added to the table later.
 */
export const describeCondition = ({
  code,
  isDay,
}: {
  code: number;
  isDay: boolean;
}): { label: string; icon: string } => {
  const condition = CONDITIONS.get(code);

  if (condition === undefined) {
    console.error(`conditions: unknown WMO code ${code}`);
    return { label: `Unknown (${code})`, icon: '❓' };
  }

  return {
    label: condition.label,
    icon: !isDay && condition.nightIcon ? condition.nightIcon : condition.icon,
  };
};
