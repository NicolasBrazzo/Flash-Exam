// Autovalutazione, nuovo tentativo di valutazione e consegna automatica delle
// prove scadute (PROVA-4). Supabase in memoria e grader finto registrati in
// require.cache PRIMA di caricare model e controller: nessuna connessione reale.
process.env.JWT_SECRET = "test-secret";
process.env.SUPABASE_URL = "http://127.0.0.1:9";
process.env.SUPABASE_KEY = "test-key";

const { describe, test, before, after, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");

// ---------------------------------------------------------------------------
// Supabase in memoria (più sessioni, insert, domande)
// ---------------------------------------------------------------------------
const db = { sessions: [], attempts: [], questionIds: [], stale: new Map(), failOn: null };
const queries = [];
const events = [];
let nextSession = 100;

const clone = (value) => (value == null ? value : JSON.parse(JSON.stringify(value)));
const questionFor = (questionId, position) => ({
  id: questionId,
  prompt: `Domanda ${position}?`,
  answer: `riferimento ${position}`,
  rubric: [{ id: "c1", concept: "primo", weight: 2 }, { id: "c2", concept: "secondo", weight: 1 }],
  article_refs: [String(1000 + position)],
  topic: { id: "t1", name: "Obbligazioni" },
});

const resolveQuery = (q) => {
  if (db.failOn && db.failOn(q)) return { data: null, error: { code: "XX000" } };
  const eqs = Object.fromEntries(q.calls.filter(([m]) => m === "eq").map(([, a]) => a));
  const iss = Object.fromEntries(q.calls.filter(([m]) => m === "is").map(([, a]) => a));

  if (q.table === "FE_Questions") return { data: db.questionIds.map((id) => ({ id })), error: null };

  if (q.table === "FE_ExamSessions") {
    if (q.op === "select") {
      if (Object.hasOwn(eqs, "id")) {
        const row = db.stale.get(eqs.id) ?? db.sessions.find((s) => s.id === eqs.id);
        return { data: clone(row ?? null), error: null };
      }
      const rows = db.sessions.filter((s) => s.status === eqs.status).sort((a, b) => b.started_at.localeCompare(a.started_at));
      return { data: clone(rows[0] ?? null), error: null };
    }
    if (q.op === "update") {
      const s = db.sessions.find((x) => x.id === eqs.id);
      if (!s || (Object.hasOwn(eqs, "status") && s.status !== eqs.status)) return { data: null, error: null };
      if (Object.hasOwn(iss, "grade") && s.grade !== null) return { data: null, error: null };
      Object.assign(s, q.fields);
      events.push(`session:${s.status}`);
      return { data: clone(s), error: null };
    }
    if (q.op === "insert") {
      nextSession += 1;
      const row = {
        id: `e0000000-0000-4000-8000-000000000${nextSession}`,
        status: "IN_PROGRESS",
        submitted_at: null,
        auto_submitted: false,
        grade: null,
        honors: false,
        ...q.fields,
      };
      db.sessions.push(row);
      events.push("insert:session");
      return { data: clone(row), error: null };
    }
    if (q.op === "delete") return { data: null, error: null };
  }

  if (q.table === "FE_Attempts") {
    if (q.op === "select") {
      const rows = db.attempts.filter((a) => a.session_id === eqs.session_id).sort((a, b) => a.position - b.position);
      return { data: clone(rows), error: null };
    }
    if (q.op === "insert") {
      const rows = q.fields.map((f) => ({
        id: `a${f.session_id.slice(1, 30)}${f.position}`,
        verdict: null,
        grading: null,
        grading_source: null,
        points: null,
        score: null,
        graded_at: null,
        updated_at: "x",
        question: questionFor(f.question_id, f.position),
        ...f,
      }));
      db.attempts.push(...rows);
      events.push("insert:attempts");
      return { data: clone(rows), error: null };
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
      if (["update", "insert", "delete"].includes(method)) {
        q.op = method;
        q.fields = args[0];
      }
      return builder;
    };
  }
  builder.then = (resolve, reject) => Promise.resolve({ count: null, ...resolveQuery(q) }).then(resolve, reject);
  return builder;
};
const dbPath = require.resolve("../config/db_connection");
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { from: (table) => makeBuilder(table) } };

