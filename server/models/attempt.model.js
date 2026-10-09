const supabase = require("../config/db_connection");

const TABLE_NAME = "FE_Attempts";

// Tentativo con la sua domanda e l'argomento. Rubrica, score e points servono a
// valutazione e voto: non escono mai nelle risposte (whitelist in serializeExam)
const ATTEMPT_COLUMNS =
  "id, position, answer, verdict, grading, grading_source, points, score, graded_at, updated_at, " +
  "question:FE_Questions(id, prompt, answer, rubric, article_refs, topic:FE_Topics(id, name))";

// Tentativo per id, con la domanda (risposta di riferimento e riferimenti)
const findAttemptById = async (id) => {};

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
const findAttemptBySessionAndPosition = async (sessionId, position) => {};

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
const createFlashcardAttempt = async ({ question_id, answer }) => {};

// Aggiorna un tentativo (risposta o valutazione; valorizza updated_at)
const updateAttempt = async (id, fields) => {};

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
  hasAttemptsForQuestion,
};
