// Model e rotta POST /attempts/:id/self-grade con un client Supabase finto:
// nessuna connessione reale. Il finto va registrato in require.cache PRIMA di
// caricare model e controller.
process.env.JWT_SECRET = "test-secret";
process.env.SUPABASE_URL = "http://127.0.0.1:9";
process.env.SUPABASE_KEY = "test-key";

const { describe, test, before, after, beforeEach, afterEach } = require("node:test");
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
const { selfGradeScore, computePoints } = require("../utils/scoring");
const { gradeUngradedAttempt } = require("../models/attempt.model");
const attemptsRoutes = require("../controllers/attempts.controller");

const AID = "a0000000-0000-4000-8000-000000000001";
const SID = "e0000000-0000-4000-8000-000000000001";
const SECRET_ANSWER = "RISPOSTA-SEGRETA-456";

const questionRow = () => ({
  id: "0a9b8c7d-6e5f-4a3b-8c2d-1e0f9a8b7c6d",
  prompt: "Domanda?",
  answer: "rif",
  rubric: [{ id: "c1", concept: "x", weight: 1 }],
  article_refs: ["2043"],
  topic: { id: "t1", name: "T" },
});
const attemptRow = (extra = {}) => ({
  id: AID,
  session_id: null,
  mode: "FLASHCARD",
  position: null,
  answer: SECRET_ANSWER,
  verdict: null,
  grading: null,
  grading_source: null,
  points: null,
  score: null,
  graded_at: null,
  updated_at: "",
  question: questionRow(),
  ...extra,
});

const callsOf = (query, method) => query.calls.filter(([name]) => name === method).map(([, args]) => args);
const allCalls = (method) => queries.flatMap((q) => callsOf(q, method));

let logs;
let originalError;

beforeEach(() => {
  queries.length = 0;
  results = [];
  logs = [];
  originalError = console.error;
  console.error = (...args) => logs.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
});

afterEach(() => {
  console.error = originalError;
});

describe("attempt.model: gradeUngradedAttempt", () => {
  test("aggiornamento condizionato a tentativo non valutato", async () => {
    results = [{ data: attemptRow({ verdict: "correct" }) }];
    const fields = { verdict: "correct", grading_source: "SELF", score: 1, points: 5, graded_at: "x", grading: null };
    await gradeUngradedAttempt(AID, fields);
    const [q] = queries;
    assert.equal(q.table, "FE_Attempts");
    const [[payload]] = callsOf(q, "update");
    assert.deepEqual(Object.keys(payload).sort(), [...Object.keys(fields), "updated_at"].sort());
    assert.deepEqual(callsOf(q, "eq"), [["id", AID]]);
    assert.deepEqual(callsOf(q, "is"), [["verdict", null]]);
    assert.equal(callsOf(q, "maybeSingle").length, 1);
    assert.ok(callsOf(q, "select")[0][0].includes("question:FE_Questions"));
    results = [{ data: null }];
    assert.equal(await gradeUngradedAttempt(AID, fields), null);
    results = [{ error: { code: "XX000" } }];
    await assert.rejects(gradeUngradedAttempt(AID, fields), { message: "DATABASE_GRADE_ATTEMPT_ERROR" });
  });
});

