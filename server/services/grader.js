// =============================================================================
// Grader AI: unico modulo che conosce il provider (Gemini, API REST con fetch, D5)
// =============================================================================
// Formato della richiesta e della risposta NON verificato sulla documentazione
// ufficiale (non raggiungibile durante lo sviluppo): va verificato a mano.
//
// Gestione dei fallimenti, per ogni valutazione:
// - una "chiamata logica" fa fino a `maxAttempts` richieste HTTP: 429, 5xx ed
//   errori di rete si riprovano con backoff 1 s, 2 s, 4 s (+ jitter < 250 ms);
//   gli altri 4xx (chiave, modello, formato) non si riprovano;
// - un output non JSON, non conforme allo schema o con id di concetto diversi
//   da quelli della rubrica dà diritto a UNA seconda chiamata logica (con il suo
//   budget di tentativi), poi GRADER_INVALID_OUTPUT;
// - il timeout `timeoutMs` vale per l'intera valutazione: oltre, GRADER_UNAVAILABLE.
// Gli errori lanciati sono solo GRADER_UNAVAILABLE e GRADER_INVALID_OUTPUT, senza
// dettagli. Nei log non finiscono mai chiave, prompt, risposta della studentessa
// o testo del modello.
//
// Valutazione in batch (simulazione): gradeBatch(items) valuta da 1 a
// EXAM_QUESTIONS risposte in UNA chiamata logica, con la stessa gestione dei
// fallimenti e un timeout di default più lungo (batchTimeoutMs). Restituisce una
// Map index -> output (stessa forma di gradeAnswer); batch vuoto -> Map vuota,
// senza chiamare la rete. Un input non valido del chiamante è un errore di
// programmazione ("gradeBatch: ..."), non un GRADER_*.
//
// La risposta vuota non arriva qui: la intercetta il chiamante (D6).
// =============================================================================

const {
  graderOutputSchema,
  graderBatchOutputSchema,
} = require("../schemas/graderOutput.schema");
const { buildSinglePrompt, buildBatchPrompt } = require("./graderPrompt");
const { EXAM_QUESTIONS } = require("../config/exam");
const { formatZodError } = require("../utils/zodError");

const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const BACKOFF_BASE_MS = 1000;
const JITTER_MAX_MS = 250;
const MAX_LOGICAL_CALLS = 2;

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const unavailable = () => new Error("GRADER_UNAVAILABLE");
const invalidOutput = () => new Error("GRADER_INVALID_OUTPUT");

// Output inutilizzabile del modello (interno: decide il secondo giro)
class InvalidOutput extends Error {
  constructor(reasons) {
    super("invalid output");
    this.reasons = reasons;
  }
}

const log = (...parts) => console.error("[grader]", ...parts);

// Id riportati nei motivi (e nei log): testo del modello, quindi accorciato
const shortId = (id) => {
  const text = String(id);
  return text.length > 40 ? `${text.slice(0, 40)}...` : text;
};

// Coerenza degli id dei concetti con la rubrica: nessuno mancante, in più o ripetuto
const conceptIdErrors = (concepts, rubric) => {
  const expected = new Set(rubric.map((item) => item.id));
  const seen = new Set();
  const errors = [];
  for (const concept of concepts) {
    if (seen.has(concept.id)) errors.push(`Concetto "${shortId(concept.id)}" ripetuto`);
    else if (!expected.has(concept.id)) errors.push(`Concetto "${shortId(concept.id)}" non presente nella rubrica`);
    seen.add(concept.id);
  }
  for (const id of expected) {
    if (!seen.has(id)) errors.push(`Concetto "${id}" della rubrica non valutato`);
  }
  return errors;
};

// Output di una valutazione singola -> { ok, data } | { ok: false, reasons }
const validateSingle = (json, rubric) => {
  const parsed = graderOutputSchema.safeParse(json);
  if (!parsed.success) return { ok: false, reasons: formatZodError(parsed.error) };
  const idErrors = conceptIdErrors(parsed.data.concepts, rubric);
  if (idErrors.length > 0) return { ok: false, reasons: idErrors };
  return { ok: true, data: parsed.data };
};

// Output del batch -> { ok, data: Map index -> output } | { ok: false, reasons }
const validateBatch = (json, items) => {
  const parsed = graderBatchOutputSchema.safeParse(json);
  if (!parsed.success) return { ok: false, reasons: formatZodError(parsed.error) };

  const requested = new Set(items.map((item) => item.index));
  const byIndex = new Map();
  const reasons = [];
  for (const result of parsed.data.results) {
    if (byIndex.has(result.index)) reasons.push(`index ${result.index} ripetuto`);
    else if (!requested.has(result.index)) reasons.push(`index ${shortId(result.index)} non richiesto`);
    byIndex.set(result.index, result);
  }
  for (const index of requested) {
    if (!byIndex.has(index)) reasons.push(`index ${index} mancante`);
  }
  if (reasons.length > 0) return { ok: false, reasons };

  for (const item of items) {
    for (const error of conceptIdErrors(byIndex.get(item.index).concepts, item.rubric)) {
      reasons.push(`index ${item.index}: ${error}`);
    }
  }
  if (reasons.length > 0) return { ok: false, reasons };

  // Ordine degli elementi richiesti, senza il campo index
  const data = new Map();
  for (const item of items) {
    const { index, ...output } = byIndex.get(item.index);
    data.set(index, output);
  }
  return { ok: true, data };
};

