// Contratto dell'API (PROVA-5): le rotte registrate nei router express devono
// corrispondere a server/ENDPOINTS.md e a server/postman_collection.json
// (percorsi, metodi, protezione, body di esempio validi, messaggi d'errore).
// server.js non si carica (fa listen): i router montati si ricavano dal testo.
process.env.JWT_SECRET = "test-secret";
process.env.SUPABASE_URL = "http://127.0.0.1:9";
process.env.SUPABASE_KEY = "test-key";

const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// Nessuna connessione: i router si caricano solo per leggerne le rotte
const dbPath = require.resolve("../config/db_connection");
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { from: () => ({}) } };

const ROOT = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
const protect = require("../middleware/auth");
const { questionsImportSchema } = require("../schemas/questionsImport.schema");
const { questionPatchSchema } = require("../schemas/questionPatch.schema");
const { examDraftSchema } = require("../schemas/examDraft.schema");
const { examSubmitSchema } = require("../schemas/examSubmit.schema");
const { examSelfGradeSchema } = require("../schemas/examSelfGrade.schema");
const { flashcardAnswerSchema } = require("../schemas/flashcardAnswer.schema");
const { selfGradeSchema } = require("../schemas/selfGrade.schema");

const serverSource = read("server.js");
const endpointsDoc = read("ENDPOINTS.md");
const collection = JSON.parse(read("postman_collection.json"));

// --- Rotte del codice -------------------------------------------------------
const joinPath = (prefix, sub) => (sub === "/" ? prefix : `${prefix}${sub}`);

