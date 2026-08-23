import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { getVaultItems, createVaultItem, getVaultSecret } from '../worker/repository';
import { createMcpServer } from '../worker/mcp';

function makeMockDb(results: any[] = []) {
  const calls: { sql: string; params: any[] }[] = [];
  const db = {
    prepare(sql: string) {
      return {
        bind(...params: any[]) {
          calls.push({ sql, params });
          return {
            run: async () => ({ results: [], meta: { changes: 1 } }),
            all: async () => ({ results }),
            first: async () => results[0] || null,
          };
        },
        all: async () => {
          calls.push({ sql, params: [] });
          return { results };
        },
        first: async () => {
          calls.push({ sql, params: [] });
          return results[0] || null;
        },
        run: async () => {
          calls.push({ sql, params: [] });
          return { results: [], meta: { changes: 1 } };
        }
      };
    },
    batch: async () => [
      { results: [] },
      { results: [] },
      { results: [] },
      { results: [] },
    ],
  };
  return { db: db as any, calls };
}

describe('vaultTools repository', () => {
  const mockUser = { id: 'user1', email: 'test@example.com', name: 'Test', timezone: 'UTC' };

  test('getVaultItems fetches items with site query filter', async () => {
    const { db, calls } = makeMockDb([
      { id: 1, site: 'github.com', username: 'octocat', secret: 'oc••••at' }
    ]);
    const items = await getVaultItems(db, mockUser, 10, 0, { query: 'github' });

    assert.strictEqual(items.length, 1);
    assert.strictEqual(items[0].site, 'github.com');
    assert.match(calls[0].sql, /WHERE user_id = \?/);
    assert.match(calls[0].sql, /site LIKE \?/);
    assert.deepStrictEqual(calls[0].params, ['user1', '%github%', 10, 0]);
  });

  test('createVaultItem inserts encrypted secret record', async () => {
    const { db, calls } = makeMockDb();
    const result = await createVaultItem(
      db,
      mockUser,
      { site: 'google.com', username: 'user@gmail.com', secret: 'mysecret' },
      'testmasterkey12345678901234567890'
    );

    assert.strictEqual(result.source, 'd1');
    assert.match(calls[0].sql, /INSERT INTO vault_items/);
    assert.strictEqual(calls[0].params[0], 'user1');
    assert.strictEqual(calls[0].params[1], 'google.com');
    assert.strictEqual(calls[0].params[2], 'user@gmail.com');
  });

  test('getVaultSecret returns empty secret if record not found', async () => {
    const { db } = makeMockDb([]);
    const res = await getVaultSecret(db, mockUser, 999, 'testmasterkey12345678901234567890');
    assert.strictEqual(res.secret, '');
    assert.strictEqual(res.source, 'd1');
  });
});

describe('MCP server vault registration', () => {
  test('createMcpServer initializes without throwing', () => {
    const server = createMcpServer();
    assert.ok(server);
  });
});
