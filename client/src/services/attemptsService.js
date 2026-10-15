import api from "@/api/client";

// Errore con lo status HTTP conservato
const toError = (err, fallback) => {
  const error = new Error(err.message || fallback);
  error.status = err.status ?? null;
  return error;
};

// Autovalutazione di un tentativo flashcard senza esito: { id, verdict, grading_source, feedback, reference_answer, references }
export const selfGradeAttempt = async (attemptId, verdict) => {
  try {
    const res = await api.post(`/attempts/${attemptId}/self-grade`, { verdict });
    return res.data.attempt;
  } catch (err) {
    throw toError(err, "Errore nel salvataggio dell'autovalutazione");
  }
};
