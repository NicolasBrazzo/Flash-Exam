// Funzioni pure del form di modifica di una domanda (pages/Domande.jsx).
// Nessun import con alias: le verifica scripts/checks/questionForm.check.mjs.

// Stesso formato dei riferimenti accettato dal server (schemas/questionsImport.schema.js)
const ARTICLE_REGEX = /^\d+(-[a-z]+)?$/;
const POSITIVE_INT_REGEX = /^\d+$/;

// Domanda in forma API -> stato del form (i pesi restano stringhe finché si scrive)
export const questionToFormState = (question) => ({
  prompt: question.prompt,
  reference_answer: question.reference_answer,
  references: question.references.join(", "),
  rubric: question.rubric.map(({ id, concept, weight }) => ({
    id,
    concept,
    weight: String(weight),
  })),
});

// "1, 42-bis" -> ["1", "42-bis"] (voci vuote scartate)
export const parseReferences = (text) =>
  text
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

// Errori di validazione, con gli stessi testi del server; [] se il form è valido
export const validateQuestionForm = (formState) => {
  const errors = [];

  if (!formState.prompt.trim()) errors.push("La domanda non può essere vuota");
  if (!formState.reference_answer.trim()) {
    errors.push("La risposta di riferimento non può essere vuota");
  }

  formState.rubric.forEach((item, i) => {
    if (!item.concept.trim()) {
      errors.push(`Concetto ${i + 1}: il testo non può essere vuoto`);
    }
    const weight = item.weight.trim();
    if (!POSITIVE_INT_REGEX.test(weight) || Number(weight) === 0) {
      errors.push(`Concetto ${i + 1}: il peso deve essere un numero intero positivo`);
    }
  });

  for (const ref of parseReferences(formState.references)) {
    if (!ARTICLE_REGEX.test(ref)) {
      errors.push(`Riferimento "${ref}" non valido (es. "1" o "42-bis")`);
    }
  }

  return errors;
};

const sameList = (a, b) => a.length === b.length && a.every((item, i) => item === b[i]);

// Body del PATCH: solo i campi cambiati rispetto alla domanda originale.
// La rubrica, se cambia, si invia intera (stessi concetti, stessi id).
export const formStateToPatch = (question, formState) => {
  const patch = {};

  const prompt = formState.prompt.trim();
  if (prompt !== question.prompt) patch.prompt = prompt;

  const answer = formState.reference_answer.trim();
  if (answer !== question.reference_answer) patch.reference_answer = answer;

  const references = parseReferences(formState.references);
  if (!sameList(references, question.references)) patch.references = references;

  const rubric = formState.rubric.map((item) => ({
    id: item.id,
    concept: item.concept.trim(),
    weight: Number(item.weight.trim()),
  }));
  const rubricChanged = rubric.some(
    (item, i) =>
      item.concept !== question.rubric[i].concept ||
      item.weight !== question.rubric[i].weight
  );
  if (rubricChanged) patch.rubric = rubric;

  return patch;
};

// Pagina da mostrare dopo una cancellazione: se sparisce l'unico elemento
// della pagina (e non è la prima) si torna alla precedente
export const pageAfterDelete = (itemsOnPage, page) =>
  itemsOnPage === 1 && page > 1 ? page - 1 : page;
