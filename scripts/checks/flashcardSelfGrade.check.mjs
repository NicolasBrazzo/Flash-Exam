// Verifica di autovalutazione e riepilogo in client/src/utils/flashcardSession.js.
// Uso: node scripts/checks/flashcardSelfGrade.check.mjs
import assert from "node:assert/strict";
import { SELF_GRADE_OPTIONS, needsSelfGrade, sessionSummary, verdictInfo } from "../../client/src/utils/flashcardSession.js";

let count = 0;
const check = (fn) => {
  fn();
  count += 1;
};

check(() => assert.deepEqual(SELF_GRADE_OPTIONS.map((o) => o.verdict), ["correct", "partial", "wrong"]));
check(() => {
  const labels = SELF_GRADE_OPTIONS.map((o) => o.label);
  for (const label of labels) {
    assert.equal(typeof label, "string");
    assert.ok(label.length > 0);
    assert.equal(/[0-9%]/.test(label), false, label);
  }
  assert.equal(new Set(labels).size, 3);
});
check(() => assert.equal(Object.isFrozen(SELF_GRADE_OPTIONS), true));
check(() => {
  for (const o of SELF_GRADE_OPTIONS) assert.notEqual(verdictInfo(o.verdict), null, o.verdict);
});

check(() => assert.equal(needsSelfGrade({ verdict: null, grading_source: null }), true));
check(() => {
  for (const attempt of [{ verdict: "correct" }, { verdict: "partial" }, { verdict: "wrong", grading_source: "SELF" }]) {
    assert.equal(needsSelfGrade(attempt), false, JSON.stringify(attempt));
  }
});
check(() => {
  assert.equal(needsSelfGrade(null), false);
  assert.equal(needsSelfGrade(undefined), false);
});

check(() => assert.equal(sessionSummary(1), "1 domanda svolta"));
check(() => {
  assert.equal(sessionSummary(10), "10 domande svolte");
  assert.equal(sessionSummary(50), "50 domande svolte");
});
check(() => {
  for (let n = 1; n <= 50; n += 1) {
    const text = sessionSummary(n);
    assert.deepEqual(text.match(/\d+/g), [String(n)], text);
    assert.equal(/corrett|errat|parzial|punt|%|voto/i.test(text), false, text);
  }
});

console.log(`flashcardSelfGrade: ${count} casi superati`);
