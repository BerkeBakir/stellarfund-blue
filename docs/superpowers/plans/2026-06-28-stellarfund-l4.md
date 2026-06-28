# StellarFund L4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve the Orange Belt crowdfund engine into StellarFund — a cross-border, USDC-denominated, milestone-escrow crowdfunding dApp with a real SEP-24 sandbox fiat↔USDC anchor bridge, a bold animated frontend, TR/EN i18n, an on-chain proof board, and full production telemetry.

**Architecture:** Three Soroban contracts (Factory → Escrow → Reputation) preserved from Orange Belt; Campaign becomes **Escrow** with USDC custody and a creator-defined **milestone schedule** that releases funds tranche-by-tranche. Next.js 15 App Router frontend (StellarWalletsKit + stellar-sdk 16) consumes the contracts; a SEP-24/10/12 client integrates `testanchor.stellar.org` for on/off ramp. Vercel Analytics + Sentry + a feedback form provide telemetry; a `/proof` page reads unique backer wallets from chain.

**Tech Stack:** Rust + soroban-sdk 22 (contracts), stellar-cli (deploy), Next.js 15 / React 19 / TypeScript, Tailwind v4, Framer Motion, @stellar/stellar-sdk 16, @creit.tech/stellar-wallets-kit 2.4, next-intl (i18n), @sentry/nextjs, @vercel/analytics, vitest.

## Global Constraints

- **Network: Stellar Testnet only.** No mainnet, no real funds.
- **Token: Testnet USDC** via its Stellar Asset Contract (SAC), not native XLM. The USDC SAC address is configured in `src/lib/config.ts` and the Factory/Escrow `token` param.
- **soroban-sdk version:** match the existing `contracts/*/Cargo.toml` (22.x) — do not bump.
- **stellar-sdk 16 / StellarWalletsKit 2.4 APIs** must be verified against the installed `.d.ts` before use (per proven workflow) — do not trust from memory.
- **Money-safety invariants (Escrow):** sum of milestone amounts == goal; each milestone releases at most once; total_released + refundable_balance <= total_raised; refund path always reachable after deadline when status != Completed.
- **Mobile-first responsive** + **loading/error states** (skeleton + toast + retry) on every on-chain/anchor action.
- **i18n:** every user-facing string goes through next-intl; TR + EN locale files kept in sync.
- **Frequent commits**, conventional-commit messages, ≥15 meaningful commits overall.

---

## Phase A — Contracts (USDC + milestone escrow)

### Task A1: Escrow data model + milestone schedule in `init`

**Files:**
- Modify: `contracts/campaign/src/lib.rs`
- Test: `contracts/campaign/src/test.rs`

**Interfaces:**
- Produces: `Status { Active=0, Releasing=1, Completed=2, Refunding=3 }`; `Milestone { amount: i128, released: bool }`; `init(env, creator, goal, deadline, token, reputation, factory, milestones: Vec<i128>)` — stores a `Vec<Milestone>` under `DataKey::Milestones`, panics unless `sum(milestones) == goal` and every entry `> 0`.

- [ ] **Step 1: Write failing test** — `init_rejects_milestones_not_summing_to_goal` and `init_stores_milestone_schedule` (assert `milestones()` returns the vec, all `released=false`). Use existing test harness patterns in `test.rs`.
- [ ] **Step 2: Run** `cd contracts/campaign && cargo test init_` → Expected FAIL (milestones param/field missing).
- [ ] **Step 3: Implement** — add `Milestone` contracttype, `Status` rename (Claimed→Releasing/Completed split), `DataKey::Milestones`, `DataKey::TotalReleased`; extend `init` signature with `milestones: Vec<i128>`, validate sum==goal and each >0, store `Vec<Milestone>` with `released=false`, set `TotalReleased=0`. Add `milestones()` and `total_released()` getters.
- [ ] **Step 4: Run** `cargo test init_` → Expected PASS.
- [ ] **Step 5: Commit** `feat(escrow): milestone schedule in init with sum==goal invariant`.

### Task A2: `release(milestone_index)` replaces `claim`

**Files:** Modify `contracts/campaign/src/lib.rs`; Test `contracts/campaign/src/test.rs`

