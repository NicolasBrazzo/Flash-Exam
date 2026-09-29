const express = require("express");

const {
  getExamSessions,
  findExamSessionById,
  findInProgressExamSession,
  createExamSession,
  updateExamSession,
} = require("../models/examSession.model");
const {
  getAttemptsBySession,
  findAttemptBySessionAndPosition,
  createExamAttempts,
  updateAttempt,
} = require("../models/attempt.model");
const { getRandomQuestions } = require("../models/question.model");
const protect = require("../middleware/auth");

const router = express.Router();

// Storico delle simulazioni
router.get("/", protect, async (req, res) => {});

// Dettaglio di una simulazione
router.get("/:id", protect, async (req, res) => {});

// Avvia una nuova simulazione (o riprende quella in corso)
router.post("/", protect, async (req, res) => {});

// Salva in bozza la risposta a una domanda
router.put("/:id/answers/:position", protect, async (req, res) => {});

// Consegna la prova e la fa valutare
router.post("/:id/submit", protect, async (req, res) => {});

// Autovalutazione di riserva
router.post("/:id/self-grade", protect, async (req, res) => {});

// Riprova la valutazione AI
router.post("/:id/grade", protect, async (req, res) => {});

module.exports = router;
