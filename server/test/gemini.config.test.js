const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const SERVER_DIR = path.join(__dirname, "..");
const CONFIG_PATH = path.join(SERVER_DIR, "config", "gemini.js");
const CLIENT_DIR = path.join(SERVER_DIR, "..", "client");
const FAKE_KEY = "chiave-finta-SEGRETA-123";
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

// config/gemini.js lancia all'import: lo si carica in un processo separato,
// con un ambiente costruito da zero (nessuna GEMINI_* ereditata)
const run = (env) =>
  spawnSync(
    process.execPath,
    ["-e", `const c = require(${JSON.stringify(CONFIG_PATH)}); process.stdout.write(JSON.stringify(c))`],
    { cwd: SERVER_DIR, env: { PATH: process.env.PATH, ...env }, encoding: "utf8" }
  );

const expectFailure = (env, variable) => {
  const res = run(env);
  assert.notEqual(res.status, 0, "il modulo doveva lanciare");
  assert.ok(res.stderr.includes(variable), `stderr senza ${variable}: ${res.stderr}`);
  assert.equal(res.stderr.includes(FAKE_KEY), false, "la chiave compare nello stderr");
};

describe("config/gemini.js: fallimento immediato", () => {
  test("nessuna variabile", () => {
    expectFailure({}, "GEMINI_API_KEY");
  });

  test("manca il modello", () => {
    expectFailure({ GEMINI_API_KEY: FAKE_KEY }, "GEMINI_MODEL");
  });

  test("manca la chiave", () => {
    expectFailure({ GEMINI_MODEL: "modello-x" }, "GEMINI_API_KEY");
  });

  test("chiave di soli spazi", () => {
    expectFailure({ GEMINI_API_KEY: "   ", GEMINI_MODEL: "modello-x" }, "GEMINI_API_KEY");
  });

  test("modello di soli spazi", () => {
    expectFailure({ GEMINI_API_KEY: FAKE_KEY, GEMINI_MODEL: "   " }, "GEMINI_MODEL");
  });
});

describe("config/gemini.js: export", () => {
  test("chiave, modello e URL base", () => {
    const res = run({ GEMINI_API_KEY: FAKE_KEY, GEMINI_MODEL: "modello-x" });
    assert.equal(res.status, 0, res.stderr);
    assert.deepEqual(JSON.parse(res.stdout), {
      GEMINI_API_KEY: FAKE_KEY,
      GEMINI_MODEL: "modello-x",
      GEMINI_BASE_URL: BASE_URL,
    });
  });

  test("valori ripuliti dagli spazi", () => {
    const res = run({ GEMINI_API_KEY: `  ${FAKE_KEY}  `, GEMINI_MODEL: " modello-x " });
    assert.equal(res.status, 0, res.stderr);
    const config = JSON.parse(res.stdout);
    assert.equal(config.GEMINI_API_KEY, FAKE_KEY);
    assert.equal(config.GEMINI_MODEL, "modello-x");
  });
});

describe("integrazione della configurazione", () => {
  test("server.js la richiede dopo dotenv e prima dei controller", () => {
    const source = fs.readFileSync(path.join(SERVER_DIR, "server.js"), "utf8");
    const gemini = source.search(/require\(["']\.\/config\/gemini["']\)/);
    const dotenv = source.indexOf("dotenv').config()") >= 0
      ? source.indexOf("dotenv').config()")
      : source.indexOf('dotenv").config()');
    const firstController = source.search(/require\(["']\.\/controllers\//);
    assert.ok(gemini >= 0, "require di config/gemini assente");
    assert.ok(dotenv >= 0 && gemini > dotenv, "config/gemini richiesto prima di dotenv");
    assert.ok(firstController >= 0 && gemini < firstController, "config/gemini richiesto dopo i controller");
  });

  test(".env.example ha le due variabili, vuote", () => {
    const example = fs.readFileSync(path.join(SERVER_DIR, ".env.example"), "utf8");
    assert.match(example, /^GEMINI_API_KEY=$/m);
    assert.match(example, /^GEMINI_MODEL=$/m);
  });

  test("il client non conosce Gemini", () => {
    assert.ok(fs.existsSync(CLIENT_DIR), "cartella client/ assente");
    const offenders = [];
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name === "dist") continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (fs.readFileSync(full, "utf8").includes("GEMINI")) offenders.push(full);
      }
    };
    walk(CLIENT_DIR);
    assert.deepEqual(offenders, []);
  });
});
