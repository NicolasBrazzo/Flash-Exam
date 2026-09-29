const express = require("express");

const {
  getQuestions,
  findQuestionById,
  updateQuestion,
  deleteQuestion,
} = require("../models/question.model");
const { findTopicById } = require("../models/topic.model");
const { hasAttemptsForQuestion } = require("../models/attempt.model");
const protect = require("../middleware/auth");

const router = express.Router();

// Elenco paginato delle domande
router.get("/", protect, async (req, res) => {});

// Dettaglio di una domanda
router.get("/:id", protect, async (req, res) => {});

// Corregge una domanda
router.patch("/:id", protect, async (req, res) => {});

// Cancella una domanda
router.delete("/:id", protect, async (req, res) => {});

module.exports = router;
