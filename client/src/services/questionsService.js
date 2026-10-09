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
