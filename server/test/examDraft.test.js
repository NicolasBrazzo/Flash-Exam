// Schema, model e rotta PUT /exams/:id/answers/:position con un client
// Supabase finto: nessuna connessione reale. Il finto va registrato in
// require.cache PRIMA di caricare model e controller.
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
  for (const method of ["select", "in", "eq", "order", "range", "limit", "maybeSingle", "single", "insert", "update", "delete"]) {
    builder[method] = (...args) => {
      query.calls.push([method, args]);
      return builder;
    };
  }
  builder.then = (resolve, reject) => {
    const next = results.length > 0 ? results.shift() : { data: null, error: null };
    return Promise.resolve({ data: null, count: null, error: null, ...next }).then(resolve, reject);
  };
  return builder;
};

const fakeSupabase = { from: (table) => makeBuilder(table) };
const dbPath = require.resolve("../config/db_connection");
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: fakeSupabase };

const express = require("express");
const jwt = require("jsonwebtoken");
const { examDraftSchema } = require("../schemas/examDraft.schema");
const { findAttemptBySessionAndPosition, updateAttempt } = require("../models/attempt.model");
const examsRoutes = require("../controllers/exams.controller");

const SESSION_ID = "e0000000-0000-4000-8000-000000000001";
const ATTEMPT_ID = "a0000000-0000-4000-8000-000000000003";
const UPDATED_AT = "2026-10-01T10:20:00.000Z";

const sessionRow = (status = "IN_PROGRESS", expiresInMs = 30 * 60 * 1000) => ({
  id: SESSION_ID,
  status,
  started_at: new Date(Date.now() + expiresInMs - 40 * 60 * 1000).toISOString(),
  expires_at: new Date(Date.now() + expiresInMs).toISOString(),
  submitted_at: null,
  auto_submitted: false,
  grade: null,
  honors: false,
});
const attemptRow = () => ({ id: ATTEMPT_ID, position: 3, answer: "vecchia", updated_at: "2026-10-01T10:10:00.000Z" });

const callsOf = (query, method) => query.calls.filter(([name]) => name === method).map(([, args]) => args);
const allCalls = (method) => queries.flatMap((q) => callsOf(q, method));

beforeEach(() => {
  queries.length = 0;
  results = [];
});

describe("examDraftSchema", () => {
  test("validi, senza trim", () => {
    assert.equal(examDraftSchema.safeParse({ answer: "" }).success, true);
    const spaced = examDraftSchema.safeParse({ answer: "  bozza  " });
    assert.equal(spaced.success, true);
    assert.equal(spaced.data.answer, "  bozza  ");
    assert.equal(examDraftSchema.safeParse({ answer: "x".repeat(5000) }).success, true);
  });

  test("rifiutati", () => {
    for (const body of [{ answer: "x".repeat(5001) }, { answer: 123 }, {}, { answer: "x", extra: 1 }, undefined]) {
      assert.equal(examDraftSchema.safeParse(body).success, false, JSON.stringify(body));
    }
  });
});

describe("attempt.model", () => {
  test("findAttemptBySessionAndPosition", async () => {
    results = [{ data: null }];
    assert.equal(await findAttemptBySessionAndPosition(SESSION_ID, 3), null);
    const [q] = queries;
    assert.equal(q.table, "FE_Attempts");
    assert.deepEqual(callsOf(q, "eq"), [["session_id", SESSION_ID], ["position", 3]]);
    assert.equal(callsOf(q, "maybeSingle").length, 1);
    results = [{ error: { code: "XX000" } }];
    await assert.rejects(findAttemptBySessionAndPosition(SESSION_ID, 3), /DATABASE_/);
  });

  test("updateAttempt: valorizza updated_at", async () => {
    const row = { ...attemptRow(), answer: "x" };
    results = [{ data: row }];
    const before = Date.now();
    const res = await updateAttempt(ATTEMPT_ID, { answer: "x" });
    const afterTime = Date.now();
    assert.equal(res, row);
    const [[payload]] = allCalls("update");
    assert.deepEqual(Object.keys(payload).sort(), ["answer", "updated_at"]);
    const t = Date.parse(payload.updated_at);
    assert.ok(t >= before && t <= afterTime);
    assert.deepEqual(allCalls("eq"), [["id", ATTEMPT_ID]]);
    assert.equal(allCalls("select").length, 1);
    assert.equal(allCalls("maybeSingle").length, 1);
    results = [{ error: { code: "XX000" } }];
    await assert.rejects(updateAttempt(ATTEMPT_ID, { answer: "x" }), /DATABASE_/);
  });
});