describe("POST /attempts/:id/self-grade", () => {
  let server;
  let baseUrl;
  const auth = { Authorization: `Bearer ${jwt.sign({ sub: "u" }, "test-secret")}` };
  const post = async (id, body, headers = auth) => {
    const res = await fetch(`${baseUrl}/${id}/self-grade`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  };

  before(async () => {
    const app = express();
    app.use(express.json());
    app.use("/attempts", attemptsRoutes);
    await new Promise((resolve) => {
      server = app.listen(0, "127.0.0.1", resolve);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}/attempts`;
  });

  after(() => new Promise((resolve) => server.close(resolve)));

  test("senza token: 401", async () => {
    assert.equal((await post(AID, { verdict: "correct" }, {})).status, 401);
    assert.equal(queries.length, 0);
  });

  test("body non valido: 400 senza query", async () => {
    for (const body of [{}, { verdict: "CORRECT" }, { verdict: "maybe" }, { verdict: null }, { verdict: 1 }, { verdict: "correct", foo: 1 }]) {
      queries.length = 0;
      const res = await post(AID, body);
      assert.equal(res.status, 400, JSON.stringify(body));
      assert.equal(res.body.ok, false);
      assert.ok(Array.isArray(res.body.error));
      assert.equal(queries.length, 0);
    }
  });

  test("id non uuid: 404 senza query", async () => {
    const res = await post("abc", { verdict: "correct" });
    assert.equal(res.status, 404);
    assert.equal(typeof res.body.error, "string");
    assert.equal(queries.length, 0);
  });

  test("tentativo inesistente: 404", async () => {
    results = [{ data: null }];
    const res = await post(AID, { verdict: "correct" });
    assert.equal(res.status, 404);
    assert.deepEqual(res.body, { ok: false, error: "Tentativo non trovato" });
    assert.deepEqual(allCalls("update"), []);
  });

  test("tentativo di una simulazione: 409 con rimando", async () => {
    for (const row of [attemptRow({ session_id: SID, mode: "EXAM", position: 1 }), attemptRow({ mode: "EXAM" })]) {
      queries.length = 0;
      results = [{ data: row }];
      const res = await post(AID, { verdict: "correct" });
      assert.equal(res.status, 409);
      assert.ok(res.body.error.includes("/exams/:id/self-grade"), res.body.error);
      assert.deepEqual(allCalls("update"), []);
    }
  });

  test("tentativo già valutato: 409", async () => {
    for (const row of [
      attemptRow({ verdict: "wrong", grading_source: "SELF" }),
      attemptRow({ verdict: "partial", grading_source: "AI" }),
      attemptRow({ grading_source: "AI" }),
    ]) {
      queries.length = 0;
      results = [{ data: row }];
      const res = await post(AID, { verdict: "correct" });
      assert.equal(res.status, 409);
      assert.deepEqual(res.body, { ok: false, error: "Tentativo già valutato" });
      assert.deepEqual(allCalls("update"), []);
    }
  });

  test("autovalutazione dei tre verdetti", async () => {
    for (const [verdict, score, points] of [["correct", 1, 5], ["partial", 0.5, 2.5], ["wrong", 0, 0]]) {
      queries.length = 0;
      results = [{ data: attemptRow() }, { data: attemptRow({ verdict, grading_source: "SELF", score, points, graded_at: "x" }) }];
      const res = await post(AID, { verdict });
      assert.equal(res.status, 200, verdict);
      const [[fields]] = allCalls("update");
      assert.equal(fields.verdict, verdict);
      assert.equal(fields.grading_source, "SELF");
      assert.equal(fields.score, score);
      assert.equal(fields.score, selfGradeScore(verdict));
      assert.equal(fields.points, points);
      assert.equal(fields.points, computePoints(score));
      assert.equal(fields.grading, null);
      assert.equal(new Date(fields.graded_at).toISOString(), fields.graded_at);
      assert.deepEqual(allCalls("is"), [["verdict", null]]);
      assert.deepEqual(Object.keys(res.body.attempt).sort(), ["feedback", "grading_source", "id", "reference_answer", "references", "verdict"]);
      assert.equal(res.body.attempt.feedback, null);
      assert.equal(res.body.attempt.verdict, verdict);
      assert.equal(res.body.attempt.reference_answer, "rif");
      assert.deepEqual(res.body.attempt.references, ["2043"]);
      const raw = JSON.stringify(res.body);
      for (const key of ['"score"', '"points"', '"grading"', '"rubric"', '"concepts"']) assert.equal(raw.includes(key), false, key);
      assert.equal(raw.includes(SECRET_ANSWER), false);
    }
  });

  test("autovalutazione contemporanea già avvenuta: 409", async () => {
    results = [{ data: attemptRow() }, { data: null }];
    const res = await post(AID, { verdict: "correct" });
    assert.equal(res.status, 409);
    assert.deepEqual(res.body, { ok: false, error: "Tentativo già valutato" });
  });

  test("errori DB: 500 generico", async () => {
    results = [{ error: { code: "XX000" } }];
    let res = await post(AID, { verdict: "correct" });
    assert.equal(res.status, 500);
    assert.deepEqual(res.body, { ok: false, error: "Errore interno del server" });
    results = [{ data: attemptRow() }, { error: { code: "XX000" } }];
    res = await post(AID, { verdict: "correct" });
    assert.equal(res.status, 500);
    for (const line of logs) assert.equal(line.includes(SECRET_ANSWER), false);
  });
});
