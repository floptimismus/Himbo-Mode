-- Himbo-Mode initial schema. Weights are stored in kg, distances in metres, times in ms since epoch.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,                       -- as typed by the user
  username_lower TEXT NOT NULL UNIQUE,          -- case-insensitive uniqueness + lookup
  display_name TEXT,
  avatar TEXT NOT NULL DEFAULT 'a1',
  locale TEXT NOT NULL DEFAULT 'en',
  theme TEXT NOT NULL DEFAULT 'system',
  units TEXT NOT NULL DEFAULT 'kg',
  weekly_goal INTEGER NOT NULL DEFAULT 3,
  leaderboard_visible INTEGER NOT NULL DEFAULT 1,
  workouts_public INTEGER NOT NULL DEFAULT 0,
  total_xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  streak_weeks INTEGER NOT NULL DEFAULT 0,      -- streak as of streak_week
  streak_week TEXT,                             -- Monday (YYYY-MM-DD) of the last week with a workout
  best_streak INTEGER NOT NULL DEFAULT 0,
  streak_freezes INTEGER NOT NULL DEFAULT 0,
  stats_json TEXT NOT NULL DEFAULT '{}',        -- lifetime counters used for trophies (shared/game/types.ts Stats)
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_users_xp ON users (leaderboard_visible, total_xp DESC);

CREATE TABLE passkey_credentials (
  id TEXT PRIMARY KEY,                          -- base64url credential id
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  public_key TEXT NOT NULL,                     -- base64url COSE key
  counter INTEGER NOT NULL DEFAULT 0,
  transports TEXT,                              -- JSON array
  device_name TEXT,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER
);
CREATE INDEX idx_passkeys_user ON passkey_credentials (user_id);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,                  -- SHA-256 of the cookie value
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX idx_sessions_user ON sessions (user_id);

CREATE TABLE auth_challenges (
  id TEXT PRIMARY KEY,
  challenge TEXT NOT NULL,
  kind TEXT NOT NULL,                           -- register | login | add
  user_id TEXT,                                 -- new user id (register) or existing user (add)
  username TEXT,
  display_name TEXT,
  expires_at INTEGER NOT NULL
);

CREATE TABLE recovery_codes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  used_at INTEGER
);
CREATE INDEX idx_recovery_user ON recovery_codes (user_id);

CREATE TABLE rate_limits (
  key TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (key, window_start)
);

CREATE TABLE exercises (
  id TEXT PRIMARY KEY,
  owner_id TEXT REFERENCES users(id) ON DELETE CASCADE,  -- NULL = system exercise
  name_en TEXT NOT NULL,
  name_de TEXT NOT NULL,
  desc_en TEXT NOT NULL DEFAULT '',
  desc_de TEXT NOT NULL DEFAULT '',
  primary_muscles TEXT NOT NULL DEFAULT '[]',   -- JSON array of muscle ids
  secondary_muscles TEXT NOT NULL DEFAULT '[]',
  equipment TEXT NOT NULL,
  tracking TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'strength',
  archived INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_exercises_owner ON exercises (owner_id);

CREATE TABLE exercise_favorites (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, exercise_id)
);

CREATE TABLE routines (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_routines_user ON routines (user_id, position);

CREATE TABLE routine_exercises (
  id TEXT PRIMARY KEY,
  routine_id TEXT NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL REFERENCES exercises(id),
  position INTEGER NOT NULL,
  target_sets INTEGER NOT NULL DEFAULT 3,
  target_reps INTEGER,
  target_weight_kg REAL,
  notes TEXT
);
CREATE INDEX idx_routine_ex ON routine_exercises (routine_id, position);

CREATE TABLE workouts (
  id TEXT PRIMARY KEY,                          -- client-generated UUID (idempotent sync)
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER NOT NULL,
  duration_s INTEGER NOT NULL,
  tz_offset_min INTEGER NOT NULL DEFAULT 0,     -- minutes east of UTC at workout time
  notes TEXT,
  routine_id TEXT,
  total_volume_kg REAL NOT NULL DEFAULT 0,
  total_sets INTEGER NOT NULL DEFAULT 0,
  total_reps INTEGER NOT NULL DEFAULT 0,
  xp_awarded INTEGER NOT NULL DEFAULT 0,
  summary_json TEXT,                            -- server-computed summary shown after finishing
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_workouts_user ON workouts (user_id, started_at DESC);

CREATE TABLE workout_exercises (
  id TEXT PRIMARY KEY,
  workout_id TEXT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL REFERENCES exercises(id),
  position INTEGER NOT NULL,
  notes TEXT
);
CREATE INDEX idx_wex_workout ON workout_exercises (workout_id, position);
CREATE INDEX idx_wex_exercise ON workout_exercises (exercise_id);

CREATE TABLE sets (
  id TEXT PRIMARY KEY,
  workout_exercise_id TEXT NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  set_type TEXT NOT NULL DEFAULT 'normal',      -- normal | warmup | drop | failure
  weight_kg REAL,
  reps INTEGER,
  duration_s INTEGER,
  distance_m REAL,
  rpe REAL
);
CREATE INDEX idx_sets_wex ON sets (workout_exercise_id, position);

CREATE TABLE personal_bests (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL,
  kind TEXT NOT NULL,                           -- weight | e1rm | reps | volume | duration | distance | pace
  value REAL NOT NULL,
  workout_id TEXT,
  achieved_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, exercise_id, kind)
);

CREATE TABLE xp_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workout_id TEXT,
  kind TEXT NOT NULL,                           -- sets | cardio | pb | duration | weekly_goal | streak
  amount INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_xp_user ON xp_events (user_id, created_at);

-- Trophy definitions live in code (shared/game/trophies.ts); only unlocks are stored.
CREATE TABLE user_trophies (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trophy_id TEXT NOT NULL,
  tier INTEGER NOT NULL,                        -- 1 bronze, 2 silver, 3 gold
  unlocked_at INTEGER NOT NULL,
  workout_id TEXT,
  PRIMARY KEY (user_id, trophy_id)
);

CREATE TABLE follows (
  follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followee_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (follower_id, followee_id)
);
CREATE INDEX idx_follows_followee ON follows (followee_id);

CREATE TABLE weekly_stats (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week TEXT NOT NULL,                           -- Monday (YYYY-MM-DD) in the user's local time
  workouts INTEGER NOT NULL DEFAULT 0,
  xp INTEGER NOT NULL DEFAULT 0,
  goal INTEGER NOT NULL DEFAULT 3,
  frozen INTEGER NOT NULL DEFAULT 0,            -- 1 = a streak freeze covered this missed week
  PRIMARY KEY (user_id, week)
);
CREATE INDEX idx_weekly_week ON weekly_stats (week, xp DESC);
