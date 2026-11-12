import type { Weeks, WeekStat } from './types.ts';

const DAY_MS = 86_400_000;
const pad = (n: number) => String(n).padStart(2, '0');
const fmt = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/** Clamp to real-world offsets (UTC−12 … UTC+14). */
export function clampTz(tzOffsetMin: number): number {
  return Math.max(-720, Math.min(840, Math.round(tzOffsetMin) || 0));
}

/** Local calendar facts for a timestamp, given minutes east of UTC. */
export function localParts(ts: number, tzOffsetMin: number) {
  const d = new Date(ts + clampTz(tzOffsetMin) * 60_000);
  return {
    dateKey: fmt(d),
    hour: d.getUTCHours(),
    /** 0 = Monday … 6 = Sunday */
    weekday: (d.getUTCDay() + 6) % 7,
  };
}

/** A week is identified by its Monday (YYYY-MM-DD) in the user's local time. */
export function weekKey(ts: number, tzOffsetMin: number): string {
  const local = ts + clampTz(tzOffsetMin) * 60_000;
  const d = new Date(local);
  const weekday = (d.getUTCDay() + 6) % 7;
  return fmt(new Date(local - weekday * DAY_MS));
}

export function addWeeks(week: string, n: number): string {
  return fmt(new Date(Date.parse(`${week}T00:00:00Z`) + n * 7 * DAY_MS));
}

export const weekMet = (w: WeekStat | undefined): boolean => !!w && w.workouts >= w.goal;

export interface StreakResult {
  /** Consecutive weeks with the goal met (frozen weeks bridge the gap but do not count). */
  streak: number;
  best: number;
  /** Freezes left after covering missed weeks. */
  freezes: number;
  /** Missed weeks that a freeze covered during this walk. */
  newlyFrozen: string[];
  currentMet: boolean;
}

/**
 * Walk all weeks chronologically up to `currentWeek`.
 *
 * - A week with the goal met extends the streak.
 * - A missed week that is already marked `frozen` keeps the streak alive.
 * - A missed week after `settledWeek` consumes a freeze if the streak is alive and one is banked.
 * - Any other missed week resets the streak. Weeks up to `settledWeek` are final: they never
 *   consume freezes retroactively.
 * - The current week only counts once its goal is met; an unfinished current week never breaks it.
 */
export function computeStreak(weeks: Weeks, currentWeek: string, freezes: number, settledWeek = ''): StreakResult {
  const keys = Object.keys(weeks).sort();
  const result: StreakResult = { streak: 0, best: 0, freezes, newlyFrozen: [], currentMet: weekMet(weeks[currentWeek]) };
  const first = keys[0];
  if (!first) return result;
  for (let w = first; w < currentWeek; w = addWeeks(w, 1)) {
    const stat = weeks[w];
    if (weekMet(stat)) result.streak++;
    else if (stat?.frozen) continue;
    else if (w > settledWeek && result.streak > 0 && result.freezes > 0) {
      result.freezes--;
      result.newlyFrozen.push(w);
    } else result.streak = 0;
    result.best = Math.max(result.best, result.streak);
  }
  if (result.currentMet) result.streak++;
  result.best = Math.max(result.best, result.streak);
  return result;
}

/**
 * "Week in danger": there is a streak to lose, the goal is not met yet and the remaining
 * days (including today) leave at most one day of slack.
 */
export function weekInDanger(streak: number, stat: WeekStat | undefined, goal: number, weekday: number): boolean {
  const done = stat?.workouts ?? 0;
  const needed = goal - done;
  if (streak <= 0 || needed <= 0) return false;
  const daysLeft = 7 - weekday;
  return daysLeft <= needed + 1;
}
