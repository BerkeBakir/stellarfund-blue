'use client';
import { Asset, Operation, TransactionBuilder, BASE_FEE } from '@stellar/stellar-sdk';
import { server } from './soroban';
import { signXdr } from './wallet';
import { fundAccount } from './friendbot';
import { NETWORK_PASSPHRASE, TOKEN_CODE, TOKEN_ISSUER, HORIZON_URL } from './config';

const USDC = new Asset(TOKEN_CODE, TOKEN_ISSUER);

/**
 * Read the wallet's USDC trustline balance from Horizon (reliable for classic
 * accounts). Returns null when the account has no USDC trustline yet, so callers
 * can tell "no trustline" apart from "zero balance".
 */
export async function getUsdcBalance(publicKey: string): Promise<number | null> {
  try {
    const res = await fetch(`${HORIZON_URL}/accounts/${publicKey}`);
    if (!res.ok) return null;
    const data = await res.json();
    const line = (data.balances ?? []).find(
      (b: { asset_code?: string; asset_issuer?: string }) =>
        b.asset_code === TOKEN_CODE && b.asset_issuer === TOKEN_ISSUER,
    );
    return line ? Number(line.balance) : null;
  } catch {
    return null;
  }
}

/** Establish (or refresh) the USDC trustline so the wallet can hold USDC. */
export async function ensureTrustline(publicKey: string): Promise<void> {
  const account = await server.getAccount(publicKey);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(Operation.changeTrust({ asset: USDC }))
    .setTimeout(60)
    .build();

  const signed = await signXdr(tx.toXDR(), publicKey);
  const signedTx = TransactionBuilder.fromXDR(signed, NETWORK_PASSPHRASE);
  const sent = await server.sendTransaction(signedTx);
  if (sent.status === 'ERROR') {
    throw new Error(`Trustline failed: ${sent.errorResult?.toXDR('base64') ?? 'unknown'}`);
  }
  let got = await server.getTransaction(sent.hash);
  const deadline = Date.now() + 30_000;
  while (got.status === 'NOT_FOUND' && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2000));
    got = await server.getTransaction(sent.hash);
  }
  if (got.status !== 'SUCCESS') {
    throw new Error(`Trustline ended with status ${got.status}.`);
  }
}

/**
 * One-tap onboarding: make sure the account exists (friendbot), has a USDC
 * trustline, then request test USDC from the server faucet. Returns the mint
 * tx hash.
 */
export async function getTestUsdc(publicKey: string): Promise<string> {
  await fundAccount(publicKey).catch(() => {
    /* already funded — ignore */
  });
  await ensureTrustline(publicKey);
  const res = await fetch('/api/faucet', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ address: publicKey }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error ?? `Faucet failed (${res.status}).`);
  }
  return data.hash as string;
}
