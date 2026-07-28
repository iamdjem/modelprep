import type { Env } from './types';

export async function makerWorldLoginRateKey(account: string): Promise<string> {
  const normalized = account.trim().toLowerCase();
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function allowMakerWorldLogin(env: Env, account: string): Promise<boolean> {
  const { success } = await env.MAKERWORLD_LOGIN_RATE_LIMITER.limit({
    key: await makerWorldLoginRateKey(account),
  });
  return success;
}
