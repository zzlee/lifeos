import test from 'node:test';
import assert from 'node:assert';
import { encryptSecret, decryptSecret } from '../worker/crypto.ts';

const KEY_MATERIAL = "vault-master-key-secure-123";

test('Vault Encryption and Decryption', async () => {
  const secret = "my-super-secret-password-123!";

  const { ciphertext, iv } = await encryptSecret(secret, KEY_MATERIAL);
  assert.ok(ciphertext);
  assert.ok(iv);
  assert.notStrictEqual(ciphertext, secret);

  const decrypted = await decryptSecret(ciphertext, iv, KEY_MATERIAL);
  assert.strictEqual(decrypted, secret);
});

test('Decryption fails with wrong key', async () => {
  const secret = "another-secret";
  const { ciphertext, iv } = await encryptSecret(secret, KEY_MATERIAL);

  await assert.rejects(async () => {
    await decryptSecret(ciphertext, iv, "wrong-key");
  });
});
