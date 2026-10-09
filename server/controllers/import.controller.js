const express = require("express");

const { findTopicByName, createTopic } = require("../models/topic.model");
const {
  getQuestionPromptsByTopic,
  createQuestions,
} = require("../models/question.model");
const protect = require("../middleware/auth");
const { questionsImportSchema } = require("../schemas/questionsImport.schema");
const { sendZodError } = require("../utils/zodError");
const { selectNewQuestions } = require("../utils/importQuestions");

const router = express.Router();

// Importa le domande di un argomento da JSON
router.post("/questions", protect, async (req, res) => {
  try {
    const parsed = questionsImportSchema.safeParse(req.body);
    if (!parsed.success) return sendZodError(res, parsed.error);

    const { topic, questions } = parsed.data;

    // Argomento: si riusa se esiste, altrimenti si crea
    let savedTopic = await findTopicByName(topic.name);
    const created = !savedTopic;
    if (created) {
      savedTopic = await createTopic({ name: topic.name });
    }

    // Scarta le domande già presenti nell'argomento e i duplicati nel file
    const existingPrompts = created ? [] : await getQuestionPromptsByTopic(savedTopic.id);
    const rows = selectNewQuestions(questions, existingPrompts, savedTopic.id);

    if (rows.length > 0) {
      await createQuestions(rows);
    }

    return res.status(201).json({
      ok: true,
      topic: { id: savedTopic.id, name: savedTopic.name, created },
      inserted: rows.length,
      skipped: questions.length - rows.length,
    });

  } catch (err) {
    if (err.message === "DATABASE_DUPLICATE_QUESTION_ERROR") {
      return res.status(409).json({
        ok: false,
        error: "Alcune domande sono state inserite nel frattempo da un altro import: riprova",
      });
    }

    console.error("IMPORT QUESTIONS ERROR:", err);

    return res.status(500).json({
      ok: false,
      error: "Errore interno del server",
    });
  }
});

module.exports = router;
