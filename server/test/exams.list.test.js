// Storico delle simulazioni (PROVA-5): model getExamSessions, rotta GET /exams,
// serializeExamSummary e defaultSort di parsePagination. Client Supabase finto
// in require.cache PRIMA di caricare model e controller.
process.env.JWT_SECRET = "test-secret";
process.env.SUPABASE_URL = "http://127.0.0.1:9";
process.env.SUPABASE_KEY = "test-key";

const { describe, test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const queries = [];
let results = [];

const makeBuilder = (table) => {
  const query = { table, calls: [] };
  queries.push(query);
  const builder = {};
  for (const method of ["select", "in", "eq", "is", "order", "range", "limit", "maybeSingle", "single", "insert", "update", "delete"]) {
    builder[method] = (...args) => {
      query.calls.push([method, args]);
      return builder;
    };
  }
  builder.then = (resolve, reject) => {
    const next = results.length > 0 ? results.shift() : { data: [], count: 0, error: null };
    return Promise.resolve({ data: null, count: null, error: null, ...next }).then(resolve, reject);
  };
  return builder;
};
const dbPath = require.resolve("../config/db_connection");
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { from: (table) => makeBuilder(table) } };

const express = require("express");
const jwt = require("jsonwebtoken");
const { getExamSessions } = require("../models/examSession.model");
const { serializeExam, serializeExamSummary } = require("../utils/serializeExam");
const { parsePagination } = require("../utils/pagination");
const examsRoutes = require("../controllers/exams.controller");

const SUMMARY_KEYS = ["auto_submitted", "expires_at", "grade", "honors", "id", "started_at", "status", "submitted_at"];
const row = (extra = {}) => ({
  id: "e0000000-0000-4000-8000-000000000001",
  status: "GRADED",
  started_at: "2026-05-01T10:00:00.000Z",
  expires_at: "2026-05-01T10:40:00.000Z",
  submitted_at: "2026-05-01T10:35:00.000Z",
  auto_submitted: false,
  grade: 27,
  honors: false,
  ...extra,
});

const callsOf = (query, method) => query.calls.filter(([name]) => name === method).map(([, args]) => args);
const allCalls = (method) => queries.flatMap((q) => callsOf(q, method));

beforeEach(() => {
  queries.length = 0;
  results = [];
});

describe("examSession.model: getExamSessions", () => {
  test("filtro, ordinamento con i null in fondo, spareggio e range", async () => {
    await getExamSessions({ status: "GRADED", page: 2, limit: 10, sort: "grade", order: "asc" });
    assert.equal(queries.length, 1);
    const [q] = queries;
    assert.equal(q.table, "FE_ExamSessions");
    const [[columns, options]] = callsOf(q, "select");
    assert.deepEqual(options, { count: "exact" });
    for (const forbidden of ["FE_Attempts", "score", "points"]) assert.equal(columns.includes(forbidden), false, forbidden);
    assert.deepEqual(callsOf(q, "eq"), [["status", "GRADED"]]);
    const orders = callsOf(q, "order");
    assert.deepEqual(orders[0], ["grade", { ascending: true, nullsFirst: false }]);
    assert.ok(orders.some(([field]) => field === "id"));
    assert.deepEqual(callsOf(q, "range"), [[10, 19]]);
  });

  test("senza status nessun filtro; default started_at desc", async () => {
    await getExamSessions({ page: 1, limit: 20, sort: "started_at", order: "desc" });
    const [q] = queries;
    assert.deepEqual(callsOf(q, "eq"), []);
    assert.deepEqual(callsOf(q, "order")[0], ["started_at", { ascending: false, nullsFirst: false }]);
  });

  test("righe e totale", async () => {
    const r = row();
    results = [{ data: [r], count: 1 }];
    assert.deepEqual(await getExamSessions({ page: 1, limit: 20, sort: "started_at", order: "desc" }), { rows: [r], total: 1 });
  });

  test("PGRST103: pagina vuota con il totale da una seconda query filtrata", async () => {
    results = [{ error: { code: "PGRST103" } }, { count: 42 }];
    const res = await getExamSessions({ status: "GRADED", page: 9, limit: 20, sort: "started_at", order: "desc" });
    assert.deepEqual(res, { rows: [], total: 42 });
    assert.equal(queries.length, 2);
    assert.deepEqual(callsOf(queries[1], "eq"), [["status", "GRADED"]]);
  });

  test("errore DB: sentinella", async () => {
    results = [{ error: { code: "XX000" } }];
    await assert.rejects(getExamSessions({ page: 1, limit: 20, sort: "started_at", order: "desc" }), {
      message: "DATABASE_FIND_EXAM_SESSIONS_ERROR",
    });
  });
});

describe("serializeExamSummary e parsePagination", () => {
  test("summary con le sole 8 chiavi; serializeExam la estende con questions", () => {
    const summary = serializeExamSummary({ ...row(), created_at: "x", extra: 1 });
    assert.deepEqual(Object.keys(summary).sort(), SUMMARY_KEYS);
    const full = serializeExam(row(), []);
    for (const key of SUMMARY_KEYS) assert.deepEqual(full[key], summary[key], key);
    assert.deepEqual(full.questions, []);
    const nulls = serializeExamSummary(row({ auto_submitted: null, honors: null, grade: undefined, submitted_at: undefined }));
    assert.equal(nulls.auto_submitted, false);
    assert.equal(nulls.honors, false);
    assert.equal(nulls.grade, null);
    assert.equal(nulls.submitted_at, null);
  });

  test("defaultSort per i sort fuori whitelist", () => {
    assert.equal(parsePagination({ sort: "x" }, { sortable: ["started_at", "grade"], defaultSort: "started_at" }).sort, "started_at");
    assert.equal(parsePagination({ sort: "x" }, { sortable: ["prompt"] }).sort, "created_at");
  });
});

