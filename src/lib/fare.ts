export interface Source {
  name: string;
  url: string;
}

export interface Tariff {
  base: number;
  perKm: number;
}

interface ModeBase {
  id: string;
  name: { en: string; tl: string };
}

export interface NewsVerifiedMode extends ModeBase {
  status: 'verified-news';
  effective: string; // YYYY-MM-DD
  sourceType: string;
  officialMatrixVerified: boolean;
  sources: Source[];
  baseKm: number;
  regular: Tariff;
  /** Published discounted tariff. Absent when only the 20% statutory discount applies (UV Express). */
  discounted?: Tariff;
}

export interface UnverifiedMode extends ModeBase {
  status: 'unverified';
}

export type Mode = NewsVerifiedMode | UnverifiedMode;

export interface FareResult {
  regular: number;
  discounted: number;
  extraKm: number;
  extraCost: number;
  /** True when discounted was derived as regular x (1 - rate) rather than a published figure. */
  discountDerived: boolean;
}

// Strips float noise only (to centavos). This is NOT an LTFRB rounding rule.
const centavos = (v: number) => Math.round(v * 100 + 1e-9) / 100;

function tariffFare(t: Tariff, baseKm: number, km: number) {
  const extraKm = Math.max(0, km - baseKm);
  const extraCost = extraKm * t.perKm;
  return { extraKm, extraCost, total: t.base + extraCost };
}

/** Fare = base for the first baseKm, then perKm for every extra km (fractions pro-rated). No LTFRB rounding applied. */
export function computeFare(m: NewsVerifiedMode, km: number, discountRate: number): FareResult {
  if (!Number.isFinite(km) || km < 0) throw new RangeError('km must be a non-negative number');
  const reg = tariffFare(m.regular, m.baseKm, km);
  const disc = m.discounted ? tariffFare(m.discounted, m.baseKm, km).total : reg.total * (1 - discountRate);
  return {
    regular: centavos(reg.total),
    discounted: centavos(disc),
    extraKm: reg.extraKm,
    extraCost: reg.extraCost,
    discountDerived: !m.discounted,
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
