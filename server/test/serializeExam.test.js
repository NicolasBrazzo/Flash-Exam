const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const { serializeExam } = require("../utils/serializeExam");

const TOPIC = { id: "6f1c2e2a-4b7d-4c1e-9a3b-2d5e8f0a1b2c", name: "Obbligazioni" };

const session = (status, extra = {}) => ({
  id: "e0000000-0000-4000-8000-000000000001",
  status,
  started_at: "2026-10-01T10:00:00.000Z",
  expires_at: "2026-10-01T10:40:00.000Z",
  submitted_at: status === "IN_PROGRESS" ? null : "2026-10-01T10:30:00.000Z",
  auto_submitted: false,
  grade: status === "GRADED" ? 28 : null,
  honors: false,
  created_at: "2026-10-01T10:00:00.000Z",
  ...extra,
});

const attempt = (position, { source = "AI", verdict = "correct" } = {}) => ({
  id: `a000000${position}`,
  position,
  answer: `bozza ${position}`,
  verdict: source ? verdict : null,
  grading_source: source,
  grading:
    source === "AI"
      ? {
          concepts: [{ id: "c1", status: "present" }],
          verdict,
          corrections: [{ written: "nullo", suggested: "annullabile", reason: "motivo", extra: 1 }],
          suggestion: "consiglio",
          exampleAnswer: "esemplare",
        }
      : null,
  points: 5,
  score: 1,
  question: {
    id: `q000000${position}`,
    prompt: `Domanda ${position}?`,
    answer: `Riferimento ${position}.`,
    rubric: [{ id: "c1", concept: "x", weight: 1 }],
    article_refs: [String(position)],
    topic: TOPIC,
  },
});

const ORDER = [3, 1, 6, 2, 5, 4];
const attempts = (opts) => ORDER.map((p) => attempt(p, opts));
const FORBIDDEN_ALWAYS = ['"score"', '"points"', '"rubric"', '"concepts"'];

describe("serializeExam: prova in corso", () => {
  test("solo position, prompt, topic e answer, in ordine", () => {
    const exam = serializeExam(session("IN_PROGRESS"), attempts({ source: null }));
    assert.deepEqual(Object.keys(exam).sort(), [
      "auto_submitted",
      "expires_at",
      "grade",
      "honors",
      "id",
      "questions",
      "started_at",
      "status",
      "submitted_at",
    ]);
    assert.deepEqual(exam.questions.map((q) => q.position), [1, 2, 3, 4, 5, 6]);
    for (const q of exam.questions) {
      assert.deepEqual(Object.keys(q).sort(), ["answer", "position", "prompt", "topic"]);
    }
    assert.equal(exam.questions[0].answer, "bozza 1");
    const raw = JSON.stringify(exam);
    for (const word of ["reference_answer", "rubric", "references", "verdict", "feedback", "score", "points", "concepts"]) {
      assert.equal(raw.includes(word), false, word);
    }
  });

  test("anche con dati di valutazione presenti nelle righe, in corso non escono", () => {
    const raw = JSON.stringify(serializeExam(session("IN_PROGRESS"), attempts()));
    for (const word of ["reference_answer", "rubric", "verdict", "feedback", "exampleAnswer"]) {
      assert.equal(raw.includes(word), false, word);
    }
  });
});

describe("serializeExam: dopo la consegna", () => {
  test("GRADED con valutazione AI: campi di revisione e feedback", () => {
    const exam = serializeExam(session("GRADED"), attempts());
    for (const q of exam.questions) {
      assert.deepEqual(Object.keys(q).sort(), [
        "answer",
        "feedback",
        "grading_source",
        "position",
        "prompt",
        "reference_answer",
        "references",
        "topic",
        "verdict",
      ]);
    }
    const first = exam.questions[0];
    assert.equal(first.reference_answer, "Riferimento 1.");
    assert.deepEqual(first.references, ["1"]);
    assert.equal(first.verdict, "correct");
    assert.equal(first.grading_source, "AI");
    assert.deepEqual(first.feedback, {
      corrections: [{ written: "nullo", suggested: "annullabile", reason: "motivo" }],
      suggestion: "consiglio",
      exampleAnswer: "esemplare",
    });
    assert.equal(exam.grade, 28);
  });

  test("SELF_GRADED non ancora valutata: verdict, fonte e feedback null", () => {
    const exam = serializeExam(session("SELF_GRADED"), attempts({ source: null }));
    for (const q of exam.questions) {
      assert.equal(q.verdict, null);
      assert.equal(q.grading_source, null);
      assert.equal(q.feedback, null);
      assert.ok("reference_answer" in q);
    }
  });

  test("autovalutazione: feedback null", () => {
    const exam = serializeExam(session("SELF_GRADED"), attempts({ source: "SELF", verdict: "partial" }));
    assert.equal(exam.questions[0].verdict, "partial");
    assert.equal(exam.questions[0].grading_source, "SELF");
    assert.equal(exam.questions[0].feedback, null);
  });
});

describe("serializeExam: sempre", () => {
  test("mai punteggi, punti, rubrica o concetti", () => {
    for (const status of ["IN_PROGRESS", "GRADING", "GRADED", "SELF_GRADED"]) {
      const raw = JSON.stringify(serializeExam(session(status), attempts()));
      for (const word of FORBIDDEN_ALWAYS) assert.equal(raw.includes(word), false, `${status}: ${word}`);
    }
  });

  test("stato sconosciuto trattato come in corso", () => {
    const exam = serializeExam(session("BOH"), attempts());
    for (const q of exam.questions) {
      assert.deepEqual(Object.keys(q).sort(), ["answer", "position", "prompt", "topic"]);
    }
  });

  test("input non modificato, valori mancanti a null", () => {
    const list = attempts();
    const order = list.map((a) => a.position);
    serializeExam(session("GRADED"), list);
    assert.deepEqual(list.map((a) => a.position), order);

    const noTopic = attempts({ source: null }).map((a) => ({ ...a, question: { ...a.question, topic: null } }));
    const s = session("IN_PROGRESS");
    delete s.submitted_at;
    delete s.grade;
    const exam = serializeExam(s, noTopic);
    assert.equal(exam.questions[0].topic, null);
    assert.equal(exam.submitted_at, null);
    assert.equal(exam.grade, null);
  });
});
