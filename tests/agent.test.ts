import test from 'node:test';
import assert from 'node:assert';
import { parseAgentInput, hydrateAgentMutation } from '../shared/lifeAgent.ts';

test('parseAgentInput - vault parsing', () => {
  const state: any = { vault: [] };
  const input = "新增 密碼庫 網站: google 帳號: test_user 密碼: secret123";
  const result = parseAgentInput(input, state, 'UTC');

  assert.strictEqual(result.kind, 'vault');
  assert.ok(result.message.includes('google'));
  if (result.kind === 'vault') {
    assert.strictEqual(result.entry.site, 'google');
    assert.strictEqual(result.entry.username, 'test_user');
    assert.strictEqual(result.entry.secret, 'secret123');
  }
});

test('parseAgentInput - finance parsing', () => {
  const state: any = { finance: [] };
  const input = "午餐 買 150 元";
  const result = parseAgentInput(input, state, 'UTC');

  assert.strictEqual(result.kind, 'expense');
  if (result.kind === 'expense') {
    assert.strictEqual(result.entry.amount, 150);
    assert.strictEqual(result.entry.category, '餐飲');
  }
});

test('parseAgentInput - health parsing', () => {
  const state: any = { health: [{ sys: 120, dia: 80, hr: 72 }] };
  const input = "血壓 130/85 心跳 80 體重 70.5kg";
  const result = parseAgentInput(input, state, 'UTC');

  assert.strictEqual(result.kind, 'health');
  if (result.kind === 'health') {
    assert.strictEqual(result.entry.sys, 130);
    assert.strictEqual(result.entry.dia, 85);
    assert.strictEqual(result.entry.hr, 80);
    assert.strictEqual(result.entry.weight, 70.5);
  }
});

test('parseAgentInput - journal parsing', () => {
  const state: any = { journal: [] };
  const input = "今天工作很順利";
  const result = parseAgentInput(input, state, 'UTC');

  assert.strictEqual(result.kind, 'journal');
  if (result.kind === 'journal') {
    assert.strictEqual(result.entry.content, input);
    assert.deepStrictEqual(result.entry.tags, ['成就感', '工作']);
  }
});

test('hydrateAgentMutation - expense', () => {
  const serialized: any = {
    kind: "expense",
    entry: { amount: 200, category: "交通", note: "高鐵" }
  };
  const state: any = {};
  const result = hydrateAgentMutation(serialized, state, 'UTC');

  assert.strictEqual(result.kind, 'expense');
  if (result.kind === 'expense') {
    assert.strictEqual(result.entry.amount, 200);
    assert.strictEqual(result.entry.category, "交通");
    assert.strictEqual(result.entry.note, "高鐵");
  }
});

test('hydrateAgentMutation - health', () => {
  const serialized: any = {
    kind: "health",
    entry: { sys: 125, dia: 82, hr: 75, weight: 71 }
  };
  const state: any = { health: [{ sys: 120, dia: 80, hr: 72 }] };
  const result = hydrateAgentMutation(serialized, state, 'UTC');

  assert.strictEqual(result.kind, 'health');
  if (result.kind === 'health') {
    assert.strictEqual(result.entry.sys, 125);
    assert.strictEqual(result.entry.dia, 82);
    assert.strictEqual(result.entry.hr, 75);
    assert.strictEqual(result.entry.weight, 71);
  }
});

test('hydrateAgentMutation - vault', () => {
  const serialized: any = {
    kind: "vault",
    entry: { site: "github", username: "user1", secret: "pass1" }
  };
  const state: any = {};
  const result = hydrateAgentMutation(serialized, state, 'UTC');

  assert.strictEqual(result.kind, 'vault');
  if (result.kind === 'vault') {
    assert.strictEqual(result.entry.site, "github");
    assert.strictEqual(result.entry.username, "user1");
    assert.strictEqual(result.entry.secret, "pass1");
  }
});