describe("GET /exams", () => {
  let server;
  let baseUrl;
  const auth = { Authorization: `Bearer ${jwt.sign({ sub: "u" }, "test-secret")}` };
  const get = async (qs = "", headers = auth) => {
    const res = await fetch(`${baseUrl}${qs}`, { headers });
    return { status: res.status, body: await res.json() };
  };

  before(async () => {
    const app = express();
    app.use(express.json());
    app.use("/exams", examsRoutes);
    await new Promise((resolve) => {
      server = app.listen(0, "127.0.0.1", resolve);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}/exams`;
  });

  after(() => new Promise((resolve) => server.close(resolve)));

  test("senza token: 401", async () => {
    assert.equal((await get("", {})).status, 401);
    assert.equal(queries.length, 0);
  });

  test("default: prima pagina, started_at desc, nessun filtro", async () => {
    results = [{ data: [row()], count: 21 }];
    const res = await get();
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.deepEqual(res.body.pagination, { total: 21, page: 1, limit: 20, totalPages: 2 });
    assert.deepEqual(allCalls("range"), [[0, 19]]);
    assert.deepEqual(allCalls("eq"), []);
    assert.deepEqual(allCalls("order")[0], ["started_at", { ascending: false, nullsFirst: false }]);
  });

  test("elementi senza questions né campi interni", async () => {
    results = [{ data: [row({ auto_submitted: null, honors: null, grade: null, score: 1, points: 5, created_at: "x" })], count: 1 }];
    const { body } = await get();
    const [item] = body.data;
    assert.deepEqual(Object.keys(item).sort(), SUMMARY_KEYS);
    assert.equal(item.auto_submitted, false);
    assert.equal(item.honors, false);
    assert.equal(item.grade, null);
  });

  test("filtro, ordinamento e pagina", async () => {
    results = [{ data: [], count: 7 }];
    const res = await get("?status=GRADED&sort=grade&order=asc&page=2&limit=5");
    assert.equal(res.status, 200);
    assert.deepEqual(allCalls("eq"), [["status", "GRADED"]]);
    assert.deepEqual(allCalls("order")[0], ["grade", { ascending: true, nullsFirst: false }]);
    assert.deepEqual(allCalls("range"), [[5, 9]]);
    assert.deepEqual(res.body.pagination, { total: 7, page: 2, limit: 5, totalPages: 2 });
  });

  test("tutti e quattro gli stati sono accettati", async () => {
    for (const status of ["IN_PROGRESS", "GRADING", "GRADED", "SELF_GRADED"]) {
      queries.length = 0;
      await get(`?status=${status}`);
      assert.deepEqual(allCalls("eq"), [["status", status]], status);
    }
  });

  test("status fuori whitelist: 200 con data vuoto, nessuna query", async () => {
    for (const qs of ["?status=graded", "?status=FOO", "?status=GRADED&status=GRADED"]) {
      queries.length = 0;
      const res = await get(qs);
      assert.equal(res.status, 200, qs);
      assert.deepEqual(res.body, { ok: true, data: [], pagination: { total: 0, page: 1, limit: 20, totalPages: 0 } });
      assert.equal(queries.length, 0);
    }
  });

  test("status vuoto: nessun filtro", async () => {
    await get("?status=");
    assert.deepEqual(allCalls("eq"), []);
  });

  test("sort, order, limit e page non validi: default", async () => {
    for (const sort of ["created_at", "prompt", "foo"]) {
      queries.length = 0;
      await get(`?sort=${sort}`);
      assert.equal(allCalls("order")[0][0], "started_at", sort);
    }
    for (const order of ["ASC", "foo"]) {
      queries.length = 0;
      await get(`?order=${order}`);
      assert.equal(allCalls("order")[0][1].ascending, false, order);
    }
    queries.length = 0;
    results = [{ data: [], count: 0 }];
    const big = await get("?limit=1000");
    assert.equal(big.body.pagination.limit, 100);
    for (const page of ["0", "abc"]) {
      queries.length = 0;
      results = [{ data: [], count: 0 }];
      const res = await get(`?page=${page}`);
      assert.equal(res.body.pagination.page, 1, page);
    }
  });

  test("prova IN_PROGRESS scaduta: nessuna consegna automatica dall'elenco", async () => {
    results = [{ data: [row({ status: "IN_PROGRESS", expires_at: "2020-01-01T00:00:00.000Z", submitted_at: null, grade: null })], count: 1 }];
    const res = await get();
    assert.equal(res.body.data[0].status, "IN_PROGRESS");
    assert.equal(queries.length, 1);
    assert.deepEqual(allCalls("update"), []);
    assert.equal(queries.some((q) => q.table === "FE_Attempts"), false);
  });

  test("errore DB: 500 generico", async () => {
    results = [{ error: { code: "XX000" } }];
    const res = await get();
    assert.equal(res.status, 500);
    assert.deepEqual(res.body, { ok: false, error: "Errore interno del server" });
  });

  test("pagina oltre l'ultima: data vuoto con il totale", async () => {
    results = [{ error: { code: "PGRST103" } }, { count: 3 }];
    const res = await get("?page=5");
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data, []);
    assert.equal(res.body.pagination.total, 3);
  });
});
