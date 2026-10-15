// Model e rotta POST /flashcards/answer con Supabase e grader finti: nessuna
// connessione reale. I finti vanno registrati in require.cache PRIMA di
// caricare model e controller.
process.env.JWT_SECRET = "test-secret";
process.env.SUPABASE_URL = "http://127.0.0.1:9";
process.env.SUPABASE_KEY = "test-key";

const { describe, test, before, after, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");

const queries = [];
const events = [];
let results = [];

const makeBuilder = (table) => {
  const query = { table, calls: [] };
  queries.push(query);
  const builder = {};
  for (const method of ["select", "in", "eq", "order", "range", "limit", "maybeSingle", "single", "insert", "update", "delete"]) {
    builder[method] = (...args) => {
      query.calls.push([method, args]);
      if (method === "insert" || method === "update") events.push(`${method}:${table}`);
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

// Grader finto: il comportamento si sceglie per test
const graderCalls = [];
let graderImpl = async () => {
  throw new Error("grader non configurato");
};
const graderPath = require.resolve("../services/grader");
require.cache[graderPath] = {
  id: graderPath,
  filename: graderPath,
  loaded: true,
  exports: {
    gradeAnswer: (item) => {
      graderCalls.push(item);
      events.push("grader");
      return graderImpl(item);
    },
  },
};

const express = require("express");
const jwt = require("jsonwebtoken");
const { computeScore, computePoints } = require("../utils/scoring");
const { createFlashcardAttempt, findAttemptById } = require("../models/attempt.model");
const flashcardsRoutes = require("../controllers/flashcards.controller");

const QID = "0a9b8c7d-6e5f-4a3b-8c2d-1e0f9a8b7c6d";
const AID = "a0000000-0000-4000-8000-000000000001";
const SECRET_ANSWER = "RISPOSTA-SEGRETA-123";

const questionRow = () => ({
  id: QID,
  prompt: "Che cos'è il fatto illecito?",
  answer: "rif",
  rubric: [
    { id: "c1", concept: "danno ingiusto", weight: 2 },
    { id: "c2", concept: "dolo o colpa", weight: 1 },
  ],
  article_refs: ["2043"],
  topic: { id: "t1", name: "Fatti illeciti" },
  created_at: "",
  updated_at: "",
});
const attemptRow = (extra = {}) => ({
  id: AID,
  position: null,
  answer: "testo",
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
const graderOutput = () => ({
  concepts: [
    { id: "c1", status: "present" },
    { id: "c2", status: "absent" },
  ],
  verdict: "partial",
  corrections: [{ written: "colposo", suggested: "colpevole", reason: "termine tecnico" }],
  suggestion: "s",
  exampleAnswer: "e",
});

const callsOf = (query, method) => query.calls.filter(([name]) => name === method).map(([, args]) => args);
const allCalls = (method) => queries.flatMap((q) => callsOf(q, method).map((args) => ({ table: q.table, args })));

let logs;
let originalError;

beforeEach(() => {
  queries.length = 0;
  events.length = 0;
  graderCalls.length = 0;
  results = [];
  logs = [];
  originalError = console.error;
  console.error = (...args) => logs.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
});

afterEach(() => {
  console.error = originalError;
});

const assertCleanLogs = () => {
  for (const line of logs) {
    assert.equal(line.includes(SECRET_ANSWER), false, "risposta nei log");
    assert.equal(line.includes("GEMINI"), false);
  }
};

describe("attempt.model", () => {
  test("createFlashcardAttempt", async () => {
    results = [{ data: attemptRow() }];
    await createFlashcardAttempt({ question_id: QID, answer: "x" });
    const [q] = queries;
    assert.equal(q.table, "FE_Attempts");
    assert.deepEqual(callsOf(q, "insert"), [[{ question_id: QID, answer: "x", mode: "FLASHCARD" }]]);
    assert.ok(callsOf(q, "select")[0][0].includes("question:FE_Questions"));
    results = [{ error: { code: "XX000" } }];
    await assert.rejects(createFlashcardAttempt({ question_id: QID, answer: "x" }), { message: "DATABASE_CREATE_FLASHCARD_ATTEMPT_ERROR" });
  });

  test("findAttemptById", async () => {
    results = [{ data: attemptRow({ session_id: null, mode: "FLASHCARD" }) }];
    const row = await findAttemptById(AID);
    assert.equal(row.id, AID);
    const [q] = queries;
    assert.deepEqual(callsOf(q, "eq"), [["id", AID]]);
    assert.equal(callsOf(q, "maybeSingle").length, 1);
    assert.ok(callsOf(q, "select")[0][0].includes("session_id"));
    results = [{ data: null }];
    assert.equal(await findAttemptById(AID), null);
    results = [{ error: { code: "XX000" } }];
    await assert.rejects(findAttemptById(AID), { message: "DATABASE_FIND_ATTEMPT_BY_ID_ERROR" });
  });
});

describe("POST /flashcards/answer", () => {
  let server;
  let baseUrl;
  const auth = { Authorization: `Bearer ${jwt.sign({ sub: "u" }, "test-secret")}` };
  const post = async (body, headers = auth) => {
    const res = await fetch(`${baseUrl}/answer`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  };

  before(async () => {
    const app = express();
    app.use(express.json());
    app.use("/flashcards", flashcardsRoutes);
    await new Promise((resolve) => {
      server = app.listen(0, "127.0.0.1", resolve);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}/flashcards`;
  });

  after(() => new Promise((resolve) => server.close(resolve)));

  test("senza token: 401", async () => {
    assert.equal((await post({ question_id: QID, answer: "x" }, {})).status, 401);
    assert.equal(queries.length, 0);
  });

  test("body non valido: 400 senza query né grader", async () => {
    for (const body of [
      {},
      { answer: "x" },
      { question_id: "abc", answer: "x" },
      { question_id: QID },
      { question_id: QID, answer: 5 },
      { question_id: QID, answer: null },
      { question_id: QID, answer: "a".repeat(5001) },
      { question_id: QID, answer: "x", foo: 1 },
    ]) {
      queries.length = 0;
      const { status, body: res } = await post(body);
      assert.equal(status, 400, JSON.stringify(body).slice(0, 50));
      assert.equal(res.ok, false);
      assert.ok(Array.isArray(res.error));
      assert.equal(queries.length, 0);
      assert.equal(graderCalls.length, 0);
    }
  });

  test("5000 caratteri: accettata", async () => {
    graderImpl = async () => graderOutput();
    results = [{ data: questionRow() }, { data: attemptRow() }, { data: attemptRow({ verdict: "partial", grading_source: "AI", grading: graderOutput() }) }];
    assert.equal((await post({ question_id: QID, answer: "a".repeat(5000) })).status, 201);
  });

  test("domanda inesistente: 404 senza tentativo", async () => {
    results = [{ data: null }];
    const { status, body } = await post({ question_id: QID, answer: "x" });
    assert.equal(status, 404);
    assert.equal(body.ok, false);
    assert.equal(typeof body.error, "string");
    assert.equal(allCalls("insert").length, 0);
  });

  test("ordine: prima il tentativo, poi il grader, poi la valutazione", async () => {
    graderImpl = async () => graderOutput();
    results = [{ data: questionRow() }, { data: attemptRow() }, { data: attemptRow({ verdict: "partial", grading_source: "AI", grading: graderOutput() }) }];
    await post({ question_id: QID, answer: "testo" });
    assert.deepEqual(events, ["insert:FE_Attempts", "grader", "update:FE_Attempts"]);
    assert.deepEqual(graderCalls, [
      { prompt: questionRow().prompt, referenceAnswer: "rif", rubric: questionRow().rubric, references: ["2043"], answer: "testo" },
    ]);
  });

  test("risposta vuota o di soli spazi: niente AI, wrong d'ufficio (D6)", async () => {
    for (const answer of ["", "   \n\t"]) {
      queries.length = 0;
      events.length = 0;
      graderCalls.length = 0;
      results = [
        { data: questionRow() },
        { data: attemptRow({ answer }) },
        { data: attemptRow({ answer, verdict: "wrong", grading_source: "SELF", score: 0, points: 0 }) },
      ];
      const { status, body } = await post({ question_id: QID, answer });
      assert.equal(status, 201);
      assert.equal(graderCalls.length, 0);
      const [insert] = allCalls("insert");
      assert.equal(insert.args[0].answer, answer);
      const [update] = allCalls("update");
      const fields = update.args[0];
      assert.equal(fields.verdict, "wrong");
      assert.equal(fields.grading_source, "SELF");
      assert.equal(fields.score, 0);
      assert.equal(fields.points, 0);
      assert.equal(fields.grading, null);
      assert.equal(Number.isNaN(Date.parse(fields.graded_at)), false);
      assert.equal(body.attempt.verdict, "wrong");
      assert.equal(body.attempt.grading_source, "SELF");
      assert.equal(body.attempt.feedback, null);
      assert.equal(body.attempt.reference_answer, "rif");
    }
  });

  test("valutazione AI: salva tutto e risponde senza punteggi", async () => {
    graderImpl = async () => graderOutput();
    results = [
      { data: questionRow() },
      { data: attemptRow({ answer: SECRET_ANSWER }) },
      { data: attemptRow({ answer: SECRET_ANSWER, verdict: "partial", grading_source: "AI", grading: graderOutput(), score: 0.567, points: 2.84 }) },
    ];
    const { status, body } = await post({ question_id: QID, answer: SECRET_ANSWER });
    assert.equal(status, 201);
    const [update] = allCalls("update");
    const fields = update.args[0];
    const expectedScore = computeScore({ rubric: questionRow().rubric, concepts: graderOutput().concepts, corrections: graderOutput().corrections });
    assert.equal(fields.verdict, "partial");
    assert.equal(fields.grading_source, "AI");
    assert.deepEqual(fields.grading, graderOutput());
    assert.equal(fields.score, expectedScore);
    assert.equal(fields.score, 0.567);
    assert.equal(fields.points, computePoints(expectedScore));
    assert.equal(fields.points, 2.84);
    assert.equal(Number.isNaN(Date.parse(fields.graded_at)), false);
    assert.equal(body.ok, true);
    assert.deepEqual(Object.keys(body.attempt).sort(), ["feedback", "grading_source", "id", "reference_answer", "references", "verdict"]);
    assert.deepEqual(body.attempt.feedback, { corrections: graderOutput().corrections, suggestion: "s", exampleAnswer: "e" });
    const raw = JSON.stringify(body);
    for (const key of ['"score"', '"points"', '"concepts"', '"rubric"', '"grading"']) assert.equal(raw.includes(key), false, key);
    assertCleanLogs();
  });

  test("grader non disponibile o output non valido: tentativo non valutato, 201", async () => {
    for (const code of ["GRADER_UNAVAILABLE", "GRADER_INVALID_OUTPUT"]) {
      queries.length = 0;
      logs.length = 0;
      graderImpl = async () => {
        throw new Error(code);
      };
      results = [{ data: questionRow() }, { data: attemptRow({ answer: SECRET_ANSWER }) }];
      const { status, body } = await post({ question_id: QID, answer: SECRET_ANSWER });
      assert.equal(status, 201, code);
      assert.equal(allCalls("update").length, 0);
      assert.deepEqual(body.attempt, {
        id: AID,
        verdict: null,
        grading_source: null,
        feedback: null,
        reference_answer: "rif",
        references: ["2043"],
      });
      assert.ok(logs.some((l) => l.includes(code)), JSON.stringify(logs));
      assertCleanLogs();
    }
  });

  test("altri errori del grader: 500", async () => {
    graderImpl = async () => {
      throw new Error("boom");
    };
    results = [{ data: questionRow() }, { data: attemptRow() }];
    const { status, body } = await post({ question_id: QID, answer: "testo" });
    assert.equal(status, 500);
    assert.deepEqual(body, { ok: false, error: "Errore interno del server" });
  });

  test("errori DB: 500 senza dati sensibili nei log", async () => {
    graderImpl = async () => graderOutput();
    results = [{ data: questionRow() }, { error: { code: "XX000" } }];
    let res = await post({ question_id: QID, answer: SECRET_ANSWER });
    assert.equal(res.status, 500);
    assert.equal(graderCalls.length, 0);

    results = [{ data: questionRow() }, { data: attemptRow() }, { error: { code: "XX000" } }];
    res = await post({ question_id: QID, answer: SECRET_ANSWER });
    assert.equal(res.status, 500);

    results = [{ error: { code: "XX000" } }];
    res = await post({ question_id: QID, answer: SECRET_ANSWER });
    assert.equal(res.status, 500);
    assertCleanLogs();
  });
});
