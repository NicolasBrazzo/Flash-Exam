const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const { shuffle, pickRandom } = require("../utils/random");

// Generatore deterministico (LCG) con valori in [0, 1)
const lcg = (seed = 42) => {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
};
const range = (n) => Array.from({ length: n }, (_, i) => i + 1);

describe("shuffle", () => {
  test("Fisher-Yates con rng costanti", () => {
    assert.deepEqual(shuffle([1, 2, 3, 4], () => 0), [2, 3, 4, 1]);
    assert.deepEqual(shuffle([1, 2, 3, 4], () => 0.999999), [1, 2, 3, 4]);
  });

  test("nessun elemento perso né duplicato, input non mutato", () => {
    const input = range(20);
    const copy = [...input];
    const out = shuffle(input, lcg());
    assert.equal(out.length, 20);
    assert.deepEqual([...out].sort((a, b) => a - b), copy);
    assert.deepEqual(input, copy);
  });

  test("casi limite e nuovo array", () => {
    assert.deepEqual(shuffle([]), []);
    assert.deepEqual(shuffle(["x"]), ["x"]);
    const input = [1, 2];
    assert.notEqual(shuffle(input), input);
  });
});

describe("pickRandom", () => {
  test("rng costante", () => {
    assert.deepEqual(pickRandom(range(5), 2, () => 0.999999), [1, 2]);
  });

  test("n elementi distinti presi dall'input, input non mutato", () => {
    const input = range(5);
    const out = pickRandom(input, 3, lcg());
    assert.equal(out.length, 3);
    assert.equal(new Set(out).size, 3);
    for (const x of out) assert.ok(input.includes(x));
    assert.deepEqual(input, range(5));
  });

  test("n maggiore della lunghezza: tutti", () => {
    const out = pickRandom([1, 2, 3], 10, lcg());
    assert.equal(out.length, 3);
    assert.deepEqual([...out].sort(), [1, 2, 3]);
  });

  test("n zero o negativo: nessuno", () => {
    assert.deepEqual(pickRandom(range(5), 0), []);
    assert.deepEqual(pickRandom(range(5), -1), []);
  });

  test("rng di default", () => {
    const out = pickRandom(range(10), 4);
    assert.equal(out.length, 4);
    assert.equal(new Set(out).size, 4);
  });
});
