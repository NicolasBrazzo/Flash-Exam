const supabase = require("../config/db_connection");

const TABLE_NAME = "FE_Questions";

// Elenco paginato con filtri (topic_id, q) e ordinamento, con l'argomento
const getQuestions = async ({ topicId, q, page, limit, sort, order }) => {};

// Domanda per id, con l'argomento
const findQuestionById = async (id) => {};

// Prompt delle domande di un argomento (import: controllo duplicati)
const getQuestionPromptsByTopic = async (topicId) => {};

// Inserimento multiplo (import)
const createQuestions = async (questions) => {};

// Aggiorna una domanda (valorizza updated_at)
const updateQuestion = async (id, fields) => {};

// Cancella una domanda
const deleteQuestion = async (id) => {};

// Estrae `count` domande a caso tra tutte (simulazione)
const getRandomQuestions = async (count) => {};

// Estrae fino a `count` domande a caso dagli argomenti indicati (flashcard)
const getRandomQuestionsByTopics = async (topicIds, count) => {};

module.exports = {
  getQuestions,
  findQuestionById,
  getQuestionPromptsByTopic,
  createQuestions,
  updateQuestion,
  deleteQuestion,
  getRandomQuestions,
  getRandomQuestionsByTopics,
};
