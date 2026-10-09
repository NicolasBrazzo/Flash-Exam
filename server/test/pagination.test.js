const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const { parsePagination, getRange, buildPagination } = require("../utils/pagination");

const SORTABLE = { sortable: ["created_at", "prompt"] };

describe("parsePagination", () => {
  test("default senza parametri", () => {
    assert.deepEqual(parsePagination({}), {
      page: 1,
      limit: 20,
      sort: "created_at",
      order: "desc",
      from: 0,
      to: 19,
    });
  });

  test("calcola from/to per .range()", () => {
    const { from, to } = parsePagination({ page: "3", limit: "20" });
    assert.equal(from, 40);
    assert.equal(to, 59);
  });

  test("page non numerico, negativo o zero -> 1", () => {
    for (const page of ["abc", "-2", "0"]) {
      assert.equal(parsePagination({ page }).page, 1, `page=${page}`);
    }
  });

  test("limit non numerico, negativo o zero -> 20; oltre 100 -> 100", () => {
    for (const limit of ["abc", "-5", "0"]) {
      assert.equal(parsePagination({ limit }).limit, 20, `limit=${limit}`);
    }
    assert.equal(parsePagination({ limit: "500" }).limit, 100);
    assert.equal(parsePagination({ limit: "100" }).limit, 100);
    assert.equal(parsePagination({ limit: "7" }).limit, 7);
  });

  test("sort fuori whitelist -> created_at", () => {
    assert.equal(parsePagination({ sort: "prompt" }, SORTABLE).sort, "prompt");
    assert.equal(parsePagination({ sort: "answer" }, SORTABLE).sort, "created_at");
    assert.equal(parsePagination({ sort: "id; drop" }, SORTABLE).sort, "created_at");
  });

  test("order diverso da asc -> desc", () => {
    assert.equal(parsePagination({ order: "asc" }).order, "asc");
    for (const order of ["ASC", "desc", "x", undefined]) {
      assert.equal(parsePagination({ order }).order, "desc", `order=${order}`);
    }
  });
});

describe("getRange", () => {
  test("estremi inclusi", () => {
    assert.deepEqual(getRange(1, 20), { from: 0, to: 19 });
    assert.deepEqual(getRange(2, 5), { from: 5, to: 9 });
  });
});

describe("buildPagination", () => {
  test("totalPages con Math.ceil", () => {
    assert.equal(buildPagination(41, 1, 20).totalPages, 3);
    assert.equal(buildPagination(40, 1, 20).totalPages, 2);
  });

  test("nessun risultato", () => {
    assert.deepEqual(buildPagination(0, 1, 20), { total: 0, page: 1, limit: 20, totalPages: 0 });
    assert.equal(buildPagination(null, 1, 20).total, 0);
  });
});
