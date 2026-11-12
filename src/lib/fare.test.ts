import { describe, expect, it } from 'vitest';
import data from '../data/fares.json';
import { classifyDistance, formatDate, MAX_KM, peso } from './format';
import { computeFare, haversineKm, type Mode, type NewsVerifiedMode } from './fare';

// Cases built from the fares in force since 28 Sep 2026 (news reports of the LTFRB fare guide; see fares.json).
const modes = data.modes as Mode[];
const get = (id: string) => modes.find((m) => m.id === id) as NewsVerifiedMode;
const RATE = data.discount.rate;

describe('computeFare', () => {
  it('PUJ traditional', () => {
    const m = get('puj');
    expect(computeFare(m, 4, RATE).regular).toBe(14);
    expect(computeFare(m, 6, RATE).regular).toBe(18); // 14 + 2*2
    expect(computeFare(m, 6, RATE).discounted).toBe(14.45); // 11.25 + 2*1.60 (published figures)
  });
  it('MPUJ discounted uses the published figures', () => {
    const r = computeFare(get('mpuj'), 6, RATE);
    expect(r.discounted).toBe(17.34); // 13.50 + 2*1.92
    expect(r.regular).toBe(21.8); // 17 + 2*2.40
    expect(r.discountDerived).toBe(false);
  });
  it('city bus ordinary', () => {
    const r = computeFare(get('bus-ordinary'), 7, RATE);
    expect(r.regular).toBe(19.98); // 15 + 2*2.49
    expect(r.discounted).toBe(15.98); // 12 + 2*1.99
  });
  it('city bus aircon', () => {
    const r = computeFare(get('bus-aircon'), 7, RATE);
    expect(r.regular).toBe(23.96); // 18 + 2*2.98
    expect(r.discounted).toBe(19.26); // 14.50 + 2*2.38
  });
  it('returns the base fare at or under base km', () => {
    for (const id of ['puj', 'mpuj', 'bus-ordinary', 'bus-aircon']) {
      const m = get(id);
      for (const km of [0, 1, m.baseKm]) {
        const r = computeFare(m, km, RATE);
        expect(r.regular).toBe(m.regular.base);
        expect(r.discounted).toBe(m.discounted!.base);
        expect(r.extraKm).toBe(0);
      }
    }
  });
  it('UV Express is per km only with the 20% statutory discount', () => {
    const t = computeFare(get('uv-traditional'), 10, RATE);
    expect(t.regular).toBe(26);
    expect(t.discounted).toBe(20.8);
    expect(t.discountDerived).toBe(true);
    expect(computeFare(get('uv-modern'), 10, RATE).regular).toBe(30);
    expect(computeFare(get('uv-modern'), 0, RATE).regular).toBe(0);
  });
  it('pro-rates fractional km without an LTFRB rounding rule', () => {
    expect(computeFare(get('puj'), 4.5, RATE).regular).toBe(15); // 14 + 0.5*2
    expect(computeFare(get('bus-ordinary'), 5.3, RATE).regular).toBe(15.75); // 15 + 0.3*2.49 = 15.747
  });
  it('rejects bad input', () => {
    expect(() => computeFare(get('puj'), -1, RATE)).toThrow();
    expect(() => computeFare(get('puj'), NaN, RATE)).toThrow();
  });
});

describe('format helpers', () => {
  it('formats pesos with thousands separators', () => {
    expect(peso(14)).toBe('₱14.00');
    expect(peso(2000006)).toBe('₱2,000,006.00');
  });
  it('formats dates as D Mon YYYY', () => {
    expect(formatDate('2026-09-28')).toBe('28 Sep 2026');
  });
  it('treats 0 km, blank and bad input as empty', () => {
    expect(classifyDistance(0).kind).toBe('empty');
    expect(classifyDistance(null).kind).toBe('empty');
    expect(classifyDistance(-3).kind).toBe('empty');
    expect(classifyDistance(NaN).kind).toBe('empty');
    expect(classifyDistance(0.1)).toEqual({ kind: 'ok', km: 0.1 });
  });
  it('caps the distance at MAX_KM', () => {
    expect(classifyDistance(MAX_KM).kind).toBe('ok');
    expect(classifyDistance(MAX_KM + 0.1).kind).toBe('tooFar');
    expect(classifyDistance(1e6).kind).toBe('tooFar');
  });
  it('matches the values rendered in the OG preview (6 km)', () => {
    const f = (id: string) => computeFare(get(id), 6, RATE);
    expect([f('puj').regular, f('puj').discounted]).toEqual([18, 14.45]);
    expect([f('mpuj').regular, f('mpuj').discounted]).toEqual([21.8, 17.34]);
    expect([f('bus-ordinary').regular, f('bus-ordinary').discounted]).toEqual([17.49, 13.99]);
  });
  it('discounted worked example (4 km base + 3.30 km)', () => {
    expect(computeFare(get('puj'), 7.3, RATE).discounted).toBe(16.53); // 11.25 + 3.30 * 1.60
  });
});

describe('haversineKm', () => {
  it('is ~111.2 km per degree of latitude', () => {
    expect(haversineKm([121, 14], [121, 15])).toBeCloseTo(111.19, 1);
  });
});
