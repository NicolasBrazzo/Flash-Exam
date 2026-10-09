const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const demo = require("../database/demoData");
const { questionsImportSchema } = require("../schemas/questionsImport.schema");
const { formatZodError } = require("../utils/zodError");
const { selectNewQuestions } = require("../utils/importQuestions");

const FORBIDDEN_PROMPT = /\bart\.|\barticol|\bcomma\b|quale articolo|quali articoli/i;

describe("dati demo del seed", () => {
  test("sono 2 argomenti", () => {
    assert.ok(Array.isArray(demo));
    assert.equal(demo.length, 2);
  });

  test("ogni argomento è un JSON di import valido", () => {
    for (const payload of demo) {
      const result = questionsImportSchema.safeParse(payload);
      assert.equal(
        result.success,
        true,
        result.success ? "" : formatZodError(result.error).join("; ")
      );
    }
  });

  test("i nomi iniziano per \"[DEMO] \" e sono diversi", () => {
    for (const payload of demo) {
      assert.ok(payload.topic.name.startsWith("[DEMO] "), payload.topic.name);
    }
    assert.notEqual(demo[0].topic.name, demo[1].topic.name);
  });

  test("almeno 4 domande per argomento, almeno 8 in totale", () => {
    for (const payload of demo) {
      assert.ok(payload.questions.length >= 4, payload.topic.name);
    }
    const total = demo.reduce((sum, payload) => sum + payload.questions.length, 0);
    assert.ok(total >= 8);
  });

  test("rubrica di 2 o 3 concetti, id univoci, peso intero positivo", () => {
    for (const { questions } of demo) {
      for (const q of questions) {
        assert.ok(q.rubric.length === 2 || q.rubric.length === 3, q.prompt);
        assert.equal(new Set(q.rubric.map((c) => c.id)).size, q.rubric.length, q.prompt);
        for (const c of q.rubric) {
          assert.ok(Number.isInteger(c.weight) && c.weight > 0, `${q.prompt}: ${c.id}`);
        }
      }
    }
  });

  test("risposta di circa 2 righe", () => {
    for (const { questions } of demo) {
      for (const q of questions) {
        const length = q.answer.trim().length;
        assert.ok(length >= 60 && length <= 400, `${q.prompt}: ${length} caratteri`);
      }
    }
  });

  test("references è sempre un elenco, anche vuoto", () => {
    for (const { questions } of demo) {
      for (const q of questions) {
        assert.ok(Array.isArray(q.references), q.prompt);
      }
    }
  });

  test("nessuna domanda su un articolo specifico", () => {
    for (const { questions } of demo) {
      for (const q of questions) {
        assert.doesNotMatch(q.prompt, FORBIDDEN_PROMPT);
      }
    }
  });

  test("nessuna domanda duplicata nello stesso argomento", () => {
    for (const payload of demo) {
      assert.equal(selectNewQuestions(payload.questions, [], "x").length, payload.questions.length);
    }
  });
});
