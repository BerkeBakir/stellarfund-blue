'use client';
import { signXdr } from '../wallet';
import { ANCHOR_BASE_URL } from '../config';

const AUTH_ENDPOINT = `${ANCHOR_BASE_URL}/auth`;

// In-memory JWT cache per wallet (sufficient for a session/demo).
const tokenCache = new Map<string, { token: string; exp: number }>();

/**
 * SEP-10 authentication: fetch a challenge transaction from the anchor, have
 * the wallet sign it, exchange it for a JWT. Returns a bearer token used by
 * SEP-24/SEP-12 calls.
 */
export async function getAnchorToken(publicKey: string): Promise<string> {
  const cached = tokenCache.get(publicKey);
  if (cached && cached.exp > Date.now() / 1000 + 60) {
    return cached.token;
  }

  // 1) Request the challenge.
  const challengeRes = await fetch(
    `${AUTH_ENDPOINT}?account=${encodeURIComponent(publicKey)}`,
  );
  if (!challengeRes.ok) {
    throw new Error(`Anchor auth challenge failed (${challengeRes.status}).`);
  }
  const challenge = await challengeRes.json();
  const unsignedXdr: string = challenge.transaction;
  if (!unsignedXdr) throw new Error('Anchor did not return a challenge transaction.');

  // 2) Sign the challenge with the user's wallet.
  const signedXdr = await signXdr(unsignedXdr, publicKey);

  // 3) Exchange the signed challenge for a JWT.
  const tokenRes = await fetch(AUTH_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ transaction: signedXdr }),
  });
  if (!tokenRes.ok) {
    const body = await tokenRes.text().catch(() => '');
    throw new Error(`Anchor auth failed (${tokenRes.status}). ${body.slice(0, 120)}`);
  }
  const { token } = await tokenRes.json();
  if (!token) throw new Error('Anchor did not return a token.');

  // Best-effort expiry parse from the JWT payload.
  let exp = Date.now() / 1000 + 600;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.exp) exp = Number(payload.exp);
  } catch {
    /* ignore */
  }
  tokenCache.set(publicKey, { token, exp });
  return token;
}
