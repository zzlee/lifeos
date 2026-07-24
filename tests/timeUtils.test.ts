import test from "node:test";
import assert from "node:assert";
import {
  toLocalDisplayDate,
  toLocalDisplayTime,
  toLocalInputString,
  localInputToUtcString,
  getCurrentLocalInputString
} from "../src/lib/timeUtils.ts";

test("toLocalDisplayDate", () => {
  assert.strictEqual(toLocalDisplayDate("2023-10-10T12:00:00Z", "UTC"), "2023-10-10");
  assert.strictEqual(toLocalDisplayDate("2023-10-10 12:00:00Z", "UTC"), "2023-10-10");
  assert.strictEqual(toLocalDisplayDate("2023-10-10 12:00:00", "UTC"), "2023-10-10");

  assert.strictEqual(toLocalDisplayDate("2023-10-10T23:00:00Z", "Asia/Tokyo"), "2023-10-11");
  assert.strictEqual(toLocalDisplayDate("2023-10-10T01:00:00Z", "America/New_York"), "2023-10-09");

  assert.strictEqual(toLocalDisplayDate("2023-10-10T12:00:00Z", "Invalid/Timezone"), "2023-10-10T12:00:00Z");
});

test("toLocalDisplayTime", () => {
  assert.strictEqual(toLocalDisplayTime("2023-10-10T12:00:00Z", "UTC"), "2023-10-10 12:00:00");
  assert.strictEqual(toLocalDisplayTime("2023-10-10T23:00:00Z", "Asia/Tokyo"), "2023-10-11 08:00:00");

  assert.strictEqual(toLocalDisplayTime("2023-10-10T12:00:00Z", "Invalid/Timezone"), "2023-10-10T12:00:00Z");
});

test("toLocalInputString", () => {
  assert.strictEqual(toLocalInputString("2023-10-10T12:00:00Z", "UTC", "date"), "2023-10-10");
  assert.strictEqual(toLocalInputString("2023-10-10T12:00:00Z", "UTC", "datetime-local"), "2023-10-10T12:00");

  assert.strictEqual(toLocalInputString("2023-10-10T23:00:00Z", "Asia/Tokyo", "date"), "2023-10-11");
  assert.strictEqual(toLocalInputString("2023-10-10T23:00:00Z", "Asia/Tokyo", "datetime-local"), "2023-10-11T08:00");

  assert.strictEqual(toLocalInputString("2023-10-10T12:00:00Z", "Invalid/Timezone", "date"), "2023-10-10T12:00:00Z");
});

test("localInputToUtcString", () => {
  assert.strictEqual(localInputToUtcString("", "UTC"), "");

  assert.strictEqual(localInputToUtcString("2023-10-10", "UTC"), "2023-10-10T00:00:00.000Z");
  assert.strictEqual(localInputToUtcString("2023-10-10", "Asia/Tokyo"), "2023-10-09T15:00:00.000Z");
  assert.strictEqual(localInputToUtcString("2023-10-10", "America/New_York"), "2023-10-10T04:00:00.000Z");

  assert.strictEqual(localInputToUtcString("2023-10-10T12:00", "UTC"), "2023-10-10T12:00:00.000Z");
  assert.strictEqual(localInputToUtcString("2023-10-10T12:00", "Asia/Tokyo"), "2023-10-10T03:00:00.000Z");

  const inputStr = "2023-10-10T12:00";
  assert.strictEqual(localInputToUtcString(inputStr, "Invalid/Timezone"), new Date(inputStr).toISOString());
});

test("getCurrentLocalInputString", () => {
  const dateStr = getCurrentLocalInputString("UTC", "date");
  assert.match(dateStr, /^\d{4}-\d{2}-\d{2}$/);

  const dateTimeStr = getCurrentLocalInputString("UTC", "datetime-local");
  assert.match(dateTimeStr, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
});
