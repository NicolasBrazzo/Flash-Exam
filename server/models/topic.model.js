const supabase = require("../config/db_connection");

const TABLE_NAME = "FE_Topics";

// Tutti gli argomenti con il numero di domande, ordinati per position e name
const getAllTopics = async () => {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("id, name, position, FE_Questions(count)")
    .order("position", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw new Error("DATABASE_FIND_ALL_TOPICS_ERROR");
  }

  // Supabase restituisce il conteggio come FE_Questions: [{ count }]
  return data.map(({ FE_Questions, ...topic }) => ({
    ...topic,
    question_count: FE_Questions[0]?.count ?? 0,
  }));
};

// Argomento per id
const findTopicById = async (id) => {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error("DATABASE_FIND_TOPIC_BY_ID_ERROR");
  }

  return data;
};

// Argomento per nome (import: riuso se esiste già)
const findTopicByName = async (name) => {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("*")
    .eq("name", name)
    .maybeSingle();

  if (error) {
    throw new Error("DATABASE_FIND_TOPIC_BY_NAME_ERROR");
  }

  return data;
};

// Crea un argomento
const createTopic = async ({ name }) => {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert({ name })
    .select()
    .single();

  if (error) {
    throw new Error("DATABASE_CREATE_TOPIC_ERROR");
  }

  return data;
};

module.exports = {
  getAllTopics,
  findTopicById,
  findTopicByName,
  createTopic,
};