**Interfaces:**
- Consumes: A1 data model.
- Produces: `release(env, index: u32)` — creator-auth; requires deadline passed AND total_raised >= goal; releases milestone `index` (panic if already released or out-of-order — enforce sequential: index must equal count of already-released); transfers that tranche of USDC to creator; on the final milestone sets `Status::Completed` and calls `ReputationClient.record_success`; emits `release` event `(index, amount)`. Intermediate releases set `Status::Releasing`.

- [ ] **Step 1: Write failing tests** — `release_sends_tranche_and_advances`, `release_must_be_sequential`, `final_release_completes_and_records_reputation`, `cannot_release_before_goal_or_deadline`.
- [ ] **Step 2: Run** `cargo test release` → FAIL.
- [ ] **Step 3: Implement** `release`; remove/replace old `claim`. Reuse the goal/deadline guards from old `claim`. Track released count via `TotalReleased` and per-milestone `released` flag.
- [ ] **Step 4: Run** `cargo test release` → PASS.
- [ ] **Step 5: Commit** `feat(escrow): sequential milestone release with reputation on completion`.

### Task A3: Refund path updated for milestone status + already-released funds

**Files:** Modify `contracts/campaign/src/lib.rs`; Test `contracts/campaign/src/test.rs`

**Interfaces:**
- Produces: `refund(env, caller)` — after deadline, if total_raised < goal and status != Completed; refunds caller's full contribution. (Goal-met-but-not-fully-released funds are NOT refundable — milestone model assumes goal-met campaigns proceed.) Keeps `refunded` event.

- [ ] **Step 1: Write failing tests** — `refund_when_goal_missed` (adapt existing), `cannot_refund_after_completion`.
- [ ] **Step 2: Run** `cargo test refund` → FAIL.
- [ ] **Step 3: Implement** — update status checks to new enum; block refund when `Status::Completed`.
- [ ] **Step 4: Run** `cargo test refund` → PASS.
- [ ] **Step 5: Commit** `feat(escrow): refund respects milestone completion status`.

### Task A4: `summary` exposes milestone progress

**Files:** Modify `contracts/campaign/src/lib.rs`; Test `contracts/campaign/src/test.rs`

**Interfaces:**
- Produces: `summary(env) -> (Address, i128, u64, i128, u32, u32, u32)` = (creator, goal, deadline, total_raised, status, milestone_count, released_count). Keep `contribution_of`, add `milestones()` from A1.

- [ ] **Step 1: Write failing test** `summary_reports_milestone_progress`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** extended tuple.
- [ ] **Step 4: Run** → PASS. Then `cargo test` (whole campaign crate) → all PASS.
- [ ] **Step 5: Commit** `feat(escrow): summary includes milestone progress`.

### Task A5: Factory passes milestones through `create_campaign`

**Files:** Modify `contracts/factory/src/lib.rs`; Test `contracts/factory/src/test.rs`

**Interfaces:**
- Consumes: Escrow `init(..., milestones)`.
- Produces: `create_campaign(env, creator, goal, deadline, milestones: Vec<i128>) -> Address` — forwards milestones to the deployed Escrow's `init`. Rebuild the campaign wasm import after A1–A4 (`make build` / `stellar contract build`) so `contractimport!` picks up the new `init` signature.

- [ ] **Step 1:** Rebuild campaign wasm: `cd contracts/campaign && stellar contract build` (or cargo build target wasm). Confirm `target/wasm32v1-none/release/campaign.wasm` updated.
- [ ] **Step 2: Write failing test** `creates_campaign_with_milestones` (adapt existing `creates_and_registers_campaign`).
- [ ] **Step 3: Run** `cd contracts/factory && cargo test` → FAIL (signature mismatch).
- [ ] **Step 4: Implement** extended `create_campaign`.
- [ ] **Step 5: Run** `cargo test` (factory) → PASS.
- [ ] **Step 6: Commit** `feat(factory): forward milestone schedule to escrow`.

### Task A6: Reputation milestone-delivery count

**Files:** Modify `contracts/reputation/src/lib.rs`; Test `contracts/reputation/src/test.rs`

**Interfaces:**
- Produces: keep `record_success(campaign, creator)` + `get_score(creator)`; add `milestones_delivered(creator) -> u32` incremented per successful campaign completion (1 per completed campaign is acceptable for L4). No interface break for Escrow.

- [ ] **Step 1: Write failing test** `tracks_milestones_delivered`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `cargo test` (reputation) → PASS.
- [ ] **Step 5: Commit** `feat(reputation): track milestone deliveries`.

