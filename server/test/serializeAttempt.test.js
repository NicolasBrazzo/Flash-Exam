const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const { serializeAttempt } = require("../utils/serializeAttempt");

const question = () => ({ answer: "rif", article_refs: ["1"], rubric: [{ id: "c1", concept: "x", weight: 1 }] });

const aiAttempt = () => ({
  id: "a1",
  verdict: "partial",
  grading_source: "AI",
  grading: {
    concepts: [{ id: "c1", status: "partial" }],
    verdict: "partial",
    corrections: [{ written: "w", suggested: "s", reason: "r", extra: 1 }],
    suggestion: "s",
    exampleAnswer: "e",
  },
  score: 0.5,
  points: 2.5,
  answer: "x",
});

const FORBIDDEN = ['"score"', '"points"', '"concepts"', '"rubric"', '"grading"'];
const assertClean = (result) => {
  const raw = JSON.stringify(result);
  for (const key of FORBIDDEN) assert.equal(raw.includes(key), false, key);
  assert.equal("answer" in result, false);
};

describe("serializeAttempt", () => {
  test("valutazione AI: forma e feedback", () => {
    const result = serializeAttempt(aiAttempt(), question());
    assert.deepEqual(Object.keys(result).sort(), ["feedback", "grading_source", "id", "reference_answer", "references", "verdict"]);
    assert.deepEqual(result.feedback, {
      corrections: [{ written: "w", suggested: "s", reason: "r" }],
      suggestion: "s",
      exampleAnswer: "e",
    });
    assert.equal(result.verdict, "partial");
    assert.equal(result.grading_source, "AI");
    assert.equal(result.reference_answer, "rif");
    assert.deepEqual(result.references, ["1"]);
    assertClean(result);
  });

  test("risposta vuota (D6): autovalutazione d'ufficio, niente feedback", () => {
    const result = serializeAttempt({ id: "a2", verdict: "wrong", grading_source: "SELF", grading: null, score: 0, points: 0 }, question());
    assert.equal(result.verdict, "wrong");
    assert.equal(result.grading_source, "SELF");
    assert.equal(result.feedback, null);
    assertClean(result);
  });

  test("autovalutazione con grading valorizzato: feedback comunque null", () => {
    const result = serializeAttempt({ ...aiAttempt(), grading_source: "SELF" }, question());
    assert.equal(result.feedback, null);
    assertClean(result);
  });

  test("non valutato", () => {
    for (const attempt of [{ id: "a3", verdict: null, grading_source: null, grading: null }, { id: "a3" }]) {
      const result = serializeAttempt(attempt, question());
      assert.equal(result.verdict, null);
      assert.equal(result.grading_source, null);
      assert.equal(result.feedback, null);
      assert.equal(result.reference_answer, "rif");
      assert.deepEqual(result.references, ["1"]);
      assertClean(result);
    }
  });

  test("domanda di default dall'attempt, riferimenti assenti", () => {
    const result = serializeAttempt({ id: "a4", question: { answer: "rif2" } });
    assert.equal(result.reference_answer, "rif2");
    assert.deepEqual(result.references, []);
  });
});
