const express = require("express");

const {
  findQuestionById,
  getRandomQuestionsByTopics,
} = require("../models/question.model");
const { createFlashcardAttempt, updateAttempt } = require("../models/attempt.model");
const protect = require("../middleware/auth");
const { parseFlashcardQuery } = require("../utils/flashcardQuery");
const { serializeFlashcard } = require("../utils/serializeQuestion");
const { serializeAttempt } = require("../utils/serializeAttempt");
const { flashcardAnswerSchema } = require("../schemas/flashcardAnswer.schema");
const { sendZodError } = require("../utils/zodError");
const { computeScore, computePoints, emptyAnswerResult } = require("../utils/scoring");
// Il grader si chiama sull'oggetto del modulo al momento della richiesta
const grader = require("../services/grader");

const GRADER_ERRORS = ["GRADER_UNAVAILABLE", "GRADER_INVALID_OUTPUT"];

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
router.post("/answer", protect, async (req, res) => {
  try {
    const parsed = flashcardAnswerSchema.safeParse(req.body ?? {});
    if (!parsed.success) return sendZodError(res, parsed.error);

    const { question_id, answer } = parsed.data;

    const question = await findQuestionById(question_id);
    if (!question) {
      return res.status(404).json({ ok: false, error: "Domanda non trovata" });
    }

    // Prima si salva la risposta: anche se la valutazione fallisce non si perde
    let attempt = await createFlashcardAttempt({ question_id, answer });

    if (answer.trim() === "") {
      // D6: risposta vuota, niente AI, sbagliata d'ufficio
      attempt = await updateAttempt(attempt.id, {
        ...emptyAnswerResult(),
        graded_at: new Date().toISOString(),
      });
    } else {
      try {
        const output = await grader.gradeAnswer({
          prompt: question.prompt,
          referenceAnswer: question.answer,
          rubric: question.rubric,
          references: question.article_refs ?? [],
          answer,
        });
        const score = computeScore({
          rubric: question.rubric,
          concepts: output.concepts,
          corrections: output.corrections,
        });
        attempt = await updateAttempt(attempt.id, {
          verdict: output.verdict,
          grading: output,
          grading_source: "AI",
          score,
          points: computePoints(score),
          graded_at: new Date().toISOString(),
        });
      } catch (err) {
        // Grader non disponibile: il tentativo resta da valutare (autovalutazione)
        if (!GRADER_ERRORS.includes(err.message)) throw err;
        console.error("FLASHCARD GRADER FALLBACK:", err.message, "attempt", attempt.id);
      }
    }

    if (!attempt) throw new Error("ATTEMPT_UPDATE_NOT_FOUND");

    return res.status(201).json({ ok: true, attempt: serializeAttempt(attempt, question) });

  } catch (err) {
    // Solo il messaggio: niente body della richiesta nei log
    console.error("POST FLASHCARD ANSWER ERROR:", err.message);

    return res.status(500).json({
      ok: false,
      error: "Errore interno del server",
    });
  }
});

module.exports = router;
