const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const scoring = require("../utils/scoring");
const {
  computeScore,
  computePoints,
  selfGradeScore,
  emptyAnswerResult,
  computeExamGrade,
} = scoring;

const rubric = (...weights) => weights.map((weight, i) => ({ id: `c${i}`, concept: `concetto ${i}`, weight }));
const concepts = (...statuses) => statuses.map((status, i) => ({ id: `c${i}`, status }));
const corr = (n) => Array.from({ length: n }, (_, i) => ({ written: `w${i}`, suggested: `s${i}`, reason: `r${i}` }));
const att = (points, { verdict = "correct", source = "AI", corrections = [] } = {}) => ({
  verdict,
  points,
  grading_source: source,
  grading: source === "AI" ? { corrections } : null,
});
const times = (n, fn) => Array.from({ length: n }, fn);

describe("computeScore e computePoints", () => {
  test("tutti present, nessuna correzione: 1 e 5 punti", () => {
    const score = computeScore({ rubric: rubric(1, 1, 1), concepts: concepts("present", "present", "present"), corrections: [] });
    assert.strictEqual(score, 1);
    assert.strictEqual(computePoints(score), 5);
  });

  test("tutti absent: 0", () => {
    const score = computeScore({ rubric: rubric(1, 1, 1), concepts: concepts("absent", "absent", "absent"), corrections: [] });
    assert.strictEqual(score, 0);
    assert.strictEqual(computePoints(score), 0);
  });

  test("concetti pieni con 1 correzione: sotto il massimo", () => {
    const score = computeScore({ rubric: rubric(1, 1, 1), concepts: concepts("present", "present", "present"), corrections: corr(1) });
    assert.strictEqual(score, 0.9);
    assert.ok(score < 1);
    assert.strictEqual(computePoints(score), 4.5);
  });

  test("penalità di 0,1 per correzione, al massimo 0,3", () => {
    const got = [0, 1, 2, 3, 4, 5].map((n) =>
      computeScore({ rubric: rubric(1, 1, 1), concepts: concepts("present", "present", "present"), corrections: corr(n) })
    );
    assert.deepStrictEqual(got, [1, 0.9, 0.8, 0.7, 0.7, 0.7]);
  });

  test("pesi diversi: peso 2 present + peso 1 absent -> 2/3", () => {
    const score = computeScore({ rubric: rubric(2, 1), concepts: concepts("present", "absent"), corrections: [] });
    assert.strictEqual(score, 0.667);
    assert.strictEqual(computePoints(score), 3.34);
  });

  test("concetto partial vale 0,5", () => {
    const score = computeScore({ rubric: rubric(1, 1), concepts: concepts("present", "partial"), corrections: [] });
    assert.strictEqual(score, 0.75);
    assert.strictEqual(computePoints(score), 3.75);
  });

  test("altre combinazioni", () => {
    assert.strictEqual(computeScore({ rubric: rubric(1), concepts: concepts("partial"), corrections: corr(3) }), 0.2);
    assert.strictEqual(computeScore({ rubric: rubric(2, 1), concepts: concepts("present", "absent"), corrections: corr(1) }), 0.567);
    assert.strictEqual(computeScore({ rubric: rubric(1, 1), concepts: concepts("absent", "absent"), corrections: corr(2) }), 0);
  });

  test("abbinamento per id: mancante = absent, extra ignorato, ordine indifferente", () => {
    const base = computeScore({ rubric: rubric(1, 1), concepts: concepts("present", "partial"), corrections: [] });
    assert.strictEqual(
      computeScore({ rubric: rubric(1, 1), concepts: [{ id: "c0", status: "present" }], corrections: [] }),
      0.5
    );
    assert.strictEqual(
      computeScore({ rubric: rubric(1, 1), concepts: [...concepts("present", "partial"), { id: "c9", status: "present" }], corrections: [] }),
      base
    );
    assert.strictEqual(
      computeScore({ rubric: rubric(1, 1), concepts: concepts("present", "partial").reverse(), corrections: [] }),
      base
    );
  });

  test("corrections assente vale come elenco vuoto", () => {
    assert.strictEqual(computeScore({ rubric: rubric(1, 1), concepts: concepts("present", "present") }), 1);
  });

  test("input non validi", () => {
    const ok = { rubric: rubric(1, 1), concepts: concepts("present", "present"), corrections: [] };
    for (const bad of [
      { ...ok, rubric: [] },
      { ...ok, rubric: rubric(0, 1) },
      { ...ok, rubric: rubric(-1, 1) },
      { ...ok, concepts: [{ id: "c0", status: "unknown" }] },
      { ...ok, concepts: [{ id: "c0", status: "present" }, { id: "c0", status: "absent" }] },
      { ...ok, corrections: "x" },
    ]) {
      assert.throws(() => computeScore(bad), /SCORING_INVALID_INPUT/, JSON.stringify(bad));
    }
  });

  test("computePoints: score fuori dominio", () => {
    for (const bad of [-0.1, 1.01, NaN, "1"]) {
      assert.throws(() => computePoints(bad), /SCORING_INVALID_SCORE/, String(bad));
    }
  });

  test("computePoints: score con molti decimali", () => {
    assert.strictEqual(computePoints(0.66666), 3.34);
    assert.strictEqual(computePoints(0.123456), 0.62);
    assert.strictEqual(computePoints(0.701), 3.51);
    assert.strictEqual(computePoints(0.998), 4.99);
  });
});