### Task A7: Deploy all three contracts to Testnet + wire USDC SAC

**Files:** Modify `scripts/deploy.sh`; Create `docs/DEPLOYMENT.md` (addresses table)

- [ ] **Step 1:** Ensure a funded testnet deployer identity (`stellar keys generate`/`fund`). Determine the **Testnet USDC asset** issuer and create/lookup its SAC id (`stellar contract asset deploy --asset USDC:<issuer>` or `--asset id`). Record the USDC SAC contract id.
- [ ] **Step 2:** Build all contracts (`stellar contract build`). Upload campaign wasm → hash. Deploy Reputation, deploy Factory with (campaign_wasm_hash, USDC_SAC, reputation), init Reputation with factory address.
- [ ] **Step 3:** Smoke test: `create_campaign` with a 2-milestone schedule; assert it appears in `list_campaigns`.
- [ ] **Step 4:** Write addresses (Factory, Reputation, campaign wasm hash, USDC SAC) into `docs/DEPLOYMENT.md` and `src/lib/config.ts`.
- [ ] **Step 5: Commit** `chore(deploy): StellarFund contracts live on testnet (USDC)`.

---

## Phase B — On-chain core frontend (no anchor yet)

> Base already exists from crowdfund: `src/lib/{config,soroban,factory,campaign,reputation,events,wallet,friendbot,format}.ts`, `src/components/*`, `src/store.ts`. These tasks **evolve** them. Verify stellar-sdk 16 / kit 2.4 APIs against installed `.d.ts` before editing.

### Task B1: Config + USDC + locale scaffolding
- Modify `src/lib/config.ts` (new addresses, USDC SAC, decimals=7, anchor base URL constant `https://testanchor.stellar.org`). Install `next-intl`, `framer-motion`, `@vercel/analytics`, `@sentry/nextjs`. Set up `next-intl` middleware + `messages/en.json` + `messages/tr.json` skeleton. Commit `chore: config for USDC + i18n + telemetry deps`.

### Task B2: campaign.ts client — milestones + release
- Modify `src/lib/campaign.ts`: add `release(index)`, update `summary` decode for the 7-tuple, add `milestones()` decode (Vec<{amount,released}>). Live-read sanity check against the A7 smoke campaign. Commit.

### Task B3: factory.ts — createCampaign with milestones
- Modify `src/lib/factory.ts`: `createCampaign(creator, goalUsdc, deadline, milestones: bigint[])`. Commit.

### Task B4: CreateForm — milestone builder UI
- Modify `src/components/CreateForm.tsx` + `src/app/create/page.tsx`: multi-step wizard (details → milestones with add/remove rows that must sum to goal → review). Validation + loading/error toasts. i18n strings. Commit.

### Task B5: Campaign detail — milestone timeline + contribute (USDC) + release
- Modify `src/components/CampaignDetail.tsx` + `src/app/campaign/[id]/page.tsx`: visual milestone timeline (released vs pending), USDC contribute flow, creator `release` button gated on goal+deadline, live event feed. Commit.

### Task B6: Discover/home + CampaignCard (USDC amounts)
- Modify `src/app/page.tsx`, `src/components/CampaignCard.tsx`: USDC formatting, country/category badge, search/filter. Update `tests/CampaignCard.test.tsx`. Commit.

### Task B7: WalletBar + faucet onboarding
- Modify `src/components/WalletBar.tsx`: connect/disconnect, one-tap "Get Test XLM" (friendbot) + a "Get Test USDC" helper (anchor deposit or SAC mint via issuer). First-run tooltip tour. Commit.

---

## Phase C — SEP-24 anchor bridge

### Task C1: SEP-10 auth client
- Create `src/lib/anchor/sep10.ts`: fetch challenge from `testanchor.stellar.org` WEB_AUTH_ENDPOINT, sign with wallet (kit `signTransaction`), exchange for JWT. Store token in memory/store. Verify endpoints from the anchor's `stellar.toml`. Commit.

### Task C2: SEP-24 interactive deposit (on-ramp)
- Create `src/lib/anchor/sep24.ts` + `src/components/AnchorDeposit.tsx`: POST `/transactions/deposit/interactive` with JWT → open returned interactive URL (popup/iframe) → poll `/transaction` until `completed` → USDC lands in wallet → chain `contribute`. Loading/error states. Commit.

