// Orari della simulazione (puro: l'ora corrente si passa, per i test)
const { EXAM_DURATION_MINUTES, EXAM_GRACE_SECONDS } = require("../config/exam");

// Inizio e scadenza di una nuova prova, decisi dal server
const buildExamTimes = (now = new Date()) => ({
  started_at: now.toISOString(),
  expires_at: new Date(now.getTime() + EXAM_DURATION_MINUTES * 60 * 1000).toISOString(),
});

// La prova accetta ancora risposte e consegna fino a expires_at più la
// tolleranza (D7). Non guarda lo stato: lo controlla il chiamante.
// `now` può essere un Date o un numero di millisecondi
const isWithinDeadline = (exam, now = new Date(), graceSeconds = EXAM_GRACE_SECONDS) => {
  const t = now instanceof Date ? now.getTime() : Number(now);
  const expires = Date.parse(exam?.expires_at);
  if (!Number.isFinite(t) || !Number.isFinite(expires)) return false;
  return t <= expires + graceSeconds * 1000;
};

module.exports = { buildExamTimes, isWithinDeadline };
