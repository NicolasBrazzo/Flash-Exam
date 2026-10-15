// Verifica di client/src/utils/flashcardSession.js (il client non ha un test runner).
// Uso: node scripts/checks/flashcardSession.check.mjs
import assert from "node:assert/strict";
import {
  DEFAULT_COUNT,
  parseCount,
  toggleTopic,
  selectAll,
  canStart,
  verdictInfo,
  sessionCounter,
  isLastQuestion,
  hasFeedbackContent,
} from "../../client/src/utils/flashcardSession.js";

let count = 0;
const check = (fn) => {
  fn();
  count += 1;
};

for (const [raw, value] of [["10", 10], [1, 1], ["50", 50], [" 7 ", 7]]) {
  check(() => assert.deepEqual(parseCount(raw), { value, error: null }, JSON.stringify(raw)));
}
for (const raw of ["", "0", "51", "2.5", "abc", "-1", null]) {
  check(() => {
    const res = parseCount(raw);
    assert.equal(res.value, null, JSON.stringify(raw));
    assert.equal(typeof res.error, "string");
    assert.ok(res.error.length > 0);
  });
}

check(() => assert.deepEqual(toggleTopic(Object.freeze(["a"]), "b"), ["a", "b"]));
check(() => assert.deepEqual(toggleTopic(Object.freeze(["a", "b"]), "a"), ["b"]));
check(() => assert.deepEqual(selectAll([{ id: "a" }, { id: "b" }]), ["a", "b"]));

check(() => assert.equal(canStart([], "10"), false));
check(() => assert.equal(canStart(["a"], "0"), false));
check(() => assert.equal(canStart(["a"], "10"), true));

const labels = { correct: "Risposta corretta", partial: "Risposta parzialmente corretta", wrong: "Risposta errata" };
const icons = new Set();
for (const [verdict, label] of Object.entries(labels)) {
  check(() => {
    const info = verdictInfo(verdict);
    assert.equal(info.label, label);
    assert.equal(/[0-9%]/.test(info.label), false);
    icons.add(info.icon);
  });
}
check(() => assert.equal(icons.size, 3));
for (const verdict of [null, undefined, "x"]) {
  check(() => assert.equal(verdictInfo(verdict), null));
}

check(() => assert.equal(sessionCounter(0, 3), "Domanda 1 di 3"));
check(() => assert.equal(isLastQuestion(2, 3), true));
check(() => assert.equal(isLastQuestion(1, 3), false));

check(() => assert.equal(hasFeedbackContent(null), false));
check(() => assert.equal(hasFeedbackContent({ corrections: [], suggestion: " ", exampleAnswer: null }), false));
check(() => assert.equal(hasFeedbackContent({ corrections: [{ written: "a", suggested: "b", reason: "c" }], suggestion: "", exampleAnswer: null }), true));

check(() => assert.equal(DEFAULT_COUNT, 10));

console.log(`flashcardSession: ${count} casi superati`);
