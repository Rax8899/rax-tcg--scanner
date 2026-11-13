const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../scanner-core.js");

test("normalizes leading-zero collector numbers", () => {
  assert.deepEqual(core.normNumber("074/128"), { number: "74", total: "128" });
  assert.deepEqual(core.normNumber("74 / 128"), { number: "74", total: "128" });
});

test("matches Cresselia 074/128 when set is blank", () => {
  const card = { name: "Cresselia", number: "074", total_set_number: "128", set: { name: "Silver Tempest" } };
  assert.equal(core.matches(card, { name: "Cresselia", number: "074/128", set: "" }), true);
});

test("matches combined number fields and ignores leading zeroes", () => {
  const card = { name: "Cresselia", number: "074/128", set: { name: "Silver Tempest" } };
  assert.equal(core.matches(card, { name: "Cresselia", number: "74/128", set: "" }), true);
});

test("rejects a wrong collector number or explicit set", () => {
  const card = { name: "Cresselia", number: "074", total_set_number: "128", set: { name: "Silver Tempest" } };
  assert.equal(core.matches(card, { name: "Cresselia", number: "075/128", set: "" }), false);
  assert.equal(core.matches(card, { name: "Cresselia", number: "074/128", set: "Lost Origin" }), false);
});

test("ranks exact name and collector number above loose name matches", () => {
  const exact = { name: "Cresselia", number: "74", total_set_number: "128", set: { name: "Silver Tempest" } };
  const loose = { name: "Cresselia V", number: "74", total_set_number: "128", set: { name: "Silver Tempest" } };
  const q = { name: "Cresselia", number: "074/128", set: "" };
  assert.ok(core.scoreCard(exact, q) > core.scoreCard(loose, q));
});

test("maps common API failures to actionable messages", () => {
  assert.match(core.errorMessage(401, {}), /API Key/);
  assert.match(core.errorMessage(403, {}), /权限/);
  assert.match(core.errorMessage(429, { error: { code: "credit_limit_exceeded", limit_type: "daily" } }), /今日 API 额度/);
  assert.match(core.errorMessage(503, {}), /暂时异常/);
});

test("retries transient server failures and succeeds", async () => {
  const originalFetch = global.fetch;
  let calls = 0;
  global.fetch = async () => {
    calls++;
    if (calls === 1) return { ok: false, status: 503, headers: { get: () => null }, text: async () => JSON.stringify({ error: { message: "temporary" } }) };
    return { ok: true, status: 200, headers: { get: () => null }, text: async () => JSON.stringify({ data: [{ id: 1 }] }) };
  };
  try {
    const result = await core.request("https://example.test/cards", "pk_test", { timeout: 1000, retries: 1 });
    assert.equal(result.data[0].id, 1);
    assert.equal(calls, 2);
  } finally { global.fetch = originalFetch; }
});

test("does not retry an invalid API key", async () => {
  const originalFetch = global.fetch;
  let calls = 0;
  global.fetch = async () => {
    calls++;
    return { ok: false, status: 401, headers: { get: () => null }, text: async () => JSON.stringify({ error: { code: "unauthorized" } }) };
  };
  try {
    await assert.rejects(core.request("https://example.test/cards", "bad", { timeout: 1000, retries: 2 }), /API Key/);
    assert.equal(calls, 1);
  } finally { global.fetch = originalFetch; }
});

test("matches card names despite punctuation and diacritics", () => {
  assert.equal(core.matches({ name: "Mr. Mime", number: "122", total_set_number: "165" }, { name: "Mr Mime", number: "122/165", set: "" }), true);
  assert.equal(core.matches({ name: "Flabébé", number: "083", total_set_number: "165" }, { name: "Flabebe", number: "083/165", set: "" }), true);
});


test("normalizes and migrates local collection state without dropping data", () => {
  const state = core.normalizeState({ holdings: [{ id: 7, name: "Cresselia", qty: 2, cost: 10 }], watchlist: [{ id: 8 }], scanHistory: [{ id: 7 }] });
  assert.equal(state.schemaVersion, 2);
  assert.equal(state.holdings[0].qty, 2);
  assert.equal(state.watchlist.length, 1);
  assert.equal(state.scanHistory.length, 1);
});

test("merges duplicate holdings by identity and calculates weighted average cost", () => {
  const first = core.upsertHolding({}, { id: 207163, name: "Cresselia", variant: "Normal", language: "English", condition: "Near Mint", qty: 2, cost: 10 });
  const second = core.upsertHolding(first.state, { id: 207163, name: "Cresselia", variant: "Normal", language: "English", condition: "Near Mint", qty: 1, cost: 16 });
  assert.equal(second.merged, true);
  assert.equal(second.state.holdings.length, 1);
  assert.equal(second.holding.qty, 3);
  assert.equal(second.holding.cost, 12);
});

test("keeps variants and languages as separate holdings", () => {
  const a = core.upsertHolding({}, { id: 1, variant: "Normal", language: "English", qty: 1 });
  const b = core.upsertHolding(a.state, { id: 1, variant: "Holofoil", language: "Japanese", qty: 1 });
  assert.equal(b.state.holdings.length, 2);
});

test("portfolio never treats missing market data as zero value", () => {
  const summary = core.portfolioSummary([
    { qty: 2, cost: 10, marketMyr: 50 },
    { qty: 1, cost: 20 }
  ]);
  assert.equal(summary.quantity, 3);
  assert.equal(summary.costBasis, 40);
  assert.equal(summary.marketValue, 100);
  assert.equal(summary.valuedQuantity, 2);
  assert.equal(summary.unpricedQuantity, 1);
  assert.equal(summary.pricedCostBasis, 20);
  assert.equal(summary.pnl, 80);
});

test("converts USD and EUR using explicitly supplied rates only", () => {
  const summary = core.portfolioSummary([
    { qty: 1, cost: 5, marketAmount: 2, currency: "USD" },
    { qty: 1, cost: 5, marketAmount: 3, currency: "EUR" },
    { qty: 1, cost: 5, marketAmount: 10, currency: "JPY" }
  ], { USD: 4.5, EUR: 4.9 });
  assert.ok(Math.abs(summary.marketValue - 23.7) < 1e-9);
  assert.equal(summary.valuedQuantity, 2);
  assert.equal(summary.unpricedQuantity, 1);
});


test("treats null and zero legacy market values as unpriced", () => {
  const summary = core.portfolioSummary([
    { qty: 1, cost: 12, marketMyr: null, usd: 0 },
    { qty: 1, cost: 15, marketMyr: 0 }
  ], { USD: 4.5 });
  assert.equal(summary.marketValue, 0);
  assert.equal(summary.valuedQuantity, 0);
  assert.equal(summary.unpricedQuantity, 2);
  assert.equal(summary.pricedCostBasis, 0);
});
