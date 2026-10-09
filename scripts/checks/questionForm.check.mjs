// Verifica di client/src/utils/questionForm.js (il client non ha un test runner).
// Uso: node scripts/checks/questionForm.check.mjs
import assert from "node:assert/strict";
import {
  questionToFormState,
  parseReferences,
  validateQuestionForm,
  formStateToPatch,
  pageAfterDelete,
} from "../../client/src/utils/questionForm.js";

const Q = {
  id: "q1",
  topic: { id: "t1", name: "Obbligazioni" },
  prompt: "Che cos'è?",
  reference_answer: "È ...",
  rubric: [
    { id: "c1", concept: "A", weight: 2 },
    { id: "c2", concept: "B", weight: 1 },
  ],
  references: ["1", "42-bis"],
};

let count = 0;
const check = (fn) => {
  fn();
  count += 1;
};

// 1. Conversione in formState
check(() =>
  assert.deepEqual(questionToFormState(Q), {
    prompt: "Che cos'è?",
    reference_answer: "È ...",
    references: "1, 42-bis",
    rubric: [
      { id: "c1", concept: "A", weight: "2" },
      { id: "c2", concept: "B", weight: "1" },
    ],
  })
);
check(() => assert.equal(questionToFormState({ ...Q, references: [] }).references, ""));

// 2. parseReferences
for (const [input, expected] of [
  ["1, 42-bis", ["1", "42-bis"]],
  [" 1 ,, 3 ,", ["1", "3"]],
  ["", []],
  ["  ", []],
]) {
  check(() => assert.deepEqual(parseReferences(input), expected, JSON.stringify(input)));
}

// 3. Validazione OK
check(() => assert.deepEqual(validateQuestionForm(questionToFormState(Q)), []));

// 4. Validazione KO
const withChange = (change) => {
  const fs = questionToFormState(Q);
  change(fs);
  return fs;
};
const expectError = (fs, word) => {
  const errors = validateQuestionForm(fs);
  assert.ok(errors.length > 0, `nessun errore per ${word}`);
  assert.ok(errors.some((e) => e.includes(word)), `"${word}" non presente in ${JSON.stringify(errors)}`);
};
check(() => expectError(withChange((fs) => (fs.prompt = "   ")), "domanda"));
check(() => expectError(withChange((fs) => (fs.reference_answer = "")), "risposta"));
check(() => expectError(withChange((fs) => (fs.rubric[0].concept = "")), "Concetto 1"));
for (const weight of ["0", "-1", "1.5", "abc", ""]) {
  check(() => expectError(withChange((fs) => (fs.rubric[0].weight = weight)), "peso"));
}
check(() => expectError(withChange((fs) => (fs.references = "1, art. 2")), "art. 2"));
check(() => expectError(withChange((fs) => (fs.references = "42-BIS")), "42-BIS"));
check(() => {
  const errors = validateQuestionForm(
    withChange((fs) => {
      fs.prompt = "";
      fs.rubric[0].weight = "0";
    })
  );
  assert.ok(errors.length >= 2, JSON.stringify(errors));
});

// 5. formStateToPatch
const patchOf = (change) => formStateToPatch(Q, withChange(change));
check(() => assert.deepEqual(formStateToPatch(Q, questionToFormState(Q)), {}));
check(() => assert.deepEqual(patchOf((fs) => (fs.prompt = " Nuovo ")), { prompt: "Nuovo" }));
check(() => assert.deepEqual(patchOf((fs) => (fs.references = "1")), { references: ["1"] }));
check(() => assert.deepEqual(patchOf((fs) => (fs.references = "")), { references: [] }));
check(() => assert.deepEqual(patchOf((fs) => (fs.references = "1,42-bis")), {}));
check(() => {
  const patch = patchOf((fs) => (fs.rubric[1].weight = "3"));
  assert.deepEqual(patch, {
    rubric: [
      { id: "c1", concept: "A", weight: 2 },
      { id: "c2", concept: "B", weight: 3 },
    ],
  });
  assert.equal(typeof patch.rubric[1].weight, "number");
});
check(() => {
  const patch = patchOf((fs) => {
    fs.prompt = "Altro";
    fs.reference_answer = "Altra";
    fs.references = "2";
    fs.rubric[0].concept = "Z";
  });
  assert.equal("topic_id" in patch, false);
  assert.equal("id" in patch, false);
});

// 6. pageAfterDelete
for (const [items, page, expected] of [
  [1, 3, 2],
  [1, 1, 1],
  [5, 3, 3],
  [0, 2, 2],
]) {
  check(() => assert.equal(pageAfterDelete(items, page), expected, `(${items}, ${page})`));
}

console.log(`questionForm: ${count} casi superati`);
