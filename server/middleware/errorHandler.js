// Handler d'errore globale (ultimo middleware di server.js).
// Un body JSON malformato o troppo grande è un errore della richiesta, non del
// server: 400 e 413 invece di 500.
const errorHandler = (err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ ok: false, error: "Il body della richiesta non è un JSON valido" });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ ok: false, error: "Il body della richiesta è troppo grande" });
  }

  console.error("Server error:", err);
  return res.status(500).json({ ok: false, error: "Errore interno del server" });
};

module.exports = errorHandler;
