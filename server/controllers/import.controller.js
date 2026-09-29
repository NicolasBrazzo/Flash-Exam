const express = require("express");

const { findTopicByName, createTopic } = require("../models/topic.model");
const {
  getQuestionPromptsByTopic,
  createQuestions,
} = require("../models/question.model");
const protect = require("../middleware/auth");
const { questionsImportSchema } = require("../schemas/questionsImport.schema");
const { sendZodError } = require("../utils/zodError");

const router = express.Router();

// Stessa normalizzazione dell'indice univoco su FE_Questions:
// lower(regexp_replace(btrim(prompt), '\s+', ' ', 'g'))
const normalizePrompt = (prompt) =>
  prompt.trim().replace(/\s+/g, " ").toLowerCase();

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
    const seen = new Set(
      created ? [] : (await getQuestionPromptsByTopic(savedTopic.id)).map(normalizePrompt)
    );

    const rows = [];
    for (const question of questions) {
      const key = normalizePrompt(question.prompt);
      if (seen.has(key)) continue;
      seen.add(key);

      rows.push({
        topic_id: savedTopic.id,
        prompt: question.prompt,
        answer: question.answer,
        rubric: question.rubric,
        article_refs: question.references,
      });
    }

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
