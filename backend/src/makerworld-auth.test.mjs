import assert from 'node:assert/strict';
import test from 'node:test';
import { allowMakerWorldLogin, makerWorldLoginRateKey } from './makerworld-auth.ts';

test('MakerWorld login rate keys normalize account identifiers without exposing them', async () => {
  const first = await makerWorldLoginRateKey(' Person@Example.com ');
  const second = await makerWorldLoginRateKey('person@example.com');
  assert.equal(first, second);
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(first.includes('person'), false);
});

test('MakerWorld login stops when the Cloudflare limiter denies an attempt', async () => {
  let receivedKey = '';
  const env = {
    MAKERWORLD_LOGIN_RATE_LIMITER: {
      async limit({ key }) {
        receivedKey = key;
        return { success: false };
      },
    },
  };
  assert.equal(await allowMakerWorldLogin(env, 'person@example.com'), false);
  assert.match(receivedKey, /^[a-f0-9]{64}$/);
});
