/** UX upper bound for the distance input (not a legal fare cap). Above this the app asks the user to check the posted matrix. */
export const MAX_KM = 200;

const pesoFmt = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
export const peso = (n: number) => pesoFmt.format(n);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** '2026-09-28' -> '28 Sep 2026' */
export function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

export type DistanceState = { kind: 'empty' } | { kind: 'tooFar' } | { kind: 'ok'; km: number };

/** 0, negative, NaN and blank are all treated as "no distance entered". */
export function classifyDistance(km: number | null): DistanceState {
  if (km === null || !Number.isFinite(km) || km <= 0) return { kind: 'empty' };
  if (km > MAX_KM) return { kind: 'tooFar' };
  return { kind: 'ok', km };
}
