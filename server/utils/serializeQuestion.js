// Riga di FE_Questions (con l'argomento in `topic`) -> forma API di ENDPOINTS.md.
// Whitelist esplicita: le colonne non elencate non escono nella risposta.
const serializeQuestion = (row) => ({
  id: row.id,
  topic: row.topic ? { id: row.topic.id, name: row.topic.name } : null,
  prompt: row.prompt,
  reference_answer: row.answer,
  rubric: row.rubric,
  references: row.article_refs ?? [],
  created_at: row.created_at,
  updated_at: row.updated_at,
});

// Flashcard: solo il testo e l'argomento, mai risposta, rubrica o riferimenti
const serializeFlashcard = (row) => ({
  id: row.id,
  prompt: row.prompt,
  topic: row.topic ? { id: row.topic.id, name: row.topic.name } : null,
});

module.exports = { serializeQuestion, serializeFlashcard };
