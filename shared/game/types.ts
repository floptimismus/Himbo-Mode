import type { Muscle } from '../data/types.ts';

export type SetType = 'normal' | 'warmup' | 'drop' | 'failure';
export const SET_TYPES: readonly SetType[] = ['normal', 'warmup', 'drop', 'failure'];

export interface GSet {
  type: SetType;
  weightKg?: number | null;
  reps?: number | null;
  durationS?: number | null;
  distanceM?: number | null;
  rpe?: number | null;
}

export interface GExercise {
  exerciseId: string;
  sets: GSet[];
}

export interface GWorkout {
  id: string;
  startedAt: number;
  endedAt: number;
  /** Minutes east of UTC at the time of the workout. */
  tzOffsetMin: number;
  exercises: GExercise[];
}

export type PbKind = 'weight' | 'e1rm' | 'reps' | 'volume' | 'duration' | 'distance' | 'pace';
export type PbMap = Partial<Record<PbKind, number>>;

export interface NewPb {
  exerciseId: string;
  kind: PbKind;
  value: number;
  previous: number | null;
}

export interface WeekStat {
  workouts: number;
  xp: number;
  goal: number;
  /** A streak freeze covered this missed week. */
  frozen?: boolean;
}
export type Weeks = Record<string, WeekStat>;

/** Lifetime counters that trophies are computed from. */
export interface Stats {
  workouts: number;
  sets: number;
  reps: number;
  volumeKg: number;
  pbs: number;
  cardioDistanceM: number;
  cardioMinutes: number;
  rugbySessions: number;
  rugbyDrillSets: number;
  earlyBird: number;
  nightOwl: number;
  weekend: number;
  longestWorkoutMin: number;
  maxWeightKg: number;
  maxRepsInSet: number;
  maxMusclesInWorkout: number;
  maxWeekWorkouts: number;
  bodyweightReps: number;
  legSets: number;
  pushSets: number;
  pullSets: number;
  coreSets: number;
  goalWeeks: number;
  comebacks: number;
  bestStreak: number;
  big3: { squat: number; bench: number; deadlift: number };
  exercisesUsed: string[];
  equipmentUsed: string[];
  lastWorkoutAt: number;
  /** Local day (YYYY-MM-DD) and XP earned on it, for the daily cap. */
  dayKey: string;
  dayXp: number;
  /** Weeks up to and including this one are final for streak purposes. */
  settledWeek: string;
  /** Set by the server from other tables. */
  following: number;
  routines: number;
}

export interface OwnedTrophy {
  tier: number;
  at: number;
  workoutId?: string | null;
}

export interface GameState {
  totalXp: number;
  freezes: number;
  stats: Stats;
  pbs: Record<string, PbMap>;
  weeks: Weeks;
  trophies: Record<string, OwnedTrophy>;
}

export interface XpBreakdown {
  sets: number;
  cardio: number;
  streak: number;
  pb: number;
  duration: number;
  weeklyGoal: number;
  /** Sum before caps. */
  raw: number;
  total: number;
  capped: boolean;
}

export interface WorkoutSummary {
  workoutId: string;
  durationS: number;
  volumeKg: number;
  sets: number;
  reps: number;
  distanceM: number;
  xp: XpBreakdown;
  totalXp: number;
  levelBefore: number;
  levelAfter: number;
  pbs: NewPb[];
  trophies: Array<{ id: string; tier: number }>;
  streak: {
    before: number;
    after: number;
    weekWorkouts: number;
    goal: number;
    goalHitNow: boolean;
    freezes: number;
  };
  muscles: Partial<Record<Muscle, number>>;
}
