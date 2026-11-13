import { QueryClient, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type {
  GameResponse, LeaderboardEntry, LeaderboardMetric, LeaderboardScope, LibraryState, MeResponse, PasskeyInfo, ProfileResponse, PublicUser,
  Routine, SaveWorkoutResponse, WorkoutDetail, WorkoutListItem,
} from '@shared/api.ts';
import { EXERCISES } from '@shared/data/exercises/index.ts';
import type { Exercise, ExerciseMeta } from '@shared/data/types.ts';
import { useOutbox } from '@/stores/outbox.ts';
import { api, ApiErr, isNetworkError } from './api.ts';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, err) => isNetworkError(err) && count < 2,
      refetchOnWindowFocus: true,
    },
  },
});

// ── Tiny localStorage cache so the app shell works offline ──
const CACHE_PREFIX = 'himbo-cache:';

function cached<T>(key: string): { initialData?: T; initialDataUpdatedAt?: number } {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    return raw ? { initialData: JSON.parse(raw) as T, initialDataUpdatedAt: 0 } : {};
  } catch {
    return {};
  }
}

function remember<T>(key: string, data: T): T {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(data));
  } catch {
    /* storage full or unavailable – caching is best effort */
  }
  return data;
}

/** Drop cached account data (on sign-in/out) and refetch whatever is on screen. */
export function clearLocalData() {
  for (const key of Object.keys(localStorage)) if (key.startsWith(CACHE_PREFIX)) localStorage.removeItem(key);
  void queryClient.resetQueries();
}

const tz = () => -new Date().getTimezoneOffset();

export const keys = {
  me: ['me'] as const,
  library: ['library'] as const,
  game: ['game'] as const,
  routines: ['routines'] as const,
  workouts: ['workouts'] as const,
  workout: (id: string) => ['workout', id] as const,
  profile: (username: string) => ['profile', username.toLowerCase()] as const,
  following: ['following'] as const,
  leaderboard: (scope: string, metric: string) => ['leaderboard', scope, metric] as const,
  passkeys: ['passkeys'] as const,
};

/** `null` = signed out. */
export const useMe = () =>
  useQuery({ queryKey: keys.me, queryFn: async () => remember('me', await api<MeResponse | null>(`/session?tz=${tz()}`)), ...cached<MeResponse | null>('me') });

export const useLibrary = () =>
  useQuery({ queryKey: keys.library, queryFn: async () => remember('library', await api<LibraryState>('/exercises/state')), ...cached<LibraryState>('library') });

export const useRoutines = () =>
  useQuery({
    queryKey: keys.routines,
    queryFn: async () => remember('routines', (await api<{ routines: Routine[] }>('/routines')).routines),
    ...cached<Routine[]>('routines'),
  });

export const useGame = () => useQuery({ queryKey: keys.game, queryFn: async () => (await api<GameResponse>('/me/game')).state });

export const useWorkouts = () =>
  useQuery({ queryKey: keys.workouts, queryFn: async () => (await api<{ workouts: WorkoutListItem[] }>('/workouts?limit=50')).workouts });

export const useWorkout = (id: string | undefined, enabled = true) =>
  useQuery({ queryKey: keys.workout(id ?? ''), queryFn: () => api<WorkoutDetail>(`/workouts/${id}`), enabled: !!id && enabled });

export const useProfile = (username: string | undefined) =>
  useQuery({ queryKey: keys.profile(username ?? ''), queryFn: () => api<ProfileResponse>(`/users/${encodeURIComponent(username!)}`), enabled: !!username, retry: false });

export const useFollowing = () => useQuery({ queryKey: keys.following, queryFn: async () => (await api<{ users: PublicUser[] }>('/following')).users });

export const useLeaderboard = (scope: LeaderboardScope, metric: LeaderboardMetric) =>
  useQuery({
    queryKey: keys.leaderboard(scope, metric),
    queryFn: async () => (await api<{ entries: LeaderboardEntry[] }>(`/leaderboard?scope=${scope}&metric=${metric}`)).entries,
  });

export const usePasskeys = () =>
  useQuery({ queryKey: keys.passkeys, queryFn: () => api<{ passkeys: PasskeyInfo[]; recoveryCodesLeft: number }>('/me/passkeys') });

/** Everything that changes when a workout is saved, edited or deleted. */
export function invalidateAfterWorkout() {
  for (const key of [keys.me, keys.library, keys.game, keys.workouts, ['leaderboard'], ['profile']]) void queryClient.invalidateQueries({ queryKey: key });
}

// ── Exercise lookup: bundled library + the user's custom exercises ──
export interface ExerciseIndex {
  /** Selectable exercises (archived custom ones excluded). */
  all: Exercise[];
  byId: Map<string, Exercise>;
  metaOf: (id: string) => ExerciseMeta | undefined;
}

export function useExercises(): ExerciseIndex {
  const custom = useLibrary().data?.custom;
  return useMemo(() => {
    const byId = new Map<string, Exercise>(EXERCISES.map((x) => [x.id, x]));
    for (const c of custom ?? []) byId.set(c.id, c);
    const all = [...EXERCISES, ...(custom ?? []).filter((c) => !c.archived)];
    return { all, byId, metaOf: (id) => byId.get(id) };
  }, [custom]);
}

// ── Outbox sync: finished workouts are queued locally and retried until the server has them ──
let syncing = false;

export async function syncOutbox(): Promise<void> {
  if (syncing) return;
  syncing = true;
  try {
    for (const input of [...useOutbox.getState().pending]) {
      try {
        const { summary } = await api<SaveWorkoutResponse>('/workouts', { method: 'POST', body: input });
        useOutbox.getState().markSynced(input.id, summary);
        invalidateAfterWorkout();
      } catch (e) {
        // Offline, signed out or rate limited: keep it queued. A validation error will never succeed.
        if (e instanceof ApiErr && (e.status === 400 || e.status === 409)) useOutbox.getState().markFailed(input.id);
        else break;
      }
    }
  } finally {
    syncing = false;
  }
}
