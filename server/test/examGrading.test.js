// Consegna e voto della simulazione (PROVA-3): pezzi puri di services/examGrading.js,
// model updateExamSession e rotta POST /exams/:id/submit. Supabase in memoria e
// grader finto registrati in require.cache PRIMA di caricare model e controller:
// nessuna connessione reale, nessuna chiamata a Gemini.
process.env.JWT_SECRET = "test-secret";
process.env.SUPABASE_URL = "http://127.0.0.1:9";
process.env.SUPABASE_KEY = "test-key";

const { describe, test, before, after, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");

// ---------------------------------------------------------------------------
// Supabase in memoria: risponde in base a tabella, operazione e filtri
// ---------------------------------------------------------------------------
const db = { session: null, attempts: [], staleSession: null, failOn: null };
const queries = [];
const events = [];

const clone = (value) => (value == null ? value : JSON.parse(JSON.stringify(value)));

const resolveQuery = (q) => {
  const key = `${q.op}:${q.table}`;
  if (db.failOn && (db.failOn === key || (typeof db.failOn === "function" && db.failOn(q)))) {
    return { data: null, error: { code: "XX000" } };
  }
  const eqs = Object.fromEntries(q.calls.filter(([m]) => m === "eq").map(([, args]) => args));

  if (q.table === "FE_ExamSessions") {
    if (q.op === "select") {
      const row = db.staleSession ?? db.session;
      return { data: row && row.id === eqs.id ? clone(row) : null, error: null };
    }
    if (q.op === "update") {
      const s = db.session;
      if (!s || s.id !== eqs.id || (Object.hasOwn(eqs, "status") && s.status !== eqs.status)) {
        return { data: null, error: null };
      }
      Object.assign(s, q.fields);
      events.push(`session:${s.status}`);
      return { data: clone(s), error: null };
    }
  }

  if (q.table === "FE_Attempts") {
    if (q.op === "select") {
      const rows = db.attempts.filter(() => db.session && eqs.session_id === db.session.id);
      return { data: clone([...rows].sort((a, b) => a.position - b.position)), error: null };
    }
    if (q.op === "update") {
      const row = db.attempts.find((a) => a.id === eqs.id);
      if (!row) return { data: null, error: null };
      Object.assign(row, q.fields);
      events.push(Object.hasOwn(q.fields, "verdict") ? `grade:${row.position}` : `answer:${row.position}`);
      return { data: clone(row), error: null };
    }
  }
  return { data: null, error: null };
};

const makeBuilder = (table) => {
  const q = { table, op: "select", fields: null, calls: [] };
  queries.push(q);
  const builder = {};
  for (const method of ["select", "in", "eq", "is", "order", "range", "limit", "maybeSingle", "single", "insert", "update", "delete"]) {
    builder[method] = (...args) => {
      q.calls.push([method, args]);
      if (method === "update") {
        q.op = "update";
        q.fields = args[0];
      }
      if (method === "insert") q.op = "insert";
      if (method === "delete") q.op = "delete";
      return builder;
    };
  }
  builder.then = (resolve, reject) => Promise.resolve({ count: null, ...resolveQuery(q) }).then(resolve, reject);
  return builder;
};
const fakeSupabase = { from: (table) => makeBuilder(table) };
const dbPath = require.resolve("../config/db_connection");
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: fakeSupabase };

// ---------------------------------------------------------------------------
// Grader finto
// ---------------------------------------------------------------------------
const graderCalls = [];
const okOutput = (overrides = {}) => ({
  concepts: [{ id: "c1", status: "present" }, { id: "c2", status: "present" }],
  verdict: "correct",
  corrections: [],
  suggestion: "suggerimento",
  exampleAnswer: "esemplare",
  ...overrides,
});
const defaultGraderImpl = async (items) => new Map(items.map((item) => [item.index, okOutput()]));
let graderImpl = defaultGraderImpl;
const fakeGrader = {
  gradeBatch: async (items, opts) => {
    graderCalls.push(clone(items));
    events.push("grader");
    return graderImpl(items, opts);
  },
  gradeAnswer: async () => {
    throw new Error("gradeAnswer non deve essere usato dalla simulazione");
  },
};
const graderPath = require.resolve("../services/grader");
require.cache[graderPath] = { id: graderPath, filename: graderPath, loaded: true, exports: fakeGrader };

