import type { CampaignMeta } from './metadata';

export type DiscoveryItem = { address: string; meta?: CampaignMeta };

/**
 * Filter campaign addresses by a case-insensitive text query (matched against
 * title + description) and an optional category. An empty query matches all;
 * a null category matches all.
 */
export function filterCampaigns(
  items: DiscoveryItem[],
  opts: { query: string; category: string | null },
): string[] {
  const q = opts.query.trim().toLowerCase();
  return items
    .filter((it) => {
      if (opts.category && it.meta?.category !== opts.category) return false;
      if (!q) return true;
      const hay = `${it.meta?.title ?? ''} ${it.meta?.description ?? ''}`.toLowerCase();
      return hay.includes(q);
    })
    .map((it) => it.address);
}
