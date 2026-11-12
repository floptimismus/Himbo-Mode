import { describe, expect, it } from 'vitest';
import { DAILY_XP_CAP, MAX_FREEZES } from '../../shared/game/constants.ts';
import { emptyState, muscleLoad, processWorkout, replay, workoutTotals } from '../../shared/game/engine.ts';
import { systemMeta } from '../../shared/data/exercises/index.ts';
import { TROPHIES, evaluateTrophies, tierFor, trophyProgress, TROPHY_BY_ID } from '../../shared/game/trophies.ts';
import { bench, ctx, DAY, MIN, MON, set, simple, workout } from './helpers.ts';

describe('processWorkout', () => {
  it('awards XP, PBs and the first trophy for a first workout', () => {
    const { state, summary } = processWorkout(emptyState(), simple(MON), ctx);
    expect(summary.xp.sets).toBe(30);
    expect(summary.xp.pb).toBe(20);
    expect(summary.xp.total).toBe(30 + 20 + 20);
    expect(summary.pbs.map((p) => p.kind).sort()).toEqual(['e1rm', 'reps', 'volume', 'weight']);
    expect(summary.trophies).toContainEqual({ id: 'first_workout', tier: 1 });
    expect(summary).toMatchObject({ sets: 3, reps: 30, volumeKg: 1800, durationS: 3600, levelBefore: 1 });
    expect(state.totalXp).toBe(70);
    expect(state.pbs['barbell-bench-press']?.weight).toBe(60);
    expect(state.weeks['2026-01-05']).toMatchObject({ workouts: 1, xp: 70, goal: 3 });
  });

  it('does not mutate the previous state', () => {
    const prev = emptyState();
    processWorkout(prev, simple(MON), ctx);
    expect(prev).toEqual(emptyState());
  });

  it('only reports beaten records on later workouts', () => {
    const a = processWorkout(emptyState(), simple(MON), ctx);
    const b = processWorkout(a.state, workout(MON + DAY, [bench([set(65, 5)])]), ctx);
    expect(b.summary.pbs).toEqual([{ exerciseId: 'barbell-bench-press', kind: 'weight', value: 65, previous: 60 }]);
    const c = processWorkout(b.state, simple(MON + 2 * DAY), ctx);
    expect(c.summary.pbs).toEqual([]);
    expect(c.summary.xp.pb).toBe(0);
  });

  it('awards the weekly goal bonus exactly once and builds a streak', () => {
    let state = emptyState();
    const goalBonus: number[] = [];
    for (let week = 0; week < 2; week++) {
      for (let d = 0; d < 4; d++) {
        const r = processWorkout(state, simple(MON + week * 7 * DAY + d * DAY), ctx);
        state = r.state;
        goalBonus.push(r.summary.xp.weeklyGoal);
        if (week === 1 && d === 2) expect(r.summary.streak).toMatchObject({ before: 1, after: 2, goalHitNow: true, weekWorkouts: 3 });
      }
    }
    expect(goalBonus).toEqual([0, 0, 50, 0, 0, 0, 50, 0]);
    expect(state.stats.goalWeeks).toBe(2);
    expect(state.stats.bestStreak).toBe(2);
  });

  it('breaks the streak after a missed week', () => {
    let state = emptyState();
    for (let d = 0; d < 3; d++) state = processWorkout(state, simple(MON + d * DAY), ctx).state;
    const r = processWorkout(state, simple(MON + 14 * DAY), ctx);
    expect(r.summary.streak.before).toBe(0);
    expect(r.state.stats.settledWeek).toBe('2026-01-12');
  });

  it('consumes a banked freeze for a missed week and persists it', () => {
    let state = emptyState();
    for (let d = 0; d < 3; d++) state = processWorkout(state, simple(MON + d * DAY), ctx).state;
    state.freezes = 1;
    const r = processWorkout(state, simple(MON + 14 * DAY), ctx);
    expect(r.summary.streak.before).toBe(1);
    expect(r.state.freezes).toBe(0);
    expect(r.state.weeks['2026-01-12']?.frozen).toBe(true);
  });

  it('applies the daily XP cap', () => {
    let state = emptyState();
    let total = 0;
    for (let i = 0; i < 6; i++) {
      const big = workout(MON + i * 90 * MIN, [
        { exerciseId: 'rugby-training-session', sets: [{ type: 'normal', durationS: 5400, rpe: 10 }] },
        bench(Array.from({ length: 30 }, () => set(100, 20, 'failure'))),
      ], 90);
      const r = processWorkout(state, big, ctx);
      state = r.state;
      total += r.summary.xp.total;
    }
    expect(total).toBe(DAILY_XP_CAP);
    expect(state.totalXp).toBe(DAILY_XP_CAP);
  });

  it('ignores workouts without valid sets for goal, streak and trophies', () => {
    const r = processWorkout(emptyState(), workout(MON, [bench([{ type: 'normal', weightKg: 50 }])]), ctx);
    expect(r.summary.xp.total).toBe(0);
    expect(r.state.stats.workouts).toBe(0);
    expect(r.state.weeks['2026-01-05']?.workouts).toBe(0);
    expect(r.summary.trophies).toEqual([]);
  });

  it('tracks rugby, cardio and time-of-day counters', () => {
    const early = Date.UTC(2026, 0, 10, 5, 30); // Saturday 05:30
    const w = workout(early, [
      { exerciseId: 'rugby-training-session', sets: [{ type: 'normal', durationS: 3600, rpe: 7 }] },
      { exerciseId: 'running', sets: [{ type: 'normal', distanceM: 3000, durationS: 900 }] },
    ], 80);
    const { state, summary } = processWorkout(emptyState(), w, ctx);
    expect(state.stats).toMatchObject({ rugbySessions: 1, earlyBird: 1, weekend: 1, cardioDistanceM: 3000, cardioMinutes: 75 });
    expect(summary.distanceM).toBe(3000);
    expect(summary.trophies.map((t) => t.id)).toEqual(expect.arrayContaining(['rugby_sessions', 'early_bird', 'marathon']));
  });

  it('grants streak freezes for silver and gold tiers, capped', () => {
    const state = emptyState();
    state.stats.workouts = 49;
    state.trophies.workouts = { tier: 1, at: 0 };
    state.trophies.first_workout = { tier: 1, at: 0 };
    const r = processWorkout(state, simple(MON), ctx);
    expect(r.summary.trophies).toContainEqual({ id: 'workouts', tier: 2 });
    expect(r.state.freezes).toBe(1);
    expect(MAX_FREEZES).toBeGreaterThanOrEqual(1);
  });
});

