// Numero massimo di errori restituiti: un import con un errore sistematico
// ne produrrebbe uno per ogni riga
const MAX_ERRORS = 50;

// ["questions", 2, "rubric", 0, "weight"] -> "questions[2].rubric[0].weight"
const formatPath = (path) => {
  if (path.length === 0) return "corpo della richiesta";
  return path
    .map((key, i) => (typeof key === "number" ? `[${key}]` : i === 0 ? String(key) : `.${String(key)}`))
    .join("");
};

// Converte uno ZodError in un array di stringhe "percorso: messaggio"
const formatZodError = (error) => {
  const messages = error.issues
    .slice(0, MAX_ERRORS)
    .map((issue) => `${formatPath(issue.path)}: ${issue.message}`);

  const hidden = error.issues.length - MAX_ERRORS;
  if (hidden > 0) {
    messages.push(`... e altri ${hidden} errori`);
  }
  return messages;
};

// Risposta 400 standard per un fallimento di validazione Zod
const sendZodError = (res, error) =>
  res.status(400).json({ ok: false, error: formatZodError(error) });

module.exports = { formatZodError, sendZodError };
