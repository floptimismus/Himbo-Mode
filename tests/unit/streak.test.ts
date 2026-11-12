import { describe, expect, it } from 'vitest';
import { addWeeks, computeStreak, localParts, weekInDanger, weekKey } from '../../shared/game/streak.ts';
import type { Weeks } from '../../shared/game/types.ts';
import { DAY, MON } from './helpers.ts';

const met = { workouts: 3, xp: 0, goal: 3 };
const missed = { workouts: 1, xp: 0, goal: 3 };

describe('week keys', () => {
  it('uses the Monday of the week', () => {
    expect(weekKey(MON, 0)).toBe('2026-01-05');
    expect(weekKey(MON + 6 * DAY, 0)).toBe('2026-01-05'); // Sunday
    expect(weekKey(MON + 7 * DAY, 0)).toBe('2026-01-12');
  });
  it('respects the time zone offset', () => {
    const sundayLateUtc = Date.UTC(2026, 0, 4, 23, 30);
    expect(weekKey(sundayLateUtc, 0)).toBe('2025-12-29');
    expect(weekKey(sundayLateUtc, 60)).toBe('2026-01-05'); // already Monday in UTC+1
  });
  it('adds weeks across year boundaries', () => {
    expect(addWeeks('2025-12-29', 1)).toBe('2026-01-05');
    expect(addWeeks('2026-01-05', -2)).toBe('2025-12-22');
  });
  it('gives local hour and weekday', () => {
    expect(localParts(Date.UTC(2026, 0, 5, 5, 0), 120)).toMatchObject({ hour: 7, weekday: 0, dateKey: '2026-01-05' });
    expect(localParts(Date.UTC(2026, 0, 10, 12, 0), 0).weekday).toBe(5); // Saturday
  });
});

describe('computeStreak', () => {
  it('is 0 without history', () => expect(computeStreak({}, '2026-01-05', 0).streak).toBe(0));
  it('counts consecutive met weeks including a met current week', () => {
    const weeks: Weeks = { '2026-01-05': met, '2026-01-12': met, '2026-01-19': met };
    expect(computeStreak(weeks, '2026-01-19', 0).streak).toBe(3);
  });
  it('does not break on an unfinished current week', () => {
    const weeks: Weeks = { '2026-01-05': met, '2026-01-12': met, '2026-01-19': missed };
    const r = computeStreak(weeks, '2026-01-19', 0);
    expect(r.streak).toBe(2);
    expect(r.currentMet).toBe(false);
  });
  it('resets after a missed week', () => {
    const weeks: Weeks = { '2026-01-05': met, '2026-01-12': missed, '2026-01-19': met };
    expect(computeStreak(weeks, '2026-01-26', 0).streak).toBe(1);
  });
  it('resets after a week with no workouts at all', () => {
    const weeks: Weeks = { '2026-01-05': met, '2026-01-19': met };
    const r = computeStreak(weeks, '2026-01-19', 0);
    expect(r.streak).toBe(1);
    expect(r.best).toBe(1);
  });
  it('uses a freeze to bridge a missed week without counting it', () => {
    const weeks: Weeks = { '2026-01-05': met, '2026-01-19': met };
    const r = computeStreak(weeks, '2026-01-19', 1);
    expect(r.streak).toBe(2);
    expect(r.freezes).toBe(0);
    expect(r.newlyFrozen).toEqual(['2026-01-12']);
  });
  it('honours weeks already marked as frozen', () => {
    const weeks: Weeks = { '2026-01-05': met, '2026-01-12': { workouts: 0, xp: 0, goal: 3, frozen: true }, '2026-01-19': met };
    expect(computeStreak(weeks, '2026-01-19', 0).streak).toBe(2);
  });
  it('never spends freezes on weeks that are already settled', () => {
    const weeks: Weeks = { '2026-01-05': met, '2026-01-19': met };
    const r = computeStreak(weeks, '2026-01-19', 2, '2026-01-12');
    expect(r.streak).toBe(1);
    expect(r.freezes).toBe(2);
  });
  it('does not waste a freeze when there is no streak to protect', () => {
    const weeks: Weeks = { '2026-01-05': missed, '2026-01-19': met };
    expect(computeStreak(weeks, '2026-01-19', 1).freezes).toBe(1);
  });
  it('tracks the best streak', () => {
    const weeks: Weeks = { '2026-01-05': met, '2026-01-12': met, '2026-01-19': met, '2026-02-02': met };
    const r = computeStreak(weeks, '2026-02-02', 0);
    expect(r.streak).toBe(1);
    expect(r.best).toBe(3);
  });
});

describe('weekInDanger', () => {
  it('warns when the remaining days barely cover the missing workouts', () => {
    expect(weekInDanger(4, { workouts: 0, xp: 0, goal: 3 }, 3, 0)).toBe(false); // Monday, plenty of time
    expect(weekInDanger(4, { workouts: 0, xp: 0, goal: 3 }, 3, 3)).toBe(true); // Thursday, 4 days for 3 workouts
    expect(weekInDanger(4, { workouts: 2, xp: 0, goal: 3 }, 3, 5)).toBe(true); // Saturday, one to go
  });
  it('never warns without a streak or when the goal is met', () => {
    expect(weekInDanger(0, undefined, 3, 6)).toBe(false);
    expect(weekInDanger(5, { workouts: 3, xp: 0, goal: 3 }, 3, 6)).toBe(false);
  });
});
