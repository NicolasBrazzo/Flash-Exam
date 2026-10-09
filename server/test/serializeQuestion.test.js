const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const { serializeQuestion } = require("../utils/serializeQuestion");

const TOPIC_ID = "6f1c2e2a-4b7d-4c1e-9a3b-2d5e8f0a1b2c";
const QUESTION_ID = "0a9b8c7d-6e5f-4a3b-8c2d-1e0f9a8b7c6d";

const row = () => ({
  id: QUESTION_ID,
  topic_id: TOPIC_ID,
  topic: { id: TOPIC_ID, name: "Obbligazioni", position: 3 },
  prompt: "Che cos'è l'obbligazione?",
  answer: "Il vincolo giuridico tra debitore e creditore.",
  rubric: [
    { id: "c1", concept: "vincolo", weight: 1 },
    { id: "c2", concept: "parti", weight: 1 },
  ],
  article_refs: ["1", "42-bis"],
  created_at: "2026-10-01T10:00:00Z",
  updated_at: "2026-10-02T10:00:00Z",
});

describe("serializeQuestion", () => {
  test("converte la riga DB nella forma API", () => {
    const r = row();
    assert.deepEqual(serializeQuestion(r), {
      id: QUESTION_ID,
      topic: { id: TOPIC_ID, name: "Obbligazioni" },
      prompt: r.prompt,
      reference_answer: r.answer,
      rubric: r.rubric,
      references: ["1", "42-bis"],
      created_at: r.created_at,
      updated_at: r.updated_at,
    });
  });

  test("references vuoto se article_refs manca, topic null se manca", () => {
    const r = row();
    delete r.article_refs;
    r.topic = null;
    const question = serializeQuestion(r);
    assert.deepEqual(question.references, []);
    assert.equal(question.topic, null);
  });

  test("non modifica l'input", () => {
    const r = row();
    const copy = structuredClone(r);
    serializeQuestion(r);
    assert.deepEqual(r, copy);
  });
});
