const express = require("express");

const {
  findQuestionById,
  getRandomQuestionsByTopics,
} = require("../models/question.model");
const { createFlashcardAttempt, updateAttempt } = require("../models/attempt.model");
const protect = require("../middleware/auth");

const router = express.Router();

// Estrae domande a caso dagli argomenti scelti
router.get("/", protect, async (req, res) => {});

// Invia la risposta a una flashcard e la fa valutare
router.post("/answer", protect, async (req, res) => {});

module.exports = router;