const codeRoutes = (() => {
  const controllers = Object.fromEntries(
    [...serverSource.matchAll(/const (\w+) = require\("\.\/controllers\/([\w.]+)"\)/g)].map((m) => [m[1], m[2]])
  );
  const mounts = [...serverSource.matchAll(/app\.use\("(\/[\w-]+)", (\w+)\)/g)].map((m) => ({ prefix: m[1], name: m[2] }));
  const routes = [];
  for (const { prefix, name } of mounts) {
    const router = require(path.join(ROOT, "controllers", controllers[name]));
    for (const layer of router.stack) {
      if (!layer.route) continue;
      for (const method of Object.keys(layer.route.methods)) {
        routes.push({
          method: method.toUpperCase(),
          path: joinPath(prefix, layer.route.path),
          protected: layer.route.stack.some((l) => l.handle === protect),
        });
      }
    }
  }
  for (const m of serverSource.matchAll(/app\.(get|post|put|patch|delete)\("(\/[\w-]*)"/g)) {
    routes.push({ method: m[1].toUpperCase(), path: m[2], protected: false });
  }
  return { mounts, routes };
})();

const key = (r) => `${r.method} ${r.path}`;

// --- Richieste Postman ------------------------------------------------------
const postmanRequests = (() => {
  const out = [];
  const walk = (items, folder) => {
    for (const item of items) {
      if (item.item) walk(item.item, item.name);
      else out.push({ folder, name: item.name, request: item.request });
    }
  };
  walk(collection.item, null);
  return out;
})();

const segmentsMatch = (routePath, requestPath) => {
  const a = routePath.split("/").filter(Boolean);
  if (a.length !== requestPath.length) return false;
  return a.every((seg, i) => (seg.startsWith(":") ? requestPath[i] !== "" : seg === requestPath[i]));
};
const routeOf = (request) => {
  const matches = codeRoutes.routes.filter((r) => r.method === request.method && segmentsMatch(r.path, request.url.path));
  return matches.length === 1 ? matches[0] : null;
};

// --- ENDPOINTS.md -----------------------------------------------------------
const docBullets = (() => {
  const re = /^- `(GET|POST|PUT|PATCH|DELETE) (\/[^`]*)`/gm;
  const found = [...endpointsDoc.matchAll(re)];
  return found.map((m, i) => {
    const end = i + 1 < found.length ? found[i + 1].index : endpointsDoc.length;
    return { method: m[1], path: m[2], text: endpointsDoc.slice(m.index, end) };
  });
})();

// Body di esempio: variabili sostituite con valori plausibili
const FIXED_UUID = "0a9b8c7d-6e5f-4a3b-8c2d-1e0f9a8b7c6d";
const parseBody = (raw) =>
  JSON.parse(raw.replace(/\{\{\w+Id\}\}/g, FIXED_UUID).replace(/"\{\{\w+\}\}"/g, '"x"').replace(/\{\{\w+\}\}/g, '"x"'));

const BODY_SCHEMAS = {
  "POST /import/questions": questionsImportSchema,
  "PATCH /questions/:id": questionPatchSchema,
  "PUT /exams/:id/answers/:position": examDraftSchema,
  "POST /exams/:id/submit": examSubmitSchema,
  "POST /exams/:id/self-grade": examSelfGradeSchema,
  "POST /flashcards/answer": flashcardAnswerSchema,
  "POST /attempts/:id/self-grade": selfGradeSchema,
};

describe("contratto API: codice, ENDPOINTS.md, Postman", () => {
  test("router montati e rotte registrate", () => {
    assert.deepEqual(
      codeRoutes.mounts.map((m) => m.prefix).sort(),
      ["/attempts", "/auth", "/exams", "/flashcards", "/import", "/questions", "/topics"]
    );
    assert.equal(codeRoutes.routes.length, 19, codeRoutes.routes.map(key).join("\n"));
    assert.equal(new Set(codeRoutes.routes.map(key)).size, codeRoutes.routes.length);
  });

  test("ogni richiesta Postman corrisponde a una sola rotta del codice", () => {
    for (const { name, request } of postmanRequests) {
      assert.ok(routeOf(request), `${name}: ${request.method} /${request.url.path.join("/")} senza rotta`);
    }
  });

  test("ogni rotta del codice ha una richiesta Postman", () => {
    const covered = new Set(postmanRequests.map(({ request }) => routeOf(request)).filter(Boolean).map(key));
    for (const route of codeRoutes.routes) assert.ok(covered.has(key(route)), `${key(route)} senza richiesta Postman`);
  });

  test("ENDPOINTS.md documenta esattamente le rotte del codice", () => {
    assert.deepEqual(docBullets.map(key).sort(), codeRoutes.routes.map(key).sort());
  });

  test("URL Postman coerenti (host, path, raw)", () => {
    for (const { name, request } of postmanRequests) {
      const { url } = request;
      assert.deepEqual(url.host, ["{{baseUrl}}"], name);
      const query = url.query?.length ? `?${url.query.map((q) => `${q.key}=${q.value ?? ""}`).join("&")}` : "";
      assert.equal(url.raw, `{{baseUrl}}/${url.path.join("/")}${query}`, name);
    }
  });

  test("body di esempio presenti, JSON e validi per lo schema della rotta", () => {
    const withBody = new Set();
    for (const { name, request } of postmanRequests) {
      const route = routeOf(request);
      const routeKey = key(route);
      if (!request.body) continue;
      withBody.add(routeKey);
      assert.equal(request.body.mode, "raw", name);
      assert.ok(request.header?.some((h) => h.key === "Content-Type" && h.value === "application/json"), `${name}: Content-Type`);
      const body = parseBody(request.body.raw);
      if (routeKey === "POST /auth/login") {
        assert.equal(typeof body.email, "string");
        assert.equal(typeof body.password, "string");
        continue;
      }
      const schema = BODY_SCHEMAS[routeKey];
      assert.ok(schema, `${name}: body su una rotta senza schema`);
      const parsed = schema.safeParse(body);
      assert.ok(parsed.success, `${name}: ${JSON.stringify(parsed.error?.issues?.slice(0, 3))}`);
    }
    for (const routeKey of [...Object.keys(BODY_SCHEMAS), "POST /auth/login"]) assert.ok(withBody.has(routeKey), `${routeKey} senza body`);
    for (const route of codeRoutes.routes) {
      if (!withBody.has(key(route))) continue;
      assert.notEqual(route.method, "GET", key(route));
      assert.notEqual(route.method, "DELETE", key(route));
    }
    assert.equal(withBody.has("POST /exams"), false);
    assert.equal(withBody.has("POST /exams/:id/grade"), false);
  });

  test("cartella Exams nell'ordine d'uso", () => {
    const exams = postmanRequests.filter((r) => r.folder === "Exams").map(({ request }) => key(routeOf(request)));
    assert.deepEqual(exams, [
      "POST /exams",
      "GET /exams/:id",
      "PUT /exams/:id/answers/:position",
      "POST /exams/:id/submit",
      "POST /exams/:id/self-grade",
      "POST /exams/:id/grade",
      "GET /exams",
    ]);
  });

  test("rotte pubbliche e protette coerenti in codice, Postman e ENDPOINTS.md", () => {
    assert.equal(collection.auth?.type, "bearer");
    assert.ok(collection.auth.bearer.some((b) => b.value === "{{token}}"));
    const publicRoutes = codeRoutes.routes.filter((r) => !r.protected).map(key).sort();
    assert.deepEqual(publicRoutes, ["GET /health", "POST /auth/login"]);
    for (const { name, request } of postmanRequests) {
      const route = routeOf(request);
      if (route.protected) assert.notEqual(request.auth?.type, "noauth", name);
      else assert.equal(request.auth?.type, "noauth", name);
    }
    for (const bullet of docBullets) {
      const route = codeRoutes.routes.find((r) => key(r) === key(bullet));
      assert.ok(bullet.text.includes(route.protected ? "**Protetta.**" : "**Pubblica.**"), key(bullet));
    }
  });

  test("messaggi d'errore citati in ENDPOINTS.md uguali al codice", () => {
    const MESSAGES = {
      "controllers/auth.controller.js": ["Email e password sono obbligatorie", "Credenziali non valide"],
      "middleware/auth.js": ["Non autenticato", "Token non valido o scaduto"],
      "server.js": ["Rotta non trovata"],
      "middleware/errorHandler.js": ["Il body della richiesta non è un JSON valido", "Il body della richiesta è troppo grande"],
      "controllers/import.controller.js": ["Alcune domande sono state inserite nel frattempo da un altro import: riprova"],
      "controllers/exams.controller.js": [
        "Simulazione non trovata",
        "Simulazione già consegnata",
        "Tempo scaduto: la simulazione non accetta più risposte",
        "Domanda non trovata in questa simulazione",
        "Simulazione già valutata",
        "La simulazione non è in attesa di autovalutazione",
        "Simulazione non ancora consegnata",
        "Valutazione già in corso: riprova tra qualche minuto",
        "Valutazione AI non disponibile: riprova più tardi",
      ],
      "controllers/flashcards.controller.js": ["Domanda non trovata"],
      "controllers/attempts.controller.js": [
        "Tentativo non trovato",
        "Tentativo già valutato",
        "Il tentativo appartiene a una simulazione: usa POST /exams/:id/self-grade",
      ],
    };
    for (const [file, messages] of Object.entries(MESSAGES)) {
      const source = read(file);
      for (const message of messages) {
        assert.ok(source.includes(message), `${message} non in ${file}`);
        assert.ok(endpointsDoc.includes(message), `${message} non in ENDPOINTS.md`);
      }
    }
    assert.ok(read("controllers/exams.controller.js").includes("Servono almeno ${EXAM_QUESTIONS} domande per avviare una simulazione"));
    assert.ok(endpointsDoc.includes("Servono almeno 6 domande per avviare una simulazione"));
  });

  test("GET /exams documentato: filtri, ordinamento, nessuna consegna automatica", () => {
    const bullet = docBullets.find((b) => key(b) === "GET /exams");
    for (const word of ["started_at", "grade", "IN_PROGRESS", "GRADING", "GRADED", "SELF_GRADED", "data: []"]) {
      assert.ok(bullet.text.includes(word), word);
    }
    assert.match(bullet.text, /non consegna/i);
  });
});
