import test from 'node:test';
import assert from 'node:assert';
import {
  signSessionToken,
  verifySessionToken,
  createOAuthState,
  verifyOAuthState
} from '../worker/auth.ts';

const SECRET = "test-secret-123";

test('SessionToken signing and verification', async () => {
  const payload: any = {
    user: { id: "user1", email: "user@test.com", name: "Test User", timezone: "UTC" },
    provider: "google-ready",
    exp: Date.now() + 1000 * 60 * 60
  };

  const token = await signSessionToken(payload, SECRET);
  assert.ok(token);
  assert.ok(token.includes('.'));

  const verified = await verifySessionToken(token, SECRET);
  assert.ok(verified);
  assert.strictEqual(verified.user.id, "user1");
  assert.strictEqual(verified.provider, "google-ready");

  const invalidVerified = await verifySessionToken(token, "wrong-secret");
  assert.strictEqual(invalidVerified, null);
});

test('SessionToken verification fails on expiry', async () => {
  const payload: any = {
    user: { id: "user2", email: "user2@test.com", name: "Test User 2", timezone: "UTC" },
    provider: "google-ready",
    exp: Date.now() - 1000 // expired
  };

  const token = await signSessionToken(payload, SECRET);
  const verified = await verifySessionToken(token, SECRET);
  assert.strictEqual(verified, null);
});

test('OAuthState creation and verification', async () => {
  const origin = "https://lifeos.test";
  const state = await createOAuthState(origin, SECRET);
  assert.ok(state);

  const verifiedState = await verifyOAuthState(state, SECRET);
  assert.ok(verifiedState);
  assert.strictEqual(verifiedState.origin, origin);

  const invalidVerified = await verifyOAuthState(state, "wrong-secret");
  assert.strictEqual(invalidVerified, null);
});
