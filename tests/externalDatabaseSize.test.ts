import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchExternalDatabaseSize } from "../src/lib/api";

test("fetchExternalDatabaseSize fetches and parses size_bytes", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async (url: string | URL | Request) => {
      assert.equal(String(url), "https://purple-water-b776.zzlee-tw.workers.dev/api/database/size");
      return new Response(
        JSON.stringify({
          size_bytes: 87910,
          tables: { item_categories: 238, payment_categories: 275, transactions: 87312, users: 85 }
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as typeof globalThis.fetch;

    const res = await fetchExternalDatabaseSize();
    assert.equal(res.size_bytes, 87910);
    assert.equal(res.tables?.transactions, 87312);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
