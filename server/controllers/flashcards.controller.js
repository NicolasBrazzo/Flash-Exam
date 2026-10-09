const express = require("express");

const {
  findQuestionById,
  getRandomQuestionsByTopics,
} = require("../models/question.model");
const { createFlashcardAttempt, updateAttempt } = require("../models/attempt.model");
const protect = require("../middleware/auth");
const { parseFlashcardQuery } = require("../utils/flashcardQuery");
const { serializeFlashcard } = require("../utils/serializeQuestion");

const router = express.Router();

// Estrae domande a caso dagli argomenti scelti
router.get("/", protect, async (req, res) => {
  try {
    const parsed = parseFlashcardQuery(req.query);
    if (!parsed.ok) {
      return res.status(400).json({ ok: false, error: parsed.error });
    }

    // Argomenti inesistenti o senza domande: elenco vuoto
    const rows = await getRandomQuestionsByTopics(parsed.topicIds, parsed.count);

    return res.json({
      ok: true,
      questions: rows.map(serializeFlashcard),
    });

  } catch (err) {
    console.error("GET FLASHCARDS ERROR:", err);

    return res.status(500).json({
      ok: false,
      error: "Errore interno del server",
    });
  }
});

// Invia la risposta a una flashcard e la fa valutare
router.post("/answer", protect, async (req, res) => {});

module.exports = router;
