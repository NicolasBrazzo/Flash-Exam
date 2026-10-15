const { describe, test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

// Il modulo deve caricarsi senza la configurazione di Gemini
for (const key of Object.keys(process.env)) {
  if (key.startsWith("GEMINI_")) delete process.env[key];
}
const graderModule = require("../services/grader");
const { createGrader } = graderModule;
const { buildBatchPrompt } = require("../services/graderPrompt");

const API_KEY = "CHIAVE-SEGRETA-123";

const batchItem = (index) => ({
  index,
  prompt: `Domanda ${index}?`,
  referenceAnswer: `Riferimento ${index}.`,
  rubric: [
    { id: `c${index}a`, concept: `Concetto ${index} a`, weight: 2 },
    { id: `c${index}b`, concept: `Concetto ${index} b`, weight: 1 },
  ],
  references: [],
  answer: `Risposta PRIVATE-${index}`,
});
const items = (...indexes) => indexes.map(batchItem);

// Output valido per un item (senza index)
const outputFor = (item) => ({
  concepts: item.rubric.map((c) => ({ id: c.id, status: "present" })),
  verdict: "correct",
  corrections: [],
  suggestion: "",
  exampleAnswer: `Esemplare ${item.index}.`,
});
const batchOutput = (list, mutate = (r) => r) => ({
  results: mutate(list.map((item) => ({ index: item.index, ...outputFor(item) }))),
});

const geminiResponse = (objOrText) => ({
  ok: true,
  status: 200,
  json: async () => ({
    candidates: [
      {
        content: { parts: [{ text: typeof objOrText === "string" ? objOrText : JSON.stringify(objOrText) }] },
        finishReason: "STOP",
      },
    ],
  }),
});
const status = (code) => ({ ok: false, status: code, json: async () => ({}) });

let calls;
let sleeps;
let logs;
let originalError;

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
  assert.equal(caught.cause, undefined);
  for (const line of logs) {
    assert.equal(line.includes(API_KEY), false, "chiave nei log");
    assert.equal(line.includes("PRIVATE-"), false, "risposta nei log");
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

describe("gradeBatch: successo", () => {
  test("6 elementi in una sola chiamata", async () => {
    const list = items(1, 2, 3, 4, 5, 6);
    const result = await grader([geminiResponse(batchOutput(list))]).gradeBatch(list);
    assert.ok(result instanceof Map);
    assert.equal(result.size, 6);
    assert.deepEqual([...result.keys()], [1, 2, 3, 4, 5, 6]);
    for (const item of list) assert.deepEqual(result.get(item.index), outputFor(item));
    assert.equal(calls.length, 1);
    assert.deepEqual(sleeps, []);
  });

  test("prompt del batch e header", async () => {
    const list = items(1, 2);
    await grader([geminiResponse(batchOutput(list))]).gradeBatch(list);
    const [{ url, init }] = calls;
    assert.equal(JSON.parse(init.body).contents[0].parts[0].text, buildBatchPrompt(list));
    assert.equal(init.headers["x-goog-api-key"], API_KEY);
    assert.equal(url.includes(API_KEY), false);
  });

  test("sottoinsieme di posizioni (1, 3, 4)", async () => {
    const list = items(1, 3, 4);
    const result = await grader([geminiResponse(batchOutput(list))]).gradeBatch(list);
    assert.deepEqual([...result.keys()], [1, 3, 4]);
    assert.equal(result.has(2), false);
    assert.equal(calls.length, 1);
  });

  test("risultati in ordine diverso dagli elementi", async () => {
    const list = items(1, 3, 4);
    const out = batchOutput(list, (r) => [r[2], r[0], r[1]]);
    const result = await grader([geminiResponse(out)]).gradeBatch(list);
    assert.deepEqual([...result.keys()], [1, 3, 4]);
    assert.deepEqual(result.get(3).concepts.map((c) => c.id), ["c3a", "c3b"]);
  });
});

describe("gradeBatch: output non valido", () => {
  test("index mancante", async () => {
    const list = items(1, 3, 4);
    const out = batchOutput(list, (r) => r.filter((x) => x.index !== 3));
    await expectError(grader([geminiResponse(out)]).gradeBatch(list), "GRADER_INVALID_OUTPUT");
    assert.equal(calls.length, 2);
    assert.ok(logs.some((l) => l.includes("3") && l.includes("mancante")), JSON.stringify(logs));
  });

  test("index duplicato", async () => {
    const list = items(1, 3, 4);
    const out = batchOutput(list, (r) => [r[0], { ...r[0] }, r[2]]);
    await expectError(grader([geminiResponse(out)]).gradeBatch(list), "GRADER_INVALID_OUTPUT");
    assert.equal(calls.length, 2);
  });

  test("index in più", async () => {
    const list = items(1, 3);
    const out = batchOutput(list, (r) => [...r, { ...r[0], index: 9 }]);
    await expectError(grader([geminiResponse(out)]).gradeBatch(list), "GRADER_INVALID_OUTPUT");
    assert.equal(calls.length, 2);
  });

  test("id della rubrica incoerenti in un elemento", async () => {
    const list = items(1, 3);
    const variants = [
      [{ id: "c3a", status: "present" }],
      [{ id: "c3a", status: "present" }, { id: "c3b", status: "present" }, { id: "zz", status: "present" }],
      [{ id: "c3a", status: "present" }, { id: "c3a", status: "absent" }, { id: "c3b", status: "present" }],
      [{ id: "c1a", status: "present" }, { id: "c3b", status: "present" }],
    ];
    for (const concepts of variants) {
      calls = [];
      const out = batchOutput(list, (r) => r.map((x) => (x.index === 3 ? { ...x, concepts } : x)));
      await expectError(grader([geminiResponse(out)]).gradeBatch(list), "GRADER_INVALID_OUTPUT");
      assert.equal(calls.length, 2, JSON.stringify(concepts));
    }
  });

  test("schema del batch non conforme", async () => {
    const list = items(1);
    for (const bad of [{ results: [] }, {}, batchOutput(list, (r) => [{ ...r[0], index: 0 }]), batchOutput(list, (r) => [{ ...r[0], index: 1.5 }])]) {
      calls = [];
      await expectError(grader([geminiResponse(bad)]).gradeBatch(list), "GRADER_INVALID_OUTPUT");
      assert.equal(calls.length, 2);
    }
  });

  test("non valido poi valido: 2 chiamate", async () => {
    const list = items(1, 3);
    let result = await grader([geminiResponse("non json"), geminiResponse(batchOutput(list))]).gradeBatch(list);
    assert.equal(result.size, 2);
    assert.equal(calls.length, 2);
    calls = [];
    const missing = batchOutput(list, (r) => [r[0]]);
    result = await grader([geminiResponse(missing), geminiResponse(batchOutput(list))]).gradeBatch(list);
    assert.equal(result.size, 2);
    assert.equal(calls.length, 2);
  });

  test("id lunghissimo rimandato dal modello: accorciato nei log", async () => {
    const list = items(3);
    // il testo riservato sta oltre i primi 40 caratteri: deve sparire col troncamento
    const long = `${"y".repeat(50)} Risposta PRIVATE-3`;
    const out = batchOutput(list, (r) => [{ ...r[0], concepts: [{ id: "c3a", status: "present" }, { id: "c3b", status: "present" }, { id: long, status: "present" }] }]);
    await expectError(grader([geminiResponse(out)]).gradeBatch(list), "GRADER_INVALID_OUTPUT");
    assert.equal(logs.some((l) => l.includes(long)), false);
  });
});

describe("gradeBatch: errori transitori e timeout", () => {
  test("429 con backoff come nel caso singolo", async () => {
    const list = items(1, 2);
    await grader([status(429), geminiResponse(batchOutput(list))]).gradeBatch(list);
    assert.equal(calls.length, 2);
    assert.deepEqual(sleeps, [1000]);
  });

  test("429 sempre: GRADER_UNAVAILABLE dopo maxAttempts", async () => {
    const list = items(1, 2);
    await expectError(grader([status(429)]).gradeBatch(list), "GRADER_UNAVAILABLE");
    assert.equal(calls.length, 4);
    assert.deepEqual(sleeps, [1000, 2000, 4000]);
    calls = [];
    await expectError(grader([status(429)], { maxAttempts: 2 }).gradeBatch(list), "GRADER_UNAVAILABLE");
    assert.equal(calls.length, 2);
  });

  test("timeout per chiamata", async () => {
    const hanging = (url, init) =>
      new Promise((resolve, reject) => {
        init.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
      });
    const start = Date.now();
    await expectError(grader([hanging]).gradeBatch(items(1), { timeoutMs: 50 }), "GRADER_UNAVAILABLE");
    assert.ok(Date.now() - start < 1000);
    assert.equal(calls.length, 1);
  });

  test("il batch ha un timeout di default più lungo del singolo", async () => {
    const list = items(1);
    const result = await grader([status(429), status(429), geminiResponse(batchOutput(list))], { timeoutMs: 1500 }).gradeBatch(list);
    assert.equal(result.size, 1);
    assert.deepEqual(sleeps, [1000, 2000]);
    calls = [];
    const single = { prompt: "p", referenceAnswer: "r", rubric: list[0].rubric, references: [], answer: "a" };
    await expectError(grader([status(429)], { timeoutMs: 1500 }).gradeAnswer(single), "GRADER_UNAVAILABLE");
    assert.equal(calls.length, 2);
  });
});

describe("gradeBatch: input del chiamante", () => {
  test("batch vuoto: nessuna chiamata", async () => {
    const result = await grader([new Error("non doveva chiamare")]).gradeBatch([]);
    assert.ok(result instanceof Map);
    assert.equal(result.size, 0);
    assert.equal(calls.length, 0);
  });

  test("input non valido: errore senza chiamare la rete", async () => {
    const bad = [
      null,
      { index: 1 },
      items(1, 2, 3, 4, 5, 6, 7),
      [batchItem(1), batchItem(1)],
      [{ ...batchItem(1), index: 0 }],
      [{ ...batchItem(1), index: -1 }],
      [{ ...batchItem(1), index: 1.5 }],
      [{ ...batchItem(1), index: "1" }],
      [{ ...batchItem(1), index: undefined }],
    ];
    for (const input of bad) {
      calls = [];
      let caught;
      try {
        await grader([geminiResponse("{}")]).gradeBatch(input);
      } catch (err) {
        caught = err;
      }
      assert.ok(caught, JSON.stringify(input)?.slice(0, 60));
      assert.ok(caught.message.startsWith("gradeBatch:"), caught.message);
      assert.equal(caught.message.startsWith("GRADER_"), false);
      assert.equal(caught.message.includes("PRIVATE"), false);
      assert.equal(calls.length, 0);
    }
  });
});

describe("istanza di default", () => {
  test("gradeBatch esportato e sull'istanza di default", () => {
    assert.equal(typeof graderModule.gradeBatch, "function");
    const serverDir = path.join(__dirname, "..");
    const res = spawnSync(
      process.execPath,
      ["-e", 'const g = require("./services/grader"); if (typeof g.getDefaultGrader().gradeBatch !== "function") process.exit(3);'],
      { cwd: serverDir, env: { PATH: process.env.PATH, GEMINI_API_KEY: "k", GEMINI_MODEL: "m" }, encoding: "utf8" }
    );
    assert.equal(res.status, 0, res.stderr);
  });
});
