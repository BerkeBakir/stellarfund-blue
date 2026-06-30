import { scValToNative, xdr } from '@stellar/stellar-sdk';
import { server } from './soroban';
import { listCampaigns } from './factory';

export type Backer = {
  address: string;
  totalContributed: bigint; // USDC base units
  contributions: number;
  lastLedger: number;
  lastTxHash: string;
};

export type ProofData = {
  backers: Backer[];
  uniqueBackers: number;
  totalContributions: number;
  totalVolume: bigint;
  windowStartLedger: number;
  latestLedger: number;
};

// Soroban RPC scans only a bounded number of ledgers per getEvents call and
// returns a continuation cursor — even for empty pages. We therefore start near
// the oldest retained ledger and paginate forward via the cursor until we reach
// the latest ledger, so no contribution is missed.
const LOOKBACK_LEDGERS = 100_000;
const MAX_PAGES = 80;

function ledgerFromCursor(cursor: string): number {
  // cursor = "<toid>-<index>"; toid = (ledger << 32) | ...
  try {
    const toid = BigInt(cursor.split('-')[0]);
    return Number(toid >> 32n);
  } catch {
    return 0;
  }
}

export async function getProofData(): Promise<ProofData> {
  const latestLedger = (await server.getLatestLedger()).sequence;
  const windowStartLedger = Math.max(latestLedger - LOOKBACK_LEDGERS, 1);
  const campaigns = await listCampaigns();

  const byAddress = new Map<string, Backer>();
  let totalContributions = 0;
  let totalVolume = 0n;

  // Soroban RPC allows at most 5 contract IDs per getEvents filter, so scan
  // campaigns in chunks of 5 and merge the results.
  const CHUNK = 5;
  for (let c = 0; c < campaigns.length; c += CHUNK) {
    const chunk = campaigns.slice(c, c + CHUNK);
    const filters = [
      { type: 'contract' as const, contractIds: chunk, topics: [['*', '*']] },
    ];
    let cursor: string | undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
      const req = cursor
        ? { cursor, filters, limit: 10000 }
        : { startLedger: windowStartLedger, filters, limit: 10000 };
      const resp = await server.getEvents(req);

      for (const e of resp.events ?? []) {
        let topic0: string;
        let topic1: string | null = null;
        try {
          const topics = (e.topic as xdr.ScVal[]).map((t) => scValToNative(t));
          topic0 = String(topics[0]);
          topic1 = topics[1] != null ? String(topics[1]) : null;
        } catch {
          continue;
        }
        if (topic0 !== 'contrib' || !topic1) continue;

        let amount = 0n;
        try {
          const v = scValToNative(e.value);
          amount = typeof v === 'bigint' ? v : BigInt(v);
        } catch {
          /* keep 0 */
        }
        totalContributions += 1;
        totalVolume += amount;
        const prev = byAddress.get(topic1);
        if (prev) {
          prev.totalContributed += amount;
          prev.contributions += 1;
          if (e.ledger >= prev.lastLedger) {
            prev.lastLedger = e.ledger;
            prev.lastTxHash = e.txHash ?? '';
          }
        } else {
          byAddress.set(topic1, {
            address: topic1,
            totalContributed: amount,
            contributions: 1,
            lastLedger: e.ledger,
            lastTxHash: e.txHash ?? '',
          });
        }
      }

      if (!resp.cursor) break;
      cursor = resp.cursor;
      if (ledgerFromCursor(resp.cursor) >= resp.latestLedger) break;
    }
  }

  const backers = [...byAddress.values()].sort((a, b) => b.lastLedger - a.lastLedger);
  return {
    backers,
    uniqueBackers: backers.length,
    totalContributions,
    totalVolume,
    windowStartLedger,
    latestLedger,
  };
}
