import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { maskSecret, exportExpenses, deleteExpensesByRange } from '../worker/repository';

function makeMockDb(results: any[] = []) {
  const calls: { sql: string; params: any[] }[] = [];
  const db = {
    prepare(sql: string) {
      return {
        bind(...params: any[]) {
          calls.push({ sql, params });
          return {
            run: async () => ({ results: [], meta: { changes: 2 } }),
            all: async () => ({ results }),
          };
        },
        all: async () => {
          calls.push({ sql, params: [] });
          return { results };
        },
        run: async () => {
          calls.push({ sql, params: [] });
          return { results: [], meta: { changes: 2 } };
        }
      };
    },
  };
  return { db: db as any, calls };
}

describe('maskSecret', () => {
  test('returns "****" for empty strings', () => {
    assert.strictEqual(maskSecret(''), '****');
  });

  test('returns "****" for short strings (length <= 4)', () => {
    assert.strictEqual(maskSecret('1'), '****');
    assert.strictEqual(maskSecret('12'), '****');
    assert.strictEqual(maskSecret('123'), '****');
    assert.strictEqual(maskSecret('1234'), '****');
  });

  test('masks middle characters for long strings (length > 4)', () => {
    assert.strictEqual(maskSecret('12345'), '12••••45');
    assert.strictEqual(maskSecret('123456'), '12••••56');
    assert.strictEqual(maskSecret('mypassword'), 'my••••rd');
    assert.strictEqual(maskSecret('supersecret123'), 'su••••23');
  });
});

describe('exportExpenses', () => {
  test('exports expenses filtered by date range and category', async () => {
    const { db, calls } = makeMockDb([
      { id: 1, date: '2026-08-05', amount: 100, category: 'Food', note: 'Lunch' }
    ]);
    const mockUser = { id: 'user1', email: 'test@example.com', name: 'Test', timezone: 'UTC' };
    const expenses = await exportExpenses(db, mockUser, {
      startDate: '2026-08-01',
      endDate: '2026-08-31',
      category: 'Food'
    });

    assert.strictEqual(expenses.length, 1);
    assert.strictEqual(expenses[0].amount, 100);
    assert.match(calls[0].sql, /WHERE user_id = \?/);
    assert.match(calls[0].sql, /date >= \?/);
    assert.match(calls[0].sql, /date <= \?/);
    assert.match(calls[0].sql, /category = \?/);
    assert.deepStrictEqual(calls[0].params, ['user1', '2026-08-01', '2026-08-31', 'Food']);
  });
});

describe('deleteExpensesByRange', () => {
  test('deletes expenses within date range', async () => {
    const { db, calls } = makeMockDb();
    const mockUser = { id: 'user1', email: 'test@example.com', name: 'Test', timezone: 'UTC' };
    const result = await deleteExpensesByRange(db, mockUser, {
      startDate: '2026-08-01',
      endDate: '2026-08-31'
    });

    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.deletedCount, 2);
    assert.match(calls[0].sql, /DELETE FROM expenses WHERE user_id = \?/);
    assert.deepStrictEqual(calls[0].params, ['user1', '2026-08-01', '2026-08-31']);
  });

  test('throws error if no filters are provided', async () => {
    const { db } = makeMockDb();
    const mockUser = { id: 'user1', email: 'test@example.com', name: 'Test', timezone: 'UTC' };
    await assert.rejects(async () => {
      await deleteExpensesByRange(db, mockUser, {});
    }, /At least one filter/);
  });
});
