import { describe, expect, it } from 'vitest';
import { epley, exerciseBests, findNewPbs, isBetter, isValidSet, paceSecPerKm } from '../../shared/game/pb.ts';

describe('epley 1RM', () => {
  it('returns the weight itself for a single', () => expect(epley(100, 1)).toBe(100));
  it('applies w × (1 + reps/30)', () => {
    expect(epley(100, 10)).toBeCloseTo(133.33, 2);
    expect(epley(60, 5)).toBeCloseTo(70, 5);
  });
  it('is 0 for missing weight or reps', () => {
    expect(epley(0, 5)).toBe(0);
    expect(epley(50, 0)).toBe(0);
  });
});

describe('exerciseBests', () => {
  it('finds heaviest weight, best e1RM, most reps and volume for weight×reps', () => {
    const b = exerciseBests('weight_reps', [
      { type: 'warmup', weightKg: 200, reps: 1 },
      { type: 'normal', weightKg: 100, reps: 5 },
      { type: 'normal', weightKg: 80, reps: 12 },
      { type: 'drop', weightKg: 40, reps: 20 },
    ]);
    expect(b.weight).toBe(100); // warm-up is ignored
    expect(b.e1rm).toBeCloseTo(116.67, 2); // 100×5 beats 80×12 (112)
    expect(b.reps).toBe(20);
    expect(b.volume).toBe(100 * 5 + 80 * 12 + 40 * 20);
  });
  it('ignores sets above the e1RM rep limit for the estimate', () => {
    expect(exerciseBests('weight_reps', [{ type: 'normal', weightKg: 50, reps: 30 }]).e1rm).toBeUndefined();
  });
  it('tracks reps-only exercises', () => {
    const b = exerciseBests('reps', [{ type: 'normal', reps: 12 }, { type: 'normal', reps: 8 }]);
    expect(b).toEqual({ reps: 12, volume: 20 });
  });
  it('tracks longest distance, duration and fastest pace for cardio', () => {
    const b = exerciseBests('distance_time', [
      { type: 'normal', distanceM: 5000, durationS: 1500 },
      { type: 'normal', distanceM: 10000, durationS: 3300 },
      { type: 'normal', distanceM: 400, durationS: 60 }, // too short for a pace record
    ]);
    expect(b.distance).toBe(10000);
    expect(b.duration).toBe(3300);
    expect(b.pace).toBe(300);
  });
  it('tracks hold time', () => {
    expect(exerciseBests('time', [{ type: 'normal', durationS: 90 }]).duration).toBe(90);
  });
});

describe('PB comparison', () => {
  it('treats lower pace as better and higher everything else', () => {
    expect(isBetter('pace', 290, 300)).toBe(true);
    expect(isBetter('pace', 310, 300)).toBe(false);
    expect(isBetter('weight', 101, 100)).toBe(true);
    expect(isBetter('weight', 100, 100)).toBe(false);
    expect(isBetter('reps', 5, undefined)).toBe(true);
  });
  it('lists only beaten records', () => {
    const pbs = findNewPbs('x', { weight: 100, reps: 8 }, { weight: 100, reps: 6 });
    expect(pbs).toEqual([{ exerciseId: 'x', kind: 'reps', value: 8, previous: 6 }]);
  });
  it('computes pace per km', () => expect(paceSecPerKm(5000, 1500)).toBe(300));
  it('validates sets per tracking type', () => {
    expect(isValidSet('weight_reps', { type: 'normal', weightKg: 50 })).toBe(false);
    expect(isValidSet('reps', { type: 'normal', reps: 1 })).toBe(true);
    expect(isValidSet('duration_rpe', { type: 'normal', rpe: 7 })).toBe(false);
    expect(isValidSet('distance_time', { type: 'normal', distanceM: 100 })).toBe(true);
  });
});
