/**
 * Extension point for daily/weekly quests (not built in v1).
 *
 * A quest is a pure predicate over the workouts of its period, exactly like trophies are pure
 * metrics over lifetime stats. To ship quests: add definitions here, evaluate them in
 * `worker/services/game.ts` next to `awardTrophies`, and award `rewardXp` as an `xp_events` row
 * with kind `quest`.
 */
import type { Localized } from '../data/types.ts';
import type { GWorkout } from './types.ts';

export interface QuestDef {
  id: string;
  period: 'day' | 'week';
  name: Localized;
  desc: Localized;
  rewardXp: number;
  /** Progress 0..1 for the workouts inside the quest period. */
  progress: (workouts: GWorkout[]) => number;
}

export const QUESTS: readonly QuestDef[] = [];
