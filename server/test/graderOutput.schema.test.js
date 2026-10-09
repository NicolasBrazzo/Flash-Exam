const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const {
  graderOutputSchema,
  graderBatchOutputSchema,
} = require("../schemas/graderOutput.schema");

const valid = () => ({
  concepts: [
    { id: "c1", status: "present" },
    { id: "c2", status: "partial" },
  ],
  verdict: "partial",
  corrections: [
    { written: "è nullo", suggested: "è annullabile", reason: "L'incapacità naturale determina annullabilità" },
  ],
  suggestion: "Cita il termine.",
  exampleAnswer: "Testo esemplare.",
});

const expectInvalid = (schema, value, path) => {
  const result = schema.safeParse(value);
  assert.equal(result.success, false, JSON.stringify(value));
  if (path !== undefined) {
    const paths = result.error.issues.map((i) => i.path.join("."));
    assert.ok(paths.includes(path), `atteso issue su "${path}", ricevuti: ${JSON.stringify(paths)}`);
  }
};

describe("graderOutputSchema: validi", () => {
  test("output valido", () => {
    const result = graderOutputSchema.safeParse(valid());
    assert.equal(result.success, true);
    assert.deepEqual(result.data, valid());
  });

  test("nessuna correzione e nessun suggerimento", () => {
    const value = { ...valid(), corrections: [], suggestion: "" };
    assert.equal(graderOutputSchema.safeParse(value).success, true);
  });

  test("campi extra scartati (anche percentuali)", () => {
    const value = valid();
    value.score = 0.8;
    value.percentage = "80%";
    value.concepts[0].confidence = 0.9;
    value.corrections[0].extra = "x";
    const result = graderOutputSchema.safeParse(value);
    assert.equal(result.success, true);
    assert.equal("score" in result.data, false);
    assert.equal("percentage" in result.data, false);
    assert.equal("confidence" in result.data.concepts[0], false);
    assert.equal("extra" in result.data.corrections[0], false);
  });
});

describe("graderOutputSchema: rifiutati", () => {
  test("valori fuori dominio", () => {
    expectInvalid(graderOutputSchema, { ...valid(), verdict: "excellent" }, "verdict");
    expectInvalid(graderOutputSchema, { ...valid(), verdict: "CORRECT" }, "verdict");
    const value = valid();
    value.concepts[0].status = "missing";
    expectInvalid(graderOutputSchema, value, "concepts.0.status");
  });

  test("campi mancanti", () => {
    for (const key of ["concepts", "verdict", "corrections", "suggestion", "exampleAnswer"]) {
      const value = valid();
      delete value[key];
      expectInvalid(graderOutputSchema, value, key);
    }
    let value = valid();
    delete value.concepts[0].id;
    expectInvalid(graderOutputSchema, value, "concepts.0.id");
    value = valid();
    delete value.concepts[0].status;
    expectInvalid(graderOutputSchema, value, "concepts.0.status");
    value = valid();
    delete value.corrections[0].reason;
    expectInvalid(graderOutputSchema, value, "corrections.0.reason");
  });

  test("vincoli e tipi", () => {
    expectInvalid(graderOutputSchema, { ...valid(), concepts: [] }, "concepts");
    for (const id of ["", "   "]) {
      const value = valid();
      value.concepts[0].id = id;
      expectInvalid(graderOutputSchema, value, "concepts.0.id");
    }
    expectInvalid(graderOutputSchema, { ...valid(), exampleAnswer: "" }, "exampleAnswer");
    const value = valid();
    value.corrections[0].written = "";
    expectInvalid(graderOutputSchema, value, "corrections.0.written");
    expectInvalid(graderOutputSchema, { ...valid(), concepts: { id: "c1" } }, "concepts");
    expectInvalid(graderOutputSchema, { ...valid(), suggestion: 3 }, "suggestion");
  });
});

describe("graderBatchOutputSchema", () => {
  test("batch valido, index conservati", () => {
    const result = graderBatchOutputSchema.safeParse({
      results: [
        { index: 1, ...valid() },
        { index: 3, ...valid() },
      ],
    });
    assert.equal(result.success, true);
    assert.deepEqual(result.data.results.map((r) => r.index), [1, 3]);
  });

  test("campi extra scartati", () => {
    const result = graderBatchOutputSchema.safeParse({
      average: 0.5,
      results: [{ index: 1, score: 1, ...valid() }],
    });
    assert.equal(result.success, true);
    assert.equal("average" in result.data, false);
    assert.equal("score" in result.data.results[0], false);
  });

  test("batch rifiutati", () => {
    expectInvalid(graderBatchOutputSchema, { results: [] }, "results");
    expectInvalid(graderBatchOutputSchema, { results: [valid()] }, "results.0.index");
    for (const index of [0, -1, 1.5, "1"]) {
      expectInvalid(graderBatchOutputSchema, { results: [{ index, ...valid() }] }, "results.0.index");
    }
    expectInvalid(
      graderBatchOutputSchema,
      { results: [{ index: 1, ...valid(), verdict: "boh" }] },
      "results.0.verdict"
    );
  });
});
