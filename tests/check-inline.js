const fs = require("node:fs");
const assert = require("node:assert/strict");
const html = fs.readFileSync("index.html", "utf8");
assert.match(html, /<script src="\.\/scanner-core\.js"><\/script>/, "scanner core script must be loaded");
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m => m[1]).filter(s => s.trim());
assert.ok(scripts.length, "expected at least one inline script");
for (const [i, source] of scripts.entries()) {
  try { new Function(source); }
  catch (error) { throw new Error("Inline script " + (i + 1) + " has a syntax error: " + error.message); }
}
console.log("Inline JavaScript syntax check passed.");
