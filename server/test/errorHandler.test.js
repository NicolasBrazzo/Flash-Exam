// Handler d'errore globale (PROVA-5): un body JSON malformato o troppo grande
// non è un errore interno. Nessun Supabase: solo express e il middleware.
const { describe, test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const errorHandler = require("../middleware/errorHandler");

describe("middleware/errorHandler", () => {
  let server;
  let baseUrl;
  let originalError;

  before(async () => {
    originalError = console.error;
    console.error = () => {};
    const app = express();
    app.use(express.json());
    app.post("/echo", (req, res) => res.json({ ok: true, body: req.body }));
    app.get("/boom", () => {
      throw new Error("boom");
    });
    app.use(errorHandler);
    await new Promise((resolve) => {
      server = app.listen(0, "127.0.0.1", resolve);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(() => {
    console.error = originalError;
    return new Promise((resolve) => server.close(resolve));
  });

  const post = async (raw) => {
    const res = await fetch(`${baseUrl}/echo`, { method: "POST", headers: { "Content-Type": "application/json" }, body: raw });
    return { status: res.status, body: await res.json() };
  };

  test("JSON malformato: 400", async () => {
    const res = await post("{bad");
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, { ok: false, error: "Il body della richiesta non è un JSON valido" });
  });

  test("body oltre il limite: 413", async () => {
    const res = await post(JSON.stringify({ text: "a".repeat(200 * 1024) }));
    assert.equal(res.status, 413);
    assert.deepEqual(res.body, { ok: false, error: "Il body della richiesta è troppo grande" });
  });

  test("JSON valido: passa", async () => {
    const res = await post('{"a":1}');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.body, { a: 1 });
  });

  test("altri errori: 500 generico", async () => {
    const res = await fetch(`${baseUrl}/boom`);
    assert.equal(res.status, 500);
    assert.deepEqual(await res.json(), { ok: false, error: "Errore interno del server" });
  });

  test("server.js usa il middleware dopo il 404", () => {
    const source = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
    assert.ok(source.includes('require("./middleware/errorHandler")'));
    const notFound = source.indexOf("Rotta non trovata");
    const use = source.indexOf("app.use(errorHandler)");
    assert.ok(notFound > 0 && use > notFound);
  });
});
