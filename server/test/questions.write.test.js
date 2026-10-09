// Model e rotte PATCH/DELETE /questions con un client Supabase finto: nessuna
// connessione reale. Il finto va registrato in require.cache PRIMA di
// caricare model e controller.
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
  for (const method of ["select", "eq", "update", "delete", "maybeSingle", "single", "order", "range", "ilike"]) {
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
const { updateQuestion, deleteQuestion } = require("../models/question.model");
const { hasAttemptsForQuestion } = require("../models/attempt.model");
const { serializeQuestion } = require("../utils/serializeQuestion");
const questionsRoutes = require("../controllers/questions.controller");

const TOPIC_ID = "6f1c2e2a-4b7d-4c1e-9a3b-2d5e8f0a1b2c";
const QUESTION_ID = "0a9b8c7d-6e5f-4a3b-8c2d-1e0f9a8b7c6d";
const HAS_ATTEMPTS_MESSAGE =
  "La domanda è già stata usata in una prova o in una flashcard: puoi correggerla ma non cancellarla";
const DUPLICATE_MESSAGE = "Nell'argomento esiste già una domanda con lo stesso testo";

const dbRow = () => ({
  id: QUESTION_ID,
  topic: { id: TOPIC_ID, name: "Obbligazioni" },
  prompt: "Che cos'è l'obbligazione?",
  answer: "Nuova",
  rubric: [
    { id: "c1", concept: "vincolo", weight: 1 },
    { id: "c2", concept: "parti", weight: 1 },
  ],
  article_refs: ["2"],
  created_at: "2026-10-01T10:00:00Z",
  updated_at: "2026-10-02T10:00:00Z",
});

const callsOf = (query, method) => query.calls.filter(([name]) => name === method).map(([, args]) => args);
const allCalls = (method) => queries.flatMap((query) => callsOf(query, method));

beforeEach(() => {
  queries.length = 0;
  results = [];
});

describe("question.model: updateQuestion", () => {
  test("aggiorna per id, valorizza updated_at e rilegge con l'argomento", async () => {
    const row = dbRow();
    results = [{ data: row }];
    const res = await updateQuestion(QUESTION_ID, { answer: "n" });
    assert.equal(res, row);
    assert.equal(queries.length, 1);
    assert.equal(queries[0].table, "FE_Questions");
    const updates = allCalls("update");
    assert.equal(updates.length, 1);
    assert.equal(updates[0][0].answer, "n");
    assert.equal(typeof updates[0][0].updated_at, "string");
    assert.equal(Number.isNaN(Date.parse(updates[0][0].updated_at)), false);
    assert.deepEqual(allCalls("eq"), [["id", QUESTION_ID]]);
    assert.match(allCalls("select")[0][0], /topic:FE_Topics\(id, name\)/);
    assert.equal(allCalls("maybeSingle").length, 1);
  });

  test("domanda inesistente -> null", async () => {
    results = [{ data: null }];
    assert.equal(await updateQuestion(QUESTION_ID, { answer: "n" }), null);
  });

  test("errori DB -> sentinel", async () => {
    results = [{ error: { code: "23505" } }];
    await assert.rejects(updateQuestion(QUESTION_ID, { prompt: "p" }), {
      message: "DATABASE_DUPLICATE_QUESTION_ERROR",
    });
    results = [{ error: { code: "XX000" } }];
    await assert.rejects(updateQuestion(QUESTION_ID, { prompt: "p" }), {
      message: "DATABASE_UPDATE_QUESTION_ERROR",
    });
  });
});

describe("question.model: deleteQuestion", () => {
  test("cancella per id", async () => {
    results = [{ data: { id: QUESTION_ID } }];
    assert.deepEqual(await deleteQuestion(QUESTION_ID), { id: QUESTION_ID });
    assert.equal(queries[0].table, "FE_Questions");
    assert.equal(allCalls("delete").length, 1);
    assert.deepEqual(allCalls("eq"), [["id", QUESTION_ID]]);
  });

  test("domanda inesistente -> null", async () => {
    results = [{ data: null }];
    assert.equal(await deleteQuestion(QUESTION_ID), null);
  });

  test("errori DB -> sentinel", async () => {
    results = [{ error: { code: "23503" } }];
    await assert.rejects(deleteQuestion(QUESTION_ID), { message: "DATABASE_QUESTION_HAS_ATTEMPTS_ERROR" });
    results = [{ error: { code: "XX000" } }];
    await assert.rejects(deleteQuestion(QUESTION_ID), { message: "DATABASE_DELETE_QUESTION_ERROR" });
  });
});

describe("attempt.model: hasAttemptsForQuestion", () => {
  test("conta i tentativi della domanda", async () => {
    results = [{ count: 2 }];
    assert.equal(await hasAttemptsForQuestion(QUESTION_ID), true);
    assert.equal(queries[0].table, "FE_Attempts");
    assert.deepEqual(allCalls("eq"), [["question_id", QUESTION_ID]]);
    assert.deepEqual(allCalls("select")[0][1], { count: "exact", head: true });
  });

  test("nessun tentativo -> false", async () => {
    results = [{ count: 0 }];
    assert.equal(await hasAttemptsForQuestion(QUESTION_ID), false);
    results = [{ count: null }];
    assert.equal(await hasAttemptsForQuestion(QUESTION_ID), false);
  });

  test("errore DB -> sentinel", async () => {
    results = [{ error: { code: "XX000" } }];
    await assert.rejects(hasAttemptsForQuestion(QUESTION_ID), {
      message: "DATABASE_FIND_ATTEMPTS_BY_QUESTION_ERROR",
    });
  });
});

describe("PATCH e DELETE /questions/:id", () => {
  let server;
  let baseUrl;
  const auth = { Authorization: `Bearer ${jwt.sign({ sub: "u" }, "test-secret")}` };
  const send = async (method, path, body, headers = auth) => {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { ...headers, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  };

  before(async () => {
    const app = express();
    app.use(express.json());
    app.use("/questions", questionsRoutes);
    await new Promise((resolve) => {
      server = app.listen(0, "127.0.0.1", resolve);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}/questions`;
  });

  after(() => new Promise((resolve) => server.close(resolve)));

  test("PATCH senza token: 401", async () => {
    const { status } = await send("PATCH", `/${QUESTION_ID}`, { prompt: "x" }, {});
    assert.equal(status, 401);
  });

  test("PATCH id non uuid: 404 senza query", async () => {
    const { status, body } = await send("PATCH", "/non-uuid", { prompt: "x" });
    assert.equal(status, 404);
    assert.deepEqual(body, { ok: false, error: "Domanda non trovata" });
    assert.equal(queries.length, 0);
  });

  test("PATCH body vuoto: 400 senza query", async () => {
    const { status, body } = await send("PATCH", `/${QUESTION_ID}`, {});
    assert.equal(status, 400);
    assert.equal(body.ok, false);
    assert.ok(Array.isArray(body.error));
    assert.ok(body.error.some((e) => e.startsWith("corpo della richiesta:")), JSON.stringify(body.error));
    assert.equal(queries.length, 0);
  });

  test("PATCH campo sconosciuto: 400 senza query", async () => {
    const { status } = await send("PATCH", `/${QUESTION_ID}`, { answer: "x" });
    assert.equal(status, 400);
    assert.equal(queries.length, 0);
  });

  test("PATCH rubrica invalida: 400", async () => {
    const { status, body } = await send("PATCH", `/${QUESTION_ID}`, {
      rubric: [{ id: "c1", concept: "a", weight: 1 }],
    });
    assert.equal(status, 400);
    assert.ok(body.error.some((e) => e.startsWith("rubric:")), JSON.stringify(body.error));
  });

  test("PATCH topic_id inesistente: 404 senza update", async () => {
    results = [{ data: null }];
    const { status, body } = await send("PATCH", `/${QUESTION_ID}`, { topic_id: TOPIC_ID });
    assert.equal(status, 404);
    assert.deepEqual(body, { ok: false, error: "Argomento non trovato" });
    assert.equal(queries.length, 1);
    assert.equal(queries[0].table, "FE_Topics");
    assert.deepEqual(allCalls("update"), []);
  });

  test("PATCH domanda inesistente: 404", async () => {
    results = [{ data: null }];
    const { status, body } = await send("PATCH", `/${QUESTION_ID}`, { prompt: "x" });
    assert.equal(status, 404);
    assert.deepEqual(body, { ok: false, error: "Domanda non trovata" });
  });

  test("PATCH prompt duplicato nell'argomento: 409", async () => {
    results = [{ error: { code: "23505" } }];
    const { status, body } = await send("PATCH", `/${QUESTION_ID}`, { prompt: "x" });
    assert.equal(status, 409);
    assert.deepEqual(body, { ok: false, error: DUPLICATE_MESSAGE });
  });

  test("PATCH riuscito: mappa i campi e risponde nella forma API", async () => {
    results = [{ data: dbRow() }];
    const { status, body } = await send("PATCH", `/${QUESTION_ID}`, {
      reference_answer: "Nuova",
      references: ["2"],
    });
    assert.equal(status, 200);
    assert.deepEqual(body, { ok: true, question: serializeQuestion(dbRow()) });
    const [[fields]] = allCalls("update");
    assert.equal(fields.answer, "Nuova");
    assert.deepEqual(fields.article_refs, ["2"]);
    assert.equal(typeof fields.updated_at, "string");
    for (const key of ["reference_answer", "references", "topic_id"]) {
      assert.equal(key in fields, false, key);
    }
  });

  test("PATCH con topic_id esistente: lo aggiorna", async () => {
    results = [{ data: { id: TOPIC_ID, name: "x" } }, { data: dbRow() }];
    const { status } = await send("PATCH", `/${QUESTION_ID}`, { topic_id: TOPIC_ID });
    assert.equal(status, 200);
    const [[fields]] = allCalls("update");
    assert.equal(fields.topic_id, TOPIC_ID);
  });

  test("PATCH errore DB: 500 generico", async () => {
    results = [{ error: { code: "XX000", message: "dettaglio segreto" } }];
    const { status, body } = await send("PATCH", `/${QUESTION_ID}`, { prompt: "x" });
    assert.equal(status, 500);
    assert.deepEqual(body, { ok: false, error: "Errore interno del server" });
  });

  test("DELETE id non uuid: 404 senza query", async () => {
    const { status, body } = await send("DELETE", "/non-uuid");
    assert.equal(status, 404);
    assert.deepEqual(body, { ok: false, error: "Domanda non trovata" });
    assert.equal(queries.length, 0);
  });

  test("DELETE con tentativi: 409 con il messaggio di ENDPOINTS.md, nessuna cancellazione", async () => {
    results = [{ count: 1 }];
    const { status, body } = await send("DELETE", `/${QUESTION_ID}`);
    assert.equal(status, 409);
    assert.deepEqual(body, { ok: false, error: HAS_ATTEMPTS_MESSAGE });
    assert.deepEqual(allCalls("delete"), []);
  });

  test("DELETE con tentativo inserito nel frattempo (FK): 409", async () => {
    results = [{ count: 0 }, { error: { code: "23503" } }];
    const { status, body } = await send("DELETE", `/${QUESTION_ID}`);
    assert.equal(status, 409);
    assert.deepEqual(body, { ok: false, error: HAS_ATTEMPTS_MESSAGE });
  });

  test("DELETE domanda inesistente: 404", async () => {
    results = [{ count: 0 }, { data: null }];
    const { status, body } = await send("DELETE", `/${QUESTION_ID}`);
    assert.equal(status, 404);
    assert.deepEqual(body, { ok: false, error: "Domanda non trovata" });
  });

  test("DELETE riuscito: { ok: true }", async () => {
    results = [{ count: 0 }, { data: { id: QUESTION_ID } }];
    const { status, body } = await send("DELETE", `/${QUESTION_ID}`);
    assert.equal(status, 200);
    assert.deepEqual(body, { ok: true });
  });

  test("DELETE errore DB: 500 generico", async () => {
    results = [{ error: { code: "XX000" } }];
    const { status, body } = await send("DELETE", `/${QUESTION_ID}`);
    assert.equal(status, 500);
    assert.deepEqual(body, { ok: false, error: "Errore interno del server" });
  });
});
