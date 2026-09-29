const supabase = require("../config/db_connection");

const TABLE_NAME = "FE_Topics";

// Tutti gli argomenti con il numero di domande, ordinati per position e name
const getAllTopics = async () => {};

// Argomento per id
const findTopicById = async (id) => {};

// Argomento per nome (import: riuso se esiste già)
const findTopicByName = async (name) => {};

// Crea un argomento
const createTopic = async ({ name }) => {};

module.exports = {
  getAllTopics,
  findTopicById,
  findTopicByName,
  createTopic,
};
