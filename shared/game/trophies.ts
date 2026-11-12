import type { Localized } from '../data/types.ts';
import { levelForXp } from './levels.ts';
import type { GameState, OwnedTrophy } from './types.ts';

export type TrophyIcon =
  | 'cup' | 'medal' | 'flame' | 'weight' | 'star' | 'heart' | 'boot' | 'ball' | 'sun' | 'moon'
  | 'crown' | 'clock' | 'bolt' | 'shield' | 'map' | 'people' | 'scroll';

export interface TrophyDef {
  id: string;
  icon: TrophyIcon;
  /** Thresholds: one entry = single trophy, three = bronze/silver/gold. */
  tiers: readonly number[];
  /** Current progress value for a player. */
  metric: (s: GameState) => number;
  name: Localized;
  /** `{n}` is replaced with the threshold of the tier being shown. */
  desc: Localized;
}

const big3 = (s: GameState) => {
  const b = s.stats.big3;
  return b.squat > 0 && b.bench > 0 && b.deadlift > 0 ? Math.floor(b.squat + b.bench + b.deadlift) : 0;
};

export const TROPHIES: readonly TrophyDef[] = [
  { id: 'first_workout', icon: 'star', tiers: [1], metric: (s) => s.stats.workouts,
    name: { en: 'Press Start', de: 'Press Start' },
    desc: { en: 'Finish your first workout.', de: 'Schließe dein erstes Workout ab.' } },
  { id: 'workouts', icon: 'cup', tiers: [10, 50, 200], metric: (s) => s.stats.workouts,
    name: { en: 'Gym Rat', de: 'Studio-Ratte' },
    desc: { en: 'Finish {n} workouts.', de: 'Schließe {n} Workouts ab.' } },
  { id: 'streak', icon: 'flame', tiers: [4, 12, 26], metric: (s) => s.stats.bestStreak,
    name: { en: 'On Fire', de: 'In Flammen' },
    desc: { en: 'Reach a {n}-week streak.', de: 'Erreiche eine Serie von {n} Wochen.' } },
  { id: 'streak_year', icon: 'crown', tiers: [52], metric: (s) => s.stats.bestStreak,
    name: { en: 'Year of the Himbo', de: 'Jahr des Himbos' },
    desc: { en: 'Keep your streak alive for {n} weeks.', de: 'Halte deine Serie {n} Wochen am Leben.' } },
  { id: 'goal_weeks', icon: 'medal', tiers: [4, 20, 52], metric: (s) => s.stats.goalWeeks,
    name: { en: 'Goal Getter', de: 'Zielstrebig' },
    desc: { en: 'Hit your weekly goal in {n} weeks.', de: 'Erreiche dein Wochenziel in {n} Wochen.' } },
  { id: 'beast_week', icon: 'bolt', tiers: [5], metric: (s) => s.stats.maxWeekWorkouts,
    name: { en: 'Beast Week', de: 'Biest-Woche' },
    desc: { en: 'Train {n} times in a single week.', de: 'Trainiere {n}-mal in einer Woche.' } },
  { id: 'no_days_off', icon: 'bolt', tiers: [7], metric: (s) => s.stats.maxWeekWorkouts,
    name: { en: 'No Days Off', de: 'Kein Ruhetag' },
    desc: { en: 'Train {n} times in a single week. Then please rest.', de: 'Trainiere {n}-mal in einer Woche. Danach bitte ausruhen.' } },
  { id: 'volume', icon: 'weight', tiers: [10_000, 100_000, 1_000_000], metric: (s) => Math.floor(s.stats.volumeKg),
    name: { en: 'Heavy Lifter', de: 'Schwerarbeiter' },
    desc: { en: 'Lift {n} kg in total.', de: 'Bewege insgesamt {n} kg.' } },
  { id: 'sets', icon: 'weight', tiers: [100, 1000, 5000], metric: (s) => s.stats.sets,
    name: { en: 'Set Collector', de: 'Satz-Sammler' },
    desc: { en: 'Complete {n} sets.', de: 'Schließe {n} Sätze ab.' } },
  { id: 'reps', icon: 'weight', tiers: [1000, 10_000, 50_000], metric: (s) => s.stats.reps,
    name: { en: 'Rep Machine', de: 'Wiederholungs-Maschine' },
    desc: { en: 'Do {n} reps.', de: 'Mache {n} Wiederholungen.' } },
  { id: 'pbs', icon: 'medal', tiers: [10, 50, 200], metric: (s) => s.stats.pbs,
    name: { en: 'Record Breaker', de: 'Rekordbrecher' },
    desc: { en: 'Set {n} personal bests.', de: 'Stelle {n} persönliche Bestleistungen auf.' } },
  { id: 'heavy_metal', icon: 'weight', tiers: [100, 140, 180], metric: (s) => Math.floor(s.stats.maxWeightKg),
    name: { en: 'Heavy Metal', de: 'Schwermetall' },
    desc: { en: 'Lift {n} kg in a single set.', de: 'Bewege {n} kg in einem Satz.' } },
  { id: 'big_three', icon: 'crown', tiers: [200, 300, 400], metric: big3,
    name: { en: 'The Big Three', de: 'Die großen Drei' },
    desc: { en: 'Reach a {n} kg estimated total in squat, bench press and deadlift.',
            de: 'Erreiche {n} kg geschätzte Gesamtlast in Kniebeuge, Bankdrücken und Kreuzheben.' } },
  { id: 'high_reps', icon: 'bolt', tiers: [20, 30, 50], metric: (s) => s.stats.maxRepsInSet,
    name: { en: 'Rep Rampage', de: 'Wiederholungs-Rausch' },
    desc: { en: 'Do {n} reps in a single set.', de: 'Mache {n} Wiederholungen in einem Satz.' } },
  { id: 'bodyweight', icon: 'heart', tiers: [500, 2500, 10_000], metric: (s) => s.stats.bodyweightReps,
    name: { en: 'Gravity Who?', de: 'Schwerkraft? Nie gehört' },
    desc: { en: 'Do {n} bodyweight reps.', de: 'Mache {n} Wiederholungen mit dem eigenen Körpergewicht.' } },
  { id: 'leg_day', icon: 'boot', tiers: [50, 300, 1000], metric: (s) => s.stats.legSets,
    name: { en: 'Never Skip Leg Day', de: 'Beintag ist Pflicht' },
    desc: { en: 'Complete {n} leg sets.', de: 'Schließe {n} Bein-Sätze ab.' } },
  { id: 'push', icon: 'shield', tiers: [50, 300, 1000], metric: (s) => s.stats.pushSets,
    name: { en: 'Push It', de: 'Druckmacher' },
    desc: { en: 'Complete {n} chest, shoulder or triceps sets.', de: 'Schließe {n} Sätze für Brust, Schultern oder Trizeps ab.' } },
  { id: 'pull', icon: 'shield', tiers: [50, 300, 1000], metric: (s) => s.stats.pullSets,
    name: { en: 'Pull Yourself Together', de: 'Zieh durch' },
    desc: { en: 'Complete {n} back or biceps sets.', de: 'Schließe {n} Sätze für Rücken oder Bizeps ab.' } },
  { id: 'core', icon: 'shield', tiers: [50, 300, 1000], metric: (s) => s.stats.coreSets,
    name: { en: 'Core Values', de: 'Starke Mitte' },
    desc: { en: 'Complete {n} core sets.', de: 'Schließe {n} Rumpf-Sätze ab.' } },
  { id: 'full_body', icon: 'map', tiers: [5, 8, 11], metric: (s) => s.stats.maxMusclesInWorkout,
    name: { en: 'Full Body Himbo', de: 'Ganzkörper-Himbo' },
    desc: { en: 'Train {n} different muscle groups in one workout.', de: 'Trainiere {n} verschiedene Muskelgruppen in einem Workout.' } },
  { id: 'explorer', icon: 'map', tiers: [10, 30, 75], metric: (s) => s.stats.exercisesUsed.length,
    name: { en: 'Exercise Explorer', de: 'Übungs-Entdecker' },
    desc: { en: 'Try {n} different exercises.', de: 'Probiere {n} verschiedene Übungen aus.' } },
  { id: 'tool_time', icon: 'map', tiers: [3, 5, 8], metric: (s) => s.stats.equipmentUsed.length,
    name: { en: 'Tool Time', de: 'Gerätepark' },
    desc: { en: 'Train with {n} different equipment types.', de: 'Trainiere mit {n} verschiedenen Gerätetypen.' } },
  { id: 'cardio_distance', icon: 'boot', tiers: [25, 100, 500], metric: (s) => Math.floor(s.stats.cardioDistanceM / 1000),
    name: { en: 'Road Runner', de: 'Kilometerfresser' },
    desc: { en: 'Cover {n} km of cardio distance.', de: 'Lege {n} km Cardio-Strecke zurück.' } },
  { id: 'cardio_time', icon: 'heart', tiers: [300, 1500, 6000], metric: (s) => Math.floor(s.stats.cardioMinutes),
    name: { en: 'Big Heart', de: 'Großes Herz' },
    desc: { en: 'Log {n} minutes of cardio or rugby.', de: 'Sammle {n} Minuten Cardio oder Rugby.' } },
  { id: 'rugby_sessions', icon: 'ball', tiers: [1, 10, 50], metric: (s) => s.stats.rugbySessions,
    name: { en: 'Rugger', de: 'Rugger' },
    desc: { en: 'Log {n} workouts with rugby training.', de: 'Trage {n} Workouts mit Rugby-Training ein.' } },
  { id: 'drills', icon: 'ball', tiers: [20, 100, 500], metric: (s) => s.stats.rugbyDrillSets,
    name: { en: 'Drill Sergeant', de: 'Drill-Sergeant' },
    desc: { en: 'Complete {n} rugby drill sets.', de: 'Schließe {n} Rugby-Drill-Sätze ab.' } },
  { id: 'early_bird', icon: 'sun', tiers: [1, 10, 50], metric: (s) => s.stats.earlyBird,
    name: { en: 'Early Bird', de: 'Früher Vogel' },
    desc: { en: 'Start {n} workouts before 7 am.', de: 'Starte {n} Workouts vor 7 Uhr.' } },
  { id: 'night_owl', icon: 'moon', tiers: [1, 10, 50], metric: (s) => s.stats.nightOwl,
    name: { en: 'Night Owl', de: 'Nachteule' },
    desc: { en: 'Start {n} workouts after 9 pm.', de: 'Starte {n} Workouts nach 21 Uhr.' } },
  { id: 'weekend', icon: 'sun', tiers: [5, 25, 100], metric: (s) => s.stats.weekend,
    name: { en: 'Weekend Warrior', de: 'Wochenend-Krieger' },
    desc: { en: 'Train on {n} weekend days.', de: 'Trainiere an {n} Wochenendtagen.' } },
  { id: 'marathon', icon: 'clock', tiers: [60, 90, 120], metric: (s) => Math.floor(s.stats.longestWorkoutMin),
    name: { en: 'Long Haul', de: 'Langstrecke' },
    desc: { en: 'Finish a workout of {n} minutes or more.', de: 'Schließe ein Workout mit mindestens {n} Minuten ab.' } },
  { id: 'comeback', icon: 'heart', tiers: [1], metric: (s) => s.stats.comebacks,
    name: { en: 'Comeback Kid', de: 'Comeback-Kid' },
    desc: { en: 'Return after a break of two weeks or more.', de: 'Komm nach mindestens zwei Wochen Pause zurück.' } },
  { id: 'xp', icon: 'star', tiers: [1000, 10_000, 50_000], metric: (s) => s.totalXp,
    name: { en: 'XP Hoarder', de: 'XP-Hamster' },
    desc: { en: 'Earn {n} XP.', de: 'Verdiene {n} XP.' } },
  { id: 'level', icon: 'star', tiers: [5, 20, 50], metric: (s) => levelForXp(s.totalXp),
    name: { en: 'Level Up!', de: 'Level Up!' },
    desc: { en: 'Reach level {n}.', de: 'Erreiche Level {n}.' } },
  { id: 'legend', icon: 'crown', tiers: [90], metric: (s) => levelForXp(s.totalXp),
    name: { en: 'Himbo Legend', de: 'Himbo-Legende' },
    desc: { en: 'Reach level {n}.', de: 'Erreiche Level {n}.' } },
  { id: 'squad', icon: 'people', tiers: [1, 5, 20], metric: (s) => s.stats.following,
    name: { en: 'Squad Goals', de: 'Die Truppe' },
    desc: { en: 'Follow {n} other athletes.', de: 'Folge {n} anderen Athleten.' } },
  { id: 'planner', icon: 'scroll', tiers: [1, 5, 10], metric: (s) => s.stats.routines,
    name: { en: 'Master Planner', de: 'Planungs-Profi' },
    desc: { en: 'Own {n} routines.', de: 'Besitze {n} Routinen.' } },
];

