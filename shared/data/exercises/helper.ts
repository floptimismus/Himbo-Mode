import type { Category, Equipment, Exercise, Muscle, Tracking } from '../types.ts';

/** Compact constructor for the exercise library files. */
export function e(
  id: string,
  equipment: Equipment,
  tracking: Tracking,
  primary: Muscle[],
  secondary: Muscle[],
  nameEn: string,
  nameDe: string,
  descEn: string,
  descDe: string,
  category: Category = 'strength',
): Exercise {
  return { id, equipment, tracking, primary, secondary, category, name: { en: nameEn, de: nameDe }, desc: { en: descEn, de: descDe } };
}
