const supabase = require("../config/db_connection");

const TABLE_NAME = "FE_Attempts";

// Tentativo con la sua domanda e l'argomento. Rubrica, score e points servono a
// valutazione e voto: non escono mai nelle risposte (whitelist in serializeExam)
const ATTEMPT_COLUMNS =
  "id, position, answer, verdict, grading, grading_source, points, score, graded_at, updated_at, " +
  "question:FE_Questions(id, prompt, answer, rubric, article_refs, topic:FE_Topics(id, name))";

// Tentativo per id, con la domanda (risposta di riferimento e riferimenti)
// (con session_id e mode: l'autovalutazione distingue flashcard e simulazioni)
const findAttemptById = async (id) => {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select(`session_id, mode, ${ATTEMPT_COLUMNS}`)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error("DATABASE_FIND_ATTEMPT_BY_ID_ERROR");
  }

  return data ?? null;
};

// Tentativi di una simulazione ordinati per position, con domanda e argomento
const getAttemptsBySession = async (sessionId) => {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select(ATTEMPT_COLUMNS)
    .eq("session_id", sessionId)
    .order("position", { ascending: true });

  if (error) {
    throw new Error("DATABASE_FIND_ATTEMPTS_BY_SESSION_ERROR");
  }

  return data ?? [];
};

// Tentativo di una simulazione per posizione
const findAttemptBySessionAndPosition = async (sessionId, position) => {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select(ATTEMPT_COLUMNS)
    .eq("session_id", sessionId)
    .eq("position", position)
    .maybeSingle();

  if (error) {
    throw new Error("DATABASE_FIND_ATTEMPT_BY_POSITION_ERROR");
  }

  return data ?? null;
};

// Crea le 6 righe di una simulazione con la risposta vuota
// (un solo insert: entrano tutte o nessuna); restituisce le righe con la domanda
const createExamAttempts = async (attempts) => {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert(attempts)
    .select(ATTEMPT_COLUMNS);

  if (error) {
    throw new Error("DATABASE_CREATE_EXAM_ATTEMPTS_ERROR");
  }

  return data ?? [];
};

// Crea un tentativo FLASHCARD
// (senza sessione né posizione, come richiede il CHECK di FE_Attempts)
const createFlashcardAttempt = async ({ question_id, answer }) => {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert({ question_id, answer, mode: "FLASHCARD" })
    .select(ATTEMPT_COLUMNS)
    .single();

  if (error) {
    throw new Error("DATABASE_CREATE_FLASHCARD_ATTEMPT_ERROR");
  }

  return data;
};

// Aggiorna un tentativo (risposta o valutazione; valorizza updated_at)
// Restituisce la riga aggiornata con la domanda, null se non esiste
const updateAttempt = async (id, fields) => {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(ATTEMPT_COLUMNS)
    .maybeSingle();

  if (error) {
    throw new Error("DATABASE_UPDATE_ATTEMPT_ERROR");
  }

  return data ?? null;
};

// Valuta un tentativo solo se non è ancora valutato (due autovalutazioni
// contemporanee non si sovrascrivono): null se non c'era o era già valutato
const gradeUngradedAttempt = async (id, fields) => {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id)
    .is("verdict", null)
    .select(ATTEMPT_COLUMNS)
    .maybeSingle();

  if (error) {
    throw new Error("DATABASE_GRADE_ATTEMPT_ERROR");
  }

  return data ?? null;
};

// Indica se una domanda ha già dei tentativi (blocca la cancellazione)
const hasAttemptsForQuestion = async (questionId) => {
  const { count, error } = await supabase
    .from(TABLE_NAME)
    .select("id", { count: "exact", head: true })
    .eq("question_id", questionId);

  if (error) {
    throw new Error("DATABASE_FIND_ATTEMPTS_BY_QUESTION_ERROR");
  }

  return (count ?? 0) > 0;
};

module.exports = {
  findAttemptById,
  getAttemptsBySession,
  findAttemptBySessionAndPosition,
  createExamAttempts,
  createFlashcardAttempt,
  updateAttempt,
  gradeUngradedAttempt,
  hasAttemptsForQuestion,
};