const express = require("express");
const jwt = require("jsonwebtoken");
const { computeScore, computePoints, computeExamGrade } = require("../utils/scoring");
const { updateExamSession } = require("../models/examSession.model");
const {
  isAutoSubmitted,
  applySubmittedAnswers,
  selectAnswersToGrade,
  buildGradedFields,
  assembleExamResult,
  gradeExam,
} = require("../services/examGrading");
const { examSubmitSchema } = require("../schemas/examSubmit.schema");
const examsRoutes = require("../controllers/exams.controller");

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------
const SESSION_ID = "e0000000-0000-4000-8000-000000000001";
const OTHER_ID = "e0000000-0000-4000-8000-000000000099";
const SECRET_ANSWER = "RISPOSTA-SEGRETA-789";
const RUBRIC = [{ id: "c1", concept: "primo", weight: 2 }, { id: "c2", concept: "secondo", weight: 1 }];
const DRAFTS = { 1: `bozza 1 ${SECRET_ANSWER}`, 2: "bozza salvata 2", 3: "", 4: "bozza 4", 5: "   ", 6: "bozza 6" };

const sessionRow = (expiresInMs = 30 * 60 * 1000, status = "IN_PROGRESS") => {
  const expires = new Date(Date.now() + expiresInMs);
  return {
    id: SESSION_ID,
    status,
    started_at: new Date(expires.getTime() - 40 * 60 * 1000).toISOString(),
    expires_at: expires.toISOString(),
    submitted_at: null,
    auto_submitted: false,
    grade: null,
    honors: false,
  };
};

const attemptRow = (position, answer = DRAFTS[position]) => ({
  id: `a0000000-0000-4000-8000-00000000000${position}`,
  position,
  answer,
  verdict: null,
  grading: null,
  grading_source: null,
  points: null,
  score: null,
  graded_at: null,
  updated_at: "2026-01-01T00:00:00.000Z",
  question: {
    id: `00000000-0000-4000-8000-00000000000${position}`,
    prompt: `Domanda ${position}?`,
    answer: `riferimento ${position}`,
    rubric: RUBRIC,
    article_refs: [String(1000 + position)],
    topic: { id: "t1", name: "Obbligazioni" },
  },
});

const resetDb = (session = sessionRow(), drafts = DRAFTS) => {
  db.session = session;
  db.staleSession = null;
  db.failOn = null;
  db.attempts = [1, 2, 3, 4, 5, 6].map((p) => attemptRow(p, drafts[p]));
};

const GRADE_FIELDS = ["verdict", "grading_source", "score", "points", "graded_at"];
const findKeysDeep = (value, keys, found = new Set()) => {
  if (Array.isArray(value)) value.forEach((v) => findKeysDeep(v, keys, found));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (keys.includes(k)) found.add(k);
      findKeysDeep(v, keys, found);
    }
  }
  return found;
};

let logs;
let originalError;

beforeEach(() => {
  queries.length = 0;
  events.length = 0;
  graderCalls.length = 0;
  graderImpl = defaultGraderImpl;
  resetDb();
  logs = [];
  originalError = console.error;
  console.error = (...args) => logs.push(args.map((a) => (typeof a === "string" ? a : a instanceof Error ? a.stack : JSON.stringify(a))).join(" "));
});

afterEach(() => {
  console.error = originalError;
});

