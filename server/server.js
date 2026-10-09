require('dotenv').config();
// Configurazione obbligatoria: senza GEMINI_API_KEY e GEMINI_MODEL il server non parte
require("./config/gemini");

const express = require("express");
const cors = require("cors");

const authRoutes = require("./controllers/auth.controller");
const importRoutes = require("./controllers/import.controller");
const topicsRoutes = require("./controllers/topics.controller");
const questionsRoutes = require("./controllers/questions.controller");
const examsRoutes = require("./controllers/exams.controller");
const flashcardsRoutes = require("./controllers/flashcards.controller");
const attemptsRoutes = require("./controllers/attempts.controller");

const app = express();
const PORT = process.env.PORT || 3000;

app.set("trust proxy", 1);

app.use(cors({
  origin: process.env.FRONTEND_URL
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/auth", authRoutes);
app.use("/import", importRoutes);
app.use("/topics", topicsRoutes);
app.use("/questions", questionsRoutes);
app.use("/exams", examsRoutes);
app.use("/flashcards", flashcardsRoutes);
app.use("/attempts", attemptsRoutes);

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use((req, res) => {
  res.status(404).json({ ok: false, error: "Rotta non trovata" });
});

app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({ ok: false, error: "Errore interno del server" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend ON at port ${PORT}`);
});