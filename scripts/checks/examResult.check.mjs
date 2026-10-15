// Verifica di client/src/utils/examResult.js (il client non ha un test runner).
// Uso: node scripts/checks/examResult.check.mjs
import assert from "node:assert/strict";
import {
  AUTO_SUBMITTED_TEXT,
  formatGrade,
  answerText,
  isEmptyAnswer,
  resultView,
  sortByPosition,
} from "../../client/src/utils/examResult.js";

let count = 0;
const check = (fn) => {
  fn();
  count += 1;
};

check(() => {
  assert.equal(formatGrade(27, false), "27/30");
  assert.equal(formatGrade(0, false), "0/30");
  assert.equal(formatGrade(18, false), "18/30");
  assert.equal(formatGrade(30, false), "30/30");
  assert.equal(formatGrade(30, true), "30/30 con lode");
});
check(() => assert.equal(formatGrade(29, true), "29/30"));
check(() => {
  for (const g of [null, undefined, 31, -1, 27.5, "27", Number.NaN]) assert.equal(formatGrade(g, true), "", String(g));
});
check(() => assert.equal(formatGrade(30, "true"), "30/30"));

check(() => {
  for (const a of ["", "   ", "\n\t ", null, undefined, 42]) assert.equal(answerText(a), "Nessuna risposta", JSON.stringify(a));
});
check(() => {
  assert.equal(answerText("Risposta"), "Risposta");
  assert.equal(answerText("  a  "), "  a  ");
  assert.equal(answerText("riga1\nriga2"), "riga1\nriga2");
});
check(() => {
  assert.equal(isEmptyAnswer(""), true);
  assert.equal(isEmptyAnswer(" "), true);
  assert.equal(isEmptyAnswer("x"), false);
});

check(() => {
  assert.equal(resultView({ status: "IN_PROGRESS" }), "in_progress");
  assert.equal(resultView({ status: "GRADED", grade: 27 }), "graded");
  assert.equal(resultView({ status: "SELF_GRADED", grade: 18 }), "graded");
  assert.equal(resultView({ status: "SELF_GRADED", grade: null }), "pending");
  assert.equal(resultView({ status: "GRADING", grade: null }), "pending");
  assert.equal(resultView({ status: "BOH" }), "pending");
  assert.equal(resultView(null), "pending");
  assert.equal(resultView({}), "pending");
});

check(() => {
  const input = [{ position: 3 }, { position: 1 }, { position: 2 }];
  assert.deepEqual(sortByPosition(input).map((q) => q.position), [1, 2, 3]);
  assert.deepEqual(input.map((q) => q.position), [3, 1, 2]);
  assert.deepEqual(sortByPosition(null), []);
});

check(() => assert.equal(AUTO_SUBMITTED_TEXT, "Consegnata automaticamente allo scadere del tempo"));

check(() => {
  assert.equal(resultView({ status: "GRADED", grade: 31 }), "pending");
  assert.equal(resultView({ status: "GRADED", grade: -1 }), "pending");
  assert.equal(resultView({ status: "GRADED", grade: 27.5 }), "pending");
  assert.equal(resultView({ status: "GRADED", grade: 0 }), "graded");
});

console.log(`examResult: ${count} casi superati`);
