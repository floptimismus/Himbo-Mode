export const MUSCLES = [
  'chest', 'shoulders', 'biceps', 'triceps', 'forearms', 'abs', 'obliques', 'traps', 'lats',
  'upper_back', 'lower_back', 'glutes', 'quads', 'hamstrings', 'calves', 'adductors', 'neck',
] as const;
export type Muscle = (typeof MUSCLES)[number];

export const EQUIPMENT = [
  'barbell', 'dumbbell', 'kettlebell', 'band', 'cable', 'machine', 'bodyweight', 'cardio', 'rugby', 'other',
] as const;
export type Equipment = (typeof EQUIPMENT)[number];

/** How sets of an exercise are logged. */
export const TRACKING = ['weight_reps', 'reps', 'time', 'distance_time', 'duration_rpe'] as const;
export type Tracking = (typeof TRACKING)[number];

export const CATEGORIES = ['strength', 'cardio', 'rugby'] as const;
export type Category = (typeof CATEGORIES)[number];

export type Lang = 'en' | 'de';
export type Localized = Record<Lang, string>;

/** The part of an exercise the game rules need. */
export interface ExerciseMeta {
  id: string;
  primary: Muscle[];
  secondary: Muscle[];
  equipment: Equipment;
  tracking: Tracking;
  category: Category;
}

export interface Exercise extends ExerciseMeta {
  name: Localized;
  desc: Localized;
  custom?: boolean;
}

export const MUSCLE_GROUPS = {
  legs: ['quads', 'hamstrings', 'glutes', 'calves', 'adductors'],
  push: ['chest', 'shoulders', 'triceps'],
  pull: ['lats', 'upper_back', 'biceps', 'traps', 'forearms'],
  core: ['abs', 'obliques', 'lower_back'],
} as const satisfies Record<string, readonly Muscle[]>;
