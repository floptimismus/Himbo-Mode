export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  RP_NAME: string;
  RP_ID: string;
  /** Comma-separated list of allowed origins. `*` matches one DNS label fragment (for preview URLs). */
  ORIGINS: string;
}

export interface SessionUser {
  id: string;
  username: string;
}

export type AppEnv = { Bindings: Env; Variables: { user: SessionUser } };
