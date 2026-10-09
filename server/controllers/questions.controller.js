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
const { questionPatchSchema } = require("../schemas/questionPatch.schema");
const { sendZodError } = require("../utils/zodError");

const router = express.Router();

const SORTABLE_FIELDS = ["created_at", "prompt"];

const QUESTION_NOT_FOUND = "Domanda non trovata";
const TOPIC_NOT_FOUND = "Argomento non trovato";
const DUPLICATE_QUESTION =
  "Nell'argomento esiste già una domanda con lo stesso testo";
const QUESTION_HAS_ATTEMPTS =
  "La domanda è già stata usata in una prova o in una flashcard: puoi correggerla ma non cancellarla";

// Campi della forma API -> colonne di FE_Questions
const PATCH_COLUMNS = {
  topic_id: "topic_id",
  prompt: "prompt",
  reference_answer: "answer",
  rubric: "rubric",
  references: "article_refs",
};

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
router.patch("/:id", protect, async (req, res) => {
  try {
    const { id } = req.params;

    if (!isUuid(id)) {
      return res.status(404).json({ ok: false, error: QUESTION_NOT_FOUND });
    }

    const parsed = questionPatchSchema.safeParse(req.body);
    if (!parsed.success) return sendZodError(res, parsed.error);

    if (parsed.data.topic_id) {
      const topic = await findTopicById(parsed.data.topic_id);
      if (!topic) {
        return res.status(404).json({ ok: false, error: TOPIC_NOT_FOUND });
      }
    }

    const fields = {};
    for (const [key, value] of Object.entries(parsed.data)) {
      fields[PATCH_COLUMNS[key]] = value;
    }

    const question = await updateQuestion(id, fields);
    if (!question) {
      return res.status(404).json({ ok: false, error: QUESTION_NOT_FOUND });
    }

    return res.json({
      ok: true,
      question: serializeQuestion(question),
    });

  } catch (err) {
    // Il prompt normalizzato è già presente nell'argomento (indice univoco)
    if (err.message === "DATABASE_DUPLICATE_QUESTION_ERROR") {
      return res.status(409).json({ ok: false, error: DUPLICATE_QUESTION });
    }

    console.error("PATCH QUESTION ERROR:", err);

    return res.status(500).json({
      ok: false,
      error: "Errore interno del server",
    });
  }
});

// Cancella una domanda
router.delete("/:id", protect, async (req, res) => {
  try {
    const { id } = req.params;

    if (!isUuid(id)) {
      return res.status(404).json({ ok: false, error: QUESTION_NOT_FOUND });
    }

    if (await hasAttemptsForQuestion(id)) {
      return res.status(409).json({ ok: false, error: QUESTION_HAS_ATTEMPTS });
    }

    const deleted = await deleteQuestion(id);
    if (!deleted) {
      return res.status(404).json({ ok: false, error: QUESTION_NOT_FOUND });
    }

    return res.json({ ok: true });

  } catch (err) {
    // Tentativo creato tra il controllo e la cancellazione (FK restrict)
    if (err.message === "DATABASE_QUESTION_HAS_ATTEMPTS_ERROR") {
      return res.status(409).json({ ok: false, error: QUESTION_HAS_ATTEMPTS });
    }

    console.error("DELETE QUESTION ERROR:", err);

    return res.status(500).json({
      ok: false,
      error: "Errore interno del server",
    });
  }
});

module.exports = router;
