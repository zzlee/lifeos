import { test, describe } from "node:test";
import assert from "node:assert";
import { getLineMessages, saveLineMessage } from "../worker/repository.ts";

/** Minimal D1 mock: captures the SQL and bound params, returns canned results. */
function makeMockDb(results: any[] = []) {
  const calls: { sql: string; params: any[] }[] = [];
  const db = {
    prepare(sql: string) {
      return {
        bind(...params: any[]) {
          calls.push({ sql, params });
          return {
            run: async () => ({ results: [] }),
            all: async () => ({ results }),
          };
        },
      };
    },
  };
  return { db: db as any, calls };
}

describe("saveLineMessage", () => {
  test("inserts with OR IGNORE and correct columns/params", async () => {
    const { db, calls } = makeMockDb();
    await saveLineMessage(db, {
      roomType: "group",
      roomId: "C123",
      userId: "U456",
      messageType: "text",
      text: "hello",
      lineMessageId: "msg-1",
      createdAt: "2026-08-08T10:00:00.000Z",
    });

    assert.strictEqual(calls.length, 1);
    assert.match(calls[0].sql, /INSERT OR IGNORE INTO line_messages/);
    assert.match(calls[0].sql, /room_type/);
    assert.deepStrictEqual(calls[0].params, [
      "group",
      "C123",
      "U456",
      "text",
      "hello",
      "msg-1",
      "2026-08-08T10:00:00.000Z",
    ]);
  });

  test("stores non-text messages with null text", async () => {
    const { db, calls } = makeMockDb();
    await saveLineMessage(db, {
      roomType: "user",
      roomId: "U1",
      userId: "U1",
      messageType: "image",
      text: null,
      lineMessageId: "img-1",
      createdAt: "2026-08-08T10:00:00.000Z",
    });
    assert.strictEqual(calls[0].params[4], null);
  });
});

describe("getLineMessages", () => {
  test("queries by room and orders newest first", async () => {
    const { db, calls } = makeMockDb([
      {
        id: 2,
        roomType: "group",
        roomId: "C123",
        userId: "U456",
        messageType: "text",
        text: "hi",
        lineMessageId: "m2",
        createdAt: "2026-08-08T10:01:00.000Z",
      },
    ]);
    const rows = await getLineMessages(db, "group", "C123", 10, 0);

    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].text, "hi");
    assert.strictEqual(rows[0].roomType, "group");
    assert.match(calls[0].sql, /ORDER BY created_at DESC, id DESC/);
    assert.deepStrictEqual(calls[0].params, ["group", "C123", 10, 0]);
  });
});
