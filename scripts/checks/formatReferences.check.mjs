// Verifica di client/src/utils/formatReferences.js (il client non ha un test runner).
// Uso: node scripts/checks/formatReferences.check.mjs
import assert from "node:assert/strict";
import { formatReferences } from "../../client/src/utils/formatReferences.js";

const cases = [
  [["1", "2"], "art. 1, 2"],
  [["42-bis"], "art. 42-bis"],
  [["1", " 3 "], "art. 1, 3"],
  [[], ""],
  [null, ""],
  [undefined, ""],
  [[""], ""],
  [["  "], ""],
  ["1", ""],
];

for (const [input, expected] of cases) {
  assert.equal(formatReferences(input), expected, `formatReferences(${JSON.stringify(input)})`);
}

console.log(`formatReferences: ${cases.length} casi superati`);
