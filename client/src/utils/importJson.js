// Funzioni pure della pagina Import (pages/Import.jsx). Nessun import con
// alias: le verifica scripts/checks/importJson.check.mjs.

// File più grandi non si leggono nemmeno (la textarea diventerebbe lenta su iPad)
export const MAX_FILE_BYTES = 1024 * 1024;
export const MAX_TEXT_CHARS = 1000000;
// Limite di default di express.json() sul server: oltre, la richiesta fallirebbe
export const MAX_BODY_BYTES = 100 * 1024;

const kB = (bytes) => Math.ceil(bytes / 1024);

// Riga e colonna (da 1) di una posizione nel testo
const lineAndColumn = (text, position) => {
  const before = text.slice(0, position);
  const lines = before.split("\n");
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
};

// Messaggio di JSON.parse (diverso per ogni browser) -> errore in italiano
export const describeJsonError = (message, text) => {
  const base = "JSON non valido: controlla virgole, virgolette e parentesi";

  const position = /position (\d+)/.exec(message);
  if (position) {
    const { line, column } = lineAndColumn(text, Number(position[1]));
    return `${base} (riga ${line}, colonna ${column})`;
  }

  const lineColumn = /line (\d+) column (\d+)/.exec(message);
  if (lineColumn) return `${base} (riga ${lineColumn[1]}, colonna ${lineColumn[2]})`;

  return base;
};

// Testo incollato o letto dal file -> { ok: true, data } | { ok: false, error }.
// Controlla solo la sintassi e la dimensione: lo schema lo valida il server.
export const parseImportText = (text) => {
  const clean = text.replace(/^\uFEFF/, "").trim();

  if (!clean) return { ok: false, error: "Il JSON è vuoto: incollalo o seleziona un file" };

  if (clean.length > MAX_TEXT_CHARS) {
    return { ok: false, error: "Il JSON è troppo grande: dividi l'argomento in più file" };
  }

  let data;
  try {
    data = JSON.parse(clean);
  } catch (err) {
    return { ok: false, error: describeJsonError(err.message, clean) };
  }

  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, error: 'Il JSON deve essere un oggetto con "topic" e "questions"' };
  }

  // Dimensione del body che parte davvero (JSON compatto, byte UTF-8)
  const bytes = new TextEncoder().encode(JSON.stringify(data)).length;
  if (bytes > MAX_BODY_BYTES) {
    return {
      ok: false,
      error: `Il JSON è troppo grande (${kB(bytes)} kB, massimo ${kB(MAX_BODY_BYTES)} kB): dividi l'argomento in più file`,
    };
  }

  return { ok: true, data };
};

// Risposta 201 dell'import -> dati del riepilogo
export const summarizeImport = ({ topic, inserted, skipped }) => ({
  topicName: topic.name,
  topicStatus: topic.created ? "creato" : "già esistente",
  inserted,
  skipped,
});
