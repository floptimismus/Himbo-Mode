import { describe, expect, it } from 'vitest';
import { systemMeta } from '../../shared/data/exercises/index.ts';
import { WORKOUT_XP_CAP } from '../../shared/game/constants.ts';
import type { GExercise } from '../../shared/game/types.ts';
import { durationBonus, intensity, strengthSetXp, workoutXp } from '../../shared/game/xp.ts';
import { bench, set } from './helpers.ts';

const base = { metaOf: systemMeta, durationS: 3600, pbExercises: 0, goalHitNow: false, streakWeeks: 0 };

describe('set XP', () => {
  it('gives 10 XP for a normal set of 10', () => expect(strengthSetXp('weight_reps', set(60, 10))).toBe(10));
  it('weights set types', () => {
    expect(strengthSetXp('weight_reps', set(60, 10, 'warmup'))).toBe(4);
    expect(strengthSetXp('weight_reps', set(60, 10, 'drop'))).toBe(8);
    expect(strengthSetXp('weight_reps', set(60, 10, 'failure'))).toBe(12);
  });
  it('clamps the effort factor between 0.7 and 1.4', () => {
    expect(strengthSetXp('weight_reps', set(200, 1))).toBeCloseTo(7);
    expect(strengthSetXp('weight_reps', set(20, 100))).toBeCloseTo(14);
  });
  it('scores holds by time', () => {
    expect(strengthSetXp('time', { type: 'normal', durationS: 45 })).toBe(10);
    expect(strengthSetXp('time', { type: 'normal', durationS: 600 })).toBe(20);
  });
  it('gives nothing for an empty set', () => expect(strengthSetXp('weight_reps', { type: 'normal' })).toBe(0));
});

describe('workout XP', () => {
  it('sums sets and the duration bonus', () => {
    const xp = workoutXp({ ...base, exercises: [bench([set(60, 10), set(60, 10), set(60, 10)])] });
    expect(xp).toMatchObject({ sets: 30, cardio: 0, duration: 20, total: 50, capped: false });
  });
  it('scores cardio by minutes and intensity', () => {
    const run: GExercise = { exerciseId: 'running', sets: [{ type: 'normal', distanceM: 5000, durationS: 1800 }] };
    expect(workoutXp({ ...base, exercises: [run] }).cardio).toBe(75); // 30 min × 2.5
    const rugby: GExercise = { exerciseId: 'rugby-training-session', sets: [{ type: 'normal', durationS: 3600, rpe: 10 }] };
    expect(workoutXp({ ...base, exercises: [rugby] }).cardio).toBe(210); // 60 × 2.5 × 1.4
  });
  it('never counts more cardio minutes than the workout lasted', () => {
    const fake: GExercise = { exerciseId: 'hiit', sets: [{ type: 'normal', durationS: 5 * 3600, rpe: 5 }] };
    const xp = workoutXp({ ...base, durationS: 600, exercises: [fake] });
    expect(xp.cardio).toBe(25); // 10 min × 2.5 × 1.0
  });
  it('keeps strength and cardio hours in the same ballpark', () => {
    const lifting = workoutXp({ ...base, exercises: [bench(Array.from({ length: 20 }, () => set(60, 10)))] }).total;
    const cardio = workoutXp({ ...base, exercises: [{ exerciseId: 'stationary-bike', sets: [{ type: 'normal', distanceM: 25000, durationS: 3600 }] }] }).total;
    expect(lifting / cardio).toBeGreaterThan(0.7);
    expect(lifting / cardio).toBeLessThan(1.5);
  });
  it('adds PB bonus for at most five exercises', () => {
    const ex = [bench([set(60, 10)])];
    expect(workoutXp({ ...base, exercises: ex, pbExercises: 2 }).pb).toBe(40);
    expect(workoutXp({ ...base, exercises: ex, pbExercises: 12 }).pb).toBe(100);
  });
  it('adds weekly goal and streak bonuses', () => {
    const ex = [bench(Array.from({ length: 10 }, () => set(60, 10)))];
    const xp = workoutXp({ ...base, exercises: ex, goalHitNow: true, streakWeeks: 5 });
    expect(xp.weeklyGoal).toBe(50);
    expect(xp.streak).toBe(10); // 100 × 2% × 5
    expect(workoutXp({ ...base, exercises: ex, streakWeeks: 99 }).streak).toBe(20); // capped at 10 weeks
  });
  it('gives no bonuses for an empty workout', () => {
    expect(workoutXp({ ...base, exercises: [], goalHitNow: true }).total).toBe(0);
  });
  it('caps a single workout', () => {
    const many = Array.from({ length: 10 }, () => bench(Array.from({ length: 30 }, () => set(100, 20, 'failure'))));
    const xp = workoutXp({ ...base, exercises: many, pbExercises: 5, goalHitNow: true, streakWeeks: 10 });
    expect(xp.total).toBe(WORKOUT_XP_CAP);
    expect(xp.capped).toBe(true);
    expect(xp.raw).toBeGreaterThan(WORKOUT_XP_CAP);
  });
  it('ignores unknown exercises', () => {
    expect(workoutXp({ ...base, exercises: [{ exerciseId: 'nope', sets: [set(500, 10)] }] }).total).toBe(0);
  });
});

describe('helpers', () => {
  it('maps RPE to intensity', () => {
    expect(intensity(5)).toBeCloseTo(1);
    expect(intensity(10)).toBeCloseTo(1.4);
    expect(intensity(undefined)).toBe(1);
  });
  it('picks the highest duration tier', () => {
    expect(durationBonus(10 * 60)).toBe(0);
    expect(durationBonus(20 * 60)).toBe(10);
    expect(durationBonus(50 * 60)).toBe(20);
    expect(durationBonus(3 * 3600)).toBe(30);
  });
});
