export type Rounding = 'none' | 'nearest-0.25' | 'nearest-0.5' | 'nearest-1' | 'ceil-1';

export interface Source {
  memo: string;
  effectiveDate: string; // YYYY-MM-DD
  url: string;
}

interface ModeBase {
  id: string;
  name: { en: string; tl: string };
}

export interface VerifiedMode extends ModeBase {
  status: 'verified';
  baseFare: number;
  baseKm: number;
  perKm: number;
  rounding: Rounding;
  source: Source;
}

export interface UnverifiedMode extends ModeBase {
  status: 'unverified';
}

export type Mode = VerifiedMode | UnverifiedMode;

export interface FareResult {
  regular: number;
  discounted: number;
  extraKm: number;
  extraCost: number;
}

export function round(value: number, rule: Rounding): number {
  const v = Math.round(value * 1e6) / 1e6; // strip float noise
  switch (rule) {
    case 'none': return Math.round(v * 100) / 100;
    case 'nearest-0.25': return Math.round(v * 4) / 4;
    case 'nearest-0.5': return Math.round(v * 2) / 2;
    case 'nearest-1': return Math.round(v);
    case 'ceil-1': return Math.ceil(v);
  }
}

/** Fare = base for the first baseKm, then perKm for every extra km (fractions pro-rated). */
export function computeFare(m: VerifiedMode, km: number, discountRate: number): FareResult {
  if (!Number.isFinite(km) || km < 0) throw new RangeError('km must be a non-negative number');
  const extraKm = Math.max(0, km - m.baseKm);
  const extraCost = extraKm * m.perKm;
  const raw = m.baseFare + extraCost;
  return {
    regular: round(raw, m.rounding),
    discounted: round(raw * (1 - discountRate), m.rounding),
    extraKm,
    extraCost,
  };
}

/** Great-circle distance in km. */
export function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371.0088;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b[1] - a[1]);
  const dLon = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
