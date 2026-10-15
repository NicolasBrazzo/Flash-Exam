import api from "@/api/client";

// Errore con lo status HTTP conservato
const toError = (err, fallback) => {
  const error = new Error(err.message || fallback);
  error.status = err.status ?? null;
  return error;
};

// Domande a caso dagli argomenti scelti: [{ id, prompt, topic }]
export const getFlashcards = async (topicIds, count) => {
  try {
    const res = await api.get("/flashcards", { params: { topics: topicIds.join(","), count } });
    return res.data.questions;
  } catch (err) {
    throw toError(err, "Errore nel caricamento delle flashcard");
  }
};

// Risposta a una flashcard, valutata subito: { id, verdict, grading_source, feedback, reference_answer, references }
export const answerFlashcard = async (questionId, answer) => {
  try {
    const res = await api.post("/flashcards/answer", { question_id: questionId, answer });
    return res.data.attempt;
  } catch (err) {
    throw toError(err, "Errore nell'invio della risposta");
  }
};