describe('replay', () => {
  it('gives the same result as applying workouts one by one, regardless of input order', () => {
    const ws = [simple(MON), simple(MON + DAY), workout(MON + 2 * DAY, [bench([set(70, 5)])])];
    let state = emptyState();
    for (const w of ws) state = processWorkout(state, w, ctx).state;
    const r = replay([ws[2]!, ws[0]!, ws[1]!], ctx);
    expect(r.state).toEqual(state);
    expect(r.summaries.size).toBe(3);
  });
  it('keeps seeded non-workout counters', () => {
    expect(replay([], ctx, { following: 3 }).state.stats.following).toBe(3);
  });
});

describe('muscle load and totals', () => {
  it('weights primary 1 and secondary 0.5 per set, warm-ups half', () => {
    const load = muscleLoad([bench([set(60, 10), set(60, 10), set(40, 10, 'warmup')])], systemMeta);
    expect(load.chest).toBe(2.5);
    expect(load.triceps).toBe(1.25);
    expect(load.quads).toBeUndefined();
  });
  it('excludes warm-ups from volume but counts their reps', () => {
    expect(workoutTotals([bench([set(60, 10), set(40, 10, 'warmup')])], systemMeta)).toEqual({ volumeKg: 600, sets: 2, reps: 20, distanceM: 0 });
  });
});

describe('trophies', () => {
  it('defines at least 30 trophies with unique ids and both languages', () => {
    expect(TROPHIES.length).toBeGreaterThanOrEqual(30);
    expect(new Set(TROPHIES.map((t) => t.id)).size).toBe(TROPHIES.length);
    for (const t of TROPHIES) {
      expect([1, 3]).toContain(t.tiers.length);
      expect([...t.tiers].sort((a, b) => a - b)).toEqual([...t.tiers]);
      expect(t.name.en && t.name.de && t.desc.en && t.desc.de).toBeTruthy();
    }
  });
  it('maps values to tiers', () => {
    const def = TROPHY_BY_ID.get('workouts')!;
    expect([0, 10, 49, 50, 200, 9999].map((v) => tierFor(def, v))).toEqual([0, 1, 1, 2, 3, 3]);
  });
  it('reports progress towards the next tier', () => {
    const s = emptyState();
    s.stats.workouts = 25;
    const p = trophyProgress(TROPHY_BY_ID.get('workouts')!, s);
    expect(p).toMatchObject({ tier: 1, target: 50, ratio: 0.5, maxed: false });
  });
  it('only returns upgrades', () => {
    const s = emptyState();
    s.stats.workouts = 10;
    expect(evaluateTrophies(s, { first_workout: { tier: 1, at: 0 }, workouts: { tier: 1, at: 0 } })).toEqual([]);
    expect(evaluateTrophies(s, {})).toEqual([{ id: 'first_workout', tier: 1 }, { id: 'workouts', tier: 1 }]);
  });
  it('needs all three lifts for the Big Three', () => {
    const s = emptyState();
    s.stats.big3 = { squat: 150, bench: 100, deadlift: 0 };
    expect(TROPHY_BY_ID.get('big_three')!.metric(s)).toBe(0);
    s.stats.big3.deadlift = 180;
    expect(TROPHY_BY_ID.get('big_three')!.metric(s)).toBe(430);
  });
});
