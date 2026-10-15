const { describe, test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

// Il modulo deve caricarsi senza la configurazione di Gemini
for (const key of Object.keys(process.env)) {
  if (key.startsWith("GEMINI_")) delete process.env[key];
}
const { createGrader, conceptIdErrors } = require("../services/grader");
const { buildSinglePrompt } = require("../services/graderPrompt");

const API_KEY = "CHIAVE-SEGRETA-123";
const PRIVATE = "RISPOSTA-PRIVATA-XYZ";

const item = () => ({
  prompt: "Come si acquista la capacità giuridica?",
  referenceAnswer: "Con la nascita.",
  rubric: [
    { id: "c1", concept: "Nascita", weight: 2 },
    { id: "c2", concept: "Concepito", weight: 1 },
  ],
  references: ["1"],
  answer: `Alla nascita ${PRIVATE}`,
});

const validOutput = (concepts = [{ id: "c1", status: "present" }, { id: "c2", status: "partial" }]) => ({
  concepts,
  verdict: "partial",
  corrections: [],
  suggestion: "Cita il concepito.",
  exampleAnswer: "Si acquista con la nascita.",
});

// Risposta di Gemini: testo (o oggetto serializzato) dentro candidates[0]
const geminiResponse = (objOrText, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => ({
    candidates: [
      {
        content: { parts: [{ text: typeof objOrText === "string" ? objOrText : JSON.stringify(objOrText) }] },
        finishReason: "STOP",
      },
    ],
  }),
});
const status = (code) => ({ ok: false, status: code, json: async () => ({ error: { message: "errore" } }) });
const rawResponse = (body) => ({ ok: true, status: 200, json: async () => body });

let calls;
let sleeps;
let logs;
let originalError;

// fetch finto: ogni elemento della coda è una risposta, un Error da lanciare
// o una funzione (url, init) => Promise
const fakeFetch = (queue) => async (url, init) => {
  calls.push({ url, init });
  const next = queue.length > 1 ? queue.shift() : queue[0];
  if (next instanceof Error) throw next;
  if (typeof next === "function") return next(url, init);
  return next;
};
const sleep = async (ms) => {
  sleeps.push(ms);
};

const grader = (queue, opts = {}) =>
  createGrader({
    apiKey: API_KEY,
    model: "modello-x",
    baseUrl: "https://base.test/v1beta",
    fetchImpl: fakeFetch(queue),
    sleep,
    random: () => 0,
    ...opts,
  });

const expectError = async (promise, message) => {
  let caught;
  try {
    await promise;
  } catch (err) {
    caught = err;
  }
  assert.ok(caught, "doveva rifiutare");
  assert.equal(caught.message, message);
  assert.equal(caught.message.includes(API_KEY), false);
  assert.equal(JSON.stringify(caught).includes(API_KEY), false);
  assert.equal(caught.cause, undefined);
  for (const line of logs) {
    assert.equal(line.includes(API_KEY), false, "chiave nei log");
    assert.equal(line.includes(PRIVATE), false, "risposta della studentessa nei log");
  }
  return caught;
};

beforeEach(() => {
  calls = [];
  sleeps = [];
  logs = [];
  originalError = console.error;
  console.error = (...args) => logs.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
});

afterEach(() => {
  console.error = originalError;
});

describe("gradeAnswer: successo e richiesta", () => {
  test("risposta valida: una chiamata, nessuna attesa", async () => {
    const result = await grader([geminiResponse(validOutput())]).gradeAnswer(item());
    assert.deepEqual(result, validOutput());
    assert.equal(calls.length, 1);
    assert.deepEqual(sleeps, []);
  });

  test("richiesta: URL, metodo, header, body", async () => {
    await grader([geminiResponse(validOutput())]).gradeAnswer(item());
    const [{ url, init }] = calls;
    assert.equal(url, "https://base.test/v1beta/models/modello-x:generateContent");
    assert.equal(url.includes(API_KEY), false);
    assert.equal(init.method, "POST");
    assert.equal(init.headers["x-goog-api-key"], API_KEY);
    assert.equal(init.headers["Content-Type"], "application/json");
    const body = JSON.parse(init.body);
    assert.equal(body.contents[0].parts[0].text, buildSinglePrompt(item()));
    assert.equal(body.generationConfig.responseMimeType, "application/json");
    assert.ok(init.signal);
  });

  test("baseUrl di default", async () => {
    await grader([geminiResponse(validOutput())], { baseUrl: undefined }).gradeAnswer(item());
    assert.ok(calls[0].url.startsWith("https://generativelanguage.googleapis.com/v1beta/models/"));
  });

  test("campi extra scartati", async () => {
    const out = validOutput();
    out.score = 0.9;
    out.percentuale = 90;
    out.concepts[0].confidence = 0.8;
    const result = await grader([geminiResponse(out)]).gradeAnswer(item());
    assert.equal("score" in result, false);
    assert.equal("percentuale" in result, false);
    assert.equal("confidence" in result.concepts[0], false);
  });
});

