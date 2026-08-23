import { test, describe } from "node:test";
import assert from "node:assert";
import { runLifeAgentLoop } from "../worker/agent.ts";

function makeMockDb() {
  const calls: { sql: string; params: any[] }[] = [];
  const db = {
    prepare(sql: string) {
      return {
        bind(...params: any[]) {
          calls.push({ sql, params });
          return {
            all: async () => {
              if (sql.includes("SELECT id, site")) {
                return { results: [{ id: 1, site: "example.com", username: "user1", secret_masked: "****" }] };
              }
              if (sql.includes("FROM journals")) {
                return { results: [{ id: 5, date: "2026-03-01T00:00:00Z", content: "Test Journal", tags: "work" }] };
              }
              return { results: [] };
            },
            first: async () => {
              if (sql.includes("FROM journals")) {
                return { id: 5, date: "2026-03-01T00:00:00Z", content: "Test Journal", tags: "work" };
              }
              if (sql.includes("COUNT(*)")) {
                return { count: 1 };
              }
              return null;
            },
            run: async () => {
              return { success: true, meta: { changes: 1 } };
            },
          };
        },
        all: async () => {
          calls.push({ sql, params: [] });
          return { results: [] };
        },
        first: async () => {
          return null;
        },
        run: async () => {
          return { success: true, meta: { changes: 1 } };
        },
      };
    },
    batch: async (statements: any[]) => {
      return statements.map(() => ({ results: [] }));
    },
  };
  return { db: db as any, calls };
}

describe("Agent Tool Integration", () => {
  test("new agent tools run via runLifeAgentLoop mock execution", async () => {
    const { db } = makeMockDb();
    const user = { id: 1, email: "test@example.com", name: "Test User", timezone: "Asia/Taipei" };

    // Mock fetch for Agnes AI API call returning tool call
    const originalFetch = globalThis.fetch;
    let turn = 0;

    globalThis.fetch = (async (url: string | URL | Request, _init?: RequestInit) => {
      const urlStr = url.toString();
      if (urlStr.includes("apihub.agnes-ai.com")) {
        turn++;
        if (turn === 1) {
          return new Response(
            JSON.stringify({
              choices: [
                {
                  message: {
                    role: "assistant",
                    tool_calls: [
                      {
                        id: "call_1",
                        type: "function",
                        function: {
                          name: "get_journal",
                          arguments: JSON.stringify({ id: 5 }),
                        },
                      },
                      {
                        id: "call_2",
                        type: "function",
                        function: {
                          name: "export_vault",
                          arguments: JSON.stringify({}),
                        },
                      },
                      {
                        id: "call_3",
                        type: "function",
                        function: {
                          name: "query_chat_groups",
                          arguments: JSON.stringify({ keyword: "work" }),
                        },
                      },
                    ],
                  },
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        } else {
          return new Response(
            JSON.stringify({
              choices: [
                {
                  message: {
                    role: "assistant",
                    content: "Retrieved journal, exported vault, and queried chat groups successfully.",
                  },
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
      }
      if (urlStr.includes("purple-water")) {
        return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response("{}", { status: 200 });
    }) as any;

    try {
      const env = {
        DB: db,
        AGNES_API_KEY: "test-key",
        VAULT_MASTER_KEY: "test-master-key",
      } as any;

      const result = await runLifeAgentLoop(env, user, [{ role: "user", content: "Check journal 5 and export vault" }]);

      assert.strictEqual(result.reply, "Retrieved journal, exported vault, and queried chat groups successfully.");
      assert.strictEqual(result.toolCalls.length, 3);
      assert.strictEqual(result.toolCalls[0].name, "get_journal");
      assert.strictEqual(result.toolCalls[0].result.id, 5);
      assert.strictEqual(result.toolCalls[1].name, "export_vault");
      assert.strictEqual(result.toolCalls[2].name, "query_chat_groups");
      assert.deepStrictEqual(result.toolCalls[2].args, { keyword: "work" });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
