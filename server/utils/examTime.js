// Orari della simulazione (puro: l'ora corrente si passa, per i test)
const { EXAM_DURATION_MINUTES } = require("../config/exam");

// Inizio e scadenza di una nuova prova, decisi dal server
const buildExamTimes = (now = new Date()) => ({
  started_at: now.toISOString(),
  expires_at: new Date(now.getTime() + EXAM_DURATION_MINUTES * 60 * 1000).toISOString(),
});

module.exports = { buildExamTimes };
