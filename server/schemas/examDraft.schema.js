const { z } = require("../config/zod");

// Risposta a una domanda della simulazione: si salva com'è (niente trim),
// anche vuota. Riusata dalla consegna (PROVA-3)
const examAnswerSchema = z
  .string()
  .max(5000, "La risposta può contenere al massimo 5000 caratteri");

// Body di PUT /exams/:id/answers/:position
const examDraftSchema = z.strictObject({
  answer: examAnswerSchema,
});

module.exports = { examAnswerSchema, examDraftSchema };
