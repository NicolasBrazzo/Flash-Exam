// Tentativo di flashcard in forma API (ENDPOINTS.md, sezione Flashcards).
// Whitelist esplicita: mai score, points, concepts, rubric, grading o la risposta
const { serializeFeedback } = require("./serializeFeedback");

const serializeAttempt = (attempt, question = attempt.question) => ({
  id: attempt.id,
  verdict: attempt.verdict ?? null,
  grading_source: attempt.grading_source ?? null,
  feedback: serializeFeedback(attempt),
  reference_answer: question?.answer ?? null,
  references: question?.article_refs ?? [],
});

module.exports = { serializeAttempt };
