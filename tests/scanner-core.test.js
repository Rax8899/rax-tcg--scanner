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