// ---------------------------------------------------------------------------
// Pezzi puri
// ---------------------------------------------------------------------------
describe("examGrading: pezzi puri", () => {
  test("isAutoSubmitted: oltre expires_at, anche di 1 ms", () => {
    const session = { expires_at: "2026-05-01T10:40:00.000Z" };
    const t = Date.parse(session.expires_at);
    assert.equal(isAutoSubmitted(session, new Date(t)), false);
    assert.equal(isAutoSubmitted(session, new Date(t - 60000)), false);
    assert.equal(isAutoSubmitted(session, new Date(t + 1)), true);
    assert.equal(isAutoSubmitted(session, new Date(t + 10000)), true);
  });

  test("applySubmittedAnswers: sostituisce solo se accettate e diverse", () => {
    const attempts = [1, 2, 3, 4, 5, 6].map((p) => attemptRow(p));
    const answers = [{ position: 2, answer: "nuova 2" }, { position: 4, answer: "bozza 4" }, { position: 3, answer: "nuova 3" }];

    const ok = applySubmittedAnswers(attempts, answers, true);
    assert.deepEqual(
      ok.changes.sort((a, b) => a.id.localeCompare(b.id)),
      [{ id: attempts[1].id, answer: "nuova 2" }, { id: attempts[2].id, answer: "nuova 3" }]
    );
    assert.equal(ok.attempts.find((a) => a.position === 2).answer, "nuova 2");
    assert.equal(ok.attempts.find((a) => a.position === 3).answer, "nuova 3");
    assert.equal(ok.attempts.find((a) => a.position === 4).answer, "bozza 4");
    assert.equal(attempts[1].answer, "bozza salvata 2", "l'input non va modificato");

    const late = applySubmittedAnswers(attempts, answers, false);
    assert.deepEqual(late.changes, []);
    assert.deepEqual(late.attempts.map((a) => a.answer), attempts.map((a) => a.answer));

    const none = applySubmittedAnswers(attempts, undefined, true);
    assert.deepEqual(none.changes, []);
    assert.deepEqual(none.attempts.map((a) => a.answer), attempts.map((a) => a.answer));
  });

  test("selectAnswersToGrade: vuote fuori dall'AI, index = position", () => {
    const attempts = [1, 2, 3, 4, 5, 6].map((p) => attemptRow(p));
    const { items, emptyPositions } = selectAnswersToGrade(attempts);
    assert.deepEqual(emptyPositions, [3, 5]);
    assert.deepEqual(items.map((i) => i.index), [1, 2, 4, 6]);
    const second = items.find((i) => i.index === 2);
    assert.deepEqual(second, {
      index: 2,
      prompt: "Domanda 2?",
      referenceAnswer: "riferimento 2",
      rubric: RUBRIC,
      references: ["1002"],
      answer: "bozza salvata 2",
    });
    const padded = selectAnswersToGrade([attemptRow(1, "  testo  ")]);
    assert.equal(padded.items[0].answer, "  testo  ", "la risposta non va trimmata");
  });

  test("buildGradedFields: vuote wrong d'ufficio, AI con score e punti, campi tutti insieme", () => {
    const attempts = [1, 2, 3, 4, 5, 6].map((p) => attemptRow(p));
    const partialOut = okOutput({ verdict: "partial", concepts: [{ id: "c1", status: "present" }, { id: "c2", status: "absent" }] });
    const results = new Map([[1, okOutput()], [2, partialOut], [4, okOutput()], [6, okOutput({ corrections: [{ written: "a", suggested: "b", reason: "c" }] })]]);
    const gradedAt = "2026-05-01T10:41:00.000Z";
    const graded = buildGradedFields(attempts, results, gradedAt);

    assert.equal(graded.length, 6);
    for (const p of [3, 5]) {
      const g = graded.find((x) => x.position === p);
      assert.equal(g.id, attempts[p - 1].id);
      assert.deepEqual(g.fields, { verdict: "wrong", grading_source: "SELF", grading: null, score: 0, points: 0, graded_at: gradedAt });
    }
    const two = graded.find((x) => x.position === 2).fields;
    assert.equal(two.verdict, "partial");
    assert.equal(two.grading_source, "AI");
    assert.deepEqual(two.grading, partialOut);
    const expectedScore = computeScore({ rubric: RUBRIC, concepts: partialOut.concepts, corrections: [] });
    assert.equal(two.score, expectedScore);
    assert.equal(two.score, 0.667);
    assert.equal(two.points, computePoints(expectedScore));
    assert.equal(two.graded_at, gradedAt);
    const six = graded.find((x) => x.position === 6).fields;
    assert.equal(six.score, 0.9);
    for (const { fields } of graded) {
      for (const key of GRADE_FIELDS) assert.notEqual(fields[key], null, key);
      assert.ok(Object.hasOwn(fields, "grading"));
    }

    const missing = new Map([[1, okOutput()], [2, okOutput()], [4, okOutput()]]);
    assert.throws(() => buildGradedFields(attempts, missing, gradedAt), { message: "EXAM_GRADING_MISSING_RESULT" });
  });

  test("assembleExamResult: voto e lode da computeExamGrade, sempre 6 risposte", () => {
    const perfect = [1, 2, 3, 4, 5, 6].map((p) => ({
      id: `x${p}`,
      position: p,
      fields: { verdict: "correct", grading_source: "AI", grading: okOutput(), score: 1, points: 5, graded_at: "x" },
    }));
    assert.deepEqual(assembleExamResult(perfect), { grade: 30, honors: true });
    assert.deepEqual(assembleExamResult(perfect), computeExamGrade(perfect.map((g) => g.fields)));

    const withEmpty = perfect.map((g) =>
      g.position === 3 ? { ...g, fields: { verdict: "wrong", grading_source: "SELF", grading: null, score: 0, points: 0, graded_at: "x" } } : g
    );
    const res = assembleExamResult(withEmpty);
    assert.equal(res.honors, false);
    assert.equal(res.grade, 25);

    assert.throws(() => assembleExamResult(perfect.slice(0, 5)), { message: "EXAM_INVALID_ATTEMPTS" });
  });

  test("examSubmitSchema: answers opzionale, posizioni 1-6 non ripetute", () => {
    for (const body of [{}, { answers: [] }, { answers: [{ position: 1, answer: "" }] }, { answers: [1, 2, 3, 4, 5, 6].map((p) => ({ position: p, answer: "x" })) }]) {
      assert.equal(examSubmitSchema.safeParse(body).success, true, JSON.stringify(body));
    }
    const bad = [
      { answers: [{ position: 0, answer: "x" }] },
      { answers: [{ position: 7, answer: "x" }] },
      { answers: [{ position: 1.5, answer: "x" }] },
      { answers: [{ position: 2, answer: "x" }, { position: 2, answer: "y" }] },
      { answers: [1, 2, 3, 4, 5, 6, 6].map((p) => ({ position: p, answer: "x" })) },
      { answers: [{ position: 1, answer: "a".repeat(5001) }] },
      { answers: [{ position: 1, answer: "x", extra: 1 }] },
      { answers: [{ position: 1 }] },
      { foo: 1 },
      { answers: "testo" },
    ];
    for (const body of bad) assert.equal(examSubmitSchema.safeParse(body).success, false, JSON.stringify(body).slice(0, 80));
  });
});

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------
describe("examSession.model: updateExamSession", () => {
  test("senza condizione: solo eq id; con expectedStatus: anche eq status", async () => {
    const row = await updateExamSession(SESSION_ID, { grade: 1 });
    assert.equal(row.grade, 1);
    let [q] = queries;
    assert.equal(q.table, "FE_ExamSessions");
    assert.deepEqual(q.calls.filter(([m]) => m === "eq").map(([, a]) => a), [["id", SESSION_ID]]);
    assert.ok(q.calls.some(([m, a]) => m === "select" && a[0].includes("expires_at")));
    assert.equal(q.calls.filter(([m]) => m === "maybeSingle").length, 1);

    queries.length = 0;
    await updateExamSession(SESSION_ID, { status: "GRADING" }, { expectedStatus: "IN_PROGRESS" });
    [q] = queries;
    assert.deepEqual(q.calls.filter(([m]) => m === "eq").map(([, a]) => a), [["id", SESSION_ID], ["status", "IN_PROGRESS"]]);
    assert.equal(db.session.status, "GRADING");

    assert.equal(await updateExamSession(SESSION_ID, { status: "GRADED" }, { expectedStatus: "IN_PROGRESS" }), null);
    assert.equal(db.session.status, "GRADING");
    assert.equal(await updateExamSession(OTHER_ID, { grade: 2 }), null);

    db.failOn = "update:FE_ExamSessions";
    await assert.rejects(updateExamSession(SESSION_ID, { grade: 3 }), { message: "DATABASE_UPDATE_EXAM_SESSION_ERROR" });
  });
});

