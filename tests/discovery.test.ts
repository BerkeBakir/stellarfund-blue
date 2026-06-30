import { describe, it, expect } from 'vitest';
import { filterCampaigns, type DiscoveryItem } from '@/lib/discovery';
import type { CampaignMeta } from '@/lib/metadata';

function meta(p: Partial<CampaignMeta>): CampaignMeta {
  return {
    address: 'C',
    title: '',
    description: '',
    category: 'Other',
    creatorName: '',
    imageUrl: null,
    createdAt: '',
    ...p,
  };
}

const items: DiscoveryItem[] = [
  { address: 'A', meta: meta({ address: 'A', title: 'Bakery in Nairobi', category: 'Community' }) },
  { address: 'B', meta: meta({ address: 'B', title: 'Solar pump', description: 'clean water', category: 'Technology' }) },
  { address: 'C' }, // no metadata
];

describe('filterCampaigns', () => {
  it('empty query + null category returns all', () => {
    expect(filterCampaigns(items, { query: '', category: null })).toEqual(['A', 'B', 'C']);
  });
  it('matches query against title', () => {
    expect(filterCampaigns(items, { query: 'bakery', category: null })).toEqual(['A']);
  });
  it('matches query against description', () => {
    expect(filterCampaigns(items, { query: 'water', category: null })).toEqual(['B']);
  });
  it('filters by category', () => {
    expect(filterCampaigns(items, { query: '', category: 'Technology' })).toEqual(['B']);
  });
  it('combines query and category', () => {
    expect(filterCampaigns(items, { query: 'solar', category: 'Technology' })).toEqual(['B']);
    expect(filterCampaigns(items, { query: 'solar', category: 'Community' })).toEqual([]);
  });
});
