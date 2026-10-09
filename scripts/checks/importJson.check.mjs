// Verifica di client/src/utils/importJson.js (il client non ha un test runner).
// Uso: node scripts/checks/importJson.check.mjs
import assert from "node:assert/strict";
import {
  MAX_BODY_BYTES,
  MAX_TEXT_CHARS,
  parseImportText,
  describeJsonError,
  summarizeImport,
} from "../../client/src/utils/importJson.js";

let count = 0;
const check = (fn) => {
  fn();
  count += 1;
};

const valid = {
  topic: { name: "Obbligazioni" },
  questions: [
    {
      prompt: "Che cos'è?",
      answer: "È ...",
      rubric: [
        { id: "c1", concept: "A", weight: 1 },
        { id: "c2", concept: "B", weight: 2 },
      ],
      references: ["1"],
    },
  ],
};

const expectError = (text, word) => {
  const res = parseImportText(text);
  assert.equal(res.ok, false, `atteso errore per ${JSON.stringify(text).slice(0, 40)}`);
  assert.ok(res.error.includes(word), `"${word}" non presente in "${res.error}"`);
  return res.error;
};

// 1. vuoto
check(() => expectError("", "vuoto"));
check(() => expectError("  \n ", "vuoto"));

// 2-3. sintassi non valida
check(() => assert.ok(expectError('{"topic":', "JSON non valido").startsWith("JSON non valido")));
check(() => expectError('{\n  "a": 1,\n  "b" 2\n}', "riga 3"));

// 4-6. describeJsonError con i messaggi dei vari browser
check(() => {
  const msg = describeJsonError("Unexpected token } in JSON at position 5", '{\n"a"}');
  assert.ok(msg.startsWith("JSON non valido"), msg);
  assert.ok(msg.includes("riga 2"), msg);
  assert.ok(msg.includes("colonna 4"), msg);
});
check(() => {
  const msg = describeJsonError("JSON.parse: expected ',' at line 2 column 3 of the JSON data", "x");
  assert.ok(msg.includes("riga 2") && msg.includes("colonna 3"), msg);
});
check(() => {
  const msg = describeJsonError('JSON Parse error: Unexpected identifier "x"', "x");
  assert.ok(msg.startsWith("JSON non valido"), msg);
  assert.equal(msg.includes("riga"), false, msg);
});

// 7. non un oggetto
for (const text of ["[]", "null", "42", '"x"']) {
  check(() => expectError(text, "oggetto"));
}

// 8-9. validi (con BOM, indentato)
check(() => {
  const res = parseImportText("﻿" + JSON.stringify(valid));
  assert.equal(res.ok, true, res.error);
  assert.deepEqual(res.data, valid);
});
check(() => {
  const res = parseImportText(JSON.stringify(valid, null, 2));
  assert.equal(res.ok, true, res.error);
  assert.deepEqual(res.data, valid);
});

// 10. troppi caratteri
check(() => expectError("x".repeat(MAX_TEXT_CHARS + 1), "troppo grande"));

// 11. limite in byte UTF-8 del body compatto, non in caratteri
check(() => {
  const big = { ...valid, note: "è".repeat(60000) };
  assert.ok(JSON.stringify(big).length < 100000);
  const error = expectError(JSON.stringify(big, null, 2), "troppo grande");
  assert.ok(error.includes("kB"), error);
});
const withBytes = (bytes) => {
  const base = JSON.stringify({ ...valid, note: "" });
  return { ...valid, note: "x".repeat(bytes - new TextEncoder().encode(base).length) };
};
check(() => {
  const obj = withBytes(MAX_BODY_BYTES);
  assert.equal(new TextEncoder().encode(JSON.stringify(obj)).length, MAX_BODY_BYTES);
  assert.equal(parseImportText(JSON.stringify(obj, null, 2)).ok, true);
});
check(() => expectError(JSON.stringify(withBytes(MAX_BODY_BYTES + 1)), "troppo grande"));

// 12. limite allineato a express.json() del server
check(() => assert.equal(MAX_BODY_BYTES, 102400));

// 13. riepilogo
check(() =>
  assert.deepEqual(
    summarizeImport({ topic: { id: "t", name: "X", created: true }, inserted: 3, skipped: 1 }),
    { topicName: "X", topicStatus: "creato", inserted: 3, skipped: 1 }
  )
);
check(() =>
  assert.equal(
    summarizeImport({ topic: { id: "t", name: "X", created: false }, inserted: 0, skipped: 3 }).topicStatus,
    "già esistente"
  )
);

console.log(`importJson: ${count} casi superati`);
