import api from "@/api/client";

// Importa le domande di un argomento (JSON già parsato): { topic, inserted, skipped }
export const importQuestions = async (payload) => {
  try {
    const res = await api.post("/import/questions", payload);
    return { topic: res.data.topic, inserted: res.data.inserted, skipped: res.data.skipped };
  } catch (err) {
    throw new Error(err.message || "Errore durante l'import");
  }
};
