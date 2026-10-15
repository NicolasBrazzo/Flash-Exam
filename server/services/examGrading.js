// =============================================================================
// Consegna e valutazione della simulazione (PROVA-3, riusato da PROVA-4)
// =============================================================================
// submitExam: transizione atomica IN_PROGRESS -> GRADING, salvataggio delle
// ultime risposte (solo entro la tolleranza) e valutazione.
// gradeExam: valuta le risposte salvate con UNA sola chiamata batch al grader
// (le vuote non vanno all'AI: wrong d'ufficio, D6), poi voto e lode.
// Se il grader non risponde la prova passa a SELF_GRADED e non si perde.
// I pezzi puri sono esportati per i test.
// =============================================================================

const { findExamSessionById, updateExamSession } = require("../models/examSession.model");
const { getAttemptsBySession, updateAttempt } = require("../models/attempt.model");
const grader = require("./grader");
const { EXAM_QUESTIONS } = require("../config/exam");
const { isWithinDeadline } = require("../utils/examTime");
const { computeScore, computePoints, emptyAnswerResult, computeExamGrade } = require("../utils/scoring");

// Errori del grader dopo i retry: la prova va in autovalutazione
const GRADER_ERRORS = ["GRADER_UNAVAILABLE", "GRADER_INVALID_OUTPUT"];

const isEmptyAnswer = (answer) => (answer ?? "").trim() === "";

// Consegna dopo expires_at (anche entro la tolleranza): decisa dal server
const isAutoSubmitted = (session, now) => now.getTime() > Date.parse(session.expires_at);

// Ultime risposte inviate con la consegna, applicate solo se accettate.
// Restituisce i tentativi aggiornati (copie) e le sole risposte cambiate
const applySubmittedAnswers = (attempts, answers, accepted) => {
  const byPosition = new Map(accepted && Array.isArray(answers) ? answers.map((a) => [a.position, a.answer]) : []);
  const changes = [];
  const merged = attempts.map((attempt) => {
    if (!byPosition.has(attempt.position)) return attempt;
    const answer = byPosition.get(attempt.position);
    if (answer === attempt.answer) return attempt;
    changes.push({ id: attempt.id, answer });
    return { ...attempt, answer };
  });
  return { attempts: merged, changes };
};

// Risposte da mandare al grader (index = position) e posizioni vuote
const selectAnswersToGrade = (attempts) => {
  const items = [];
  const emptyPositions = [];
  for (const attempt of attempts) {
    if (isEmptyAnswer(attempt.answer)) {
      emptyPositions.push(attempt.position);
      continue;
    }
    const question = attempt.question ?? {};
    items.push({
      index: attempt.position,
      prompt: question.prompt,
      referenceAnswer: question.answer,
      rubric: question.rubric,
      references: question.article_refs ?? [],
      answer: attempt.answer,
    });
  }
  return { items, emptyPositions };
};

// Campi di valutazione di ogni tentativo, tutti insieme (CHECK dello schema)
const buildGradedFields = (attempts, results, gradedAt) =>
  attempts.map((attempt) => {
    if (isEmptyAnswer(attempt.answer)) {
      return { id: attempt.id, position: attempt.position, fields: { ...emptyAnswerResult(), graded_at: gradedAt } };
    }
    const output = results.get(attempt.position);
    if (!output) throw new Error("EXAM_GRADING_MISSING_RESULT");
    const score = computeScore({
      rubric: attempt.question?.rubric,
      concepts: output.concepts,
      corrections: output.corrections,
    });
    return {
      id: attempt.id,
      position: attempt.position,
      fields: {
        verdict: output.verdict,
        grading: output,
        grading_source: "AI",
        score,
        points: computePoints(score),
        graded_at: gradedAt,
      },
    };
  });

// Voto e lode della prova a partire dalle 6 valutazioni
const assembleExamResult = (graded) => {
  if (!Array.isArray(graded) || graded.length !== EXAM_QUESTIONS) throw new Error("EXAM_INVALID_ATTEMPTS");
  return computeExamGrade(graded.map((g) => g.fields));
};

// Una prova si valuta se è in GRADING o in autovalutazione senza voto (PROVA-4)
const isGradable = (session) =>
  session.status === "GRADING" || (session.status === "SELF_GRADED" && session.grade == null);

// Valuta le risposte salvate. Tutto si calcola in memoria prima di scrivere:
// un errore del grader non lascia valutazioni a metà
const gradeExam = async (id, { now = new Date() } = {}) => {
  const session = await findExamSessionById(id);
  if (!session) throw new Error("EXAM_NOT_FOUND");
  if (!isGradable(session)) throw new Error("EXAM_NOT_GRADABLE");

  const attempts = await getAttemptsBySession(session.id);
  const { items } = selectAnswersToGrade(attempts);
  const results = items.length > 0 ? await grader.gradeBatch(items) : new Map();

  const graded = buildGradedFields(attempts, results, now.toISOString());
  const { grade, honors } = assembleExamResult(graded);

  const updatedAttempts = [];
  for (const { id: attemptId, fields } of graded) {
    const row = await updateAttempt(attemptId, fields);
    if (!row) throw new Error("EXAM_INVALID_ATTEMPTS");
    updatedAttempts.push(row);
  }

  const updated = await updateExamSession(session.id, { status: "GRADED", grade, honors }, { expectedStatus: session.status });
  if (!updated) throw new Error("EXAM_ALREADY_SUBMITTED");

  return { session: updated, attempts: updatedAttempts };
};

// Consegna: blocca la prova, salva le ultime risposte e la fa valutare
const submitExam = async (id, { answers, now = new Date() } = {}) => {
  const session = await findExamSessionById(id);
  if (!session) throw new Error("EXAM_NOT_FOUND");
  if (session.status !== "IN_PROGRESS") throw new Error("EXAM_ALREADY_SUBMITTED");

  const accepted = isWithinDeadline(session, now);

  // Prima la transizione: da qui la prova non accetta altre bozze né consegne
  const locked = await updateExamSession(
    session.id,
    { status: "GRADING", submitted_at: now.toISOString(), auto_submitted: isAutoSubmitted(session, now) },
    { expectedStatus: "IN_PROGRESS" }
  );
  if (!locked) throw new Error("EXAM_ALREADY_SUBMITTED");

  const { changes } = applySubmittedAnswers(await getAttemptsBySession(session.id), answers, accepted);
  for (const change of changes) {
    await updateAttempt(change.id, { answer: change.answer });
  }

  try {
    return await gradeExam(session.id, { now });
  } catch (err) {
    if (!GRADER_ERRORS.includes(err.message)) throw err;

    // Solo il codice: il testo delle risposte non finisce nei log
    console.error("EXAM GRADING FALLBACK:", err.message);
    const selfGraded = await updateExamSession(session.id, { status: "SELF_GRADED" }, { expectedStatus: "GRADING" });
    if (!selfGraded) throw new Error("EXAM_ALREADY_SUBMITTED");
    return { session: selfGraded, attempts: await getAttemptsBySession(session.id) };
  }
};

module.exports = {
  submitExam,
  gradeExam,
  isAutoSubmitted,
  applySubmittedAnswers,
  selectAnswersToGrade,
  buildGradedFields,
  assembleExamResult,
};
