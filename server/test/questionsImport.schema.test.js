const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const { z } = require("../config/zod");
const { questionsImportSchema } = require("../schemas/questionsImport.schema");

// Payload valido di partenza: ogni caso ne crea una copia e cambia un solo campo
const validPayload = () => ({
  topic: { name: "Obbligazioni" },
  questions: [
    {
      prompt: "Che cos'è l'obbligazione?",
      answer: "Il vincolo giuridico tra debitore e creditore.",
      rubric: [
        { id: "c0", concept: "vincolo giuridico", weight: 1 },
        { id: "c1", concept: "debitore e creditore", weight: 2 },
      ],
      references: ["1", "42-bis"],
    },
  ],
});

const concept = (i) => ({ id: `c${i}`, concept: `concetto ${i}`, weight: 1 });

// Il payload deve fallire con un issue Zod sul path e con il codice attesi
const expectInvalid = (payload, path, code) => {
  const result = questionsImportSchema.safeParse(payload);
  assert.equal(result.success, false);
  assert.ok(result.error instanceof z.ZodError);
  const issue = result.error.issues.find((i) => i.path.join(".") === path && i.code === code);
  assert.ok(issue, `atteso issue ${code} su "${path}", ricevuti: ${JSON.stringify(result.error.issues)}`);
  return issue;
};

describe("questionsImportSchema", () => {
  test("payload valido", () => {
    const result = questionsImportSchema.safeParse(validPayload());
    assert.equal(result.success, true);
    assert.equal(result.data.topic.name, "Obbligazioni");
    assert.deepEqual(result.data.questions[0].references, ["1", "42-bis"]);
  });

  test("references assente: default elenco vuoto", () => {
    const payload = validPayload();
    delete payload.questions[0].references;
    const result = questionsImportSchema.safeParse(payload);
    assert.equal(result.success, true);
    assert.deepEqual(result.data.questions[0].references, []);
  });

  test("topic.name mancante", () => {
    const payload = validPayload();
    delete payload.topic.name;
    const issue = expectInvalid(payload, "topic.name", "invalid_type");
    assert.equal(issue.message, "Campo obbligatorio");
  });

  test("topic.name vuoto", () => {
    const payload = validPayload();
    payload.topic.name = "   ";
    expectInvalid(payload, "topic.name", "too_small");
  });

  test("rubrica con 1 concetto", () => {
    const payload = validPayload();
    payload.questions[0].rubric = [concept(0)];
    expectInvalid(payload, "questions.0.rubric", "too_small");
  });

  test("rubrica con 5 concetti", () => {
    const payload = validPayload();
    payload.questions[0].rubric = [0, 1, 2, 3, 4].map(concept);
    expectInvalid(payload, "questions.0.rubric", "too_big");
  });

  test("rubrica con 4 concetti: valida", () => {
    const payload = validPayload();
    payload.questions[0].rubric = [0, 1, 2, 3].map(concept);
    assert.equal(questionsImportSchema.safeParse(payload).success, true);
  });

  test("id di rubrica duplicati", () => {
    const payload = validPayload();
    payload.questions[0].rubric[1].id = "c0";
    expectInvalid(payload, "questions.0.rubric.1.id", "custom");
  });

  test("weight 0", () => {
    const payload = validPayload();
    payload.questions[0].rubric[0].weight = 0;
    expectInvalid(payload, "questions.0.rubric.0.weight", "too_small");
  });

  test("weight negativo", () => {
    const payload = validPayload();
    payload.questions[0].rubric[0].weight = -1;
    expectInvalid(payload, "questions.0.rubric.0.weight", "too_small");
  });

  test("weight decimale", () => {
    const payload = validPayload();
    payload.questions[0].rubric[0].weight = 1.5;
    expectInvalid(payload, "questions.0.rubric.0.weight", "invalid_type");
  });

  for (const [label, value] of [
    ["stringa", "1"],
    ["oggetto", {}],
    ["null", null],
  ]) {
    test(`references non array (${label})`, () => {
      const payload = validPayload();
      payload.questions[0].references = value;
      expectInvalid(payload, "questions.0.references", "invalid_type");
    });
  }
});