describe("gradeAnswer: errori transitori", () => {
  test("un 429 poi successo: attesa di 1 s", async () => {
    await grader([status(429), geminiResponse(validOutput())]).gradeAnswer(item());
    assert.equal(calls.length, 2);
    assert.deepEqual(sleeps, [1000]);
  });

  test("due 429 poi successo: attese di 1 s e 2 s", async () => {
    await grader([status(429), status(429), geminiResponse(validOutput())]).gradeAnswer(item());
    assert.equal(calls.length, 3);
    assert.deepEqual(sleeps, [1000, 2000]);
  });

  test("jitter piccolo", async () => {
    await grader([status(429), geminiResponse(validOutput())], { random: () => 0.5 }).gradeAnswer(item());
    assert.ok(sleeps[0] > 1000 && sleeps[0] < 1250, String(sleeps[0]));
  });

  test("429 sempre: GRADER_UNAVAILABLE dopo maxAttempts chiamate", async () => {
    await expectError(grader([status(429)]).gradeAnswer(item()), "GRADER_UNAVAILABLE");
    assert.equal(calls.length, 4);
    assert.deepEqual(sleeps, [1000, 2000, 4000]);
    calls = [];
    await expectError(grader([status(429)], { maxAttempts: 2 }).gradeAnswer(item()), "GRADER_UNAVAILABLE");
    assert.equal(calls.length, 2);
  });

  test("5xx come 429", async () => {
    await grader([status(500), geminiResponse(validOutput())]).gradeAnswer(item());
    assert.equal(calls.length, 2);
    assert.deepEqual(sleeps, [1000]);
    calls = [];
    await expectError(grader([status(503)]).gradeAnswer(item()), "GRADER_UNAVAILABLE");
    assert.equal(calls.length, 4);
  });

  test("altri 4xx: nessun nuovo tentativo", async () => {
    for (const code of [400, 401, 403]) {
      calls = [];
      sleeps = [];
      await expectError(grader([status(code)]).gradeAnswer(item()), "GRADER_UNAVAILABLE");
      assert.equal(calls.length, 1, String(code));
      assert.deepEqual(sleeps, []);
    }
  });

  test("errore di rete: nuovo tentativo", async () => {
    const networkError = new TypeError("fetch failed https://base.test/v1beta/models/modello-x:generateContent");
    await grader([networkError, geminiResponse(validOutput())]).gradeAnswer(item());
    assert.equal(calls.length, 2);
    calls = [];
    await expectError(grader([networkError]).gradeAnswer(item()), "GRADER_UNAVAILABLE");
    assert.equal(calls.length, 4);
  });
});

describe("gradeAnswer: timeout", () => {
  test("fetch appeso: GRADER_UNAVAILABLE allo scadere", async () => {
    const hanging = (url, init) =>
      new Promise((resolve, reject) => {
        init.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
      });
    const start = Date.now();
    await expectError(grader([hanging], { timeoutMs: 50 }).gradeAnswer(item()), "GRADER_UNAVAILABLE");
    assert.ok(Date.now() - start < 1000);
    assert.equal(calls.length, 1);
  });

  test("le attese non superano il timeout complessivo", async () => {
    await expectError(grader([status(429)], { timeoutMs: 1500 }).gradeAnswer(item()), "GRADER_UNAVAILABLE");
    assert.equal(calls.length, 2);
    assert.deepEqual(sleeps, [1000]);
  });
});

