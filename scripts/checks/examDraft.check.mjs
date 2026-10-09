// Verifica di client/src/utils/examDraft.js (il client non ha un test runner).
// Uso: node scripts/checks/examDraft.check.mjs
import assert from "node:assert/strict";
import {
  DRAFT_DEBOUNCE_MS,
  MAX_ANSWER_LENGTH,
  answersFromExam,
  questionCounter,
  needsSave,
  dirtyPositions,
  retryDelay,
  isClosedError,
  saveStatusText,
  aggregateSaveStatus,
  buildSubmitAnswers,
} from "../../client/src/utils/examDraft.js";

let count = 0;
const check = (fn) => {
  fn();
  count += 1;
};

const exam = {
  questions: [1, 2, 3, 4, 5, 6].map((position) => ({
    position,
    prompt: `Domanda ${position}?`,
    answer: position === 4 ? null : `r${position}`,
  })),
};

check(() =>
  assert.deepEqual(answersFromExam(exam), { 1: "r1", 2: "r2", 3: "r3", 4: "", 5: "r5", 6: "r6" })
);
check(() => assert.equal(questionCounter(1, 6), "Domanda 2 di 6"));

check(() => assert.equal(needsSave("a", "a", undefined), false));
check(() => assert.equal(needsSave("ab", "a", undefined), true));
check(() => assert.equal(needsSave("ab", "a", "ab"), false));

check(() => assert.deepEqual(dirtyPositions({ 1: "x", 2: "", 3: "y" }, { 1: "x", 2: "", 3: "" }), [3]));

for (const [attempt, expected] of [[1, 2000], [2, 4000], [3, 8000], [10, 15000]]) {
  check(() => assert.equal(retryDelay(attempt), expected, `retryDelay(${attempt})`));
}

check(() => assert.equal(isClosedError({ status: 409 }), true));
check(() => assert.equal(isClosedError({ status: 500 }), false));
check(() => assert.equal(isClosedError({}), false));

check(() => assert.equal(saveStatusText("saved"), "Salvato"));
check(() => assert.equal(saveStatusText("error"), "Salvataggio non riuscito, riprovo"));
check(() => assert.equal(saveStatusText("saving"), "Salvataggio in corso"));
check(() => assert.equal(saveStatusText("idle"), ""));
check(() => assert.equal(saveStatusText("closed", "Tempo scaduto"), "Tempo scaduto"));

const base = { inFlightCount: 0, failedCount: 0, dirtyCount: 0, closed: false, everSaved: false };
check(() => assert.equal(aggregateSaveStatus({ ...base, closed: true, failedCount: 1 }), "closed"));
check(() => assert.equal(aggregateSaveStatus({ ...base, failedCount: 1, inFlightCount: 1 }), "error"));
check(() => assert.equal(aggregateSaveStatus({ ...base, inFlightCount: 1 }), "saving"));
check(() => assert.equal(aggregateSaveStatus({ ...base, dirtyCount: 1 }), "saving"));
check(() => assert.equal(aggregateSaveStatus({ ...base, everSaved: true }), "saved"));
check(() => assert.equal(aggregateSaveStatus(base), "idle"));

check(() =>
  assert.deepEqual(buildSubmitAnswers({ 3: "c", 1: "a", 2: "", 4: "", 5: "", 6: "f" }), [
    { position: 1, answer: "a" },
    { position: 2, answer: "" },
    { position: 3, answer: "c" },
    { position: 4, answer: "" },
    { position: 5, answer: "" },
    { position: 6, answer: "f" },
  ])
);

check(() => assert.equal(DRAFT_DEBOUNCE_MS, 800));
check(() => assert.equal(MAX_ANSWER_LENGTH, 5000));

console.log(`examDraft: ${count} casi superati`);