// ---------------------------------------------------------------------------
// Grader finto
// ---------------------------------------------------------------------------
const graderCalls = [];
const okOutput = () => ({
  concepts: [{ id: "c1", status: "present" }, { id: "c2", status: "present" }],
  verdict: "correct",
  corrections: [],
  suggestion: "suggerimento",
  exampleAnswer: "esemplare",
});
const defaultGraderImpl = async (items) => new Map(items.map((item) => [item.index, okOutput()]));
let graderImpl = defaultGraderImpl;
const graderPath = require.resolve("../services/grader");
require.cache[graderPath] = {
  id: graderPath,
  filename: graderPath,
  loaded: true,
  exports: {
    gradeBatch: async (items, opts) => {
      graderCalls.push(clone(items));
      events.push("grader");
      return graderImpl(items, opts);
    },
    gradeAnswer: async () => {
      throw new Error("gradeAnswer non deve essere usato dalla simulazione");
    },
  },
};

const express = require("express");
const jwt = require("jsonwebtoken");
const { updateExamSession } = require("../models/examSession.model");
const {
  isExpiredInProgress,
  checkRegradable,
  buildSelfGradedFields,
  assembleExamResult,
} = require("../services/examGrading");
const { examSelfGradeSchema } = require("../schemas/examSelfGrade.schema");
const examsRoutes = require("../controllers/exams.controller");

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------
const SID = "e0000000-0000-4000-8000-000000000001";
const MISSING = "e0000000-0000-4000-8000-000000000999";
const DRAFTS = { 1: "bozza 1", 2: "bozza 2", 3: "", 4: "bozza 4", 5: "   ", 6: "bozza 6" };
const FULL = { 1: "a", 2: "b", 3: "c", 4: "d", 5: "e", 6: "f" };
const MIN = 60 * 1000;
const NOT_AWAITING = "La simulazione non è in attesa di autovalutazione";
const ALREADY_GRADED = "Simulazione già valutata";

const iso = (ms) => new Date(Date.now() + ms).toISOString();

const addSession = ({ status = "IN_PROGRESS", expiresIn = 30 * MIN, submittedAgo = null, grade = null, drafts = DRAFTS, id = SID, graded = false } = {}) => {
  const expires = Date.now() + expiresIn;
  const session = {
    id,
    status,
    started_at: new Date(expires - 40 * MIN).toISOString(),
    expires_at: new Date(expires).toISOString(),
    submitted_at: submittedAgo == null ? (status === "IN_PROGRESS" ? null : iso(-MIN)) : iso(-submittedAgo),
    auto_submitted: false,
    grade,
    honors: false,
  };
  db.sessions.push(session);
  for (let p = 1; p <= 6; p += 1) {
    db.attempts.push({
      id: `${id.slice(0, 30)}a${p}`,
      session_id: id,
      position: p,
      answer: drafts[p],
      verdict: graded ? "partial" : null,
      grading: null,
      grading_source: graded ? "SELF" : null,
      points: graded ? 2.5 : null,
      score: graded ? 0.5 : null,
      graded_at: graded ? iso(-MIN) : null,
      updated_at: "x",
      question: questionFor(`00000000-0000-4000-8000-00000000000${p}`, p),
    });
  }
  return session;
};

const sessionOf = (id = SID) => db.sessions.find((s) => s.id === id);
const attemptsOf = (id = SID) => db.attempts.filter((a) => a.session_id === id).sort((a, b) => a.position - b.position);
const verdicts = (list) => list.map((verdict, i) => ({ position: i + 1, verdict }));
const allCorrect = () => verdicts(["correct", "correct", "correct", "correct", "correct", "correct"]);
const updates = () => queries.filter((q) => q.op === "update");
const FORBIDDEN_KEYS = ['"score"', '"points"', '"rubric"', '"concepts"'];
const assertNoInternals = (body) => {
  const raw = JSON.stringify(body);
  for (const key of FORBIDDEN_KEYS) assert.equal(raw.includes(key), false, key);
};

