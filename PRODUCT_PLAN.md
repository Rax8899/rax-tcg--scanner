# RAX TCG Scanner 2.0 — Hybrid Edition

## Product direction
A local-first Pokémon TCG collector workspace inspired by the public feature set and interaction patterns of MonPrice. RAX uses its own brand, implementation, data integrations, and UI.

## User-approved constraints
- Hybrid interface: clean collector workflow with a premium dark/gold RAX identity.
- Full product scope, delivered in milestones.
- RM0 operating/development budget: prefer browser-native/local processing, open-source libraries, free datasets and free hosting tiers. Do not add paid AI, subscriptions, or metered services without explicit approval.
- Existing repository and server-side PkmnPrices proxy are retained where useful.

## Modules
1. Home dashboard: collection count, cost basis, estimated value, unrealized P/L, recent additions.
2. Live scanner: camera/file input, on-device recognition, exact card identity validation before price lookup.
3. Explore: card catalog search and set browsing.
4. Collections: local holdings, quantities, buy cost, collection grouping, CSV export/import.
5. Portfolio: cost basis, last-seen market value, P/L and ROI; never fabricate missing prices.
6. Watchlist: locally saved cards.
7. Price details: source, currency, condition, variant, timestamp and price history when source access permits.
8. Settings: MYR conversion, data source status, local backup and privacy controls.

## Architecture
- Frontend: responsive static web app, vanilla JS/CSS, installable PWA as a later milestone.
- Persistence: versioned local-first browser storage; explicit JSON backup/export. Cloud sync is out of scope at RM0 unless a free quota is verified.
- Card catalog/prices: existing same-origin Vercel API proxy to PkmnPrices; server-side key only. The proxy is a metered dependency and must display quota/permission errors clearly.
- Recognition: open-source/on-device processing only. OCR is a fallback, not a promise of MonPrice-equivalent trained-model accuracy. Recognition must not trigger price display unless card identity is sufficiently verified.
- Hosting: GitHub Pages as zero-cost static fallback; Vercel production remains connected if quota permits.

## Delivery gates
- Gate A: CI syntax/unit tests pass and existing Cresselia 074/128 API regression remains green.
- Gate B: dashboard, Explore, collections, portfolio and watchlist operate on local data.
- Gate C: scanner is validated on real iPhone/iPad camera photos; no claim of success before this test.
- Gate D: detail response must match the scanned card name and collector number; price provenance and timestamp are shown.
- Gate E: PWA/offline shell, backup/restore, accessibility and mobile QA.

## Non-goals
- Do not copy MonPrice proprietary code, model weights, branding, or assets.
- Do not call paid OpenAI vision or introduce surprise billing.
- Do not show guessed card identity, prices, or market history.


## Delivery status — 2026-11-13
### Completed in the first 2.0 foundation pass
- Added versioned local-state normalization (schemaVersion 2) with migration that preserves existing holdings, watchlist, scan history and collections.
- Added duplicate holding merge keyed by card ID + variant + language + condition.
- Duplicate adds increase quantity and recalculate weighted-average buy cost.
- Portfolio math now distinguishes priced and unpriced holdings. Missing, zero, unsupported-currency or unavailable prices are excluded from market value and ROI instead of being displayed as a fabricated RM0 valuation.
- Dashboard and portfolio show pricing coverage; collection CSV export includes set, number, variant, language, condition, currency and price provenance fields.
- Added automated tests for migration, duplicate merge, variant separation, currency conversion and unpriced holdings.
- Retained Cresselia 074/128 regression coverage and verified the live Vercel market proxy search and detail response.

### Milestones
**M1 — Reliable data foundation (in progress)**
- [x] Versioned local data model and safe migration
- [x] Duplicate merge and weighted average cost
- [x] No fabricated valuation for missing market data
- [x] Unit and regression tests
- [x] Named collections and collection filtering
- [ ] Bulk management
- [x] Expanded CSV export fields
- [ ] Export/import round-trip tests

**M2 — Scanner reliability**
- [ ] Remove false-success states from camera/recognition
- [ ] Make OpenCV loading deterministic and expose a diagnostic self-test
- [ ] Card boundary detection and perspective correction
- [ ] OCR candidate confidence and exact catalog verification
- [ ] Validate on real iPhone/iPad photos including glare, tilt, foil and different lighting
- [ ] Never auto-add or show a price when identity is ambiguous

**M3 — Market and card detail**
- [x] Same-origin PkmnPrices proxy retained
- [x] Cresselia 074/128 search and detail regression verified live
- [ ] Add explicit price-source/condition/variant selection
- [ ] Distinguish raw, graded and sealed product records
- [ ] Persist last-known quote with source timestamp; clearly label stale values
- [ ] Handle unavailable history/marketplace coverage without guessing

**M4 — Collector UX**
- [ ] Hybrid RAX dashboard with recent scans and collection performance
- [ ] Named collections, filters, sorting and bulk edit
- [ ] Watchlist price snapshots and history
- [ ] Set completion and set progress
- [ ] Portfolio chart and top-value cards (only where data exists)

**M5 — PWA and device quality**
- [x] Installable web app manifest and service-worker shell
- [ ] Offline collection browsing and scanner graceful-degradation states
- [ ] Backup/restore compatibility tests
- [ ] iPhone, iPad and desktop layout/accessibility QA

### Zero-budget operating rules
- No paid AI vision API, paid model endpoint, or new paid subscription.
- Existing PkmnPrices API is an external dependency and may have usage limits or plan restrictions; RM0 does not guarantee unlimited live prices.
- Local holdings and backup remain usable without market API access.
- Cross-device cloud sync, push notifications, and always-on hosted market ingestion are not promised under RM0; use user-controlled JSON export/import until a genuinely free, verified option exists.
