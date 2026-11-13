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
