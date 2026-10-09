const express = require("express");

const {
  getExamSessions,
  findExamSessionById,
  findInProgressExamSession,
  createExamSession,
  updateExamSession,
  deleteExamSession,
} = require("../models/examSession.model");
const {
  getAttemptsBySession,
  findAttemptBySessionAndPosition,
  createExamAttempts,
  updateAttempt,
} = require("../models/attempt.model");
const { getRandomQuestions } = require("../models/question.model");
const protect = require("../middleware/auth");
const { EXAM_QUESTIONS } = require("../config/exam");
const { buildExamTimes, isWithinDeadline } = require("../utils/examTime");
const { serializeExam } = require("../utils/serializeExam");
const { isUuid } = require("../utils/sqlFilters");
const { examDraftSchema } = require("../schemas/examDraft.schema");
const { sendZodError } = require("../utils/zodError");

const EXAM_NOT_FOUND = "Simulazione non trovata";
const EXAM_ALREADY_SUBMITTED = "Simulazione già consegnata";
const EXAM_TIME_OVER = "Tempo scaduto: la simulazione non accetta più risposte";
const POSITION_NOT_FOUND = "Domanda non trovata in questa simulazione";

// Posizione dall'URL: intero da 1 a EXAM_QUESTIONS, senza zeri iniziali
const parsePosition = (value) => {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const position = Number(value);
  return position <= EXAM_QUESTIONS ? position : null;
};

const serverError = (res, label, err) => {
  console.error(label, err);
  return res.status(500).json({ ok: false, error: "Errore interno del server" });
};

const router = express.Router();

// Storico delle simulazioni
router.get("/", protect, async (req, res) => {});

// Dettaglio di una simulazione
router.get("/:id", protect, async (req, res) => {
  try {
    const { id } = req.params;

    if (!isUuid(id)) {
      return res.status(404).json({ ok: false, error: EXAM_NOT_FOUND });
    }

    const session = await findExamSessionById(id);
    if (!session) {
      return res.status(404).json({ ok: false, error: EXAM_NOT_FOUND });
    }

    // PROVA-4: una prova IN_PROGRESS scaduta (oltre la tolleranza) va consegnata
    // automaticamente con le bozze salvate prima di rispondere

    const attempts = await getAttemptsBySession(session.id);

    return res.json({ ok: true, exam: serializeExam(session, attempts) });

  } catch (err) {
    return serverError(res, "GET EXAM ERROR:", err);
  }
});

// Avvia una nuova simulazione (o riprende quella in corso)
router.post("/", protect, async (req, res) => {
  try {
    const inProgress = await findInProgressExamSession();

    // Una prova in corso si riprende (ed è ancora consegnabile) fino a
    // expires_at più la tolleranza
    if (inProgress && isWithinDeadline(inProgress)) {
      const attempts = await getAttemptsBySession(inProgress.id);
      return res.json({ ok: true, exam: serializeExam(inProgress, attempts), resumed: true });
    }

    // PROVA-4: qui la prova IN_PROGRESS scaduta va consegnata automaticamente
    // prima di proseguire. Per ora non viene ripresa e se ne crea una nuova

    // D4: estrazione su tutto il materiale
    const questions = await getRandomQuestions(EXAM_QUESTIONS);
    if (questions.length < EXAM_QUESTIONS) {
      return res.status(409).json({
        ok: false,
        error: `Servono almeno ${EXAM_QUESTIONS} domande per avviare una simulazione`,
      });
    }

    const session = await createExamSession(buildExamTimes());

    let attempts;
    try {
      attempts = await createExamAttempts(
        questions.map((question, i) => ({
          session_id: session.id,
          question_id: question.id,
          mode: "EXAM",
          position: i + 1,
          answer: "",
        }))
      );
    } catch (err) {
      // Nessuna prova a metà: senza tentativi la sessione si rimuove
      try {
        await deleteExamSession(session.id);
      } catch (deleteErr) {
        console.error("DELETE EXAM SESSION (ROLLBACK) ERROR:", deleteErr);
      }
      throw err;
    }

    return res.status(201).json({
      ok: true,
      exam: serializeExam(session, attempts),
      resumed: false,
    });

  } catch (err) {
    return serverError(res, "POST EXAM ERROR:", err);
  }
});

// Salva in bozza la risposta a una domanda
router.put("/:id/answers/:position", protect, async (req, res) => {
  try {
    const now = new Date();
    const { id } = req.params;

    if (!isUuid(id)) {
      return res.status(404).json({ ok: false, error: EXAM_NOT_FOUND });
    }

    const position = parsePosition(req.params.position);
    if (!position) {
      return res.status(400).json({
        ok: false,
        error: `Posizione non valida: deve essere un intero da 1 a ${EXAM_QUESTIONS}`,
      });
    }

    const parsed = examDraftSchema.safeParse(req.body);
    if (!parsed.success) return sendZodError(res, parsed.error);

    const session = await findExamSessionById(id);
    if (!session) {
      return res.status(404).json({ ok: false, error: EXAM_NOT_FOUND });
    }
    if (session.status !== "IN_PROGRESS") {
      return res.status(409).json({ ok: false, error: EXAM_ALREADY_SUBMITTED });
    }
    if (!isWithinDeadline(session, now)) {
      return res.status(409).json({ ok: false, error: EXAM_TIME_OVER });
    }

    const attempt = await findAttemptBySessionAndPosition(session.id, position);
    if (!attempt) {
      return res.status(404).json({ ok: false, error: POSITION_NOT_FOUND });
    }

    // Solo la risposta: updated_at lo valorizza il model
    const updated = await updateAttempt(attempt.id, { answer: parsed.data.answer });
    if (!updated) {
      return res.status(404).json({ ok: false, error: POSITION_NOT_FOUND });
    }

    return res.json({ ok: true, updated_at: updated.updated_at });

  } catch (err) {
    return serverError(res, "PUT EXAM ANSWER ERROR:", err);
  }
});

// Consegna la prova e la fa valutare
router.post("/:id/submit", protect, async (req, res) => {});

// Autovalutazione di riserva
router.post("/:id/self-grade", protect, async (req, res) => {});

// Riprova la valutazione AI
router.post("/:id/grade", protect, async (req, res) => {});

module.exports = router;
