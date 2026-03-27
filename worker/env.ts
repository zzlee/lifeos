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
  VAULT_MASTER_KEY?: string;
};
