// Timer e consegna della simulazione (funzioni pure: l'ora si passa, per i check)

// Frequenza di aggiornamento del timer: sotto il secondo per non saltarne uno
export const EXAM_TICK_MS = 500;
// Attesa massima dei salvataggi in bozza in volo prima della consegna
export const SUBMIT_FLUSH_WAIT_MS = 3000;

const NETWORK_ERROR_TEXT =
  "Consegna non riuscita: server non raggiungibile. Le risposte restano in questa pagina, riprova tra poco.";

// Secondi rimanenti fino a expires_at (per eccesso, minimo 0); null se la data non è valida
export const remainingSeconds = (expiresAt, now) => {
  const expires = Date.parse(expiresAt);
  if (!Number.isFinite(expires)) return null;
  return Math.ceil(Math.max(0, expires - now) / 1000);
};

// "mm:ss" calcolato ogni volta da expires_at e dall'ora corrente
export const formatRemaining = (expiresAt, now) => {
  const seconds = remainingSeconds(expiresAt, now);
  if (seconds === null) return "--:--";
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
};

// Tempo scaduto? Con una data non valida no: nessuna consegna parte per errore
export const isExpired = (expiresAt, now) => {
  const expires = Date.parse(expiresAt);
  return Number.isFinite(expires) && now >= expires;
};

// Tempo scaduto adesso (fuori dal render: per i gestori d'evento)
export const isExpiredNow = (expiresAt) => isExpired(expiresAt, Date.now());

// Guardia della consegna unica (doppio click, più tick, scadenza col Modal aperto)
export const createSubmitGuard = () => {
  let busy = false;
  let done = false;
  return {
    tryAcquire: () => {
      if (busy || done) return false;
      busy = true;
      return true;
    },
    release: () => {
      busy = false;
    },
    markDone: () => {
      done = true;
    },
    isBusy: () => busy,
  };
};

// 409 "tempo scaduto" di una bozza: la prova non è consegnata, va consegnata
// (il server la accetta comunque e valuta le bozze salvate). Il testo è quello di
// EXAM_TIME_OVER in server/controllers/exams.controller.js, citato in ENDPOINTS.md:
// se cambia lì va cambiato anche qui
export const isTimeOverError = (err) => err?.status === 409 && /^Tempo scaduto/.test(err?.message ?? "");

export const resultPath = (id) => `/simulazione/${id}/risultato`;

// Messaggio da mostrare se la consegna non riesce
export const submitErrorText = (err) => {
  if (err?.status === 409) return err.message || "La prova è già stata consegnata";
  if (err?.status == null) return NETWORK_ERROR_TEXT;
  return err.message || "Consegna non riuscita, riprova.";
};
