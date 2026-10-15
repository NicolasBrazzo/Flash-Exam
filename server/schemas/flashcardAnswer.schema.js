const { z } = require("../config/zod");
const { examAnswerSchema } = require("./examDraft.schema");

// Body di POST /flashcards/answer: la risposta si salva com'è, anche vuota (D6)
const flashcardAnswerSchema = z.strictObject({
  question_id: z.guid("Id domanda non valido"),
  answer: examAnswerSchema,
});

module.exports = { flashcardAnswerSchema };