describe("gradeAnswer: output non valido", () => {
  test("JSON non valido due volte: GRADER_INVALID_OUTPUT con 2 chiamate", async () => {
    await expectError(grader([geminiResponse("non json")]).gradeAnswer(item()), "GRADER_INVALID_OUTPUT");
    assert.equal(calls.length, 2);
  });

  test("non valido poi valido: esattamente 2 chiamate", async () => {
    await grader([geminiResponse("non json"), geminiResponse(validOutput())]).gradeAnswer(item());
    assert.equal(calls.length, 2);
    calls = [];
    await grader([geminiResponse({ ...validOutput(), verdict: "ottimo" }), geminiResponse(validOutput())]).gradeAnswer(item());
    assert.equal(calls.length, 2);
  });

  test("schema non conforme due volte: il motivo va nel log", async () => {
    await expectError(grader([geminiResponse({ ...validOutput(), verdict: "ottimo" })]).gradeAnswer(item()), "GRADER_INVALID_OUTPUT");
    assert.equal(calls.length, 2);
    assert.ok(logs.some((line) => line.includes("verdict")), JSON.stringify(logs));
  });

  test("id della rubrica non coerenti: rifiutati", async () => {
    for (const concepts of [
      [{ id: "c1", status: "present" }],
      [{ id: "c1", status: "present" }, { id: "c2", status: "present" }, { id: "c3", status: "present" }],
      [{ id: "c1", status: "present" }, { id: "c1", status: "absent" }, { id: "c2", status: "present" }],
    ]) {
      calls = [];
      await expectError(grader([geminiResponse(validOutput(concepts))]).gradeAnswer(item()), "GRADER_INVALID_OUTPUT");
      assert.equal(calls.length, 2, JSON.stringify(concepts));
    }
  });

  test("conceptIdErrors", () => {
    const rubric = item().rubric;
    assert.deepEqual(conceptIdErrors([{ id: "c1" }, { id: "c2" }], rubric), []);
    assert.ok(conceptIdErrors([{ id: "c1" }], rubric).some((m) => m.includes("c2")));
    assert.ok(conceptIdErrors([{ id: "c1" }, { id: "c2" }, { id: "c3" }], rubric).some((m) => m.includes("c3")));
    assert.ok(conceptIdErrors([{ id: "c1" }, { id: "c1" }, { id: "c2" }], rubric).some((m) => m.includes("c1")));
  });

  test("risposta senza candidates o senza testo: output non valido", async () => {
    await grader([rawResponse({}), geminiResponse(validOutput())]).gradeAnswer(item());
    assert.equal(calls.length, 2);
    for (const body of [{ candidates: [] }, { candidates: [{ content: { parts: [] } }] }]) {
      calls = [];
      await expectError(grader([rawResponse(body)]).gradeAnswer(item()), "GRADER_INVALID_OUTPUT");
      assert.equal(calls.length, 2);
    }
  });
});

describe("gradeAnswer: i due conteggi", () => {
  test("il budget dei transitori riparte nel secondo giro", async () => {
    await grader([geminiResponse("non json"), status(429), geminiResponse(validOutput())]).gradeAnswer(item());
    assert.equal(calls.length, 3);
    assert.deepEqual(sleeps, [1000]);
  });

  test("non valido, poi 429 sempre: GRADER_UNAVAILABLE dopo 5 chiamate", async () => {
    await expectError(grader([geminiResponse("non json"), status(429)]).gradeAnswer(item()), "GRADER_UNAVAILABLE");
    assert.equal(calls.length, 5);
  });
});

describe("createGrader e istanza di default", () => {
  test("apiKey e model obbligatori", () => {
    assert.throws(() => createGrader({ model: "m", fetchImpl: fakeFetch([]) }));
    assert.throws(() => createGrader({ apiKey: API_KEY, fetchImpl: fakeFetch([]) }));
  });

  test("getDefaultGrader pigro", () => {
    const serverDir = path.join(__dirname, "..");
    const run = (env, code) =>
      spawnSync(process.execPath, ["-e", code], { cwd: serverDir, env: { PATH: process.env.PATH, ...env }, encoding: "utf8" });
    let res = run({}, 'require("./services/grader");');
    assert.equal(res.status, 0, res.stderr);
    res = run({}, 'require("./services/grader").getDefaultGrader();');
    assert.notEqual(res.status, 0);
    assert.ok(res.stderr.includes("GEMINI_API_KEY"));
    res = run(
      { GEMINI_API_KEY: "k", GEMINI_MODEL: "m" },
      'const g = require("./services/grader"); const a = g.getDefaultGrader(); const b = g.getDefaultGrader(); if (typeof a.gradeAnswer !== "function" || a !== b) process.exit(3);'
    );
    assert.equal(res.status, 0, res.stderr);
  });
});
