import { describe, expect, it } from 'vitest';
import { EXERCISES, EXERCISE_BY_ID } from '../../shared/data/exercises/index.ts';
import { EQUIPMENT, MUSCLES } from '../../shared/data/types.ts';
import { BIG_THREE } from '../../shared/game/constants.ts';
import { fromKg, toKg } from '../../shared/units.ts';

describe('exercise library', () => {
  it('has at least 120 exercises with unique ids', () => {
    expect(EXERCISES.length).toBeGreaterThanOrEqual(120);
    expect(EXERCISE_BY_ID.size).toBe(EXERCISES.length);
  });
  it('covers every equipment type and muscle', () => {
    for (const eq of EQUIPMENT) expect(EXERCISES.some((x) => x.equipment === eq), eq).toBe(true);
    for (const m of MUSCLES) expect(EXERCISES.some((x) => x.primary.includes(m)), m).toBe(true);
  });
  it('has complete localized texts and sane muscle lists', () => {
    for (const x of EXERCISES) {
      expect(x.id).toMatch(/^[a-z0-9-]+$/);
      expect(x.name.en.length, x.id).toBeGreaterThan(2);
      expect(x.name.de.length, x.id).toBeGreaterThan(2);
      expect(x.desc.en.length, x.id).toBeGreaterThan(40);
      expect(x.desc.de.length, x.id).toBeGreaterThan(40);
      expect(x.primary.length, x.id).toBeGreaterThan(0);
      expect(x.primary.filter((m) => x.secondary.includes(m)), x.id).toEqual([]);
    }
  });
  it('contains the Big Three lifts', () => {
    for (const id of Object.values(BIG_THREE)) expect(EXERCISE_BY_ID.has(id)).toBe(true);
  });
});

describe('units', () => {
  it('round-trips pounds through kg', () => {
    for (const lb of [45, 135, 225, 315, 2.5]) expect(fromKg(toKg(lb, 'lb'), 'lb')).toBe(lb);
  });
  it('leaves kg alone', () => expect(fromKg(toKg(62.5, 'kg'), 'kg')).toBe(62.5));
});
