const supabase = require("../config/db_connection");

const TABLE_NAME = "FE_ExamSessions";

// Storico paginato con filtro status e ordinamento
const getExamSessions = async ({ status, page, limit, sort, order }) => {};

// Simulazione per id
const findExamSessionById = async (id) => {};

// Simulazione IN_PROGRESS più recente, se esiste
const findInProgressExamSession = async () => {};

// Crea una simulazione
const createExamSession = async ({ started_at, expires_at }) => {};

// Aggiorna una simulazione (status, submitted_at, auto_submitted, grade, honors)
const updateExamSession = async (id, fields) => {};

module.exports = {
  getExamSessions,
  findExamSessionById,
  findInProgressExamSession,
  createExamSession,
  updateExamSession,
};
