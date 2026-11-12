# RAXTCG

A mobile-first Pokémon TCG scanner and collection tracker.

## Current architecture
- Static frontend: `index.html` and `scanner-core.js`
- Secure same-origin API proxy: Vercel serverless functions in `api/`
- Market data provider: PkmnPrices
- The PkmnPrices API key is read only from the server-side environment variable `PKMNPRICES_API_KEY`; never put it in browser code.

## Deploy
1. Import this repository into Vercel.
2. Set the Production (and Preview, if desired) environment variable `PKMNPRICES_API_KEY` to the PkmnPrices API key.
3. Deploy the `raxtcg-rebuild` branch for preview; deploy to production only after smoke tests pass.
4. Check `/api/health`. It should return `status: "ok"` and `marketApiConfigured: true`.
5. Check `/api/cards?name=Cresselia&per_page=1` to verify provider connectivity.

## Accuracy notes
OCR is a candidate generator, not proof of identity. Always verify the matched card's set, collector number, language, finish/variant, and condition before using a quote. Never substitute another printing's price. Prices are estimates from enabled provider sources, not guaranteed sale prices.
