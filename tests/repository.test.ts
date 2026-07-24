import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { maskSecret } from '../worker/repository';

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