export const TROPHY_BY_ID: ReadonlyMap<string, TrophyDef> = new Map(TROPHIES.map((t) => [t.id, t]));

/** Highest tier (1-based, 0 = none) whose threshold `value` reaches. */
export function tierFor(def: TrophyDef, value: number): number {
  let tier = 0;
  def.tiers.forEach((threshold, i) => {
    if (value >= threshold) tier = i + 1;
  });
  return tier;
}

export interface TrophyProgress {
  def: TrophyDef;
  value: number;
  tier: number;
  /** Threshold of the next tier, or of the highest tier when maxed. */
  target: number;
  maxed: boolean;
  ratio: number;
}

/** `ownedTier` wins over the live metric so an unlocked trophy never visually re-locks. */
export function trophyProgress(def: TrophyDef, state: GameState, ownedTier = 0): TrophyProgress {
  const value = def.metric(state);
  const tier = Math.max(ownedTier, tierFor(def, value));
  const maxed = tier >= def.tiers.length;
  const target = def.tiers[Math.min(tier, def.tiers.length - 1)]!;
  return { def, value, tier, target, maxed, ratio: maxed ? 1 : Math.min(1, value / target) };
}

export interface Unlock {
  id: string;
  tier: number;
}

/** Trophies whose tier is higher than what the player already owns. */
export function evaluateTrophies(state: GameState, owned: Record<string, OwnedTrophy>): Unlock[] {
  const out: Unlock[] = [];
  for (const def of TROPHIES) {
    const tier = tierFor(def, def.metric(state));
    if (tier > (owned[def.id]?.tier ?? 0)) out.push({ id: def.id, tier });
  }
  return out;
}

/** Display tier of a single-tier trophy is gold; multi-tier maps 1/2/3 → bronze/silver/gold. */
export function tierName(def: TrophyDef, tier: number): 'bronze' | 'silver' | 'gold' | 'locked' {
  if (tier <= 0) return 'locked';
  if (def.tiers.length === 1) return 'gold';
  return (['bronze', 'silver', 'gold'] as const)[Math.min(tier, 3) - 1]!;
}