// Input del batch (errore di programmazione del chiamante, prima di ogni chiamata)
const assertBatchItems = (items) => {
  if (!Array.isArray(items)) throw new Error("gradeBatch: items deve essere un array");
  if (items.length > EXAM_QUESTIONS) {
    throw new Error(`gradeBatch: al massimo ${EXAM_QUESTIONS} elementi`);
  }
  const seen = new Set();
  for (const item of items) {
    const index = item?.index;
    if (!Number.isInteger(index) || index <= 0) {
      throw new Error("gradeBatch: ogni elemento deve avere un index intero positivo");
    }
    if (seen.has(index)) throw new Error(`gradeBatch: index ${index} ripetuto`);
    seen.add(index);
  }
};

// Testo del modello dalla busta della risposta, null se manca
const extractText = (body) => {
  const parts = body?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return null;
  const text = parts.map((part) => (typeof part?.text === "string" ? part.text : "")).join("");
  return text.trim() ? text : null;
};

const createGrader = ({
  apiKey,
  model,
  baseUrl = DEFAULT_BASE_URL,
  fetchImpl = fetch,
  sleep = defaultSleep,
  maxAttempts = 4,
  timeoutMs = 30000,
  batchTimeoutMs = 90000,
  random = Math.random,
} = {}) => {
  if (!apiKey || !model) {
    throw new Error("createGrader: apiKey e model sono obbligatori");
  }

  const url = `${baseUrl}/models/${encodeURIComponent(model)}:generateContent`;

  // Una richiesta HTTP -> { kind: "ok", text } | { kind: "retry" } | { kind: "fatal" }
  const request = async (prompt, signal, attempt) => {
    let res;
    try {
      res = await fetchImpl(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0 },
        }),
        signal,
      });
    } catch (err) {
      if (signal.aborted) {
        log("timeout raggiunto");
        return { kind: "fatal" };
      }
      log(`errore di rete (tentativo ${attempt}):`, err?.name ?? "Error", err?.code ?? "");
      return { kind: "retry" };
    }

    if (!res.ok) {
      // Il body degli errori non serve: si libera la connessione
      res.body?.cancel?.().catch(() => {});
      if (res.status === 429 || res.status >= 500) {
        log(`HTTP ${res.status} (tentativo ${attempt})`);
        return { kind: "retry" };
      }
      log(`HTTP ${res.status}: nessun nuovo tentativo`);
      return { kind: "fatal" };
    }

    let body;
    try {
      body = await res.json();
    } catch {
      if (signal.aborted) return { kind: "fatal" };
      throw new InvalidOutput(["busta della risposta non JSON"]);
    }
    const text = extractText(body);
    if (text === null) throw new InvalidOutput(["risposta senza candidates o senza testo"]);
    return { kind: "ok", text };
  };

  // Una chiamata logica: fino a maxAttempts richieste, con backoff sui transitori
  const callModel = async (prompt, signal, deadline) => {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const outcome = await request(prompt, signal, attempt);
      if (outcome.kind === "ok") return outcome.text;
      if (outcome.kind === "fatal" || attempt === maxAttempts) throw unavailable();

      const wait = BACKOFF_BASE_MS * 2 ** (attempt - 1) + Math.floor(random() * JITTER_MAX_MS);
      if (Date.now() + wait >= deadline) {
        log("timeout raggiunto durante il backoff");
        throw unavailable();
      }
      await sleep(wait);
      if (signal.aborted) throw unavailable();
    }
    throw unavailable();
  };

  // Valutazione completa: al massimo due chiamate logiche entro il timeout.
  // `validate(json)` -> { ok, data } | { ok: false, reasons } (riusato dal batch)
  const runGrading = async (prompt, validate, limitMs) => {
    const controller = new AbortController();
    const deadline = Date.now() + limitMs;
    const timer = setTimeout(() => controller.abort(), limitMs);
    try {
      for (let round = 1; round <= MAX_LOGICAL_CALLS; round += 1) {
        try {
          const text = await callModel(prompt, controller.signal, deadline);
          let json;
          try {
            json = JSON.parse(text);
          } catch {
            throw new InvalidOutput(["output non JSON"]);
          }
          const result = validate(json);
          if (result.ok) return result.data;
          throw new InvalidOutput(result.reasons);
        } catch (err) {
          if (!(err instanceof InvalidOutput)) throw err;
          log(`output non valido (giro ${round}):`, err.reasons.join("; "));
        }
      }
      throw invalidOutput();
    } finally {
      clearTimeout(timer);
    }
  };

  // Valutazione di una risposta: { prompt, referenceAnswer, rubric, references, answer }
  const gradeAnswer = (item) =>
    runGrading(buildSinglePrompt(item), (json) => validateSingle(json, item.rubric), timeoutMs);

  // Valutazione di più risposte in una chiamata: items [{ index, ...come gradeAnswer }]
  const gradeBatch = async (items, { timeoutMs: limitMs } = {}) => {
    assertBatchItems(items);
    if (items.length === 0) return new Map();
    return runGrading(
      buildBatchPrompt(items),
      (json) => validateBatch(json, items),
      limitMs ?? batchTimeoutMs
    );
  };

  return { gradeAnswer, gradeBatch };
};

// Istanza di default, creata alla prima chiamata da config/gemini.js (che lancia
// se manca la configurazione): così caricare questo modulo non richiede le variabili
let defaultGrader = null;
const getDefaultGrader = () => {
  if (!defaultGrader) {
    const { GEMINI_API_KEY, GEMINI_MODEL, GEMINI_BASE_URL } = require("../config/gemini");
    defaultGrader = createGrader({ apiKey: GEMINI_API_KEY, model: GEMINI_MODEL, baseUrl: GEMINI_BASE_URL });
  }
  return defaultGrader;
};

const gradeAnswer = (item) => getDefaultGrader().gradeAnswer(item);
const gradeBatch = (items, options) => getDefaultGrader().gradeBatch(items, options);

module.exports = {
  createGrader,
  getDefaultGrader,
  gradeAnswer,
  gradeBatch,
  conceptIdErrors,
};
