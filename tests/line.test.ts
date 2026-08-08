import { test, describe } from "node:test";
import assert from "node:assert";
import { parseLineCommand, formatWhere, buildMemberListText } from "../worker/lineCommands.ts";

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