describe("selfGradeScore", () => {
  test("1 / 0,5 / 0", () => {
    assert.strictEqual(selfGradeScore("correct"), 1);
    assert.strictEqual(selfGradeScore("partial"), 0.5);
    assert.strictEqual(selfGradeScore("wrong"), 0);
  });

  test("verdetto non valido", () => {
    for (const bad of ["CORRECT", null, "toString"]) {
      assert.throws(() => selfGradeScore(bad), /SCORING_INVALID_VERDICT/, String(bad));
    }
  });
});

describe("emptyAnswerResult", () => {
  test("risposta vuota: wrong, 0, autovalutazione d'ufficio (D6)", () => {
    assert.deepStrictEqual(emptyAnswerResult(), {
      verdict: "wrong",
      score: 0,
      points: 0,
      grading_source: "SELF",
      grading: null,
    });
  });

  test("oggetto nuovo a ogni chiamata", () => {
    const first = emptyAnswerResult();
    first.points = 5;
    assert.strictEqual(emptyAnswerResult().points, 0);
  });
});

describe("computeExamGrade", () => {
  test("6 domande da 5 punti: 30 con lode", () => {
    assert.deepStrictEqual(computeExamGrade(times(6, () => att(5))), { grade: 30, honors: true });
  });

  test("6 da 4,99 (29,94): 30 con lode, D1 alla lettera", () => {
    assert.deepStrictEqual(computeExamGrade(times(6, () => att(4.99))), { grade: 30, honors: true });
  });

  test("6 da 5 ma una con correzione: 29 o meno, niente lode", () => {
    const withCorrection = computePoints(
      computeScore({ rubric: rubric(1, 1), concepts: concepts("present", "present"), corrections: corr(1) })
    );
    const result = computeExamGrade([...times(5, () => att(5)), att(withCorrection, { corrections: corr(1) })]);
    assert.ok(result.grade <= 29, `voto ${result.grade}`);
    assert.strictEqual(result.grade, 29);
    assert.strictEqual(result.honors, false);
  });

  test("arrotondamento del voto", () => {
    assert.deepStrictEqual(computeExamGrade([...times(5, () => att(5)), att(4.4)]), { grade: 29, honors: false });
    assert.strictEqual(computeExamGrade([...times(5, () => att(5)), att(4.51)]).grade, 30);
  });

  test("5 corrette e una partial: niente lode", () => {
    assert.strictEqual(computeExamGrade([...times(5, () => att(5)), att(3.75, { verdict: "partial" })]).honors, false);
  });

  test("autovalutazione: mai lode", () => {
    assert.deepStrictEqual(
      computeExamGrade([...times(5, () => att(5)), att(5, { source: "SELF" })]),
      { grade: 30, honors: false }
    );
    assert.strictEqual(computeExamGrade(times(6, () => att(5, { source: "SELF" }))).honors, false);
  });

  test("dati incoerenti o mancanti: niente lode", () => {
    assert.strictEqual(computeExamGrade([...times(5, () => att(5)), att(5, { corrections: corr(1) })]).honors, false);
    const noGrading = times(6, () => ({ verdict: "correct", points: 5, grading_source: "AI", grading: null }));
    assert.strictEqual(computeExamGrade(noGrading).honors, false);
  });

  test("risposta vuota tra le sei", () => {
    assert.deepStrictEqual(computeExamGrade([...times(5, () => att(5)), emptyAnswerResult()]), { grade: 25, honors: false });
  });

  test("tutte sbagliate: 0", () => {
    assert.deepStrictEqual(computeExamGrade(times(6, () => att(0, { verdict: "wrong" }))), { grade: 0, honors: false });
  });

  test("voto limitato a 30", () => {
    assert.strictEqual(computeExamGrade(times(7, () => att(5))).grade, 30);
  });

  test("input non validi", () => {
    for (const bad of [[], "x", [att(null)], [att(6)], [att(-1)]]) {
      assert.throws(() => computeExamGrade(bad), /SCORING_INVALID_ATTEMPTS/, JSON.stringify(bad));
    }
  });

  test("non modifica l'input", () => {
    const input = [...times(5, () => att(5)), att(4.5, { corrections: corr(1) })];
    const copy = structuredClone(input);
    computeExamGrade(input);
    assert.deepStrictEqual(input, copy);
  });
});

describe("niente percentuali", () => {
  test("solo le cinque funzioni esportate", () => {
    assert.deepStrictEqual(Object.keys(scoring).sort(), [
      "computeExamGrade",
      "computePoints",
      "computeScore",
      "emptyAnswerResult",
      "selfGradeScore",
    ]);
  });

  test("nessun risultato è una stringa", () => {
    const score = computeScore({ rubric: rubric(2, 1), concepts: concepts("present", "absent"), corrections: [] });
    const values = [
      computeScore({ rubric: rubric(1, 1, 1), concepts: concepts("present", "present", "present"), corrections: [] }),
      score,
      computePoints(score),
      ...Object.values(computeExamGrade(times(6, () => att(5)))),
    ];
    for (const value of values) {
      assert.ok(typeof value === "number" || typeof value === "boolean", `${typeof value}: ${value}`);
    }
  });
});
