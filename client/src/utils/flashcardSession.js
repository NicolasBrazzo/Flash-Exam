// Funzioni pure della pagina Flashcard (pages/Flashcard.jsx) e del blocco di
// feedback. Nessun import con alias: le verifica scripts/checks/flashcardSession.check.mjs.

export const DEFAULT_COUNT = 10;
export const MIN_COUNT = 1;
export const MAX_COUNT = 50;
// Stesso limite del server (schemas/examDraft.schema.js)
export const MAX_ANSWER_LENGTH = 5000;

const COUNT_ERROR = `Il numero di domande deve essere un intero tra ${MIN_COUNT} e ${MAX_COUNT}`;

// Numero di domande scritto nel campo -> { value, error }
export const parseCount = (raw) => {
  const text = raw === null || raw === undefined ? "" : String(raw).trim();
  if (!/^\d+$/.test(text)) return { value: null, error: COUNT_ERROR };
  const value = Number(text);
  if (value < MIN_COUNT || value > MAX_COUNT) return { value: null, error: COUNT_ERROR };
  return { value, error: null };
};

// Aggiunge o toglie un argomento dalla selezione (nuovo array)
export const toggleTopic = (selected, id) =>
  selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id];

export const selectAll = (topics) => topics.map((topic) => topic.id);

export const canStart = (selected, countRaw) => selected.length > 0 && parseCount(countRaw).error === null;

const VERDICTS = {
  correct: { label: "Risposta corretta", icon: "CircleCheck", tone: "success" },
  partial: { label: "Risposta parzialmente corretta", icon: "CircleAlert", tone: "warning" },
  wrong: { label: "Risposta errata", icon: "CircleX", tone: "destructive" },
};

// Etichetta, icona (nome Lucide) e tono dell'esito; null se non c'è un esito
export const verdictInfo = (verdict) => (Object.hasOwn(VERDICTS, verdict ?? "") ? VERDICTS[verdict] : null);

export const sessionCounter = (index, total) => `Domanda ${index + 1} di ${total}`;

export const isLastQuestion = (index, total) => index === total - 1;

// C'è qualcosa da mostrare oltre all'esito?
export const hasFeedbackContent = (feedback) =>
  Boolean(
    feedback &&
      ((feedback.corrections?.length ?? 0) > 0 ||
        (feedback.suggestion ?? "").trim() ||
        (feedback.exampleAnswer ?? "").trim())
  );
