import api from "@/api/client";

// Elenco paginato delle domande. params: { q, topic_id, page, limit, sort, order }
// (le chiavi undefined non finiscono nella query string)
export const getQuestions = async (params) => {
  try {
    const res = await api.get("/questions", { params });
    return { data: res.data.data, pagination: res.data.pagination };
  } catch (err) {
    throw new Error(err.message || "Errore nel caricamento delle domande");
  }
};

// Correzione parziale di una domanda: restituisce la domanda aggiornata
export const updateQuestion = async (id, patch) => {
  try {
    const res = await api.patch(`/questions/${id}`, patch);
    return res.data.question;
  } catch (err) {
    throw new Error(err.message || "Errore nel salvataggio della domanda");
  }
};

// Cancella una domanda (409 se è già stata usata in una prova o in una flashcard)
export const deleteQuestion = async (id) => {
  try {
    await api.delete(`/questions/${id}`);
    return true;
  } catch (err) {
    throw new Error(err.message || "Errore nella cancellazione della domanda");
  }
};
