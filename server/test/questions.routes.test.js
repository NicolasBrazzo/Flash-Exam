// Model e rotte GET /questions con un client Supabase finto: nessuna
// connessione reale, nessuna dipendenza. Il finto va registrato in
// require.cache PRIMA di caricare model e controller.
process.env.JWT_SECRET = "test-secret";
process.env.SUPABASE_URL = "http://127.0.0.1:9";
process.env.SUPABASE_KEY = "test-key";

const { describe, test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

// Ogni from() apre una query che registra le chiamate e si risolve con il
// prossimo risultato della coda
const queries = [];
let results = [];

const makeBuilder = (table) => {
  const query = { table, calls: [] };
  queries.push(query);
  const builder = {};
  for (const method of ["select", "eq", "ilike", "order", "range", "maybeSingle", "single"]) {
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

const fakeSupabase = { from: (table) => makeBuilder(table) };
const dbPath = require.resolve("../config/db_connection");
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: fakeSupabase };

const express = require("express");
const jwt = require("jsonwebtoken");
const { getQuestions, findQuestionById } = require("../models/question.model");
const questionsRoutes = require("../controllers/questions.controller");

const TOPIC_ID = "6f1c2e2a-4b7d-4c1e-9a3b-2d5e8f0a1b2c";
const QUESTION_ID = "0a9b8c7d-6e5f-4a3b-8c2d-1e0f9a8b7c6d";
const dbRow = () => ({
  id: QUESTION_ID,
  topic: { id: TOPIC_ID, name: "Obbligazioni" },
  prompt: "Che cos'è l'obbligazione?",
  answer: "Il vincolo giuridico tra debitore e creditore.",
  rubric: [
    { id: "c1", concept: "vincolo", weight: 1 },
    { id: "c2", concept: "parti", weight: 1 },
  ],
  article_refs: ["1173"],
  created_at: "2026-10-01T10:00:00Z",
  updated_at: "2026-10-01T10:00:00Z",
});

const callsOf = (query, method) => query.calls.filter(([name]) => name === method).map(([, args]) => args);
const allCalls = (method) => queries.flatMap((query) => callsOf(query, method));

beforeEach(() => {
  queries.length = 0;
  results = [];
});

describe("question.model", () => {
  test("getQuestions applica filtri, ordinamento e range", async () => {
    results = [{ data: [], count: 0 }];
    await getQuestions({ page: 2, limit: 10, sort: "prompt", order: "asc", q: "50%_x", topicId: TOPIC_ID });
    assert.equal(queries.length, 1);
    const [query] = queries;
    assert.equal(query.table, "FE_Questions");
    const [select] = callsOf(query, "select");
    assert.match(select[0], /topic:FE_Topics\(id, name\)/);
    assert.deepEqual(select[1], { count: "exact" });
    assert.deepEqual(callsOf(query, "eq"), [["topic_id", TOPIC_ID]]);
    assert.deepEqual(callsOf(query, "ilike"), [["prompt", "%50\\%\\_x%"]]);
    assert.deepEqual(callsOf(query, "order")[0], ["prompt", { ascending: true }]);
    assert.deepEqual(callsOf(query, "range"), [[10, 19]]);
  });

  test("getQuestions senza filtri: nessun eq/ilike, order sempre presente", async () => {
    results = [{ data: [], count: 0 }];
    await getQuestions({ page: 1, limit: 20, sort: "created_at", order: "desc" });
    assert.deepEqual(allCalls("eq"), []);
    assert.deepEqual(allCalls("ilike"), []);
    assert.deepEqual(allCalls("order")[0], ["created_at", { ascending: false }]);
  });

  test("getQuestions restituisce righe e totale", async () => {
    const r = dbRow();
    results = [{ data: [r], count: 1 }];
    const res = await getQuestions({ page: 1, limit: 20, sort: "created_at", order: "desc" });
    assert.deepEqual(res, { rows: [r], total: 1 });
  });

  test("pagina oltre l'ultima (PGRST103): righe vuote e totale dai filtri", async () => {
    results = [{ error: { code: "PGRST103", message: "Requested range not satisfiable" } }, { count: 42 }];
    const res = await getQuestions({ page: 99, limit: 20, sort: "created_at", order: "desc", q: "dolo", topicId: TOPIC_ID });
    assert.deepEqual(res, { rows: [], total: 42 });
    assert.equal(queries.length, 2);
    assert.deepEqual(callsOf(queries[1], "eq"), [["topic_id", TOPIC_ID]]);
    assert.deepEqual(callsOf(queries[1], "ilike"), [["prompt", "%dolo%"]]);
  });

  test("getQuestions: errore DB -> sentinel", async () => {
    results = [{ error: { code: "XX000", message: "boom" } }];
    await assert.rejects(
      getQuestions({ page: 1, limit: 20, sort: "created_at", order: "desc" }),
      { message: "DATABASE_FIND_QUESTIONS_ERROR" }
    );
  });

  test("findQuestionById: eq su id e maybeSingle, null se non esiste", async () => {
    results = [{ data: null }];
    assert.equal(await findQuestionById(QUESTION_ID), null);
    assert.deepEqual(allCalls("eq"), [["id", QUESTION_ID]]);
    assert.equal(allCalls("maybeSingle").length, 1);
  });
});

describe("GET /questions", () => {
  let server;
  let baseUrl;
  const auth = { Authorization: `Bearer ${jwt.sign({ sub: "u" }, "test-secret")}` };
  const get = async (path, headers = auth) => {
    const res = await fetch(`${baseUrl}${path}`, { headers });
    return { status: res.status, body: await res.json() };
  };

  before(async () => {
    const app = express();
    app.use("/questions", questionsRoutes);
    await new Promise((resolve) => {
      server = app.listen(0, "127.0.0.1", resolve);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}/questions`;
  });

  after(() => new Promise((resolve) => server.close(resolve)));

  test("senza token: 401", async () => {
    const { status } = await get("/", {});
    assert.equal(status, 401);
  });

  test("risposta con data e pagination", async () => {
    results = [{ data: [], count: 21 }];
    const { status, body } = await get("/?page=2&limit=20");
    assert.equal(status, 200);
    assert.deepEqual(body, {
      ok: true,
      data: [],
      pagination: { total: 21, page: 2, limit: 20, totalPages: 2 },
    });
  });

  test("gli elementi sono nella forma API", async () => {
    results = [{ data: [dbRow()], count: 1 }];
    const { body } = await get("/");
    const [question] = body.data;
    assert.equal(question.reference_answer, dbRow().answer);
    assert.deepEqual(question.references, ["1173"]);
    assert.equal("answer" in question, false);
    assert.equal("article_refs" in question, false);
  });

  test("topic_id non uuid: 200 vuoto senza interrogare il DB", async () => {
    const { status, body } = await get("/?topic_id=non-uuid");
    assert.equal(status, 200);
    assert.deepEqual(body.data, []);
    assert.equal(body.pagination.total, 0);
    assert.equal(queries.length, 0);
  });

  test("topic_id e q vuoti: nessun filtro", async () => {
    results = [{ data: [], count: 0 }];
    await get("/?topic_id=&q=");
    assert.deepEqual(allCalls("eq"), []);
    assert.deepEqual(allCalls("ilike"), []);
  });

  test("sort e order non validi: created_at desc", async () => {
    results = [{ data: [], count: 0 }];
    await get("/?sort=answer&order=x");
    assert.deepEqual(allCalls("order")[0], ["created_at", { ascending: false }]);
  });

  test("dettaglio con id non uuid: 404 senza interrogare il DB", async () => {
    const { status, body } = await get("/non-uuid");
    assert.equal(status, 404);
    assert.deepEqual(body, { ok: false, error: "Domanda non trovata" });
    assert.equal(queries.length, 0);
  });

  test("dettaglio inesistente: 404", async () => {
    results = [{ data: null }];
    const { status, body } = await get(`/${QUESTION_ID}`);
    assert.equal(status, 404);
    assert.deepEqual(body, { ok: false, error: "Domanda non trovata" });
  });

  test("dettaglio esistente: { ok, question } nella forma API", async () => {
    results = [{ data: dbRow() }];
    const { status, body } = await get(`/${QUESTION_ID}`);
    assert.equal(status, 200);
    assert.deepEqual(body, {
      ok: true,
      question: {
        id: QUESTION_ID,
        topic: { id: TOPIC_ID, name: "Obbligazioni" },
        prompt: dbRow().prompt,
        reference_answer: dbRow().answer,
        rubric: dbRow().rubric,
        references: ["1173"],
        created_at: dbRow().created_at,
        updated_at: dbRow().updated_at,
      },
    });
  });

  test("errore DB: 500 generico senza dettagli interni", async () => {
    for (const path of ["/", `/${QUESTION_ID}`]) {
      results = [{ error: { code: "XX000", message: "dettaglio segreto" } }];
      const { status, body } = await get(path);
      assert.equal(status, 500, path);
      assert.deepEqual(body, { ok: false, error: "Errore interno del server" });
      const raw = JSON.stringify(body);
      assert.equal(raw.includes("DATABASE_"), false);
      assert.equal(raw.includes("dettaglio segreto"), false);
    }
  });
});
