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

test("getDatabaseSize calculates page_count * page_size correctly", async () => {
  const db = makeMockDb(25, 4096) as any;
  const sizeResult = await getDatabaseSize(db);

  assert.equal(typeof sizeResult.sizeBytes, "number");
  assert.equal(sizeResult.sizeBytes, 25 * 4096);
});
