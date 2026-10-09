const supabase = require("../config/db_connection");

const TABLE_NAME = "FE_Attempts";

// Tentativo per id, con la domanda (risposta di riferimento e riferimenti)
const findAttemptById = async (id) => {};

// Tentativi di una simulazione ordinati per position, con domanda e argomento
const getAttemptsBySession = async (sessionId) => {};

// Tentativo di una simulazione per posizione
const findAttemptBySessionAndPosition = async (sessionId, position) => {};

// Crea le 6 righe di una simulazione con la risposta vuota
const createExamAttempts = async (attempts) => {};

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
