# StellarFund — Level 5 (Blue Belt) Design

> Status: **Approved** (2026-06-30). L5 focus: **user growth + product iteration + pitch & demo.**
> Builds on the live L4 MVP (https://stellarfund-xi.vercel.app).

## 1. Scope — three workstreams

**A. Product (engineering — Claude):**
- **Campaign identity:** title, description, category, cover image, creator name. Cards/detail/discovery show these instead of the raw contract address.
- **Discovery:** category filters + text search, on top of the existing active/past split.
- **UX & stability:** faster onboarding, small bug fixes (e.g. the home "Unique backers" stat currently counts unique creators, not real backers).

**B. Growth (process — user + Claude):**
- 50 testnet users with real transaction activity (user drives onboarding; `/proof` is the active-usage proof).
- **Google Form** collecting wallet address, email, name, product rating, feedback (Claude drafts the questions; user creates/shares the form, gathers responses, exports to Excel, links it in the README).
- README "feedback iteration" summary with git commit links (Claude writes from the collected feedback).

**C. Presentation (Claude):**
- Professional pitch deck (`.pptx`): problem, solution, market, architecture, growth strategy, roadmap.
- Demo video script (user records).

## 2. Architecture — off-chain campaign metadata

Contracts store only address + amounts + milestones on-chain. Human-readable
identity (title, description, category, cover image, creator name) lives
**off-chain**, keyed by the campaign's contract address.

**Storage: Vercel Blob** (free on Hobby, provisioned via CLI — no extra accounts/keys for the user).
- Metadata: one JSON object per campaign at `campaigns/<address>.json`.
- Cover images: `covers/<address>.<ext>` (public Blob URLs).
- A server `BLOB_READ_WRITE_TOKEN` (env, server-only) authorizes writes/listing.

**Metadata shape:**
```json
{
  "address": "C...",
  "title": "Bakery in Nairobi",
  "description": "...",
  "category": "Community",
  "creatorName": "Jane",
  "imageUrl": "https://...blob.../covers/C....jpg",
  "createdAt": "2026-06-30T..."
}
```

**Categories (fixed list):** Education, Health, Technology, Community, Emergency, Other.

**Data flow (create):**
1. Creator fills title / description / category / cover image / creator name + goal/milestones.
2. On-chain `create_campaign` runs → returns the new campaign address.
3. Client uploads the cover image to `POST /api/campaigns/upload` → Blob URL.
4. Client writes metadata to `POST /api/campaigns` (`campaigns/<address>.json`).

**Data flow (read):**
- `GET /api/campaigns` lists `campaigns/*` blobs → returns a `{address: metadata}` map.
- Home/discovery merges on-chain summaries (via `list_campaigns`) with metadata.
- Missing metadata → fall back to the truncated address (existing behaviour). Demo campaigns get metadata backfilled.

## 3. Components

- `src/lib/metadata.ts` — client helpers: `getAllMetadata()`, `getMetadata(address)`, `putMetadata(...)`, `uploadCover(file)`.
- `src/app/api/campaigns/route.ts` — GET (list) + POST (write metadata) using Blob.
- `src/app/api/campaigns/upload/route.ts` — POST cover image → Blob.
- `CreateForm.tsx` — add title/description/category/image/creatorName fields; write metadata after on-chain create.
- `CampaignCard.tsx` / `CampaignDetail.tsx` — render title/image/category/creator from metadata (address fallback).
- `src/app/page.tsx` — category filter chips + search box; keep active/past split.
- `src/components/Discovery.tsx` (optional) — filter/search UI extracted for clarity.
- Fix `LiveStats` backers stat (use real unique-backer count from `/proof` data or label correctly).

## 4. Error handling & stability

- Metadata writes are best-effort: if the Blob write fails after a successful on-chain create, the campaign still exists (address fallback) and metadata can be re-submitted. Surface a clear toast.
- Image upload: validate type (jpg/png/webp) and size (≤ 2 MB); show progress + errors.
- All new fetches have loading/empty/error states.
- Category filter + search are pure client-side over the merged list (fast for tens of campaigns).

## 5. Testing

- Unit-test the metadata merge/filter logic (search + category) with vitest.
- Unit-test category validation and metadata shape.
- Manual: create a campaign end-to-end (metadata + image), verify card/detail render, verify discovery filters.

## 6. Deliverables checklist (belt)

- [ ] Campaign identity + discovery shipped
- [ ] UX/stability + onboarding improvements
- [ ] Google Form questions drafted (user creates form)
- [ ] README: Excel link + feedback-iteration summary with commit links
- [ ] 50+ users (user) + `/proof` active-usage proof
- [ ] Pitch deck `.pptx`
- [ ] Demo video (user records; Claude scripts)
- [ ] 20+ meaningful commits + updated docs

## 7. Out of scope for L5 (deferred to L6+)

- Mainnet / live licensed anchor + real USDC.
- On-chain governance voting, yield on idle escrow.
- In-app registration form (belt requires a Google Form; the existing feedback widget stays as a bonus).
- Relational DB / full creator profiles (Blob metadata is sufficient at this scale).
