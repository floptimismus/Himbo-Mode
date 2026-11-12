/** Response shapes of the JSON API, shared by worker and client. */
import type { Exercise, Lang } from './data/types.ts';
import type { GameState, GSet, WorkoutSummary } from './game/types.ts';
import type { Units } from './units.ts';

export interface MeUser {
  id: string;
  username: string;
  displayName: string | null;
  avatar: string;
  locale: Lang;
  theme: 'light' | 'dark' | 'system';
  units: Units;
  weeklyGoal: number;
  leaderboardVisible: boolean;
  workoutsPublic: boolean;
  createdAt: number;
}

export interface MeGame {
  totalXp: number;
  level: number;
  /** Current streak in weeks, evaluated now. */
  streak: number;
  bestStreak: number;
  freezes: number;
  weekWorkouts: number;
  weekGoal: number;
  weekMet: boolean;
  inDanger: boolean;
  workouts: number;
}

export interface MeResponse {
  user: MeUser;
  game: MeGame;
}

export interface CustomExercise extends Exercise {
  custom: true;
  archived: boolean;
}

export interface LastPerformance {
  at: number;
  sets: GSet[];
}

export interface LibraryState {
  custom: CustomExercise[];
  favorites: string[];
  /** Most recently used exercise ids, newest first. */
  recents: string[];
  lastPerf: Record<string, LastPerformance>;
}

export interface WorkoutListItem {
  id: string;
  name: string;
  startedAt: number;
  durationS: number;
  volumeKg: number;
  sets: number;
  xp: number;
  exerciseIds: string[];
}

export interface WorkoutDetail {
  id: string;
  name: string;
  startedAt: number;
  endedAt: number;
  durationS: number;
  tzOffsetMin: number;
  notes: string | null;
  routineId: string | null;
  exercises: Array<{ exerciseId: string; notes: string | null; sets: GSet[] }>;
  summary: WorkoutSummary | null;
}

export interface SaveWorkoutResponse {
  summary: WorkoutSummary;
}

export interface RoutineExercise {
  exerciseId: string;
  targetSets: number;
  targetReps: number | null;
  targetWeightKg: number | null;
  notes: string | null;
}

export interface Routine {
  id: string;
  name: string;
  position: number;
  updatedAt: number;
  exercises: RoutineExercise[];
}

export interface PublicUser {
  username: string;
  displayName: string | null;
  avatar: string;
  level: number;
}

export interface ProfileResponse extends PublicUser {
  totalXp: number;
  streak: number;
  bestStreak: number;
  workouts: number;
  followers: number;
  following: number;
  isMe: boolean;
  isFollowing: boolean;
  trophies: Array<{ id: string; tier: number; at: number }>;
  /** `null` when the user keeps workouts private. */
  recentWorkouts: WorkoutListItem[] | null;
  createdAt: number;
}

export type LeaderboardMetric = 'xp_all' | 'xp_week' | 'streak';
export type LeaderboardScope = 'global' | 'friends';

export interface LeaderboardEntry extends PublicUser {
  rank: number;
  value: number;
  isMe: boolean;
}

export interface GameResponse {
  state: GameState;
}

export interface PasskeyInfo {
  id: string;
  deviceName: string | null;
  createdAt: number;
  lastUsedAt: number | null;
}

export interface ApiError {
  error: string;
  message?: string;
}
