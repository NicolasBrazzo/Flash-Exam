// Verifica dell'autovalutazione della simulazione in client/src/utils/examResult.js.
// Uso: node scripts/checks/examSelfGrade.check.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  pendingKind,
  initialSelfGradeChoices,
  setSelfGradeChoice,
  canSubmitSelfGrade,
  buildSelfGradeVerdicts,
  regradeErrorText,
  selfGradeErrorText,
} from "../../client/src/utils/examResult.js";

let count = 0;
const check = (fn) => {
  fn();
  count += 1;
};

const full = { 1: "correct", 2: "wrong", 3: "partial", 4: "partial", 5: "correct", 6: "wrong" };

check(() => {
  assert.equal(canSubmitSelfGrade({}), false);
  assert.equal(canSubmitSelfGrade({ 1: "correct", 2: "wrong", 3: "partial", 4: "partial", 5: "correct" }), false);
  assert.equal(canSubmitSelfGrade({ ...full, 6: "boh" }), false);
  assert.equal(canSubmitSelfGrade({ ...full, 7: "wrong" }), false);
  const { 6: _six, ...fiveAndSeven } = full;
  assert.equal(canSubmitSelfGrade({ ...fiveAndSeven, 7: "wrong" }), false);
  assert.equal(canSubmitSelfGrade(full), true);
  assert.equal(canSubmitSelfGrade(Object.fromEntries(Object.entries(full).map(([k, v]) => [String(k), v]))), true);
});

check(() => {
  assert.deepEqual(buildSelfGradeVerdicts({ 6: "wrong", 1: "correct", 3: "partial", 2: "wrong", 5: "correct", 4: "partial" }), [
    { position: 1, verdict: "correct" },
    { position: 2, verdict: "wrong" },
    { position: 3, verdict: "partial" },
    { position: 4, verdict: "partial" },
    { position: 5, verdict: "correct" },
    { position: 6, verdict: "wrong" },
  ]);
});

check(() => {
  const input = { 1: "correct" };
  const next = setSelfGradeChoice(input, 1, "wrong");
  assert.deepEqual(input, { 1: "correct" });
  assert.deepEqual(next, { 1: "wrong" });
  assert.deepEqual(setSelfGradeChoice(input, 2, "boh"), input);
  assert.deepEqual(setSelfGradeChoice(input, 0, "wrong"), input);
  assert.deepEqual(setSelfGradeChoice(input, 7, "wrong"), input);
});

check(() => {
  const answers = { 1: "r1", 2: "", 3: "r3", 4: "  ", 5: "r5", 6: null };
  const qs = [1, 2, 3, 4, 5, 6].map((p) => ({ position: p, answer: answers[p] }));
  assert.deepEqual(initialSelfGradeChoices(qs), { 2: "wrong", 4: "wrong", 6: "wrong" });
  assert.deepEqual(initialSelfGradeChoices([1, 2, 3, 4, 5, 6].map((p) => ({ position: p, answer: "x" }))), {});
  assert.deepEqual(initialSelfGradeChoices(null), {});
});

check(() => {
  assert.equal(pendingKind({ status: "SELF_GRADED", grade: null }), "self_grade");
  assert.equal(pendingKind({ status: "GRADING", grade: null }), "grading");
  assert.equal(pendingKind({ status: "GRADED", grade: 31 }), "unknown");
  assert.equal(pendingKind(null), "unknown");
});

check(() => {
  const self = regradeErrorText({ status: 502, message: "Valutazione AI non disponibile: riprova più tardi" }, "SELF_GRADED");
  assert.ok(self.includes("riprova più tardi") && self.includes("autovaluta"), self);
  const grading = regradeErrorText({ status: 502 }, "GRADING");
  assert.equal(grading.includes("autovaluta"), false);
  assert.equal(
    regradeErrorText({ status: 409, message: "Valutazione già in corso: riprova tra qualche minuto" }, "GRADING"),
    "Valutazione già in corso: riprova tra qualche minuto"
  );
  assert.equal(regradeErrorText({ status: null, message: "Server non raggiungibile" }, "GRADING"), "Server non raggiungibile");
});

check(() => {
  const text = selfGradeErrorText({ status: 409, message: "Simulazione già valutata" });
  assert.ok(text.startsWith("Simulazione già valutata") && text.includes("Aggiorna"), text);
  assert.equal(selfGradeErrorText({ status: 400, message: "x" }), "x");
});

check(() => {
  const source = readFileSync(new URL("../../client/src/utils/examResult.js", import.meta.url), "utf8");
  assert.equal(source.includes("@/"), false);
});

console.log(`examSelfGrade: ${count} casi superati`);
