// Verifica di client/src/utils/examTimer.js (il client non ha un test runner).
// Uso: node scripts/checks/examTimer.check.mjs
import assert from "node:assert/strict";
import {
  EXAM_TICK_MS,
  SUBMIT_FLUSH_WAIT_MS,
  remainingSeconds,
  formatRemaining,
  isExpired,
  createSubmitGuard,
  resultPath,
  submitErrorText,
  isTimeOverError,
  isExpiredNow,
} from "../../client/src/utils/examTimer.js";
import { buildSubmitAnswers } from "../../client/src/utils/examDraft.js";

let count = 0;
const check = (fn) => {
  fn();
  count += 1;
};

const E = "2026-10-15T10:40:00.000Z";
const e = Date.parse(E);
const NETWORK_TEXT = "Consegna non riuscita: server non raggiungibile. Le risposte restano in questa pagina, riprova tra poco.";

check(() => assert.equal(formatRemaining(E, e - 40 * 60000), "40:00"));
check(() => assert.equal(formatRemaining(E, e - 61000), "01:01"));
check(() => assert.equal(formatRemaining(E, e - 59001), "01:00"));
check(() => assert.equal(formatRemaining(E, e - 500), "00:01"));
check(() => assert.equal(formatRemaining(E, e), "00:00"));
check(() => assert.equal(formatRemaining(E, e + 90000), "00:00"));
check(() => assert.equal(formatRemaining(E, e - 100 * 60000), "100:00"));
check(() => assert.equal(formatRemaining("non-una-data", e), "--:--"));

check(() => {
  assert.equal(remainingSeconds(E, e - 1500), 2);
  assert.equal(remainingSeconds(E, e + 1), 0);
  assert.equal(remainingSeconds("x", e), null);
});

check(() => {
  assert.equal(isExpired(E, e - 1), false);
  assert.equal(isExpired(E, e), true);
  assert.equal(isExpired(E, e + 5000), true);
  assert.equal(isExpired("x", e), false);
});

check(() => {
  const g = createSubmitGuard();
  assert.equal(g.tryAcquire(), true);
  assert.equal(g.tryAcquire(), false);
  assert.equal(g.isBusy(), true);
  g.release();
  assert.equal(g.isBusy(), false);
  assert.equal(g.tryAcquire(), true);
  g.markDone();
  g.release();
  assert.equal(g.tryAcquire(), false);
});

check(() => {
  const a = createSubmitGuard();
  const b = createSubmitGuard();
  assert.equal(a.tryAcquire(), true);
  assert.equal(b.tryAcquire(), true);
});

check(() => assert.equal(resultPath("e1"), "/simulazione/e1/risultato"));

check(() => {
  assert.equal(submitErrorText({ status: 409, message: "Simulazione già consegnata" }), "Simulazione già consegnata");
  assert.equal(submitErrorText({ status: 409 }), "La prova è già stata consegnata");
});

check(() => assert.equal(submitErrorText({ status: null, message: "Server non raggiungibile. Riprova più tardi." }), NETWORK_TEXT));

check(() => {
  assert.equal(submitErrorText({ status: 500, message: "Errore interno" }), "Errore interno");
  assert.equal(submitErrorText({ status: 500 }), "Consegna non riuscita, riprova.");
});

check(() => {
  assert.ok(EXAM_TICK_MS <= 1000);
  assert.ok(SUBMIT_FLUSH_WAIT_MS <= 5000);
});

check(() => {
  const body = buildSubmitAnswers({ 1: "a", 2: "b", 3: "", 4: "d", 5: "e", 6: "f" });
  assert.equal(body.length, 6);
  assert.deepEqual(body.map((x) => x.position), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(body.map((x) => x.answer), ["a", "b", "", "d", "e", "f"]);
});

check(() => {
  assert.equal(isTimeOverError({ status: 409, message: "Tempo scaduto: la simulazione non accetta più risposte" }), true);
  assert.equal(isTimeOverError({ status: 409, message: "Simulazione già consegnata" }), false);
  assert.equal(isTimeOverError({ status: 400, message: "Tempo scaduto" }), false);
  assert.equal(isTimeOverError(null), false);
});

check(() => {
  assert.equal(isExpiredNow(new Date(Date.now() - 1000).toISOString()), true);
  assert.equal(isExpiredNow(new Date(Date.now() + 60000).toISOString()), false);
  assert.equal(isExpiredNow("x"), false);
});

console.log(`examTimer: ${count} casi superati`);