describe("PUT /exams/:id/answers/:position", () => {
  let server;
  let baseUrl;
  const auth = { Authorization: `Bearer ${jwt.sign({ sub: "u" }, "test-secret")}` };
  const put = async (path, body, headers = auth) => {
    const res = await fetch(`${baseUrl}${path}`, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  };
  const path = (position = "3", id = SESSION_ID) => `/${id}/answers/${position}`;

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
    assert.equal((await put(path(), { answer: "x" }, {})).status, 401);
  });

  test("id non uuid: 404 senza query", async () => {
    const { status } = await put(path("3", "abc"), { answer: "x" });
    assert.equal(status, 404);
    assert.equal(queries.length, 0);
  });

  test("posizione non valida: 400 senza query", async () => {
    for (const position of ["0", "7", "1.5", "abc", "-1", "01"]) {
      queries.length = 0;
      const { status, body } = await put(path(position), { answer: "x" });
      assert.equal(status, 400, position);
      assert.equal(body.ok, false);
      assert.equal(queries.length, 0, position);
    }
  });

  test("body non valido: 400 con elenco errori, senza query", async () => {
    for (const body of [{}, { answer: 5 }, { answer: "x", extra: 1 }, { answer: "x".repeat(5001) }]) {
      queries.length = 0;
      const res = await put(path(), body);
      assert.equal(res.status, 400, JSON.stringify(body).slice(0, 40));
      assert.ok(Array.isArray(res.body.error));
      assert.equal(queries.length, 0);
    }
  });

  test("prova inesistente: 404", async () => {
    results = [{ data: null }];
    assert.equal((await put(path(), { answer: "x" })).status, 404);
  });

  test("prova già consegnata: 409 senza aggiornare", async () => {
    for (const status of ["GRADED", "GRADING", "SELF_GRADED"]) {
      queries.length = 0;
      results = [{ data: sessionRow(status) }];
      const res = await put(path(), { answer: "x" });
      assert.equal(res.status, 409, status);
      assert.equal(res.body.ok, false);
      assert.deepEqual(allCalls("update"), []);
    }
  });

  test("oltre la scadenza più la tolleranza: 409 senza aggiornare", async () => {
    results = [{ data: sessionRow("IN_PROGRESS", -20000) }];
    const res = await put(path(), { answer: "x" });
    assert.equal(res.status, 409);
    assert.deepEqual(allCalls("update"), []);
  });

  test("dentro la tolleranza: salvata", async () => {
    results = [{ data: sessionRow("IN_PROGRESS", -5000) }, { data: attemptRow() }, { data: { ...attemptRow(), updated_at: UPDATED_AT } }];
    assert.equal((await put(path(), { answer: "x" })).status, 200);
  });

  test("posizione senza tentativo: 404 senza aggiornare", async () => {
    results = [{ data: sessionRow() }, { data: null }];
    const res = await put(path(), { answer: "x" });
    assert.equal(res.status, 404);
    assert.deepEqual(allCalls("update"), []);
  });

  test("salvataggio (anche vuoto): solo answer e updated_at", async () => {
    results = [{ data: sessionRow() }, { data: attemptRow() }, { data: { ...attemptRow(), answer: "", updated_at: UPDATED_AT } }];
    const { status, body } = await put(path(), { answer: "" });
    assert.equal(status, 200);
    assert.deepEqual(body, { ok: true, updated_at: UPDATED_AT });
    const attemptQuery = queries.find((q) => q.table === "FE_Attempts" && callsOf(q, "update").length === 0);
    assert.deepEqual(callsOf(attemptQuery, "eq"), [["session_id", SESSION_ID], ["position", 3]]);
    const updateQuery = queries.find((q) => callsOf(q, "update").length > 0);
    const [[payload]] = callsOf(updateQuery, "update");
    assert.deepEqual(Object.keys(payload).sort(), ["answer", "updated_at"]);
    assert.equal(payload.answer, "");
    assert.deepEqual(callsOf(updateQuery, "eq"), [["id", ATTEMPT_ID]]);
  });

  test("5000 caratteri: salvata", async () => {
    results = [{ data: sessionRow() }, { data: attemptRow() }, { data: { ...attemptRow(), updated_at: UPDATED_AT } }];
    assert.equal((await put(path(), { answer: "x".repeat(5000) })).status, 200);
  });

  test("errore DB: 500", async () => {
    results = [{ data: sessionRow() }, { data: attemptRow() }, { error: { code: "XX000" } }];
    const res = await put(path(), { answer: "x" });
    assert.equal(res.status, 500);
    assert.equal(res.body.ok, false);
  });
});
