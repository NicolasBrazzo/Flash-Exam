const supabase = require("../config/db_connection");
const { getRange } = require("../utils/pagination");

const TABLE_NAME = "FE_ExamSessions";

// Colonne della forma API (vedi utils/serializeExam.js)
const SESSION_COLUMNS =
  "id, status, started_at, expires_at, submitted_at, auto_submitted, grade, honors";

// Filtro facoltativo per stato
const applyStatus = (query, status) => (status ? query.eq("status", status) : query);

// Storico paginato con filtro status e ordinamento. Le prove senza voto vanno
// sempre in fondo; spareggio su id. Restituisce { rows, total }
const getExamSessions = async ({ status, page, limit, sort, order }) => {
  const { from, to } = getRange(page, limit);

  const { data, count, error } = await applyStatus(
    supabase.from(TABLE_NAME).select(SESSION_COLUMNS, { count: "exact" }),
    status
  )
    .order(sort, { ascending: order === "asc", nullsFirst: false })
    .order("id", { ascending: true })
    .range(from, to);

  if (error) {
    // PGRST103: pagina oltre l'ultima. Non è un errore: pagina vuota con il totale
    if (error.code === "PGRST103") {
      const { count: total, error: countError } = await applyStatus(
        supabase.from(TABLE_NAME).select("id", { count: "exact", head: true }),
        status
      );
      if (countError) {
        throw new Error("DATABASE_FIND_EXAM_SESSIONS_ERROR");
      }
      return { rows: [], total: total ?? 0 };
    }
    throw new Error("DATABASE_FIND_EXAM_SESSIONS_ERROR");
  }

  return { rows: data ?? [], total: count ?? 0 };
};

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

// Aggiorna una simulazione (status, submitted_at, auto_submitted, grade, honors).
// Con expectedStatus l'update vale solo se lo stato è ancora quello (transizione
// atomica); con requireNoGrade solo se la prova non ha ancora un voto.
// Restituisce la riga aggiornata, null se nessuna riga corrisponde
const updateExamSession = async (id, fields, { expectedStatus, requireNoGrade = false } = {}) => {
  let query = supabase.from(TABLE_NAME).update(fields).eq("id", id);
  if (expectedStatus) query = query.eq("status", expectedStatus);
  if (requireNoGrade) query = query.is("grade", null);

  const { data, error } = await query.select(SESSION_COLUMNS).maybeSingle();

  if (error) {
    throw new Error("DATABASE_UPDATE_EXAM_SESSION_ERROR");
  }

  return data ?? null;
};

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
