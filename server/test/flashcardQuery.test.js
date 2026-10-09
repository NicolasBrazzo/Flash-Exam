const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const { parseFlashcardQuery } = require("../utils/flashcardQuery");

const U1 = "6f1c2e2a-4b7d-4c1e-9a3b-2d5e8f0a1b2c";
const U2 = "0a9b8c7d-6e5f-4a3b-8c2d-1e0f9a8b7c6d";
const uuid = (i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;

const expectError = (query, word) => {
  const res = parseFlashcardQuery(query);
  assert.equal(res.ok, false, JSON.stringify(query));
  assert.equal(typeof res.error, "string");
  assert.ok(res.error.includes(word), `"${word}" non presente in "${res.error}"`);
};

describe("parseFlashcardQuery: validi", () => {
  test("un argomento, count di default", () => {
    assert.deepEqual(parseFlashcardQuery({ topics: U1 }), { ok: true, topicIds: [U1], count: 10 });
  });

  test("più argomenti e count", () => {
    assert.deepEqual(parseFlashcardQuery({ topics: `${U1}, ${U2}`, count: "5" }), {
      ok: true,
      topicIds: [U1, U2],
      count: 5,
    });
  });

  test("segmenti vuoti tollerati e duplicati rimossi", () => {
    assert.deepEqual(parseFlashcardQuery({ topics: `${U1},,${U2},` }).topicIds, [U1, U2]);
    assert.deepEqual(parseFlashcardQuery({ topics: `${U1},${U1}` }).topicIds, [U1]);
    assert.deepEqual(parseFlashcardQuery({ topics: `${U1},${U1.toUpperCase()}` }).topicIds, [U1]);
  });

  test("count ai limiti e vuoto", () => {
    assert.equal(parseFlashcardQuery({ topics: U1, count: "1" }).count, 1);
    assert.equal(parseFlashcardQuery({ topics: U1, count: "50" }).count, 50);
    assert.equal(parseFlashcardQuery({ topics: U1, count: "" }).count, 10);
    assert.equal(parseFlashcardQuery({ topics: U1, count: "010" }).count, 10);
  });

  test("al massimo 100 argomenti", () => {
    const hundred = Array.from({ length: 100 }, (_, i) => uuid(i)).join(",");
    assert.equal(parseFlashcardQuery({ topics: hundred }).ok, true);
  });
});

describe("parseFlashcardQuery: errori", () => {
  test("topics mancante o non valido", () => {
    for (const query of [
      {},
      { topics: "" },
      { topics: " , " },
      { topics: "abc" },
      { topics: `${U1},abc` },
      { topics: [U1, U2] },
      { topics: { a: U1 } },
      { topics: Array.from({ length: 101 }, (_, i) => uuid(i)).join(",") },
    ]) {
      expectError(query, "topics");
    }
  });

  test("count non valido", () => {
    for (const count of ["0", "51", "1.5", "10abc", "-1", " 10", "abc", ["5", "6"]]) {
      expectError({ topics: U1, count }, "count");
    }
  });

  test("prima si controlla topics", () => {
    expectError({ count: "0" }, "topics");
  });

  test("senza argomenti", () => {
    assert.equal(parseFlashcardQuery().ok, false);
  });
});
