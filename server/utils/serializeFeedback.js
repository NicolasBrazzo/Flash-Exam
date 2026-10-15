// Feedback del grader in forma API, solo per le valutazioni AI: niente concetti,
// verdetto interno o punteggi; delle correzioni solo testo scritto, suggerito e motivo
const serializeFeedback = (attempt) => {
  if (attempt.grading_source !== "AI" || !attempt.grading) return null;
  const { corrections, suggestion, exampleAnswer } = attempt.grading;
  return {
    corrections: (corrections ?? []).map(({ written, suggested, reason }) => ({ written, suggested, reason })),
    suggestion: suggestion ?? null,
    exampleAnswer: exampleAnswer ?? null,
  };
};

module.exports = { serializeFeedback };