let originalError;

beforeEach(() => {
  db.sessions = [];
  db.attempts = [];
  db.questionIds = Array.from({ length: 8 }, (_, i) => `00000000-0000-4000-8000-0000000001${String(i).padStart(2, "0")}`);
  db.stale = new Map();
  db.failOn = null;
  queries.length = 0;
  events.length = 0;
  graderCalls.length = 0;
  graderImpl = defaultGraderImpl;
  originalError = console.error;
  console.error = () => {};
});

afterEach(() => {
  console.error = originalError;
});

// ---------------------------------------------------------------------------
// A. Pezzi puri
// ---------------------------------------------------------------------------
describe("PROVA-4: pezzi puri", () => {
  test("examSelfGradeSchema: tutte e 6 le posizioni, una volta sola, verdetti validi", () => {
    const shuffled = [3, 1, 6, 2, 5, 4].map((position) => ({ position, verdict: "partial" }));
    assert.equal(examSelfGradeSchema.safeParse({ verdicts: allCorrect() }).success, true);
    assert.equal(examSelfGradeSchema.safeParse({ verdicts: shuffled }).success, true);
    const bad = [
      { verdicts: allCorrect().slice(0, 5) },
      { verdicts: [...allCorrect(), { position: 6, verdict: "wrong" }] },
      { verdicts: [...allCorrect().slice(0, 5), { position: 5, verdict: "wrong" }] },
      { verdicts: [...allCorrect().slice(1), { position: 0, verdict: "wrong" }] },
      { verdicts: [...allCorrect().slice(1), { position: 7, verdict: "wrong" }] },
      { verdicts: [...allCorrect().slice(1), { position: 1.5, verdict: "wrong" }] },
      { verdicts: [...allCorrect().slice(1), { position: "1", verdict: "wrong" }] },
      { verdicts: [...allCorrect().slice(1), { position: 1, verdict: "giusto" }] },
      { verdicts: [...allCorrect().slice(1), { position: 1, verdict: null }] },
      { verdicts: [...allCorrect().slice(1), { position: 1, verdict: "correct", extra: 1 }] },
      { verdicts: allCorrect(), extra: 1 },
      {},
    ];
    for (const body of bad) {
      const res = examSelfGradeSchema.safeParse(body);
      assert.equal(res.success, false, JSON.stringify(body).slice(0, 120));
      for (const issue of res.error.issues) assert.ok(typeof issue.message === "string" && issue.message.length > 0);
    }
  });

  test("isExpiredInProgress: solo IN_PROGRESS oltre expires_at più la tolleranza", () => {
    const now = new Date("2026-05-01T12:00:00.000Z");
    const at = (ms, status = "IN_PROGRESS") => ({ status, expires_at: new Date(now.getTime() - ms).toISOString() });
    assert.equal(isExpiredInProgress(at(15000), now), false);
    assert.equal(isExpiredInProgress(at(15001), now), true);
    assert.equal(isExpiredInProgress(at(-60000), now), false);
    for (const status of ["GRADING", "GRADED", "SELF_GRADED"]) assert.equal(isExpiredInProgress(at(3600000, status), now), false, status);
  });

  test("checkRegradable: SELF_GRADED senza voto o GRADING bloccata da oltre 5 minuti", () => {
    const now = new Date("2026-05-01T12:00:00.000Z");
    const ago = (ms) => new Date(now.getTime() - ms).toISOString();
    assert.equal(checkRegradable({ status: "SELF_GRADED", grade: null }, now), null);
    assert.equal(checkRegradable({ status: "SELF_GRADED", grade: 18 }, now), "EXAM_ALREADY_GRADED");
    assert.equal(checkRegradable({ status: "GRADED", grade: 25 }, now), "EXAM_ALREADY_GRADED");
    assert.equal(checkRegradable({ status: "IN_PROGRESS", grade: null, submitted_at: null }, now), "EXAM_NOT_SUBMITTED");
    assert.equal(checkRegradable({ status: "GRADING", grade: null, submitted_at: ago(5 * MIN - 1000) }, now), "EXAM_GRADING_IN_PROGRESS");
    assert.equal(checkRegradable({ status: "GRADING", grade: null, submitted_at: ago(5 * MIN) }, now), "EXAM_GRADING_IN_PROGRESS");
    assert.equal(checkRegradable({ status: "GRADING", grade: null, submitted_at: ago(5 * MIN + 1) }, now), null);
    assert.equal(checkRegradable({ status: "GRADING", grade: null, submitted_at: ago(-MIN) }, now), "EXAM_GRADING_IN_PROGRESS");
  });

  test("buildSelfGradedFields: punteggi 1/0,5/0, vuote wrong d'ufficio, abbinamento per posizione", () => {
    addSession();
    const attempts = attemptsOf();
    const list = [
      { position: 6, verdict: "wrong" },
      { position: 1, verdict: "correct" },
      { position: 2, verdict: "partial" },
      { position: 3, verdict: "correct" },
      { position: 4, verdict: "correct" },
      { position: 5, verdict: "partial" },
    ];
    const gradedAt = "2026-05-01T12:00:00.000Z";
    const graded = buildSelfGradedFields(attempts, list, gradedAt);
    const by = (p) => graded.find((g) => g.position === p);
    assert.equal(graded.length, 6);
    assert.deepEqual(by(1).fields, { verdict: "correct", grading_source: "SELF", grading: null, score: 1, points: 5, graded_at: gradedAt });
    assert.deepEqual(by(2).fields, { verdict: "partial", grading_source: "SELF", grading: null, score: 0.5, points: 2.5, graded_at: gradedAt });
    assert.deepEqual(by(6).fields, { verdict: "wrong", grading_source: "SELF", grading: null, score: 0, points: 0, graded_at: gradedAt });
    for (const p of [3, 5]) assert.deepEqual(by(p).fields, { verdict: "wrong", grading_source: "SELF", grading: null, score: 0, points: 0, graded_at: gradedAt });
    assert.equal(by(1).id, attempts[0].id);
    assert.throws(() => buildSelfGradedFields(attempts, list.slice(1), gradedAt));
  });

  test("autovalutazione: niente lode anche con 30 (D1)", () => {
    addSession({ drafts: FULL });
    assert.deepEqual(assembleExamResult(buildSelfGradedFields(attemptsOf(), allCorrect(), "x")), { grade: 30, honors: false });
  });

  test("updateExamSession: requireNoGrade aggiunge is(grade, null)", async () => {
    addSession({ status: "SELF_GRADED" });
    await updateExamSession(SID, { grade: 10 }, { expectedStatus: "SELF_GRADED", requireNoGrade: true });
    const [q] = queries;
    assert.deepEqual(q.calls.filter(([m]) => m === "eq").map(([, a]) => a), [["id", SID], ["status", "SELF_GRADED"]]);
    assert.deepEqual(q.calls.filter(([m]) => m === "is").map(([, a]) => a), [["grade", null]]);
    queries.length = 0;
    await updateExamSession(SID, { honors: false }, { expectedStatus: "SELF_GRADED" });
    assert.deepEqual(queries[0].calls.filter(([m]) => m === "is"), []);
  });
});

