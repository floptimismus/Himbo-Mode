import type { Tracking } from '../data/types.ts';
import { E1RM_MAX_REPS, PACE_MIN_DISTANCE_M } from './constants.ts';
import type { GSet, NewPb, PbKind, PbMap } from './types.ts';

/** Estimated one-rep max (Epley): w × (1 + reps / 30); a single is the weight itself. */
export function epley(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

/** Pace in seconds per kilometre. */
export function paceSecPerKm(distanceM: number, durationS: number): number {
  return durationS / (distanceM / 1000);
}

/** Whether a logged set is complete enough to count for the given tracking type. */
export function isValidSet(tracking: Tracking, s: GSet): boolean {
  switch (tracking) {
    case 'weight_reps':
    case 'reps':
      return (s.reps ?? 0) >= 1;
    case 'time':
    case 'duration_rpe':
      return (s.durationS ?? 0) > 0;
    case 'distance_time':
      return (s.distanceM ?? 0) > 0 || (s.durationS ?? 0) > 0;
  }
}

/** Lower is better only for pace. */
export function isBetter(kind: PbKind, value: number, previous: number | undefined | null): boolean {
  if (previous == null) return true;
  return kind === 'pace' ? value < previous - 1e-9 : value > previous + 1e-9;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Best values of one exercise within a single workout. Warm-up sets never count. */
export function exerciseBests(tracking: Tracking, sets: GSet[]): PbMap {
  const out: PbMap = {};
  const put = (kind: PbKind, v: number) => {
    if (v > 0 && isBetter(kind, v, out[kind])) out[kind] = round2(v);
  };
  let volume = 0;
  for (const s of sets) {
    if (s.type === 'warmup' || !isValidSet(tracking, s)) continue;
    const w = s.weightKg ?? 0;
    const reps = s.reps ?? 0;
    const dur = s.durationS ?? 0;
    const dist = s.distanceM ?? 0;
    if (tracking === 'weight_reps') {
      put('weight', w);
      if (reps <= E1RM_MAX_REPS) put('e1rm', epley(w, reps));
      put('reps', reps);
      volume += w * reps;
    } else if (tracking === 'reps') {
      put('reps', reps);
      volume += reps;
    } else if (tracking === 'time' || tracking === 'duration_rpe') {
      put('duration', dur);
    } else {
      put('distance', dist);
      put('duration', dur);
      if (dist >= PACE_MIN_DISTANCE_M && dur > 0) put('pace', paceSecPerKm(dist, dur));
    }
  }
  put('volume', volume);
  return out;
}

/** Compare a workout's bests with the stored records; returns the records that were beaten. */
export function findNewPbs(exerciseId: string, bests: PbMap, records: PbMap | undefined): NewPb[] {
  const out: NewPb[] = [];
  for (const [kind, value] of Object.entries(bests) as Array<[PbKind, number]>) {
    const previous = records?.[kind];
    if (isBetter(kind, value, previous)) out.push({ exerciseId, kind, value, previous: previous ?? null });
  }
  return out;
}
