export type Units = 'kg' | 'lb';

export const LB_PER_KG = 2.2046226218;

/** Stored kg → value in the user's unit, rounded to one decimal. */
export function fromKg(kg: number, units: Units): number {
  const v = units === 'lb' ? kg * LB_PER_KG : kg;
  return Math.round(v * 10) / 10;
}

/** Value typed by the user → kg (kept precise so lb values round-trip). */
export function toKg(value: number, units: Units): number {
  const kg = units === 'lb' ? value / LB_PER_KG : value;
  return Math.round(kg * 1000) / 1000;
}

/** Metres ↔ the distance unit that matches the weight unit (km or miles). */
export const M_PER_MILE = 1609.344;
export function fromMetres(m: number, units: Units): number {
  const v = units === 'lb' ? m / M_PER_MILE : m / 1000;
  return Math.round(v * 100) / 100;
}
export function toMetres(value: number, units: Units): number {
  return Math.round(units === 'lb' ? value * M_PER_MILE : value * 1000);
}
export const distanceUnit = (units: Units) => (units === 'lb' ? 'mi' : 'km');
