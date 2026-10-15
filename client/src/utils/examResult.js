// Pagina del risultato della simulazione (funzioni pure, verificate dai check)

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
