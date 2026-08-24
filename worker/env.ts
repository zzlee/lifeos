export type D1PreparedStatement = {
  bind: (...values: unknown[]) => D1PreparedStatement;
  all: <T = unknown>() => Promise<{ results: T[]; meta?: { changes?: number; size_after?: number; [key: string]: unknown } }>;
  first: <T = unknown>() => Promise<T | null>;
  run: <T = unknown>() => Promise<{ results?: T[]; meta?: { changes?: number; size_after?: number; [key: string]: unknown } }>;
};

export type D1Database = {
  batch: <T = unknown>(statements: D1PreparedStatement[]) => Promise<Array<{ results: T[] }>>;
  prepare: (query: string) => D1PreparedStatement;
};

export type Env = {
  DB?: D1Database;
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
  AGNES_API_KEY?: string;
  AGNES_MODEL?: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  VAULT_MASTER_KEY?: string;
  SESSION_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REDIRECT_URI?: string;
  LINE_CHANNEL_SECRET?: string;
  LINE_CHANNEL_ACCESS_TOKEN?: string;
  ALLOWED_ORIGINS?: string;
};
