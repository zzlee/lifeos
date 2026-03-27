export type D1Database = {
  prepare: (query: string) => {
    bind: (...values: unknown[]) => {
      all: <T>() => Promise<{ results: T[] }>;
      first: <T>() => Promise<T | null>;
      run: () => Promise<unknown>;
    };
    all: <T>() => Promise<{ results: T[] }>;
    first: <T>() => Promise<T | null>;
    run: () => Promise<unknown>;
  };
};

export type Env = {
  DB?: D1Database;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  VAULT_MASTER_KEY?: string;
  SESSION_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REDIRECT_URI?: string;
};
