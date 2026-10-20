import { formatTemperature } from '../../src/renderer/format';

describe('formatTemperature', () => {
  it('formats zero Celsius in metric units', () => {
    expect(formatTemperature({ celsius: 0, units: 'C' })).toBe('0°');
  });

  it('formats zero Celsius in imperial units', () => {
    expect(formatTemperature({ celsius: 0, units: 'F' })).toBe('32°');
  });

  it('formats a negative metric temperature', () => {
    expect(formatTemperature({ celsius: -1.2, units: 'C' })).toBe('-1°');
  });

  it('uses Math.round behavior for negative halves', () => {
    expect(formatTemperature({ celsius: -2.5, units: 'C' })).toBe('-2°');
  });

  it('normalizes a rounded negative zero', () => {
    expect(formatTemperature({ celsius: -0.1, units: 'C' })).toBe('0°');
  });

  it('converts before rounding imperial output', () => {
    expect(formatTemperature({ celsius: 0.4, units: 'F' })).toBe('33°');
  });
});
