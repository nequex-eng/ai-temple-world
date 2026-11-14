import fs from "node:fs";
import assert from "node:assert/strict";

const read = path => fs.readFileSync(path, "utf8");
const html = read("index.html");
const app = read("src/app.js");
const world = read("src/world.js");
const network = read("src/network.js");
const i18n = read("src/i18n.js");
const worker = read("worker/index.js");
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
const idSet = new Set(ids);
assert.equal(ids.length, idSet.size, "HTML contains duplicate IDs");
const used = [...app.matchAll(/\$\("([^"]+)"\)/g)].map(match => match[1]);
const missing = [...new Set(used)].filter(id => !idSet.has(id));
assert.deepEqual(missing, [], "App references missing HTML elements");
for (const asset of ["/style.css", "/manifest.webmanifest", "/src/app.js", "/icons/lotus.svg"]) {
  assert.ok(html.includes(asset), "index.html must load " + asset);
}
for (const language of ["zh:", "ja:", "ko:", "th:"]) assert.ok(i18n.includes(language), "Missing locale " + language);
assert.ok(app.includes("async function saveProfile()"), "Profile creation handler must be async");
assert.ok(app.includes("await network.visit()"), "Daily visit tracking must be called");
assert.ok(network.includes("/api/live"), "Realtime websocket route missing");
assert.ok(network.includes("/api/session"), "Visitor session route missing");
assert.ok(world.includes("export class TempleWorld"), "3D world class missing");
assert.ok(world.includes("incenseStick.visible"), "Incense ritual prop missing");
assert.ok(worker.includes("export class TempleRoom"), "Durable Object class missing");
for (const table of ["profiles", "activities", "prayers", "visits", "offerings"]) {
  assert.ok(worker.includes(table), "Worker missing D1 table reference: " + table);
}
console.log("Smoke test passed: " + ids.length + " unique HTML IDs, " + used.length + " static app references, 4 locales, 3D world and API routes.");
