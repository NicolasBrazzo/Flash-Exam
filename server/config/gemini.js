// GEMINI CONFIGURATION (solo server: la chiave non arriva mai al client)

// Valore ripulito dagli spazi; stringa vuota se la variabile manca
const readEnv = (name) => (process.env[name] || "").trim();

const GEMINI_API_KEY = readEnv("GEMINI_API_KEY");
const GEMINI_MODEL = readEnv("GEMINI_MODEL");

// Fail fast se manca la configurazione. Il messaggio nomina solo la variabile,
// mai il suo valore
if (!GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is not defined in environment variables");
}
if (!GEMINI_MODEL) {
  throw new Error("GEMINI_MODEL is not defined in environment variables");
}

module.exports = {
  GEMINI_API_KEY,

  // Nome del modello Flash: va preso dalla documentazione ufficiale di Google AI Studio
  GEMINI_MODEL,

  // API REST di Gemini (D5: fetch, nessun SDK). Da verificare sulla documentazione ufficiale
  GEMINI_BASE_URL: "https://generativelanguage.googleapis.com/v1beta",
};
