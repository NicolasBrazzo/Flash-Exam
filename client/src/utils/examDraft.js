// Funzioni pure del salvataggio in bozza della simulazione (pages/Simulazione.jsx).
// Nessun import con alias: le verifica scripts/checks/examDraft.check.mjs.

export const DRAFT_DEBOUNCE_MS = 800;
// Stesso limite del server (schemas/examDraft.schema.js)
export const MAX_ANSWER_LENGTH = 5000;
export const EXAM_SIZE = 6;

const POSITIONS = Array.from({ length: EXAM_SIZE }, (_, i) => i + 1);

// Risposte della prova per posizione: { 1: "...", ..., 6: "..." }
export const answersFromExam = (exam) => {
  const answers = Object.fromEntries(POSITIONS.map((p) => [p, ""]));
  for (const question of exam.questions) answers[question.position] = question.answer ?? "";
  return answers;
};

// Indice da 0 -> "Domanda 2 di 6"
export const questionCounter = (index, total) => `Domanda ${index + 1} di ${total}`;

// Va salvata se è cambiata rispetto all'ultimo salvataggio e non è già in volo
export const needsSave = (current, saved, inFlight) => current !== saved && current !== inFlight;

// Posizioni con testo diverso dall'ultimo salvato, in ordine
export const dirtyPositions = (answers, saved) =>
  Object.keys(answers)
    .map(Number)
    .filter((p) => answers[p] !== saved[p])
    .sort((a, b) => a - b);

// Attesa prima del nuovo tentativo n (da 1): 2 s, 4 s, 8 s, poi 15 s
export const retryDelay = (attempt) => (attempt <= 3 ? 1000 * 2 ** attempt : 15000);

// 409: la prova non accetta più risposte (consegnata o scaduta)
export const isClosedError = (err) => err?.status === 409;

const STATUS_TEXTS = {
  idle: "",
  saving: "Salvataggio in corso",
  saved: "Salvato",
  error: "Salvataggio non riuscito, riprovo",
};

export const saveStatusText = (status, closedMessage) =>
  status === "closed"
    ? closedMessage || "La prova non accetta più modifiche"
    : (STATUS_TEXTS[status] ?? "");

// Stato complessivo dell'indicatore, su tutte le posizioni
export const aggregateSaveStatus = ({ inFlightCount, failedCount, dirtyCount, closed, everSaved }) => {
  if (closed) return "closed";
  if (failedCount > 0) return "error";
  if (inFlightCount > 0 || dirtyCount > 0) return "saving";
  return everSaved ? "saved" : "idle";
};

// Body della consegna (PROVA-7): [{ position, answer }] da 1 a 6
export const buildSubmitAnswers = (answers) =>
  POSITIONS.map((position) => ({ position, answer: answers[position] ?? "" }));
