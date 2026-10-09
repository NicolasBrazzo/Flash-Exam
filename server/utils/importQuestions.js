// Funzioni pure condivise dall'import JSON (controllers/import.controller.js)
// e dal seed dei dati demo (database/seed.js): nessun accesso al database.

// Stessa normalizzazione dell'indice univoco su FE_Questions:
// lower(regexp_replace(btrim(prompt), '\s+', ' ', 'g'))
const normalizePrompt = (prompt) =>
  prompt.trim().replace(/\s+/g, " ").toLowerCase();

// Scarta le domande già presenti nell'argomento e i duplicati nel file,
// poi converte le altre nelle righe di FE_Questions
const selectNewQuestions = (questions, existingPrompts, topicId) => {
  const seen = new Set(existingPrompts.map(normalizePrompt));

  const rows = [];
  for (const question of questions) {
    const key = normalizePrompt(question.prompt);
    if (seen.has(key)) continue;
    seen.add(key);

    rows.push({
      topic_id: topicId,
      prompt: question.prompt,
      answer: question.answer,
      rubric: question.rubric,
      article_refs: question.references,
    });
  }

  return rows;
};

// Dati demo del seed: solo con SEED_DEMO=true, qualsiasi altro valore li esclude
const isDemoEnabled = (env) => env.SEED_DEMO === "true";

module.exports = {
  normalizePrompt,
  selectNewQuestions,
  isDemoEnabled,
};
