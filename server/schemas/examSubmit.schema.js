const { z } = require("../config/zod");
const { EXAM_QUESTIONS } = require("../config/exam");
const { examAnswerSchema } = require("./examDraft.schema");

// Ultima risposta a una domanda, inviata con la consegna
const submittedAnswerSchema = z.strictObject({
  position: z
    .int("La posizione deve essere un numero intero")
    .min(1, `La posizione deve essere da 1 a ${EXAM_QUESTIONS}`)
    .max(EXAM_QUESTIONS, `La posizione deve essere da 1 a ${EXAM_QUESTIONS}`),
  answer: examAnswerSchema,
});

// Body di POST /exams/:id/submit: le risposte non ancora salvate in bozza (opzionali)
const examSubmitSchema = z.strictObject({
  answers: z
    .array(submittedAnswerSchema)
    .max(EXAM_QUESTIONS, `Al massimo ${EXAM_QUESTIONS} risposte`)
    .superRefine((answers, ctx) => {
      const seen = new Set();
      answers.forEach((item, i) => {
        if (seen.has(item.position)) {
          ctx.addIssue({ code: "custom", path: [i, "position"], message: `Posizione ${item.position} ripetuta` });
        }
        seen.add(item.position);
      });
    })
    .optional(),
});

module.exports = { examSubmitSchema };
