const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizePrompt,
  selectNewQuestions,
  isDemoEnabled,
} = require("../utils/importQuestions");
require("../database/demoData");

const question = (prompt, references = ["2"]) => ({
  prompt,
  answer: "Risposta di riferimento.",
  rubric: [
    { id: "c1", concept: "primo", weight: 1 },
    { id: "c2", concept: "secondo", weight: 2 },
  ],
  references,
});

describe("normalizePrompt", () => {
  test("rimuove gli spazi ai bordi, compatta quelli interni e passa in minuscolo", () => {
    assert.equal(
      normalizePrompt("  Come   si\tacquisisce\n LA Capacità? "),
      "come si acquisisce la capacità?"
    );
  });
});

describe("selectNewQuestions", () => {
  test("mappa le domande nelle righe DB", () => {
    const qs = [question("Prima domanda?", ["1", "2"]), question("Seconda domanda?", [])];
    const rows = selectNewQuestions(qs, [], "t1");
    assert.equal(rows.length, 2);
    for (const [i, row] of rows.entries()) {
      assert.deepEqual(Object.keys(row).sort(), ["answer", "article_refs", "prompt", "rubric", "topic_id"]);
      assert.equal(row.topic_id, "t1");
      assert.equal(row.prompt, qs[i].prompt);
      assert.equal(row.answer, qs[i].answer);
      assert.deepEqual(row.rubric, qs[i].rubric);
      assert.deepEqual(row.article_refs, qs[i].references);
      assert.equal("references" in row, false);
    }
  });

  test("scarta i duplicati nel file (spazi e maiuscole a parte), tiene il primo", () => {
    const qs = [question("Che cos'è il  contratto?", ["1"]), question("che cos'è il contratto?", ["2"])];
    const rows = selectNewQuestions(qs, [], "t1");
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0].article_refs, ["1"]);
  });

  test("scarta le domande già presenti nell'argomento", () => {
    const qs = [question("Come si acquisisce la capacità giuridica?"), question("Altra domanda?")];
    const rows = selectNewQuestions(qs, ["  come SI acquisisce   la capacità giuridica?"], "t1");
    assert.deepEqual(rows.map((r) => r.prompt), ["Altra domanda?"]);
  });

  test("secondo giro sugli stessi dati: nessuna riga nuova", () => {
    const qs = [question("Uno?"), question("Due?"), question("Tre?")];
    const first = selectNewQuestions(qs, [], "t1");
    assert.equal(first.length, 3);
    assert.deepEqual(selectNewQuestions(qs, first.map((r) => r.prompt), "t1"), []);
  });

  test("non modifica l'input", () => {
    const qs = [question("Uno?"), question("uno?")];
    const existing = ["Due?"];
    const qsCopy = structuredClone(qs);
    const existingCopy = structuredClone(existing);
    selectNewQuestions(qs, existing, "t1");
    assert.deepEqual(qs, qsCopy);
    assert.deepEqual(existing, existingCopy);
  });
});

describe("isDemoEnabled", () => {
  test("solo la stringa esatta \"true\" attiva i dati demo", () => {
    assert.equal(isDemoEnabled({ SEED_DEMO: "true" }), true);
    for (const value of [undefined, "", "false", "TRUE", "1", " true", "yes"]) {
      assert.equal(isDemoEnabled({ SEED_DEMO: value }), false, `SEED_DEMO=${JSON.stringify(value)}`);
    }
    assert.equal(isDemoEnabled({}), false);
  });
});

describe("purezza dei moduli", () => {
  test("utils/importQuestions e database/demoData non caricano la connessione al DB", () => {
    const loaded = Object.keys(require.cache).filter((key) =>
      key.replace(/\\/g, "/").endsWith("config/db_connection.js")
    );
    assert.deepEqual(loaded, []);
  });
});
