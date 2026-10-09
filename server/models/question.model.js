const supabase = require("../config/db_connection");
const { getRange } = require("../utils/pagination");
const { escapeLike } = require("../utils/sqlFilters");

const TABLE_NAME = "FE_Questions";

// Colonne della forma API (vedi utils/serializeQuestion.js), argomento incluso
const SELECT_COLUMNS =
  "id, prompt, answer, rubric, article_refs, created_at, updated_at, topic:FE_Topics(id, name)";

// Filtri dell'elenco, applicati solo se presenti
const applyFilters = (query, { topicId, q }) => {
  let filtered = query;
  if (topicId) filtered = filtered.eq("topic_id", topicId);
  if (q) filtered = filtered.ilike("prompt", `%${escapeLike(q)}%`);
  return filtered;
};

// Elenco paginato con filtri (topic_id, q) e ordinamento, con l'argomento
const getQuestions = async ({ topicId, q, page, limit, sort, order }) => {
  const { from, to } = getRange(page, limit);

  // Spareggio su id: le domande di uno stesso import hanno lo stesso created_at
  const { data, count, error } = await applyFilters(
    supabase.from(TABLE_NAME).select(SELECT_COLUMNS, { count: "exact" }),
    { topicId, q }
  )
    .order(sort, { ascending: order === "asc" })
    .order("id", { ascending: true })
    .range(from, to);

  if (error) {
    // PGRST103: pagina oltre l'ultima. Non è un errore: pagina vuota con il totale
    if (error.code === "PGRST103") {
      const { count: total, error: countError } = await applyFilters(
        supabase.from(TABLE_NAME).select("id", { count: "exact", head: true }),
        { topicId, q }
      );
      if (countError) {
        throw new Error("DATABASE_FIND_QUESTIONS_ERROR");
      }
      return { rows: [], total: total ?? 0 };
    }
    throw new Error("DATABASE_FIND_QUESTIONS_ERROR");
  }

  return { rows: data ?? [], total: count ?? 0 };
};

// Domanda per id, con l'argomento
const findQuestionById = async (id) => {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select(SELECT_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error("DATABASE_FIND_QUESTION_BY_ID_ERROR");
  }

  return data;
};

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
