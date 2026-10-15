const express = require("express");

const { findAttemptById, gradeUngradedAttempt } = require("../models/attempt.model");
const protect = require("../middleware/auth");
const { isUuid } = require("../utils/sqlFilters");
const { selfGradeSchema } = require("../schemas/selfGrade.schema");
const { sendZodError } = require("../utils/zodError");
const { selfGradeScore, computePoints } = require("../utils/scoring");
const { serializeAttempt } = require("../utils/serializeAttempt");

const router = express.Router();

const ATTEMPT_NOT_FOUND = "Tentativo non trovato";
const ATTEMPT_ALREADY_GRADED = "Tentativo già valutato";
const ATTEMPT_IN_EXAM =
  "Il tentativo appartiene a una simulazione: usa POST /exams/:id/self-grade";

// Autovalutazione di riserva di una flashcard
router.post("/:id/self-grade", protect, async (req, res) => {
  try {
    const { id } = req.params;

    if (!isUuid(id)) {
      return res.status(404).json({ ok: false, error: ATTEMPT_NOT_FOUND });
    }

    const parsed = selfGradeSchema.safeParse(req.body);
    if (!parsed.success) return sendZodError(res, parsed.error);

    const attempt = await findAttemptById(id);
    if (!attempt) {
      return res.status(404).json({ ok: false, error: ATTEMPT_NOT_FOUND });
    }
    if (attempt.session_id !== null || attempt.mode === "EXAM") {
      return res.status(409).json({ ok: false, error: ATTEMPT_IN_EXAM });
    }
    if (attempt.verdict !== null || attempt.grading_source !== null) {
      return res.status(409).json({ ok: false, error: ATTEMPT_ALREADY_GRADED });
    }

    const { verdict } = parsed.data;
    const score = selfGradeScore(verdict);

    // Aggiornamento condizionato: un'autovalutazione arrivata prima vince
    const graded = await gradeUngradedAttempt(id, {
      verdict,
      grading_source: "SELF",
      score,
      points: computePoints(score),
      graded_at: new Date().toISOString(),
      grading: null,
    });
    if (!graded) {
      return res.status(409).json({ ok: false, error: ATTEMPT_ALREADY_GRADED });
    }

    return res.json({ ok: true, attempt: serializeAttempt(graded) });

  } catch (err) {
    console.error("POST ATTEMPT SELF-GRADE ERROR:", err.message);

    return res.status(500).json({
      ok: false,
      error: "Errore interno del server",
    });
  }
});

module.exports = router;
