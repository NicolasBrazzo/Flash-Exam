// Simulazione in forma API (ENDPOINTS.md, sezione Exams). Whitelist esplicita:
// mai score, points, rubric o concepts. Durante la prova escono solo testo,
// argomento e bozza; la revisione arriva solo dopo la consegna.

const SUBMITTED_STATUSES = ["GRADING", "GRADED", "SELF_GRADED"];

// Feedback del grader, solo per le valutazioni AI
const serializeFeedback = (attempt) => {
  if (attempt.grading_source !== "AI" || !attempt.grading) return null;
  const { corrections, suggestion, exampleAnswer } = attempt.grading;
  return {
    corrections: (corrections ?? []).map(({ written, suggested, reason }) => ({ written, suggested, reason })),
    suggestion: suggestion ?? null,
    exampleAnswer: exampleAnswer ?? null,
  };
};

const serializeExamQuestion = (attempt, submitted) => {
  const question = attempt.question ?? {};
  const base = {
    position: attempt.position,
    prompt: question.prompt,
    topic: question.topic ? { id: question.topic.id, name: question.topic.name } : null,
    answer: attempt.answer ?? "",
  };
  if (!submitted) return base;

  return {
    ...base,
    reference_answer: question.answer,
    references: question.article_refs ?? [],
    verdict: attempt.verdict ?? null,
    grading_source: attempt.grading_source ?? null,
    feedback: serializeFeedback(attempt),
  };
};

// session: riga di FE_ExamSessions; attempts: righe di FE_Attempts con la domanda.
// Uno stato sconosciuto si tratta come prova in corso (nel dubbio si nasconde)
const serializeExam = (session, attempts) => {
  const submitted = SUBMITTED_STATUSES.includes(session.status);
  return {
    id: session.id,
    status: session.status,
    started_at: session.started_at,
    expires_at: session.expires_at,
    submitted_at: session.submitted_at ?? null,
    auto_submitted: Boolean(session.auto_submitted),
    grade: session.grade ?? null,
    honors: Boolean(session.honors),
    questions: [...attempts]
      .sort((a, b) => a.position - b.position)
      .map((attempt) => serializeExamQuestion(attempt, submitted)),
  };
};

module.exports = { serializeExam };