### Task C3: SEP-24 withdraw (off-ramp) on creator dashboard
- Create `src/components/AnchorWithdraw.tsx` + `src/app/dashboard/page.tsx`: after `release`, offer SEP-24 withdraw of USDC → interactive → poll. Commit.

### Task C4: SEP-12 lightweight KYC handoff
- Create `src/components/KycForm.tsx`: when anchor responds `needs_info`, render SEP-12 fields, PUT to KYC endpoint, resume. Commit.

---

## Phase D — Visual polish + i18n completeness

### Task D1: Theme + animated hero
- Modify `src/app/globals.css`, `src/app/layout.tsx`: dark-first indigo/violet gradient theme, glassmorphism utility classes. Create `src/components/Hero.tsx` with SVG world-map money-arc + flowing particles (Framer Motion). Commit.

### Task D2: Micro-interactions + live counters
- Create `src/components/LiveStats.tsx` (animated counters from events), add Framer Motion page/card transitions, milestone progress fill animation, "funds arrived" pulse. Commit.

### Task D3: i18n sweep + language switcher
- Create `src/components/LanguageSwitcher.tsx`; audit all components for hardcoded strings → move to `messages/{en,tr}.json`; verify both locales render. Commit.

### Task D4: PWA + mobile pass
- Add `public/manifest.json`, icons, viewport meta; manual responsive sweep of every screen at 375px. Commit.

---

## Phase E — Production layer

### Task E1: Proof board `/proof`
- Create `src/app/proof/page.tsx` + `src/lib/proof.ts`: iterate `list_campaigns`, read each escrow's contributors (from `contrib` events via `events.ts`), dedupe unique backer addresses, render table: address + stellar.expert testnet link + first-seen date + total USDC. Show unique-backer count + total volume. Commit.

### Task E2: Analytics + event tracking
- Add `@vercel/analytics` `<Analytics/>` to layout; create `src/lib/track.ts` wrapper; fire events on wallet-connect, contribute, release, anchor-deposit. Commit.

### Task E3: Sentry error tracking
- `npx @sentry/wizard` (or manual `sentry.client/server.config.ts`); wrap on-chain/anchor calls; verify a test error reports. Commit.

### Task E4: Feedback form
- Create `src/components/FeedbackForm.tsx` → store submissions (Supabase table or Tally embed) + a `src/app/feedback/page.tsx`. Commit.

### Task E5: CI/CD
- Update `.github/workflows/ci.yml`: cargo test (3 contracts) + `npm run lint` + `npm run build` + `vitest`. Node 22. Commit.

---

## Phase F — Submission package

### Task F1: README rewrite
- Rewrite `README.md` for StellarFund: pitch, architecture diagram, contract addresses, live demo link, USDC+anchor+milestone explanation, screenshots, proof-board link. Commit.

### Task F2: Deploy to Vercel + GitHub
- Create public GitHub repo `stellarfund`, push; link Vercel project, set env vars, deploy production. Record live URL. Commit.

### Task F3: Screenshots + submission checklist doc
- Create `docs/SUBMISSION.md`: live link, contract addresses, screenshots (UI / mobile / analytics / proof board), demo-video placeholder, 10+ interaction proof (stellar.expert links), feedback summary placeholder. Commit.

> **Human-only (left for the user):** record the demo video; drive ≥10 real wallet interactions (onboarding made one-tap in B7); collect a few genuine feedback responses. F3 leaves clearly marked placeholders for these.

---

## Self-Review

- **Spec coverage:** USDC ✓(A1–A7,B), milestone escrow ✓(A1–A5), SEP-24 anchor ✓(C), bold animated frontend ✓(D), TR/EN ✓(B1,D3), proof board ✓(E1), loading/error ✓(B,C), analytics+Sentry+feedback ✓(E2–E4), PWA/mobile ✓(D4), CI/CD ✓(E5), 15+ commits ✓(per-task commits), README/screenshots/demo ✓(F). Out-of-scope (governance, yield, mainnet) correctly excluded.
- **Type consistency:** `Status` 4-variant enum used consistently A1–A4; `summary` 7-tuple defined A4 and consumed B2; `create_campaign(...,milestones)` defined A5 consumed B3; `release(index)` defined A2 consumed B2/B5.
- **Placeholder scan:** human-only items in F are intentional external deliverables, not code placeholders.