// ---------------------------------------------------------------------------
// Rotta
// ---------------------------------------------------------------------------
describe("POST /exams/:id/submit", () => {
  let server;
  let baseUrl;
  const auth = { Authorization: `Bearer ${jwt.sign({ sub: "u" }, "test-secret")}` };
  const submit = async (id = SESSION_ID, body, headers = auth) => {
    const res = await fetch(`${baseUrl}/${id}/submit`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  };
  const gradeUpdates = () => events.filter((e) => e.startsWith("grade:"));
  const answerUpdates = () => events.filter((e) => e.startsWith("answer:"));

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

  test("senza token: 401; id non uuid: 404 senza query", async () => {
    assert.equal((await submit(SESSION_ID, {}, {})).status, 401);
    const res = await submit("abc", {});
    assert.equal(res.status, 404);
    assert.equal(typeof res.body.error, "string");
    assert.equal(queries.length, 0);
    assert.equal(graderCalls.length, 0);
  });

  test("prova inesistente: 404 senza grader", async () => {
    const res = await submit(OTHER_ID, {});
    assert.equal(res.status, 404);
    assert.deepEqual(res.body, { ok: false, error: "Simulazione non trovata" });
    assert.equal(graderCalls.length, 0);
    assert.equal(db.session.status, "IN_PROGRESS");
  });

  test("body non valido: 400 con elenco, nessuna query", async () => {
    for (const body of [{ answers: [{ position: 9, answer: "x" }] }, { answers: [{ position: 1, answer: "a" }, { position: 1, answer: "b" }] }, { foo: 1 }]) {
      queries.length = 0;
      const res = await submit(SESSION_ID, body);
      assert.equal(res.status, 400, JSON.stringify(body));
      assert.equal(res.body.ok, false);
      assert.ok(Array.isArray(res.body.error));
      assert.equal(queries.length, 0);
    }
    assert.equal(graderCalls.length, 0);
  });

  test("consegna normale: GRADED, una sola chiamata batch, vuote wrong d'ufficio", async () => {
    const res = await submit(SESSION_ID, {});
    assert.equal(res.status, 200);
    const { exam } = res.body;
    assert.equal(exam.status, "GRADED");
    assert.equal(exam.auto_submitted, false);
    assert.ok(exam.submitted_at);
    assert.equal(typeof exam.honors, "boolean");

    assert.equal(graderCalls.length, 1);
    assert.deepEqual(graderCalls[0].map((i) => i.index), [1, 2, 4, 6]);
    assert.equal(graderCalls[0].find((i) => i.index === 2).answer, "bozza salvata 2");

    for (const p of [3, 5]) {
      const a = db.attempts.find((x) => x.position === p);
      assert.equal(a.verdict, "wrong");
      assert.equal(a.grading_source, "SELF");
      assert.equal(a.points, 0);
      assert.equal(a.grading, null);
    }
    for (const a of db.attempts) for (const key of GRADE_FIELDS) assert.notEqual(a[key], null, `${a.position} ${key}`);

    const expected = computeExamGrade(db.attempts);
    assert.equal(exam.grade, expected.grade);
    assert.equal(exam.grade, 20);
    assert.equal(exam.honors, false);
    assert.equal(db.session.status, "GRADED");
    assert.equal(db.session.grade, 20);
  });

  test("nessun voto per domanda nella risposta", async () => {
    const res = await submit(SESSION_ID, {});
    assert.equal(res.status, 200);
    assert.deepEqual([...findKeysDeep(res.body, ["score", "points", "concepts", "rubric", "grading"])], []);
    assert.equal(res.body.exam.questions.length, 6);
    for (const q of res.body.exam.questions) {
      for (const key of ["verdict", "reference_answer", "references", "feedback"]) assert.ok(Object.hasOwn(q, key), key);
    }
    assert.equal(res.body.exam.questions.find((q) => q.position === 3).feedback, null);
    assert.equal(res.body.exam.questions.find((q) => q.position === 1).feedback.exampleAnswer, "esemplare");
  });

  test("doppia consegna: 409 senza seconda valutazione", async () => {
    assert.equal((await submit(SESSION_ID, {})).status, 200);
    const before = events.length;
    const res = await submit(SESSION_ID, {});
    assert.equal(res.status, 409);
    assert.equal(res.body.ok, false);
    assert.match(res.body.error, /già consegnata/i);
    assert.equal(graderCalls.length, 1);
    assert.equal(events.length, before);
  });

  test("consegna concorrente: l'update condizionato non trova la riga, 409", async () => {
    db.staleSession = { ...db.session };
    db.session.status = "GRADING";
    const res = await submit(SESSION_ID, { answers: [{ position: 3, answer: "tardiva" }] });
    assert.equal(res.status, 409);
    assert.match(res.body.error, /già consegnata/i);
    assert.equal(graderCalls.length, 0);
    assert.deepEqual(answerUpdates(), []);
    assert.deepEqual(gradeUpdates(), []);
  });

  test("consegna oltre expires_at entro la tolleranza: auto_submitted, risposte salvate prima del grader", async () => {
    resetDb(sessionRow(-5000));
    const res = await submit(SESSION_ID, { answers: [{ position: 3, answer: "risposta all'ultimo" }] });
    assert.equal(res.status, 200);
    assert.equal(res.body.exam.auto_submitted, true);
    assert.equal(db.session.auto_submitted, true);
    assert.equal(db.attempts.find((a) => a.position === 3).answer, "risposta all'ultimo");
    assert.ok(events.indexOf("answer:3") >= 0 && events.indexOf("answer:3") < events.indexOf("grader"), events.join(","));
    assert.ok(graderCalls[0].some((i) => i.index === 3 && i.answer === "risposta all'ultimo"));
  });

  test("answers oltre la tolleranza: ignorate, si valutano le bozze", async () => {
    resetDb(sessionRow(-60000));
    const res = await submit(SESSION_ID, { answers: [{ position: 2, answer: "testo nuovo" }, { position: 3, answer: "altro" }] });
    assert.equal(res.status, 200);
    assert.equal(res.body.exam.auto_submitted, true);
    assert.deepEqual(answerUpdates(), []);
    assert.equal(graderCalls[0].find((i) => i.index === 2).answer, "bozza salvata 2");
    assert.equal(graderCalls[0].some((i) => i.index === 3), false);
    assert.equal(db.attempts.find((a) => a.position === 3).verdict, "wrong");
  });

  test("tutte vuote: niente AI, voto 0", async () => {
    resetDb(sessionRow(), { 1: "", 2: " ", 3: "", 4: "\n", 5: "", 6: "" });
    const res = await submit(SESSION_ID);
    assert.equal(res.status, 200);
    assert.equal(graderCalls.length, 0);
    assert.equal(res.body.exam.status, "GRADED");
    assert.equal(res.body.exam.grade, 0);
    assert.equal(res.body.exam.honors, false);
    for (const a of db.attempts) {
      assert.equal(a.verdict, "wrong");
      assert.equal(a.grading_source, "SELF");
    }
  });

  test("grader non disponibile o output non valido: SELF_GRADED, nessuna valutazione, prova conservata", async () => {
    for (const code of ["GRADER_UNAVAILABLE", "GRADER_INVALID_OUTPUT"]) {
      resetDb(sessionRow(-3000));
      events.length = 0;
      logs.length = 0;
      graderImpl = async () => {
        throw new Error(code);
      };
      const res = await submit(SESSION_ID, { answers: [{ position: 3, answer: "ultima" }] });
      assert.equal(res.status, 200, code);
      assert.equal(res.body.ok, true);
      assert.equal(res.body.exam.status, "SELF_GRADED");
      assert.equal(res.body.exam.grade, null);
      assert.ok(res.body.exam.submitted_at);
      assert.deepEqual(gradeUpdates(), []);
      assert.deepEqual(answerUpdates(), ["answer:3"]);
      for (const a of db.attempts) assert.equal(a.verdict, null);
      assert.equal(db.session.status, "SELF_GRADED");
      assert.equal(db.session.grade, null);
      for (const q of res.body.exam.questions) {
        assert.equal(q.verdict, null);
        assert.equal(q.feedback, null);
        assert.equal(q.reference_answer, `riferimento ${q.position}`);
      }
      for (const line of logs) assert.equal(line.includes(SECRET_ANSWER), false);
    }
  });

  test("errore di programmazione del grader: 500, la prova resta GRADING", async () => {
    graderImpl = async () => {
      throw new Error("gradeBatch: index 1 ripetuto");
    };
    const res = await submit(SESSION_ID, {});
    assert.equal(res.status, 500);
    assert.deepEqual(res.body, { ok: false, error: "Errore interno del server" });
    assert.equal(db.session.status, "GRADING");
    for (const line of logs) assert.equal(line.includes(SECRET_ANSWER), false);
  });

  test("errore DB nel salvataggio delle valutazioni: 500, non GRADED", async () => {
    db.failOn = (q) => q.op === "update" && q.table === "FE_Attempts" && Object.hasOwn(q.fields, "verdict");
    const res = await submit(SESSION_ID, {});
    assert.equal(res.status, 500);
    assert.equal(db.session.status, "GRADING");
    assert.equal(db.session.grade, null);
  });
});

// ---------------------------------------------------------------------------
// gradeExam diretto (riusato da PROVA-4)
// ---------------------------------------------------------------------------
describe("examGrading: gradeExam", () => {
  test("SELF_GRADED senza voto -> GRADED; GRADED non si rivaluta; inesistente", async () => {
    resetDb(sessionRow(-120000, "SELF_GRADED"));
    const { session, attempts } = await gradeExam(SESSION_ID);
    assert.equal(session.status, "GRADED");
    assert.equal(session.grade, 20);
    assert.equal(attempts.length, 6);
    assert.equal(graderCalls.length, 1);

    await assert.rejects(gradeExam(SESSION_ID), { message: "EXAM_NOT_GRADABLE" });
    assert.equal(graderCalls.length, 1);

    resetDb(sessionRow(0, "IN_PROGRESS"));
    await assert.rejects(gradeExam(SESSION_ID), { message: "EXAM_NOT_GRADABLE" });
    await assert.rejects(gradeExam(OTHER_ID), { message: "EXAM_NOT_FOUND" });
  });
});
