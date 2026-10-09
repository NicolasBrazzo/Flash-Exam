const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const { isWithinDeadline } = require("../utils/examTime");

const exam = { expires_at: "2026-10-01T10:40:00.000Z" };
const E = Date.parse(exam.expires_at);

describe("isWithinDeadline", () => {
  test("prima, esattamente a, dentro la tolleranza, oltre", () => {
    assert.equal(isWithinDeadline(exam, E - 1000, 15), true);
    assert.equal(isWithinDeadline(exam, E, 15), true);
    assert.equal(isWithinDeadline(exam, E + 10000, 15), true);
    assert.equal(isWithinDeadline(exam, E + 15000, 15), true);
    assert.equal(isWithinDeadline(exam, E + 15001, 15), false);
  });

  test("senza tolleranza", () => {
    assert.equal(isWithinDeadline(exam, E, 0), true);
    assert.equal(isWithinDeadline(exam, E + 1, 0), false);
  });

  test("now come Date", () => {
    assert.equal(isWithinDeadline(exam, new Date(E + 10000), 15), true);
    assert.equal(isWithinDeadline(exam, new Date(E + 15001), 15), false);
  });

  test("tolleranza di default: 15 secondi (D7)", () => {
    assert.equal(isWithinDeadline(exam, E + 15000), true);
    assert.equal(isWithinDeadline(exam, E + 15001), false);
  });

  test("dati non validi: false", () => {
    for (const expires_at of ["abc", null, undefined]) {
      assert.equal(isWithinDeadline({ expires_at }, E, 15), false, String(expires_at));
    }
    assert.equal(isWithinDeadline({}, E, 15), false);
    assert.equal(isWithinDeadline(exam, new Date("x"), 15), false);
  });
});
