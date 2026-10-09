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
const { parsePagination, buildPagination } = require("../utils/pagination");
const { isUuid } = require("../utils/sqlFilters");
const { serializeQuestion } = require("../utils/serializeQuestion");

const router = express.Router();

const SORTABLE_FIELDS = ["created_at", "prompt"];

const QUESTION_NOT_FOUND = "Domanda non trovata";

// Elenco paginato delle domande
router.get("/", protect, async (req, res) => {
  try {
    const { page, limit, sort, order } = parsePagination(req.query, {
      sortable: SORTABLE_FIELDS,
    });

    // Parametri vuoti (es. "q=" da Postman) = nessun filtro
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const topicId = req.query.topic_id ?? "";

    // Un topic_id che non è un uuid non può corrispondere a nessun argomento
    if (topicId !== "" && !isUuid(topicId)) {
      return res.json({
        ok: true,
        data: [],
        pagination: buildPagination(0, page, limit),
      });
    }

    const { rows, total } = await getQuestions({
      topicId: topicId || undefined,
      q: q || undefined,
      page,
      limit,
      sort,
      order,
    });

    return res.json({
      ok: true,
      data: rows.map(serializeQuestion),
      pagination: buildPagination(total, page, limit),
    });

  } catch (err) {
    console.error("GET QUESTIONS ERROR:", err);

    return res.status(500).json({
      ok: false,
      error: "Errore interno del server",
    });
  }
});

// Dettaglio di una domanda
router.get("/:id", protect, async (req, res) => {
  try {
    const { id } = req.params;

    if (!isUuid(id)) {
      return res.status(404).json({ ok: false, error: QUESTION_NOT_FOUND });
    }

    const question = await findQuestionById(id);
    if (!question) {
      return res.status(404).json({ ok: false, error: QUESTION_NOT_FOUND });
    }

    return res.json({
      ok: true,
      question: serializeQuestion(question),
    });

  } catch (err) {
    console.error("GET QUESTION ERROR:", err);

    return res.status(500).json({
      ok: false,
      error: "Errore interno del server",
    });
  }
});

// Corregge una domanda
router.patch("/:id", protect, async (req, res) => {});

// Cancella una domanda
router.delete("/:id", protect, async (req, res) => {});

module.exports = router;
