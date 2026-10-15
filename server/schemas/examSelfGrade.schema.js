const { z } = require("../config/zod");
const { EXAM_QUESTIONS } = require("../config/exam");
const { VERDICTS } = require("./graderOutput.schema");

// Esito scelto per una domanda della simulazione
const selfGradeItemSchema = z.strictObject({
  position: z
    .int("La posizione deve essere un numero intero")
    .min(1, `La posizione deve essere da 1 a ${EXAM_QUESTIONS}`)
    .max(EXAM_QUESTIONS, `La posizione deve essere da 1 a ${EXAM_QUESTIONS}`),
  verdict: z.enum(VERDICTS, "Il verdetto deve essere correct, partial o wrong"),
});

// Body di POST /exams/:id/self-grade: tutte le posizioni, una volta sola
const examSelfGradeSchema = z.strictObject({
  verdicts: z
    .array(selfGradeItemSchema)
    .length(EXAM_QUESTIONS, `Servono esattamente ${EXAM_QUESTIONS} verdetti, uno per domanda`)
    .superRefine((verdicts, ctx) => {
      const seen = new Set();
      verdicts.forEach((item, i) => {
        if (seen.has(item.position)) {
          ctx.addIssue({ code: "custom", path: [i, "position"], message: `Posizione ${item.position} ripetuta` });
        }
        seen.add(item.position);
      });
    }),
});

module.exports = { examSelfGradeSchema };
