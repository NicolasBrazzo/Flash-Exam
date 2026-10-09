// Configurazione, model e rotte POST /exams e GET /exams/:id con un client
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
const examConfig = require("../config/exam");
const { buildExamTimes } = require("../utils/examTime");
const { getRandomQuestions } = require("../models/question.model");
const {
  findExamSessionById,
  findInProgressExamSession,
  createExamSession,
  deleteExamSession,
} = require("../models/examSession.model");
const { getAttemptsBySession, createExamAttempts } = require("../models/attempt.model");
const examsRoutes = require("../controllers/exams.controller");

const SESSION_ID = "e0000000-0000-4000-8000-000000000001";
const TOPIC = { id: "6f1c2e2a-4b7d-4c1e-9a3b-2d5e8f0a1b2c", name: "Obbligazioni" };
const qid = (i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
const ids = (n) => Array.from({ length: n }, (_, i) => ({ id: qid(i + 1) }));

const sessionRow = (status = "IN_PROGRESS", expiresInMs = 30 * 60 * 1000) => {
  const expires = new Date(Date.now() + expiresInMs);
  return {
    id: SESSION_ID,
    status,
    started_at: new Date(expires.getTime() - 40 * 60 * 1000).toISOString(),
    expires_at: expires.toISOString(),
    submitted_at: status === "IN_PROGRESS" ? null : new Date().toISOString(),
    auto_submitted: false,
    grade: status === "GRADED" ? 27 : null,
    honors: false,
  };
};

const attemptRow = (position, status = "IN_PROGRESS") => ({
  id: `a0000000-0000-4000-8000-00000000000${position}`,
  position,
  answer: position === 2 ? "bozza salvata" : "",
  verdict: status === "GRADED" ? "partial" : null,
  grading_source: status === "GRADED" ? "AI" : null,
  grading:
    status === "GRADED"
      ? { concepts: [{ id: "c1", status: "partial" }], verdict: "partial", corrections: [], suggestion: "s", exampleAnswer: "e" }
      : null,
  points: status === "GRADED" ? 2.5 : null,
  score: status === "GRADED" ? 0.5 : null,
  question: {
    id: qid(position),
    prompt: `Domanda ${position}?`,
    answer: `Riferimento ${position}.`,
    rubric: [{ id: "c1", concept: "x", weight: 1 }],
    article_refs: ["1"],
    topic: TOPIC,
  },
});
const attemptRows = (status) => [1, 2, 3, 4, 5, 6].map((p) => attemptRow(p, status));

const callsOf = (query, method) => query.calls.filter(([name]) => name === method).map(([, args]) => args);
const allCalls = (method) => queries.flatMap((q) => callsOf(q, method).map((args) => ({ table: q.table, args })));

beforeEach(() => {
  queries.length = 0;
  results = [];
});

describe("configurazione e orari", () => {
  test("costanti della prova (D7)", () => {
    assert.equal(examConfig.EXAM_QUESTIONS, 6);
    assert.equal(examConfig.EXAM_DURATION_MINUTES, 40);
    assert.equal(examConfig.EXAM_GRACE_SECONDS, 15);
  });

  test("buildExamTimes: scadenza a 40 minuti", () => {
    assert.deepEqual(buildExamTimes(new Date("2026-10-01T10:00:00.000Z")), {
      started_at: "2026-10-01T10:00:00.000Z",
      expires_at: "2026-10-01T10:40:00.000Z",
    });
  });
});

describe("model", () => {
  test("getRandomQuestions: una query sugli id di tutte le domande (D4)", async () => {
    results = [{ data: ids(8) }];
    const rows = await getRandomQuestions(6, () => 0);
    assert.equal(queries.length, 1);
    assert.equal(queries[0].table, "FE_Questions");
    assert.deepEqual(callsOf(queries[0], "select"), [["id"]]);
    assert.deepEqual(callsOf(queries[0], "eq"), []);
    assert.deepEqual(callsOf(queries[0], "in"), []);
    assert.equal(rows.length, 6);
    assert.equal(new Set(rows.map((r) => r.id)).size, 6);
    for (const row of rows) assert.ok(ids(8).some((r) => r.id === row.id));
  });

  test("getRandomQuestions: meno domande disponibili, errore", async () => {
    results = [{ data: ids(3) }];
    assert.equal((await getRandomQuestions(6)).length, 3);
    results = [{ error: { code: "XX000" } }];
    await assert.rejects(getRandomQuestions(6), { message: "DATABASE_FIND_RANDOM_QUESTIONS_ERROR" });
  });

  test("findInProgressExamSession: la più recente in corso", async () => {
    results = [{ data: null }];
    assert.equal(await findInProgressExamSession(), null);
    const [q] = queries;
    assert.equal(q.table, "FE_ExamSessions");
    assert.deepEqual(callsOf(q, "eq"), [["status", "IN_PROGRESS"]]);
    assert.deepEqual(callsOf(q, "order"), [["started_at", { ascending: false }]]);
    assert.deepEqual(callsOf(q, "limit"), [[1]]);
    assert.equal(callsOf(q, "maybeSingle").length, 1);
    results = [{ error: { code: "XX000" } }];
    await assert.rejects(findInProgressExamSession(), /DATABASE_/);
  });

  test("findExamSessionById, createExamSession, deleteExamSession", async () => {
    results = [{ data: sessionRow() }];
    await findExamSessionById(SESSION_ID);
    assert.deepEqual(callsOf(queries[0], "eq"), [["id", SESSION_ID]]);
    assert.equal(callsOf(queries[0], "maybeSingle").length, 1);

    queries.length = 0;
    const times = { started_at: "a", expires_at: "b" };
    results = [{ data: sessionRow() }];
    await createExamSession(times);
    assert.deepEqual(callsOf(queries[0], "insert"), [[times]]);
    assert.equal(callsOf(queries[0], "single").length, 1);

    queries.length = 0;
    results = [{ data: null }];
    await deleteExamSession(SESSION_ID);
    assert.equal(queries[0].table, "FE_ExamSessions");
    assert.equal(callsOf(queries[0], "delete").length, 1);
    assert.deepEqual(callsOf(queries[0], "eq"), [["id", SESSION_ID]]);
    results = [{ error: { code: "XX000" } }];
    await assert.rejects(deleteExamSession(SESSION_ID), /DATABASE_/);
  });

  test("getAttemptsBySession e createExamAttempts", async () => {
    results = [{ data: attemptRows() }];
    await getAttemptsBySession(SESSION_ID);
    const [q] = queries;
    assert.equal(q.table, "FE_Attempts");
    assert.deepEqual(callsOf(q, "eq"), [["session_id", SESSION_ID]]);
    assert.deepEqual(callsOf(q, "order"), [["position", { ascending: true }]]);
    const columns = callsOf(q, "select")[0][0];
    assert.ok(columns.includes("question:FE_Questions("));
    assert.ok(columns.includes("topic:FE_Topics(id, name)"));

    queries.length = 0;
    const rows = [{ session_id: SESSION_ID, question_id: qid(1), mode: "EXAM", position: 1, answer: "" }];
    results = [{ data: attemptRows() }];
    await createExamAttempts(rows);
    assert.deepEqual(callsOf(queries[0], "insert"), [[rows]]);
    assert.equal(callsOf(queries[0], "select").length, 1);
    results = [{ error: { code: "XX000" } }];
    await assert.rejects(createExamAttempts(rows), /DATABASE_/);
  });
});

describe("POST /exams e GET /exams/:id", () => {
  let server;
  let baseUrl;
  const auth = { Authorization: `Bearer ${jwt.sign({ sub: "u" }, "test-secret")}` };
  const call = async (method, path, headers = auth) => {
    const res = await fetch(`${baseUrl}${path}`, { method, headers });
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
    assert.equal((await call("POST", "/", {})).status, 401);
    assert.equal((await call("GET", `/${SESSION_ID}`, {})).status, 401);
  });

  test("nessuna prova in corso: crea sessione e 6 tentativi", async () => {
    results = [{ data: null }, { data: ids(8) }, { data: sessionRow() }, { data: attemptRows() }];
    const before = Date.now();
    const { status, body } = await call("POST", "/");
    const afterTime = Date.now();
    assert.equal(status, 201);
    assert.equal(body.ok, true);
    assert.equal(body.resumed, false);
    assert.deepEqual(body.exam.questions.map((q) => q.position), [1, 2, 3, 4, 5, 6]);
    for (const q of body.exam.questions) assert.deepEqual(Object.keys(q).sort(), ["answer", "position", "prompt", "topic"]);

    const sessionInsert = allCalls("insert").find((c) => c.table === "FE_ExamSessions").args[0];
    const started = Date.parse(sessionInsert.started_at);
    assert.equal(Date.parse(sessionInsert.expires_at) - started, 40 * 60 * 1000);
    assert.ok(started >= before - 1000 && started <= afterTime + 1000);

    const attemptsInsert = allCalls("insert").find((c) => c.table === "FE_Attempts").args[0];
    assert.equal(attemptsInsert.length, 6);
    for (const row of attemptsInsert) {
      assert.deepEqual(Object.keys(row).sort(), ["answer", "mode", "position", "question_id", "session_id"]);
      assert.equal(row.mode, "EXAM");
      assert.equal(row.answer, "");
      assert.equal(row.session_id, SESSION_ID);
      assert.ok(ids(8).some((r) => r.id === row.question_id));
    }
    assert.deepEqual(attemptsInsert.map((r) => r.position), [1, 2, 3, 4, 5, 6]);
    assert.equal(new Set(attemptsInsert.map((r) => r.question_id)).size, 6);
    assert.deepEqual(allCalls("delete"), []);
  });

  test("prova in corso non scaduta: ripresa", async () => {
    results = [{ data: sessionRow() }, { data: attemptRows() }];
    const { status, body } = await call("POST", "/");
    assert.equal(status, 200);
    assert.equal(body.resumed, true);
    assert.equal(queries.length, 2);
    assert.deepEqual(allCalls("insert"), []);
  });

  test("prova scaduta da pochi secondi (entro la tolleranza): ripresa", async () => {
    results = [{ data: sessionRow("IN_PROGRESS", -5000) }, { data: attemptRows() }];
    const { status, body } = await call("POST", "/");
    assert.equal(status, 200);
    assert.equal(body.resumed, true);
  });

  test("prova scaduta: non ripresa, se ne crea una nuova", async () => {
    results = [
      { data: sessionRow("IN_PROGRESS", -60 * 60 * 1000) },
      { data: ids(8) },
      { data: sessionRow() },
      { data: attemptRows() },
    ];
    const { status, body } = await call("POST", "/");
    assert.equal(status, 201);
    assert.equal(body.resumed, false);
    assert.ok(allCalls("insert").some((c) => c.table === "FE_ExamSessions"));
    assert.deepEqual(allCalls("update"), []);
  });

  test("meno di 6 domande: 409", async () => {
    for (const n of [5, 0]) {
      queries.length = 0;
      results = [{ data: null }, { data: ids(n) }];
      const { status, body } = await call("POST", "/");
      assert.equal(status, 409);
      assert.equal(body.ok, false);
      assert.equal(typeof body.error, "string");
      assert.ok(body.error.includes("6"), body.error);
      assert.deepEqual(allCalls("insert"), []);
    }
  });

  test("errore sui tentativi: la sessione viene rimossa", async () => {
    results = [{ data: null }, { data: ids(8) }, { data: sessionRow() }, { error: { code: "23505" } }, { data: null }];
    const { status, body } = await call("POST", "/");
    assert.equal(status, 500);
    assert.deepEqual(body, { ok: false, error: "Errore interno del server" });
    const last = queries.at(-1);
    assert.equal(last.table, "FE_ExamSessions");
    assert.equal(callsOf(last, "delete").length, 1);
    assert.deepEqual(callsOf(last, "eq"), [["id", SESSION_ID]]);

    queries.length = 0;
    results = [{ data: null }, { data: ids(8) }, { data: sessionRow() }, { error: { code: "23505" } }, { error: { code: "XX000" } }];
    assert.equal((await call("POST", "/")).status, 500);
  });

  test("errore sulla sessione: nessun tentativo, nessuna rimozione", async () => {
    results = [{ data: null }, { data: ids(8) }, { error: { code: "XX000" } }];
    const { status } = await call("POST", "/");
    assert.equal(status, 500);
    assert.equal(allCalls("insert").some((c) => c.table === "FE_Attempts"), false);
    assert.deepEqual(allCalls("delete"), []);
  });

  test("GET con id non uuid o inesistente: 404", async () => {
    let res = await call("GET", "/abc");
    assert.equal(res.status, 404);
    assert.deepEqual(res.body, { ok: false, error: "Simulazione non trovata" });
    assert.equal(queries.length, 0);
    results = [{ data: null }];
    res = await call("GET", `/${SESSION_ID}`);
    assert.equal(res.status, 404);
    assert.equal(queries.some((q) => q.table === "FE_Attempts"), false);
  });

  test("GET di una prova in corso: bozze e scadenza dal database", async () => {
    const row = sessionRow();
    results = [{ data: row }, { data: attemptRows() }];
    const { status, body } = await call("GET", `/${SESSION_ID}`);
    assert.equal(status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.exam.expires_at, row.expires_at);
    assert.equal(body.exam.questions[1].answer, "bozza salvata");
    for (const q of body.exam.questions) assert.deepEqual(Object.keys(q).sort(), ["answer", "position", "prompt", "topic"]);
  });

  test("GET di una prova valutata: revisione senza punteggi", async () => {
    results = [{ data: sessionRow("GRADED") }, { data: attemptRows("GRADED") }];
    const { status, body } = await call("GET", `/${SESSION_ID}`);
    assert.equal(status, 200);
    assert.ok("reference_answer" in body.exam.questions[0]);
    assert.ok("feedback" in body.exam.questions[0]);
    const raw = JSON.stringify(body);
    for (const word of ["score", "points", "rubric", "concepts"]) assert.equal(raw.includes(word), false, word);
  });

  test("GET con errore DB: 500 generico", async () => {
    results = [{ error: { code: "XX000" } }];
    const { status, body } = await call("GET", `/${SESSION_ID}`);
    assert.equal(status, 500);
    assert.deepEqual(body, { ok: false, error: "Errore interno del server" });
  });
});
