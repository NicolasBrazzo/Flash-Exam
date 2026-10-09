const supabase = require("../config/db_connection");
const { getRange } = require("../utils/pagination");
const { escapeLike } = require("../utils/sqlFilters");
const { pickRandom } = require("../utils/random");

const TABLE_NAME = "FE_Questions";

// Colonne della forma API (vedi utils/serializeQuestion.js), argomento incluso
const SELECT_COLUMNS =
  "id, prompt, answer, rubric, article_refs, created_at, updated_at, topic:FE_Topics(id, name)";

// Colonne di una flashcard: niente risposta, rubrica o riferimenti
const FLASHCARD_COLUMNS = "id, prompt, topic:FE_Topics(id, name)";

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

// Aggiorna una domanda (valorizza updated_at). `fields` usa i nomi delle
// colonne; restituisce la riga aggiornata con l'argomento, null se non esiste
const updateQuestion = async (id, fields) => {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(SELECT_COLUMNS)
    .maybeSingle();

  if (error) {
    // 23505: violato l'indice univoco argomento + prompt normalizzato
    if (error.code === "23505") {
      throw new Error("DATABASE_DUPLICATE_QUESTION_ERROR");
    }
    throw new Error("DATABASE_UPDATE_QUESTION_ERROR");
  }

  return data;
};

// Cancella una domanda; restituisce la riga cancellata, null se non esiste
const deleteQuestion = async (id) => {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    // 23503: la domanda ha dei tentativi (FK on delete restrict da FE_Attempts)
    if (error.code === "23503") {
      throw new Error("DATABASE_QUESTION_HAS_ATTEMPTS_ERROR");
    }
    throw new Error("DATABASE_DELETE_QUESTION_ERROR");
  }

  return data;
};

// Estrae `count` domande a caso tra tutte (simulazione)
// (gli id bastano: testo e argomento arrivano con i tentativi creati). `rng` per i test
const getRandomQuestions = async (count, rng = Math.random) => {
  const { data, error } = await supabase.from(TABLE_NAME).select("id");

  if (error) {
    throw new Error("DATABASE_FIND_RANDOM_QUESTIONS_ERROR");
  }

  return pickRandom((data ?? []).map((row) => row.id), count, rng).map((id) => ({ id }));
};

// Estrae fino a `count` domande a caso dagli argomenti indicati (flashcard):
// legge gli id, li sceglie in JS e carica solo quelli, nell'ordine estratto.
// `rng` serve solo ai test
const getRandomQuestionsByTopics = async (topicIds, count, rng = Math.random) => {
  const { data: idRows, error: idsError } = await supabase
    .from(TABLE_NAME)
    .select("id")
    .in("topic_id", topicIds);

  if (idsError) {
    throw new Error("DATABASE_FIND_RANDOM_QUESTIONS_ERROR");
  }

  const picked = pickRandom((idRows ?? []).map((row) => row.id), count, rng);
  if (picked.length === 0) return [];

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select(FLASHCARD_COLUMNS)
    .in("id", picked);

  if (error) {
    throw new Error("DATABASE_FIND_RANDOM_QUESTIONS_ERROR");
  }

  // .in() non conserva l'ordine: si riordina come estratto
  const byId = new Map((data ?? []).map((row) => [row.id, row]));
  return picked.map((id) => byId.get(id)).filter(Boolean);
};

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
