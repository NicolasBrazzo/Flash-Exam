import api from "@/api/client";

// Elenco completo degli argomenti (con il numero di domande)
export const getTopics = async () => {
  try {
    const res = await api.get("/topics");
    return res.data.topics;
  } catch (err) {
    throw new Error(err.message || "Errore nel caricamento degli argomenti");
  }
};
