const { z } = require("../config/zod");

// Numero di articolo del codice civile, con l'eventuale suffisso: "1", "2043", "42-bis"
const ARTICLE_REGEX = /^\d+(-[a-z]+)?$/;

// Testo obbligatorio: spazi iniziali e finali rimossi, poi non vuoto
const requiredText = (message) => z.string().trim().min(1, message);

// Un concetto della rubrica
const rubricItemSchema = z.strictObject({
  id: requiredText("L'id del concetto non può essere vuoto"),
  concept: requiredText("Il concetto non può essere vuoto"),
  weight: z.int().positive("Il peso deve essere un numero intero positivo"),
});

// Rubrica: 2-4 concetti con id univoci. Riusata dalla modifica di una domanda
const rubricSchema = z
  .array(rubricItemSchema)
  .min(2, "La rubrica deve avere almeno 2 concetti")
  .max(4, "La rubrica può avere al massimo 4 concetti")
  .superRefine((rubric, ctx) => {
    const seen = new Set();
    rubric.forEach((item, i) => {
      if (seen.has(item.id)) {
        ctx.addIssue({
          code: "custom",
          message: `Id "${item.id}" ripetuto nella rubrica`,
          path: [i, "id"],
        });
      }
      seen.add(item.id);
    });
  });

// Riferimenti normativi: numeri di articolo, anche nessuno
const referencesSchema = z.array(
  z
    .string()
    .trim()
    .regex(ARTICLE_REGEX, 'Numero di articolo non valido (es. "1" o "42-bis")')
);

// Una domanda, con gli stessi nomi di campo del JSON di import
const questionSchema = z.strictObject({
  prompt: requiredText("La domanda non può essere vuota"),
  answer: requiredText("La risposta di riferimento non può essere vuota"),
  rubric: rubricSchema,
  references: referencesSchema.default([]),
});

// JSON di import: un file per argomento (formato in docs/PROGETTO.md)
const questionsImportSchema = z.strictObject({
  topic: z.strictObject({
    name: requiredText("Il nome dell'argomento non può essere vuoto"),
  }),
  questions: z.array(questionSchema).min(1, "Il file non contiene domande"),
});

module.exports = {
  requiredText,
  rubricSchema,
  referencesSchema,
  questionsImportSchema,
};
