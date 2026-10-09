const supabase = require("../config/db_connection");

const TABLE_NAME = "FE_ExamSessions";

// Colonne della forma API (vedi utils/serializeExam.js)
const SESSION_COLUMNS =
  "id, status, started_at, expires_at, submitted_at, auto_submitted, grade, honors";

// Storico paginato con filtro status e ordinamento
const getExamSessions = async ({ status, page, limit, sort, order }) => {};

// Simulazione per id
const findExamSessionById = async (id) => {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select(SESSION_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error("DATABASE_FIND_EXAM_SESSION_BY_ID_ERROR");
  }

  return data;
};

// Simulazione IN_PROGRESS più recente, se esiste
const findInProgressExamSession = async () => {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select(SESSION_COLUMNS)
    .eq("status", "IN_PROGRESS")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error("DATABASE_FIND_IN_PROGRESS_EXAM_SESSION_ERROR");
  }

  return data;
};

// Crea una simulazione
const createExamSession = async ({ started_at, expires_at }) => {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert({ started_at, expires_at })
    .select(SESSION_COLUMNS)
    .single();

  if (error) {
    throw new Error("DATABASE_CREATE_EXAM_SESSION_ERROR");
  }

  return data;
};

// Aggiorna una simulazione (status, submitted_at, auto_submitted, grade, honors)
const updateExamSession = async (id, fields) => {};

// Cancella una simulazione (rollback di un avvio fallito: i tentativi vanno
// via in cascata)
const deleteExamSession = async (id) => {
  const { error } = await supabase.from(TABLE_NAME).delete().eq("id", id);

  if (error) {
    throw new Error("DATABASE_DELETE_EXAM_SESSION_ERROR");
  }
};

module.exports = {
  getExamSessions,
  findExamSessionById,
  findInProgressExamSession,
  createExamSession,
  updateExamSession,
  deleteExamSession,
};