// ---------------------------------------------------------------------------
// Rotte
// ---------------------------------------------------------------------------
describe("PROVA-4: rotte", () => {
  let server;
  let baseUrl;
  const auth = { Authorization: `Bearer ${jwt.sign({ sub: "u" }, "test-secret")}` };
  const call = async (method, path, body, headers = auth) => {
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
    app.use("/exams", examsRoutes);
    await new Promise((resolve) => {
      server = app.listen(0, "127.0.0.1", resolve);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}/exams`;
  });

  after(() => new Promise((resolve) => server.close(resolve)));

  // B. self-grade
  describe("POST /exams/:id/self-grade", () => {
    const selfGrade = (id, body, headers) => call("POST", `/${id}/self-grade`, body, headers);

    test("401, id non uuid 404 senza query, body non valido 400 senza update", async () => {
      addSession({ status: "SELF_GRADED" });
      assert.equal((await selfGrade(SID, { verdicts: allCorrect() }, {})).status, 401);
      let res = await selfGrade("abc", { verdicts: allCorrect() });
      assert.equal(res.status, 404);
      assert.equal(queries.length, 0);
      for (const body of [{ verdicts: allCorrect().slice(0, 5) }, { verdicts: [...allCorrect().slice(0, 5), { position: 1, verdict: "wrong" }] }]) {
        res = await selfGrade(SID, body);
        assert.equal(res.status, 400);
        assert.ok(Array.isArray(res.body.error));
      }
      assert.deepEqual(updates(), []);
    });

    test("prova inesistente: 404", async () => {
      const res = await selfGrade(MISSING, { verdicts: allCorrect() });
      assert.equal(res.status, 404);
      assert.deepEqual(res.body, { ok: false, error: "Simulazione non trovata" });
    });

    test("409 se non in attesa di autovalutazione o già valutata", async () => {
      const cases = [
        [{ status: "IN_PROGRESS" }, NOT_AWAITING],
        [{ status: "GRADING" }, NOT_AWAITING],
        [{ status: "GRADED", grade: 25 }, ALREADY_GRADED],
        [{ status: "SELF_GRADED", grade: 20 }, ALREADY_GRADED],
      ];
      for (const [opts, message] of cases) {
        db.sessions = [];
        db.attempts = [];
        addSession(opts);
        queries.length = 0;
        const res = await selfGrade(SID, { verdicts: allCorrect() });
        assert.equal(res.status, 409, opts.status);
        assert.deepEqual(res.body, { ok: false, error: message });
        assert.deepEqual(updates(), []);
      }
    });

    test("successo: voto senza lode, vuote wrong, stato resta SELF_GRADED, niente AI", async () => {
      const session = addSession({ status: "SELF_GRADED" });
      const submittedAt = session.submitted_at;
      const res = await selfGrade(SID, { verdicts: allCorrect() });
      assert.equal(res.status, 200);
      assert.equal(res.body.ok, true);
      const { exam } = res.body;
      assert.equal(exam.status, "SELF_GRADED");
      assert.equal(exam.grade, 20);
      assert.equal(exam.honors, false);
      for (const q of exam.questions) {
        assert.equal(q.grading_source, "SELF");
        assert.equal(q.feedback, null);
        assert.equal(q.verdict, [3, 5].includes(q.position) ? "wrong" : "correct");
      }
      assertNoInternals(res.body);
      for (const a of attemptsOf()) {
        const empty = [3, 5].includes(a.position);
        assert.equal(a.score, empty ? 0 : 1);
        assert.equal(a.points, empty ? 0 : 5);
        assert.equal(a.grading, null);
        assert.ok(a.graded_at);
      }
      assert.equal(sessionOf().status, "SELF_GRADED");
      assert.equal(sessionOf().grade, 20);
      assert.equal(sessionOf().submitted_at, submittedAt);
      assert.equal(graderCalls.length, 0);
    });

    test("tutte corrette e non vuote: 30 senza lode (D1)", async () => {
      addSession({ status: "SELF_GRADED", drafts: FULL });
      const res = await selfGrade(SID, { verdicts: allCorrect() });
      assert.equal(res.body.exam.grade, 30);
      assert.equal(res.body.exam.honors, false);
      assert.equal(sessionOf().honors, false);
    });

    test("verdetti misti: 22,5 punti -> 22", async () => {
      addSession({ status: "SELF_GRADED", drafts: FULL });
      const res = await selfGrade(SID, { verdicts: verdicts(["correct", "correct", "correct", "correct", "partial", "wrong"]) });
      assert.equal(res.status, 200);
      assert.equal(res.body.exam.grade, 22);
    });

    test("seconda autovalutazione: 409, tentativi invariati", async () => {
      addSession({ status: "SELF_GRADED" });
      assert.equal((await selfGrade(SID, { verdicts: allCorrect() })).status, 200);
      const snapshot = clone(attemptsOf());
      const res = await selfGrade(SID, { verdicts: verdicts(["wrong", "wrong", "wrong", "wrong", "wrong", "wrong"]) });
      assert.equal(res.status, 409);
      assert.deepEqual(res.body, { ok: false, error: ALREADY_GRADED });
      assert.deepEqual(attemptsOf(), snapshot);
    });

    test("voto valorizzato da un'altra richiesta prima dell'update finale: 409", async () => {
      const session = addSession({ status: "SELF_GRADED" });
      db.stale.set(SID, clone(session));
      session.grade = 18;
      const res = await selfGrade(SID, { verdicts: allCorrect() });
      assert.equal(res.status, 409);
      assert.equal(sessionOf().grade, 18);
    });

    test("errore DB su un tentativo: 500, voto ancora null", async () => {
      addSession({ status: "SELF_GRADED" });
      db.failOn = (q) => q.table === "FE_Attempts" && q.op === "update";
      const res = await selfGrade(SID, { verdicts: allCorrect() });
      assert.equal(res.status, 500);
      assert.deepEqual(res.body, { ok: false, error: "Errore interno del server" });
      assert.equal(sessionOf().grade, null);
    });
  });

  // C. grade
  describe("POST /exams/:id/grade", () => {
    const grade = (id, headers) => call("POST", `/${id}/grade`, undefined, headers);

    test("401, 404 id non uuid, 404 inesistente senza grader", async () => {
      addSession({ status: "SELF_GRADED" });
      assert.equal((await grade(SID, {})).status, 401);
      assert.equal((await grade("abc")).status, 404);
      const res = await grade(MISSING);
      assert.equal(res.status, 404);
      assert.deepEqual(res.body, { ok: false, error: "Simulazione non trovata" });
      assert.equal(graderCalls.length, 0);
    });

    test("409: già valutata, non consegnata, valutazione in corso", async () => {
      const cases = [
        { status: "GRADED", grade: 25 },
        { status: "SELF_GRADED", grade: 20 },
        { status: "IN_PROGRESS" },
        { status: "GRADING", submittedAgo: MIN },
      ];
      for (const opts of cases) {
        db.sessions = [];
        db.attempts = [];
        addSession(opts);
        queries.length = 0;
        const res = await grade(SID);
        assert.equal(res.status, 409, opts.status);
        assert.equal(res.body.ok, false);
        assert.equal(typeof res.body.error, "string");
        assert.deepEqual(updates(), []);
      }
      assert.equal(graderCalls.length, 0);
    });

    test("SELF_GRADED senza voto: una chiamata batch, GRADED", async () => {
      addSession({ status: "SELF_GRADED" });
      const res = await grade(SID);
      assert.equal(res.status, 200);
      assert.equal(res.body.exam.status, "GRADED");
      assert.equal(res.body.exam.grade, 20);
      assert.equal(graderCalls.length, 1);
      assert.deepEqual(graderCalls[0].map((i) => i.index), [1, 2, 4, 6]);
      for (const p of [3, 5]) assert.equal(attemptsOf()[p - 1].verdict, "wrong");
      assertNoInternals(res.body);
    });

    test("GRADING bloccata da 10 minuti: GRADED", async () => {
      addSession({ status: "GRADING", submittedAgo: 10 * MIN });
      const res = await grade(SID);
      assert.equal(res.status, 200);
      assert.equal(res.body.exam.status, "GRADED");
    });

    test("grader fallito: 502, la prova resta com'era", async () => {
      for (const code of ["GRADER_UNAVAILABLE", "GRADER_INVALID_OUTPUT"]) {
        for (const opts of [{ status: "SELF_GRADED" }, { status: "GRADING", submittedAgo: 10 * MIN }]) {
          db.sessions = [];
          db.attempts = [];
          addSession(opts);
          const snapshot = clone({ session: sessionOf(), attempts: attemptsOf() });
          queries.length = 0;
          graderImpl = async () => {
            throw new Error(code);
          };
          const res = await grade(SID);
          assert.equal(res.status, 502, `${code} ${opts.status}`);
          assert.equal(res.body.ok, false);
          assert.equal(typeof res.body.error, "string");
          assert.deepEqual(updates(), []);
          assert.deepEqual({ session: sessionOf(), attempts: attemptsOf() }, snapshot);
        }
      }
    });

    test("errore di programmazione del grader: 500, prova invariata", async () => {
      addSession({ status: "SELF_GRADED" });
      graderImpl = async () => {
        throw new Error("boom");
      };
      const res = await grade(SID);
      assert.equal(res.status, 500);
      assert.equal(sessionOf().status, "SELF_GRADED");
      assert.deepEqual(updates(), []);
    });

    test("via AI la lode resta possibile", async () => {
      addSession({ status: "SELF_GRADED", drafts: FULL });
      const res = await grade(SID);
      assert.equal(res.body.exam.grade, 30);
      assert.equal(res.body.exam.honors, true);
    });
  });

  // D. GET /exams/:id
  describe("GET /exams/:id: consegna automatica", () => {
    test("scaduta oltre la tolleranza: consegnata e valutata prima di rispondere", async () => {
      addSession({ expiresIn: -MIN });
      const res = await call("GET", `/${SID}`);
      assert.equal(res.status, 200);
      const { exam } = res.body;
      assert.equal(exam.status, "GRADED");
      assert.equal(exam.auto_submitted, true);
      assert.ok(exam.submitted_at);
      assert.equal(exam.questions[0].reference_answer, "riferimento 1");
      assert.equal(graderCalls.length, 1);
      assert.equal(graderCalls[0].find((i) => i.index === 2).answer, "bozza 2");
      const order = ["session:GRADING", "grader", "session:GRADED"].map((e) => events.indexOf(e));
      assert.ok(order.every((i) => i >= 0) && order[0] < order[1] && order[1] < order[2], events.join(","));
      assert.equal(events.some((e) => e.startsWith("answer:")), false);
      assertNoInternals(res.body);
    });

    test("entro la tolleranza o non scaduta: nessuna consegna", async () => {
      for (const expiresIn of [-10000, 10 * MIN]) {
        db.sessions = [];
        db.attempts = [];
        addSession({ expiresIn });
        queries.length = 0;
        const res = await call("GET", `/${SID}`);
        assert.equal(res.status, 200);
        assert.equal(res.body.exam.status, "IN_PROGRESS");
        assert.equal(Object.hasOwn(res.body.exam.questions[0], "reference_answer"), false);
        assert.deepEqual(updates(), []);
      }
      assert.equal(graderCalls.length, 0);
    });

    test("scaduta con grader non disponibile: SELF_GRADED senza valutazioni", async () => {
      addSession({ expiresIn: -MIN });
      graderImpl = async () => {
        throw new Error("GRADER_UNAVAILABLE");
      };
      const res = await call("GET", `/${SID}`);
      assert.equal(res.status, 200);
      assert.equal(res.body.exam.status, "SELF_GRADED");
      assert.equal(res.body.exam.auto_submitted, true);
      assert.equal(res.body.exam.grade, null);
      for (const a of attemptsOf()) assert.equal(a.verdict, null);
    });

    test("scaduta ma già consegnata da un'altra richiesta: 200 con lo stato riletto", async () => {
      const session = addSession({ expiresIn: -MIN });
      db.stale.set(SID, clone(session));
      session.status = "GRADING";
      session.submitted_at = iso(-1000);
      // dopo il lock fallito la rilettura deve vedere lo stato vero
      const original = db.failOn;
      let lockTried = false;
      db.failOn = (q) => {
        if (q.table === "FE_ExamSessions" && q.op === "update") {
          lockTried = true;
          db.stale.delete(SID);
        }
        return original ? original(q) : false;
      };
      const res = await call("GET", `/${SID}`);
      assert.equal(lockTried, true);
      assert.equal(res.status, 200);
      assert.equal(res.body.exam.status, "GRADING");
      assert.equal(graderCalls.length, 0);
    });

    test("prove consegnate: nessun update, nessun grader", async () => {
      for (const opts of [{ status: "GRADED", grade: 25, graded: true }, { status: "SELF_GRADED" }]) {
        db.sessions = [];
        db.attempts = [];
        addSession({ ...opts, expiresIn: -60 * MIN });
        queries.length = 0;
        const res = await call("GET", `/${SID}`);
        assert.equal(res.status, 200);
        assert.equal(res.body.exam.status, opts.status);
        assert.deepEqual(updates(), []);
      }
      assert.equal(graderCalls.length, 0);
    });

    test("errore DB durante la consegna: 500", async () => {
      addSession({ expiresIn: -MIN });
      db.failOn = (q) => q.table === "FE_ExamSessions" && q.op === "update";
      const res = await call("GET", `/${SID}`);
      assert.equal(res.status, 500);
      assert.deepEqual(res.body, { ok: false, error: "Errore interno del server" });
    });
  });

  // E. POST /exams
  describe("POST /exams: consegna automatica della prova scaduta", () => {
    test("scaduta: liquidata (GRADED, auto_submitted) prima di crearne una nuova", async () => {
      addSession({ expiresIn: -60 * MIN });
      const res = await call("POST", "/");
      assert.equal(res.status, 201);
      assert.equal(res.body.resumed, false);
      assert.notEqual(res.body.exam.id, SID);
      assert.equal(sessionOf().status, "GRADED");
      assert.equal(sessionOf().auto_submitted, true);
      assert.ok(events.indexOf("session:GRADED") < events.indexOf("insert:session"), events.join(","));
    });

    test("scaduta con grader non disponibile: vecchia SELF_GRADED, nuova creata", async () => {
      addSession({ expiresIn: -60 * MIN });
      graderImpl = async () => {
        throw new Error("GRADER_UNAVAILABLE");
      };
      const res = await call("POST", "/");
      assert.equal(res.status, 201);
      assert.equal(sessionOf().status, "SELF_GRADED");
    });

    test("entro la tolleranza: ripresa, nessuna consegna", async () => {
      addSession({ expiresIn: -5000 });
      const res = await call("POST", "/");
      assert.equal(res.status, 200);
      assert.equal(res.body.resumed, true);
      assert.equal(graderCalls.length, 0);
      assert.deepEqual(updates(), []);
    });

    test("scaduta con meno di 6 domande: liquidata comunque, poi 409", async () => {
      addSession({ expiresIn: -60 * MIN });
      db.questionIds = db.questionIds.slice(0, 4);
      const res = await call("POST", "/");
      assert.equal(res.status, 409);
      assert.equal(sessionOf().status, "GRADED");
    });

    test("scaduta ma già consegnata da un'altra richiesta: si crea comunque la nuova", async () => {
      const session = addSession({ expiresIn: -60 * MIN });
      db.failOn = (q) => {
        if (q.table === "FE_ExamSessions" && q.op === "update" && q.fields.status === "GRADING") session.status = "GRADING";
        return false;
      };
      const res = await call("POST", "/");
      assert.equal(res.status, 201);
      assert.equal(res.body.resumed, false);
      assert.equal(graderCalls.length, 0);
    });
  });
});
