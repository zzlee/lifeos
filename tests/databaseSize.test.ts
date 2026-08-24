import { test } from "node:test";
import assert from "node:assert/strict";
import { getDatabaseSize } from "../worker/repository";

function makeMockDb(pageCount: number, pageSize: number) {
  return {
    prepare(sql: string) {
      return {
        first() {
          if (sql === "PRAGMA page_count") {
            return { page_count: pageCount };
          }
          if (sql === "PRAGMA page_size") {
            return { page_size: pageSize };
          }
          return null;
        }
      };
    }
  };
}

test("getDatabaseSize retrieves sizeBytes from meta.size_after when available", async () => {
  const db = {
    prepare(sql: string) {
      return {
        async run() {
          if (sql === "SELECT 1") {
            return {
              results: [],
              meta: { size_after: 1048576 }
            };
          }
          return { results: [], meta: {} };
        }
      };
    }
  } as any;

  const sizeResult = await getDatabaseSize(db);
  assert.equal(typeof sizeResult.sizeBytes, "number");
  assert.equal(sizeResult.sizeBytes, 1048576);
});

test("getDatabaseSize calculates page_count * page_size correctly as fallback", async () => {
  const db = makeMockDb(25, 4096) as any;
  const sizeResult = await getDatabaseSize(db);

  assert.equal(typeof sizeResult.sizeBytes, "number");
  assert.equal(sizeResult.sizeBytes, 25 * 4096);
});
