const supabase = require("../config/db_connection");

const TABLE_NAME = "FE_Questions";

// Elenco paginato con filtri (topic_id, q) e ordinamento, con l'argomento
const getQuestions = async ({ topicId, q, page, limit, sort, order }) => {};

// Domanda per id, con l'argomento
const findQuestionById = async (id) => {};

// Prompt delle domande di un argomento (import: controllo duplicati)
const getQuestionPromptsByTopic = async (topicId) => {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("prompt")
    .eq("topic_id", topicId);

  if (error) {
    throw new Error("DATABASE_FIND_QUESTION_PROMPTS_ERROR");
  }

  return data.map((question) => question.prompt);
};

// Inserimento multiplo (import). Le righe usano i nomi delle colonne:
// { topic_id, prompt, answer, rubric, article_refs }
const createQuestions = async (questions) => {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert(questions)
    .select("id");

  if (error) {
    // 23505: violato l'indice univoco argomento + prompt normalizzato
    if (error.code === "23505") {
      throw new Error("DATABASE_DUPLICATE_QUESTION_ERROR");
    }
    throw new Error("DATABASE_CREATE_QUESTIONS_ERROR");
  }

  return data;
};

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
