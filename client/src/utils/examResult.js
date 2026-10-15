// Pagina del risultato della simulazione (funzioni pure, verificate dai check)
import { SELF_GRADE_OPTIONS } from "./flashcardSession.js";

export const AUTO_SUBMITTED_TEXT = "Consegnata automaticamente allo scadere del tempo";
export const PENDING_TEXT = "La prova è stata consegnata, ma la valutazione non è ancora disponibile.";
export const NO_ANSWER_TEXT = "Nessuna risposta";

const MAX_GRADE = 30;

const isValidGrade = (grade) => Number.isInteger(grade) && grade >= 0 && grade <= MAX_GRADE;

// "27/30"; "30/30 con lode" solo con il 30 (D1); stringa vuota se il voto non è valido
export const formatGrade = (grade, honors) => {
  if (!isValidGrade(grade)) return "";
  const base = `${grade}/${MAX_GRADE}`;
  return honors === true && grade === MAX_GRADE ? `${base} con lode` : base;
};

export const isEmptyAnswer = (answer) => typeof answer !== "string" || answer.trim() === "";

// Risposta da mostrare nella revisione, così com'è; "Nessuna risposta" se vuota
export const answerText = (answer) => (isEmptyAnswer(answer) ? NO_ANSWER_TEXT : answer);

// Cosa mostra la pagina: la prova (in corso), voto e revisione, oppure l'attesa
// della valutazione (GRADING o autovalutazione non ancora fatta, PROVA-9)
export const resultView = (exam) => {
  if (exam?.status === "IN_PROGRESS") return "in_progress";
  const graded = exam?.status === "GRADED" || exam?.status === "SELF_GRADED";
  return graded && isValidGrade(exam.grade) ? "graded" : "pending";
};

// Copia ordinata per posizione (l'input non viene modificato)
export const sortByPosition = (questions) =>
  Array.isArray(questions) ? [...questions].sort((a, b) => a.position - b.position) : [];

// --- Fallback (PROVA-9): autovalutazione e nuovo tentativo di valutazione ---

export const SELF_GRADE_EMPTY_NOTE = "Nessuna risposta: conta come errata";

const EXAM_POSITIONS = [1, 2, 3, 4, 5, 6];
const VERDICT_VALUES = SELF_GRADE_OPTIONS.map((o) => o.verdict);

// Quale attesa: autovalutazione da fare, valutazione ancora in corso, altro
export const pendingKind = (exam) => {
  if (exam?.status === "SELF_GRADED" && !isValidGrade(exam.grade)) return "self_grade";
  if (exam?.status === "GRADING") return "grading";
  return "unknown";
};

// Le risposte vuote partono già come errate (il server le tratta così, D6)
export const initialSelfGradeChoices = (questions) =>
  Array.isArray(questions)
    ? Object.fromEntries(questions.filter((q) => isEmptyAnswer(q.answer)).map((q) => [q.position, "wrong"]))
    : {};

// Nuova scelta per una posizione (copia); valori non validi ignorati
export const setSelfGradeChoice = (choices, position, verdict) => {
  if (!EXAM_POSITIONS.includes(Number(position)) || !VERDICT_VALUES.includes(verdict)) return choices;
  return { ...choices, [position]: verdict };
};

// Invio possibile solo con le 6 posizioni, ognuna con un verdetto valido
export const canSubmitSelfGrade = (choices) => {
  const keys = Object.keys(choices ?? {}).map(Number).sort((a, b) => a - b);
  return (
    keys.length === EXAM_POSITIONS.length &&
    keys.every((k, i) => k === EXAM_POSITIONS[i]) &&
    keys.every((k) => VERDICT_VALUES.includes(choices[k]))
  );
};

// Body di POST /exams/:id/self-grade: [{ position, verdict }] in ordine
export const buildSelfGradeVerdicts = (choices) =>
  Object.keys(choices)
    .map(Number)
    .sort((a, b) => a - b)
    .map((position) => ({ position, verdict: choices[position] }));

// Messaggio se il nuovo tentativo di valutazione non riesce
export const regradeErrorText = (error, status) => {
  if (error?.status === 502) {
    return status === "SELF_GRADED"
      ? "Valutazione AI non disponibile: riprova più tardi oppure autovaluta la prova."
      : "Valutazione AI non disponibile: riprova più tardi.";
  }
  if (error?.status === 409) return error.message || "Valutazione già in corso: riprova tra qualche minuto";
  return error?.message || "Errore nella valutazione della simulazione";
};

// Messaggio se l'autovalutazione non riesce
export const selfGradeErrorText = (error) => {
  if (error?.status === 409) {
    const message = (error.message || "Simulazione già valutata").replace(/\.?$/, ".");
    return `${message} Aggiorna la pagina per vedere il risultato.`;
  }
  return error?.message || "Errore nell'autovalutazione";
};
