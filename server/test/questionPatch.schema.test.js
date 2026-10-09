const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const { questionPatchSchema } = require("../schemas/questionPatch.schema");
const { questionsImportSchema } = require("../schemas/questionsImport.schema");

const TOPIC_ID = "6f1c2e2a-4b7d-4c1e-9a3b-2d5e8f0a1b2c";
const rubric = () => [
  { id: "c1", concept: "a", weight: 1 },
  { id: "c2", concept: "b", weight: 2 },
];
const concept = (i) => ({ id: `c${i}`, concept: `concetto ${i}`, weight: 1 });

// Il body deve fallire con un issue sul path (e, se indicato, con il codice) attesi
const expectInvalid = (body, path, code) => {
  const result = questionPatchSchema.safeParse(body);
  assert.equal(result.success, false, JSON.stringify(body));
  const issue = result.error.issues.find(
    (i) => i.path.join(".") === path && (code === undefined || i.code === code)
  );
  assert.ok(issue, `atteso issue ${code ?? ""} su "${path}", ricevuti: ${JSON.stringify(result.error.issues)}`);
  return issue;
};

const parse = (body) => {
  const result = questionPatchSchema.safeParse(body);
  assert.equal(result.success, true, JSON.stringify(result.error?.issues));
  return result.data;
};

describe("questionPatchSchema: body", () => {
  test("body vuoto", () => {
    const issue = expectInvalid({}, "");
    assert.equal(issue.message, "Indica almeno un campo da modificare");
  });

  test("campo sconosciuto", () => {
    expectInvalid({ prompt: "x", answer: "y" }, "", "unrecognized_keys");
    expectInvalid({ foo: 1 }, "", "unrecognized_keys");
  });
});

describe("questionPatchSchema: rubrica invalida", () => {
  test("1 concetto", () => {
    expectInvalid({ rubric: [concept(1)] }, "rubric", "too_small");
  });

  test("5 concetti", () => {
    expectInvalid({ rubric: [1, 2, 3, 4, 5].map(concept) }, "rubric", "too_big");
  });

  test("id duplicati", () => {
    const r = rubric();
    r[1].id = "c1";
    expectInvalid({ rubric: r }, "rubric.1.id", "custom");
  });

  test("peso 0 o decimale", () => {
    for (const weight of [0, 1.5]) {
      const r = rubric();
      r[0].weight = weight;
      expectInvalid({ rubric: r }, "rubric.0.weight");
    }
  });

  test("chiave in più nel concetto", () => {
    const r = rubric();
    r[0].extra = true;
    expectInvalid({ rubric: r }, "rubric.0", "unrecognized_keys");
  });
});

describe("questionPatchSchema: altri campi invalidi", () => {
  test("topic_id non uuid", () => {
    expectInvalid({ topic_id: "non-uuid" }, "topic_id");
  });

  test("testi vuoti o null", () => {
    expectInvalid({ prompt: "   " }, "prompt");
    expectInvalid({ reference_answer: "" }, "reference_answer");
    expectInvalid({ prompt: null }, "prompt");
  });

  test("riferimento non valido", () => {
    expectInvalid({ references: ["abc"] }, "references.0");
  });
});

describe("questionPatchSchema: casi validi", () => {
  test("prompt con trim", () => {
    assert.equal(parse({ prompt: "  Testo  " }).prompt, "Testo");
  });

  test("un solo campo alla volta", () => {
    assert.equal(parse({ reference_answer: "r" }).reference_answer, "r");
    assert.deepEqual(parse({ rubric: rubric() }).rubric, rubric());
    assert.equal(parse({ topic_id: TOPIC_ID }).topic_id, TOPIC_ID);
    assert.equal(
      parse({ topic_id: "00000000-0000-0000-0000-000000000001" }).topic_id,
      "00000000-0000-0000-0000-000000000001"
    );
  });

  test("references: svuotamento ammesso e trim", () => {
    assert.deepEqual(parse({ references: [] }).references, []);
    assert.deepEqual(parse({ references: [" 42-bis "] }).references, ["42-bis"]);
  });

  test("tutti i campi insieme", () => {
    const data = parse({
      topic_id: TOPIC_ID,
      prompt: "p",
      reference_answer: "r",
      rubric: rubric(),
      references: ["1"],
    });
    assert.deepEqual(Object.keys(data).sort(), ["prompt", "reference_answer", "references", "rubric", "topic_id"]);
  });

  test("nessun default iniettato", () => {
    assert.deepEqual(Object.keys(parse({ prompt: "x" })), ["prompt"]);
  });
});

describe("schema di import", () => {
  test("resta esportato", () => {
    assert.equal(typeof questionsImportSchema.safeParse, "function");
  });
});
