import { describe, expect, it } from 'vitest';
import { computeFare, haversineKm, type VerifiedMode } from './fare';

// SYNTHETIC TEST FIXTURE ONLY. These numbers are NOT an LTFRB matrix; they exercise the arithmetic.
// Matrix: base 10.00 for the first 4 km, then 2.00 per extra km, rounded to nearest 0.25.
const fx: VerifiedMode = {
  id: 'fixture', name: { en: 'fx', tl: 'fx' }, status: 'verified',
  baseFare: 10, baseKm: 4, perKm: 2, rounding: 'nearest-0.25',
  source: { memo: 'TEST', effectiveDate: '2000-01-01', url: 'https://example.com' },
};

describe('computeFare', () => {
  it('charges the base fare within the base distance', () => {
    expect(computeFare(fx, 0, 0.2).regular).toBe(10);
    expect(computeFare(fx, 4, 0.2).regular).toBe(10);
    expect(computeFare(fx, 4, 0.2).discounted).toBe(8); // 10 * 0.8
  });
  it('adds per-km just over base', () => {
    expect(computeFare(fx, 5, 0.2).regular).toBe(12); // 10 + 1*2
    expect(computeFare(fx, 5, 0.2).discounted).toBe(9.5); // 12 * 0.8 = 9.6 -> nearest 0.25 = 9.5
  });
  it('pro-rates fractional km and rounds', () => {
    expect(computeFare(fx, 4.3, 0).regular).toBe(10.5); // 10.6 -> 10.5
    expect(computeFare(fx, 5.3, 0).regular).toBe(12.5); // 12.6 -> 12.5
  });
  it('handles long trips', () => {
    expect(computeFare(fx, 40, 0.2).regular).toBe(82); // 10 + 36*2
    expect(computeFare(fx, 40, 0.2).discounted).toBe(65.5); // 65.6 -> 65.5
  });
  it('applies each rounding rule (raw 10.6)', () => {
    const r = (rounding: VerifiedMode['rounding']) => computeFare({ ...fx, rounding }, 4.3, 0).regular;
    expect(r('none')).toBe(10.6);
    expect(r('nearest-0.5')).toBe(10.5);
    expect(r('nearest-1')).toBe(11);
    expect(r('ceil-1')).toBe(11);
  });
  it('rejects bad input', () => {
    expect(() => computeFare(fx, -1, 0.2)).toThrow();
    expect(() => computeFare(fx, NaN, 0.2)).toThrow();
  });
});

describe('haversineKm', () => {
  it('is ~111.2 km per degree of latitude', () => {
    expect(haversineKm([121, 14], [121, 15])).toBeCloseTo(111.19, 1);
  });
});
