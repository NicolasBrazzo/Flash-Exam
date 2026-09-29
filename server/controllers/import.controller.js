const express = require("express");

const { findTopicByName, createTopic } = require("../models/topic.model");
const {
  getQuestionPromptsByTopic,
  createQuestions,
} = require("../models/question.model");
const protect = require("../middleware/auth");

const router = express.Router();

// Importa le domande di un argomento da JSON
router.post("/questions", protect, async (req, res) => {});

module.exports = router;
