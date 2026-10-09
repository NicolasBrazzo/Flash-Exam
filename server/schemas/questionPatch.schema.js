const { z } = require("../config/zod");
const {
  requiredText,
  rubricSchema,
  referencesSchema,
} = require("./questionsImport.schema");

// Correzione di una domanda (PATCH /questions/:id): body parziale con i nomi
// di campo della forma API, stesse regole dell'import. Nessun default: un
// campo assente resta invariato.
const questionPatchSchema = z
  .strictObject({
    topic_id: z.guid("Id argomento non valido").optional(),
    prompt: requiredText("La domanda non può essere vuota").optional(),
    reference_answer: requiredText("La risposta di riferimento non può essere vuota").optional(),
    rubric: rubricSchema.optional(),
    references: referencesSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Indica almeno un campo da modificare",
  });

module.exports = { questionPatchSchema };
