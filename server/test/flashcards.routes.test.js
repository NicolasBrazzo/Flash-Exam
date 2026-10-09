// Model e rotta GET /flashcards con un client Supabase finto: nessuna
// connessione reale. Il finto va registrato in require.cache PRIMA di
// caricare model e controller.
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
  for (const method of ["select", "in", "eq", "order", "range", "maybeSingle", "single", "insert", "update", "delete"]) {
    builder[method] = (...args) => {
      query.calls.push([method, args]);
      return builder;
    };
  }
  builder.then = (resolve, reject) => {
    const next = results.length > 0 ? results.shift() : { data: [], error: null };
    return Promise.resolve({ data: null, count: null, error: null, ...next }).then(resolve, reject);
  };
  return builder;
};

const fakeSupabase = { from: (table) => makeBuilder(table) };
const dbPath = require.resolve("../config/db_connection");
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: fakeSupabase };

const express = require("express");
const jwt = require("jsonwebtoken");
const { getRandomQuestionsByTopics } = require("../models/question.model");
const { serializeFlashcard } = require("../utils/serializeQuestion");
const flashcardsRoutes = require("../controllers/flashcards.controller");

const T1 = "6f1c2e2a-4b7d-4c1e-9a3b-2d5e8f0a1b2c";
const T2 = "1b2c3d4e-5f60-4718-8293-a4b5c6d7e8f9";
const qid = (i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
const [A, B, C] = [qid(1), qid(2), qid(3)];

const fullRow = (id) => ({
  id,
  prompt: `Domanda ${id}?`,
  answer: "risposta segreta",
  rubric: [{ id: "c1", concept: "x", weight: 1 }],
  article_refs: ["1"],
  created_at: "2026-10-01T10:00:00Z",
  topic: { id: T1, name: "Obbligazioni", position: 1 },
});

const callsOf = (query, method) => query.calls.filter(([name]) => name === method).map(([, args]) => args);

beforeEach(() => {
  queries.length = 0;
  results = [];
});

describe("serializeFlashcard", () => {
  test("solo id, prompt e argomento", () => {
    const card = serializeFlashcard(fullRow(A));
    assert.deepEqual(Object.keys(card).sort(), ["id", "prompt", "topic"]);
    assert.deepEqual(card.topic, { id: T1, name: "Obbligazioni" });
    assert.equal(serializeFlashcard({ ...fullRow(A), topic: null }).topic, null);
  });
});

describe("question.model: getRandomQuestionsByTopics", () => {
  test("legge gli id, ne sceglie count a caso e carica solo quelli, nell'ordine scelto", async () => {
    results = [{ data: [{ id: A }, { id: B }, { id: C }] }, { data: [fullRow(C), fullRow(B)] }];
    const rows = await getRandomQuestionsByTopics([T1, T2], 2, () => 0);
    assert.equal(queries.length, 2);
    for (const q of queries) assert.equal(q.table, "FE_Questions");
    assert.deepEqual(callsOf(queries[0], "select"), [["id"]]);
    assert.deepEqual(callsOf(queries[0], "in"), [["topic_id", [T1, T2]]]);
    assert.deepEqual(callsOf(queries[1], "in"), [["id", [B, C]]]);
    const columns = callsOf(queries[1], "select")[0][0];
    assert.match(columns, /topic:FE_Topics\(id, name\)/);
    assert.doesNotMatch(columns, /answer|rubric|article_refs/);
    assert.deepEqual(rows.map((r) => r.id), [B, C]);
  });

  test("nessuna domanda: nessuna seconda query", async () => {
    results = [{ data: [] }];
    assert.deepEqual(await getRandomQuestionsByTopics([T1], 10), []);
    assert.equal(queries.length, 1);
  });

  test("count maggiore delle domande disponibili: tutte", async () => {
    results = [{ data: [{ id: A }, { id: B }] }, { data: [fullRow(A), fullRow(B)] }];
    await getRandomQuestionsByTopics([T1], 10);
    assert.deepEqual([...callsOf(queries[1], "in")[0][1]].sort(), [A, B]);
  });

  test("errori DB -> sentinel", async () => {
    results = [{ error: { code: "XX000" } }];
    await assert.rejects(getRandomQuestionsByTopics([T1], 2), { message: "DATABASE_FIND_RANDOM_QUESTIONS_ERROR" });
    results = [{ data: [{ id: A }] }, { error: { code: "XX000" } }];
    await assert.rejects(getRandomQuestionsByTopics([T1], 2), { message: "DATABASE_FIND_RANDOM_QUESTIONS_ERROR" });
  });
});

describe("GET /flashcards", () => {
  let server;
  let baseUrl;
  const auth = { Authorization: `Bearer ${jwt.sign({ sub: "u" }, "test-secret")}` };
  const get = async (path, headers = auth) => {
    const res = await fetch(`${baseUrl}${path}`, { headers });
    return { status: res.status, body: await res.json() };
  };

  before(async () => {
    const app = express();
    app.use("/flashcards", flashcardsRoutes);
    await new Promise((resolve) => {
      server = app.listen(0, "127.0.0.1", resolve);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}/flashcards`;
  });

  after(() => new Promise((resolve) => server.close(resolve)));

  test("senza token: 401", async () => {
    assert.equal((await get(`/?topics=${T1}`, {})).status, 401);
  });

  test("query non valida: 400 senza interrogare il DB", async () => {
    for (const qs of [
      "",
      "?topics=",
      "?topics=abc",
      `?topics=${T1},abc`,
      `?topics=${T1}&topics=${T2}`,
      `?topics=${T1}&count=0`,
      `?topics=${T1}&count=51`,
      `?topics=${T1}&count=1.5`,
      `?topics=${T1}&count=10abc`,
      `?topics=${T1}&count=5&count=6`,
    ]) {
      queries.length = 0;
      const { status, body } = await get(`/${qs}`);
      assert.equal(status, 400, qs);
      assert.equal(body.ok, false);
      assert.equal(typeof body.error, "string");
      assert.equal(queries.length, 0, qs);
    }
  });

  test("200 con 10 domande distinte, senza risposta, rubrica né riferimenti", async () => {
    const ids = Array.from({ length: 12 }, (_, i) => qid(i + 1));
    // la seconda query restituisce le righe di tutti i 12 id: il model deve
    // tenere solo quelli scelti, nell'ordine scelto
    results = [{ data: ids.map((id) => ({ id })) }, { data: ids.map(fullRow) }];
    const { status, body } = await get(`/?topics=${T1},${T2}`);
    assert.equal(status, 200);
    assert.equal(body.ok, true);
    const picked = callsOf(queries[1], "in")[0][1];
    assert.equal(picked.length, 10);
    assert.equal(new Set(picked).size, 10);
    for (const id of picked) assert.ok(ids.includes(id));
    assert.equal(body.questions.length, 10);
    for (const q of body.questions) assert.deepEqual(Object.keys(q).sort(), ["id", "prompt", "topic"]);
    const raw = JSON.stringify(body);
    for (const word of ["answer", "rubric", "references", "reference_answer", "article_refs"]) {
      assert.equal(raw.includes(word), false, word);
    }
  });

  test("meno domande di count: quelle che ci sono", async () => {
    results = [{ data: [{ id: A }, { id: B }] }, { data: [fullRow(A), fullRow(B)] }];
    const { status, body } = await get(`/?topics=${T1}&count=3`);
    assert.equal(status, 200);
    assert.equal(body.questions.length, 2);
  });

  test("argomento senza domande: elenco vuoto", async () => {
    results = [{ data: [] }];
    const { status, body } = await get(`/?topics=${T1}`);
    assert.equal(status, 200);
    assert.deepEqual(body, { ok: true, questions: [] });
  });

  test("errore DB: 500 generico", async () => {
    results = [{ error: { code: "XX000", message: "dettaglio segreto" } }];
    const { status, body } = await get(`/?topics=${T1}`);
    assert.equal(status, 500);
    assert.deepEqual(body, { ok: false, error: "Errore interno del server" });
  });
});
