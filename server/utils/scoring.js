// =============================================================================
// Punteggio di una risposta e voto della simulazione (funzioni pure)
// =============================================================================
// Sono gli unici numeri che determinano il voto (decisioni D1, D2, D6 di TODO.md).
//
// Punteggio interno di una risposta (0-1), D2:
//   - ogni concetto della rubrica vale present = 1, partial = 0,5, absent = 0;
//   - base = media pesata con i pesi della rubrica;
//   - penalità = 0,1 per ogni correzione terminologica, al massimo 0,3;
//   - punteggio = base - penalità, minimo 0, arrotondato a 3 decimali
//     (colonna FE_Attempts.score numeric(4,3)).
//   Un concetto della rubrica senza valutazione conta come absent (un dato
//   mancante non alza mai il voto); i concetti con id fuori rubrica si ignorano.
//
// Punti della domanda (0-5) = punteggio x 5, arrotondato a 2 decimali.
//
// Voto della simulazione (0-30) = somma dei punti delle domande arrotondata
// all'intero più vicino, con il .5 arrotondato per DIFETTO (29,5 -> 29):
// altrimenti cinque risposte perfette e una con una correzione (5 x 5 + 4,5)
// varrebbero 30 e la penalità terminologica sparirebbe dal voto.
//
// Lode, D1: voto 30, tutte le risposte valutate dall'AI (in autovalutazione la
// lode non c'è), tutti i verdetti "correct" e nessuna correzione terminologica.
//
// Risposta vuota, D6: non va all'AI; "wrong" d'ufficio in autovalutazione.
//
// I calcoli usano interi (mezzi punti, millesimi, centesimi) per evitare gli
// errori di arrotondamento dei numeri in virgola mobile. Nessuna funzione
// restituisce o formatta percentuali.
// =============================================================================

// Valore dei verdetti in autovalutazione
const VERDICT_SCORES = { correct: 1, partial: 0.5, wrong: 0 };
// Stati dei concetti in mezzi punti (present = 1, partial = 0,5, absent = 0)
const STATUS_HALVES = { present: 2, partial: 1, absent: 0 };
const MAX_CORRECTIONS_PENALIZED = 3;
const MAX_POINTS = 5;
const MAX_GRADE = 30;

const invalid = (code) => {
  throw new Error(code);
};

// Punteggio interno 0-1 di una risposta valutata dall'AI
const computeScore = ({ rubric, concepts, corrections }) => {
  if (!Array.isArray(rubric) || rubric.length === 0) invalid("SCORING_INVALID_INPUT");
  if (!Array.isArray(concepts)) invalid("SCORING_INVALID_INPUT");
  const correctionList = corrections ?? [];
  if (!Array.isArray(correctionList)) invalid("SCORING_INVALID_INPUT");

  const statusById = new Map();
  for (const concept of concepts) {
    if (!Object.hasOwn(STATUS_HALVES, concept?.status)) invalid("SCORING_INVALID_INPUT");
    if (statusById.has(concept.id)) invalid("SCORING_INVALID_INPUT");
    statusById.set(concept.id, concept.status);
  }

  let num = 0;
  let totalWeight = 0;
  for (const item of rubric) {
    if (!Number.isFinite(item?.weight) || item.weight <= 0) invalid("SCORING_INVALID_INPUT");
    num += item.weight * STATUS_HALVES[statusById.get(item.id) ?? "absent"];
    totalWeight += item.weight;
  }
  const den = 2 * totalWeight;
  const penalized = Math.min(correctionList.length, MAX_CORRECTIONS_PENALIZED);

  // (num / den) - 0,1 x penalized, con un solo passaggio in virgola mobile
  const raw = (num * 10 - penalized * den) / (den * 10);
  return Math.max(0, Math.round(raw * 1000) / 1000);
};

// Punti 0-5 (2 decimali) da un punteggio interno 0-1: millesimi di punteggio
// x 5 / 10 = centesimi di punto, quindi i punti si ricavano sempre dallo score salvato
const computePoints = (score) => {
  if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 1) {
    invalid("SCORING_INVALID_SCORE");
  }
  return Math.round(Math.round(score * 1000) / 2) / 100;
};

// Punteggio interno di una risposta autovalutata
const selfGradeScore = (verdict) => {
  if (!Object.hasOwn(VERDICT_SCORES, verdict)) invalid("SCORING_INVALID_VERDICT");
  return VERDICT_SCORES[verdict];
};

// Esito d'ufficio di una risposta vuota (D6); graded_at lo imposta il chiamante
const emptyAnswerResult = () => ({
  verdict: "wrong",
  score: 0,
  points: 0,
  grading_source: "SELF",
  grading: null,
});

// Voto della simulazione e lode a partire dai tentativi valutati
// (attempts: [{ verdict, points, grading_source, grading }])
const computeExamGrade = (attempts) => {
  if (!Array.isArray(attempts) || attempts.length === 0) invalid("SCORING_INVALID_ATTEMPTS");

  let cents = 0;
  for (const attempt of attempts) {
    const points = attempt?.points;
    if (typeof points !== "number" || !Number.isFinite(points) || points < 0 || points > MAX_POINTS) {
      invalid("SCORING_INVALID_ATTEMPTS");
    }
    cents += Math.round(points * 100);
  }

  // Intero più vicino, con il .5 per difetto
  const grade = Math.min(MAX_GRADE, Math.max(0, Math.floor((cents + 49) / 100)));

  const honors =
    grade === MAX_GRADE &&
    attempts.every(
      (attempt) =>
        attempt.grading_source === "AI" &&
        attempt.verdict === "correct" &&
        Array.isArray(attempt.grading?.corrections) &&
        attempt.grading.corrections.length === 0
    );

  return { grade, honors };
};

module.exports = {
  computeScore,
  computePoints,
  selfGradeScore,
  emptyAnswerResult,
  computeExamGrade,
};
