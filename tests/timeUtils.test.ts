import { test, describe } from 'node:test';
import assert from 'node:assert';
import { toLocalInputString } from '../src/lib/timeUtils';

describe('timeUtils', () => {
  describe('toLocalInputString', () => {
    test('returns valid date string for type "date"', () => {
      const result = toLocalInputString('2024-01-01T12:34:56Z', 'UTC', 'date');
      assert.strictEqual(result, '2024-01-01');
    });

    test('returns valid datetime string for type "datetime-local"', () => {
      const result = toLocalInputString('2024-01-01T12:34:56Z', 'UTC', 'datetime-local');
      assert.strictEqual(result, '2024-01-01T12:34');
    });

    test('returns original string when an error occurs (e.g., invalid time zone)', () => {
      const original = '2024-01-01T12:34:56Z';
      const result = toLocalInputString(original, 'Invalid/TimeZone', 'date');
      assert.strictEqual(result, original);
    });
  });
});
