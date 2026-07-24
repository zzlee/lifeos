import { test, describe } from "node:test";
import assert from "node:assert";
import { parseAgentInput } from "../shared/lifeAgent.ts";

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
});
