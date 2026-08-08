import { test, describe } from "node:test";
import assert from "node:assert";
import { parseLineCommand, formatWhere, buildMemberListText, formatHistoryText, handleLineMessage } from "../worker/lineCommands.ts";
import type { LineChatMessageRecord } from "../worker/repository.ts";

/** Minimal D1 mock for getLineMessages. */
function makeDb(results: any[]) {
  const db = {
    prepare(_sql: string) {
      return {
        bind: (..._params: any[]) => ({
          all: async () => ({ results }),
        }),
      };
    },
  };
  return db as any;
}

describe("parseLineCommand", () => {
  test("parses a simple command", () => {
    assert.deepStrictEqual(parseLineCommand("/group"), { name: "/group", args: [] });
  });

  test("parses command with args", () => {
    assert.deepStrictEqual(parseLineCommand("/members 10"), { name: "/members", args: ["10"] });
  });

  test("lowercases command name", () => {
    assert.deepStrictEqual(parseLineCommand("/GROUP"), { name: "/group", args: [] });
  });

  test("trims surrounding whitespace", () => {
    assert.deepStrictEqual(parseLineCommand("  /help  "), { name: "/help", args: [] });
  });

  test("returns null for non-command text", () => {
    assert.strictEqual(parseLineCommand("hello"), null);
    assert.strictEqual(parseLineCommand(""), null);
    assert.strictEqual(parseLineCommand("3/4 條"), null);
  });
});

describe("formatWhere", () => {
  test("user source", () => {
    const text = formatWhere({ type: "user", userId: "U123" });
    assert.match(text, /類型: user/);
    assert.match(text, /使用者 ID: U123/);
  });

  test("group source", () => {
    const text = formatWhere({ type: "group", userId: "U123", groupId: "C456" });
    assert.match(text, /類型: group/);
    assert.match(text, /使用者 ID: U123/);
    assert.match(text, /群組 ID: C456/);
  });

  test("room source", () => {
    const text = formatWhere({ type: "room", roomId: "R789" });
    assert.match(text, /類型: room/);
    assert.match(text, /聊天室 ID: R789/);
  });
});

describe("buildMemberListText", () => {
  test("formats member list with count", async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async (input: any) => {
      const url = String(input);
      const json = (body: unknown) =>
        new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

      if (url.includes("/members/count")) return json({ count: 3 });
      if (url.includes("/members/ids")) return json({ userIds: ["U1", "U2", "U3"] });
      if (url.includes("/member/")) {
        const id = String(url).split("/").pop();
        const names: Record<string, string> = { U1: "Alice", U2: "Bob", U3: "Carol" };
        return json({ displayName: names[id ?? ""] ?? "Unknown", userId: id });
      }
      return new Response("not found", { status: 404 });
    }) as any;

    try {
      const text = await buildMemberListText("fake-token", "C1", []);
      assert.match(text, /群組成員 \(3\)/);
      assert.match(text, /1\. Alice \(U1\)/);
      assert.match(text, /2\. Bob \(U2\)/);
      assert.match(text, /3\. Carol \(U3\)/);
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});

describe("formatHistoryText", () => {
  test("formats log oldest→newest, resolves names, skips slash commands", async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async (input: any) => {
      const url = String(input);
      const json = (body: unknown) =>
        new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.includes("/member/")) {
        const id = String(url).split("/").pop();
        return json({ displayName: id === "U1" ? "Alice" : "Bob", userId: id });
      }
      return json({});
    }) as any;

    const records: LineChatMessageRecord[] = [
      { id: 3, roomType: "group", roomId: "C1", userId: "U2", messageType: "text", text: "/history", lineMessageId: "m3", createdAt: "2026-08-08T10:03:00.000Z" },
      { id: 2, roomType: "group", roomId: "C1", userId: "U1", messageType: "text", text: "hello", lineMessageId: "m2", createdAt: "2026-08-08T10:02:00.000Z" },
      { id: 1, roomType: "group", roomId: "C1", userId: "U2", messageType: "image", text: null, lineMessageId: "m1", createdAt: "2026-08-08T10:01:00.000Z" },
    ];

    try {
      const text = await formatHistoryText("fake-token", { type: "group", groupId: "C1", userId: "U1" }, records, 10);
      assert.match(text, /最近 2 則紀錄\(群組\)/);
      assert.match(text, /\[08-08 10:01\] Bob: \[圖片\]/);
      assert.match(text, /\[08-08 10:02\] Alice: hello/);
      assert.ok(!text.includes("/history"), "slash command should be skipped in display");
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  test("returns empty notice when nothing visible", async () => {
    const text = await formatHistoryText("fake-token", { type: "user", userId: "U1" }, [], 10);
    assert.match(text, /尚無可顯示的紀錄/);
  });
});

describe("handleLineMessage /history", () => {
  test("returns history text using env.DB", async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async (input: any) => {
      const json = (body: unknown) =>
        new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
      if (String(input).includes("/member/")) return json({ displayName: "Carol", userId: "U9" });
      return json({});
    }) as any;

    const db = makeDb([
      { id: 1, roomType: "group", roomId: "C1", userId: "U9", messageType: "text", text: "hi there", lineMessageId: "m1", createdAt: "2026-08-08T09:00:00.000Z" },
    ]);
    const env = { DB: db, LINE_CHANNEL_ACCESS_TOKEN: "fake-token" } as any;

    try {
      const messages = await handleLineMessage(env, {
        replyToken: "rt",
        source: { type: "group", groupId: "C1", userId: "U9" },
        message: { type: "text", text: "/history" },
      });
      assert.ok(messages, "should reply");
      assert.match(messages![0].text, /最近 1 則紀錄\(群組\)/);
      assert.match(messages![0].text, /Carol: hi there/);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  test("non-command message returns null (no reply)", async () => {
    const env = { DB: makeDb([]), LINE_CHANNEL_ACCESS_TOKEN: "fake-token" } as any;
    const messages = await handleLineMessage(env, {
      replyToken: "rt",
      source: { type: "user", userId: "U1" },
      message: { type: "text", text: "一般訊息" },
    });
    assert.strictEqual(messages, null);
  });
});
