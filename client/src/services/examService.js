import api from "@/api/client";

// Errore con lo status HTTP conservato (la pagina riconosce il 409)
const toError = (err, fallback) => {
  const error = new Error(err.message || fallback);
  error.status = err.status ?? null;
  return error;
};

// Avvia una simulazione o riprende quella in corso: { exam, resumed }
export const startExam = async () => {
  try {
    const res = await api.post("/exams");
    return { exam: res.data.exam, resumed: res.data.resumed };
  } catch (err) {
    throw toError(err, "Errore nell'avvio della simulazione");
  }
};

export const getExam = async (id) => {
  try {
    const res = await api.get(`/exams/${id}`);
    return res.data.exam;
  } catch (err) {
    throw toError(err, "Errore nel caricamento della simulazione");
  }
};

// Salva in bozza la risposta di una posizione: restituisce updated_at
export const saveDraft = async (id, position, answer) => {
  try {
    const res = await api.put(`/exams/${id}/answers/${position}`, { answer });
    return res.data.updated_at;
  } catch (err) {
    throw toError(err, "Errore nel salvataggio della risposta");
  }
};

// Salvataggio mentre la pagina si chiude o va in background: fetch con
// keepalive (axios non lo supporta, sendBeacon non permette PUT né il token).
// Non rifiuta mai: true se il server ha confermato
export const saveDraftKeepalive = (id, position, answer) => {
  const token = localStorage.getItem("token");
  return fetch(`${import.meta.env.VITE_API_URL}/exams/${id}/answers/${position}`, {
    method: "PUT",
    keepalive: true,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ answer }),
  })
    .then((res) => res.ok)
    .catch(() => false);
};

// Consegna (PROVA-7): nessun timeout lato client, la valutazione può durare
export const submitExam = async (id, answers) => {
  try {
    const res = await api.post(`/exams/${id}/submit`, { answers });
    return res.data.exam;
  } catch (err) {
    throw toError(err, "Errore nella consegna della simulazione");
  }
};

// Autovalutazione di riserva (PROVA-9): verdicts [{ position, verdict }]
export const selfGradeExam = async (id, verdicts) => {
  try {
    const res = await api.post(`/exams/${id}/self-grade`, { verdicts });
    return res.data.exam;
  } catch (err) {
    throw toError(err, "Errore nell'autovalutazione");
  }
};

// Nuovo tentativo di valutazione AI (PROVA-9)
export const regradeExam = async (id) => {
  try {
    const res = await api.post(`/exams/${id}/grade`);
    return res.data.exam;
  } catch (err) {
    throw toError(err, "Errore nella valutazione della simulazione");
  }
};
