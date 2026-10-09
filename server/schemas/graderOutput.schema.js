const { z } = require("../config/zod");

// Output del grader AI (services/grader.js). Viene da un LLM, non dall'utente:
// i campi in più (punteggi, percentuali, confidenze) si scartano invece di
// rifiutare l'intera risposta, quindi z.object e non strictObject.
// La coerenza degli id con la rubrica e degli index del batch la verifica il grader.

const VERDICTS = ["correct", "partial", "wrong"];
const CONCEPT_STATUSES = ["present", "partial", "absent"];

const requiredText = (message) => z.string().trim().min(1, message);

const conceptSchema = z.object({
  id: requiredText("L'id del concetto non può essere vuoto"),
  status: z.enum(CONCEPT_STATUSES),
});

// Correzione terminologica: cosa ha scritto, cosa andava scritto, perché
const correctionSchema = z.object({
  written: requiredText("Il testo scritto non può essere vuoto"),
  suggested: requiredText("Il testo suggerito non può essere vuoto"),
  reason: requiredText("Il motivo non può essere vuoto"),
});

const graderOutputSchema = z.object({
  concepts: z.array(conceptSchema).min(1, "Nessun concetto valutato"),
  verdict: z.enum(VERDICTS),
  // vuoto se la terminologia è corretta
  corrections: z.array(correctionSchema),
  // può non esserci nulla da suggerire
  suggestion: z.string().trim(),
  // sempre presente: si mostra come risposta esemplare
  exampleAnswer: requiredText("La risposta esemplare non può essere vuota"),
});

// Valutazione in batch (simulazione): un risultato per posizione in prova
const graderBatchOutputSchema = z.object({
  results: z
    .array(
      graderOutputSchema.extend({
        index: z.int().positive("L'index deve essere un numero intero positivo"),
      })
    )
    .min(1, "Nessun risultato nel batch"),
});

module.exports = {
  VERDICTS,
  CONCEPT_STATUSES,
  graderOutputSchema,
  graderBatchOutputSchema,
};
