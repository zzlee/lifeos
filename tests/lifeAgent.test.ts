import { test, describe } from "node:test";
import assert from "node:assert";
import { parseAgentInput } from "../shared/lifeAgent.ts";
import { listLineRooms, getLineMessages } from "../worker/repository.ts";

function makeMockDb(rooms: any[] = [], messages: any[] = []) {
  const calls: { sql: string; params: any[] }[] = [];
  const db = {
    prepare(sql: string) {
      return {
        bind(...params: any[]) {
          calls.push({ sql, params });
          return {
            all: async () => {
              if (sql.includes("line_messages lm")) return { results: rooms };
              return { results: messages };
            },
          };
        },
        all: async () => {
          calls.push({ sql, params: [] });
          if (sql.includes("line_messages lm")) return { results: rooms };
          return { results: messages };
        },
      };
    },
  };
  return { db: db as any, calls };
}

describe("lifeAgent", () => {
  test("getShortDate invalid timezone fallback", () => {
    const state = { health: [], vault: [], journal: [], expenses: [] } as any;
    // We pass an invalid timezone to trigger the catch block in getShortDate
    const result = parseAgentInput("血壓 120/80", state, "Invalid/TimeZone");

    assert.strictEqual(result.kind, "health");
    if (result.kind === "health") {
      // getShortDate returns new Date().toISOString().slice(0, 10) on error
      const today = new Date().toISOString().slice(0, 10);
      assert.strictEqual(result.entry.date, today);
    }
  });

  test("query_chat_rooms tool execution flow via listLineRooms", async () => {
    const mockRooms = [
      {
        roomType: "group",
        roomId: "C100",
        messageCount: 10,
        lastMessageType: "text",
        lastMessageText: "Hello world",
        lastSenderId: "U123",
        lastMessageAt: "2026-08-08T12:00:00Z",
      },
    ];
    const { db } = makeMockDb(mockRooms);
    const rooms = await listLineRooms(db);

    assert.strictEqual(rooms.length, 1);
    assert.strictEqual(rooms[0].roomId, "C100");
    assert.strictEqual(rooms[0].lastMessageText, "Hello world");
  });

  test("query_chat_messages tool execution flow via getLineMessages", async () => {
    const mockMessages = [
      {
        id: 1,
        roomType: "user",
        roomId: "U456",
        userId: "U456",
        messageType: "text",
        text: "Test chat log",
        lineMessageId: "msg-99",
        createdAt: "2026-08-08T12:30:00Z",
      },
    ];
    const { db, calls } = makeMockDb([], mockMessages);
    const msgs = await getLineMessages(db, "user", "U456", 20, 0);

    assert.strictEqual(msgs.length, 1);
    assert.strictEqual(msgs[0].text, "Test chat log");
    assert.deepStrictEqual(calls[0].params, ["user", "U456", 20, 0]);
  });
});
