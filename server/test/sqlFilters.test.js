const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const { escapeLike, isUuid } = require("../utils/sqlFilters");

const UUID = "6f1c2e2a-4b7d-4c1e-9a3b-2d5e8f0a1b2c";

describe("escapeLike", () => {
  test("rende letterali %, _ e backslash", () => {
    assert.equal(escapeLike("50%"), "50\\%");
    assert.equal(escapeLike("a_b"), "a\\_b");
    assert.equal(escapeLike("c:\\x"), "c:\\\\x");
    assert.equal(escapeLike("\\%"), "\\\\\\%");
  });

  test("lascia invariato il resto", () => {
    assert.equal(escapeLike("art. 1"), "art. 1");
    assert.equal(escapeLike(""), "");
  });
});

describe("isUuid", () => {
  test("accetta un uuid, anche maiuscolo", () => {
    assert.equal(isUuid(UUID), true);
    assert.equal(isUuid(UUID.toUpperCase()), true);
  });

  test("rifiuta tutto il resto", () => {
    for (const value of [
      "abc",
      "",
      undefined,
      123,
      [UUID],
      UUID.replace(/-/g, ""),
      `${UUID}a`,
      "' or 1=1",
    ]) {
      assert.equal(isUuid(value), false, JSON.stringify(value));
    }
  });
});
