# API Endpoints

Documentazione delle rotte del backend Express.

> Questo file è il riferimento di ogni rotta del backend: se aggiungi, rimuovi
> o modifichi un endpoint, aggiorna questo file nella stessa modifica.

## Test delle API con Postman

Nel repo è committata la collection [`postman_collection.json`](./postman_collection.json)
(Postman → File → Import). Contiene tutte le rotte con la variabile `{{baseUrl}}`
(default `http://localhost:3000` — per il deploy sostituirla con il dominio del
backend) e `{{token}}`, valorizzata automaticamente dopo il Login.
Se aggiungi o modifichi un endpoint, aggiorna anche la collection.

## Convenzioni generali

- **Base URL**: definito dalla porta del server (`PORT`, default `3000`). Es. `http://localhost:3000`.
- **Formato**: tutte le richieste e risposte usano JSON (`Content-Type: application/json`).
- **Formato risposta**: ogni risposta ha la forma `{ "ok": true, ... }` in caso di successo, oppure `{ "ok": false, "error": <string | string[]> }` in caso di errore.
- **Autenticazione**: le rotte protette richiedono l'header `Authorization: Bearer <token>`. Il token JWT si ottiene tramite `POST /auth/login`.
- **Utente unico**: non esiste registrazione pubblica. L'unica utente viene creata da `npm run seed` a partire dalle variabili `SEED_*` del `.env`.
- **Logout**: è solo lato client (rimozione del token da `localStorage`), non esiste una rotta dedicata.

### Errori comuni di autenticazione

| Codice | Quando |
|--------|--------|
| `401 Non autenticato` | Header `Authorization` assente o non nel formato `Bearer <token>` |
| `401 Token non valido o scaduto` | Token JWT non verificabile o scaduto |
| `404 Rotta non trovata` | Endpoint inesistente |
| `500 Errore interno del server` | Errore non gestito lato server |

---

## Auth — `/auth`

- `POST /auth/login` — Autenticazione utente. **Pubblica.**
  Body: `{ "email": string, "password": string }`. Risposta: `{ "ok": true, "token": string }`.
  `400` se manca email o password, `401` con credenziali non valide.
- `GET /auth/me` — Dati dell'utente autenticato (letti dal token: `sub`, `email`, `first_name`, `last_name`). **Protetta.**

---

## Regole comuni alle rotte di dominio

Valgono per tutte le sezioni seguenti. Tutte le rotte di dominio sono **protette**.

- **Dati mai esposti**: `score` (punteggio interno 0-1) e `points` (punti 0-5 della singola domanda) non escono mai dalle API. Di una simulazione si restituiscono solo `grade` e `honors`. Dell'output del grader si espone solo `feedback`: `{ corrections, suggestion, exampleAnswer }`. `concepts` resta sul server.
- **Nomi dei campi**: `answer` è sempre la risposta scritta da lei `reference_answer` è la risposta di riferimento della domanda (colonna `answer` di `FE_Questions`). `references` è l'array dei riferimenti normativi (colonna `article_refs`).
- **Elenchi paginati**: seguono [`client/src/FILTERS_BE.md`](../client/src/FILTERS_BE.md)
  (`page`, `limit`, `sort`, `order`), con la risposta
  `{ "ok": true, "data": [...], "pagination": { total, page, limit, totalPages } }`.
- **Validazione**: i body che arrivano da fuori sono validati con Zod
  (`server/schemas/`); in caso di errore `400` con `error` come array di
  `"path: messaggio"`.
- **Id non validi o inesistenti**: `404` con un messaggio specifico della
  risorsa (es. `"Simulazione non trovata"`).

---

## Import — `/import`

- `POST /import/questions` — Importa le domande di un argomento da JSON. **Protetta.**
  Body: il JSON di import, un file per argomento (formato in `docs/PROGETTO.md`):
  ```json
  {
    "topic": { "name": "Capacità giuridica e capacità d'agire" },
    "questions": [
      {
        "prompt": "Come si acquisisce la capacità giuridica?",
        "answer": "Si acquisisce al momento della nascita. ...",
        "rubric": [
          { "id": "c1", "concept": "Acquisto con la nascita", "weight": 2 },
          { "id": "c2", "concept": "Diritti del concepito subordinati alla nascita", "weight": 1 }
        ],
        "references": ["1"]
      }
    ]
  }
  ```
  - L'argomento si riusa se `topic.name` esiste già, altrimenti si crea.
  - **Idempotente**: una domanda con lo stesso prompt normalizzato nello stesso
    argomento non viene reinserita ma conteggiata in `skipped`. Lo stesso vale
    per i duplicati dentro lo stesso file.
  - Risposta `201`:
    `{ "ok": true, "topic": { "id", "name", "created": boolean }, "inserted": number, "skipped": number }`.
  - `400` se il JSON non rispetta lo schema: `topic.name` o `questions`
    mancanti, rubrica fuori da 2-4 concetti, `id` di rubrica duplicati, `weight`
    non intero positivo, e così via.
  - `409` se, mentre l'import era in corso, un altro import ha inserito una
    delle stesse domande: non viene inserito nulla e basta riprovare.

---

## Topics — `/topics`

- `GET /topics` — Elenco completo degli argomenti. **Protetta.**
  Serve per la scelta degli argomenti nelle flashcard e per i filtri della
  pagina domande. Non è paginato, perché gli argomenti sono circa 50.
  Ordinamento: `position`, poi `name`.
  Risposta: `{ "ok": true, "topics": [{ "id", "name", "position", "question_count" }] }`.

---

## Questions — `/questions`

- `GET /questions` — Elenco paginato delle domande (`client/src/FILTERS_BE.md`). **Protetta.**
  Query: `topic_id` (filtro per argomento), `q` (ricerca case-insensitive nel
  prompt; `%` e `_` sono letterali), `page` (default `1`), `limit` (default `20`,
  massimo `100`), `sort` (whitelist: `created_at`, `prompt`; default
  `created_at`), `order` (`asc`, qualsiasi altro valore `desc`). Parametri vuoti
  = nessun filtro; un `topic_id` che non è un uuid dà `data: []`.
  Risposta: `{ "ok": true, "data": [...], "pagination": { "total", "page", "limit", "totalPages" } }`;
  pagina oltre l'ultima: `data: []` con `200`.
  Ogni elemento di `data` ha:
  `{ "id", "topic": { "id", "name" }, "prompt", "reference_answer", "rubric", "references", "created_at", "updated_at" }`.
- `GET /questions/:id` — Dettaglio di una domanda. **Protetta.**
  Risposta: `{ "ok": true, "question": {...} }` (stessa forma di un elemento
  dell'elenco). `404` `"Domanda non trovata"` se non esiste o se l'id non è un uuid.
- `PATCH /questions/:id` — Corregge una domanda. **Protetta.**
  Body parziale, con almeno un campo tra `topic_id`, `prompt`,
  `reference_answer`, `rubric` e `references`, validato con le stesse regole
  dell'import (`schemas/questionPatch.schema.js`; campi sconosciuti rifiutati,
  `references: []` svuota i riferimenti). `400` con l'elenco degli errori se il
  body non è valido. Aggiorna `updated_at`. Risposta: `{ "ok": true, "question": {...} }`
  (forma API). `404` `"Domanda non trovata"` se la domanda non esiste o l'id
  non è un uuid; `404` `"Argomento non trovato"` se il `topic_id` non esiste.
  `409` `"Nell'argomento esiste già una domanda con lo stesso testo"` se
  nell'argomento esiste già una domanda con lo stesso prompt normalizzato.
- `DELETE /questions/:id` — Cancella una domanda. **Protetta.**
  Risposta: `{ "ok": true }`. `409` se la domanda ha già dei tentativi
  (`"La domanda è già stata usata in una prova o in una flashcard: puoi correggerla ma non cancellarla"`).
  `404` `"Domanda non trovata"` se non esiste o se l'id non è un uuid.

---

## Exams — `/exams`

Simulazione d'esame: 6 domande estratte a caso, 40 minuti per l'intera prova,
voto in trentesimi. La scadenza (`expires_at`) la decide il server all'avvio;
il client mostra il timer a partire da `expires_at`.

**Consegna automatica.** Scaduto il tempo, il client chiama
`POST /exams/:id/submit` con le ultime risposte. Il server accetta la consegna
fino a `expires_at` più una piccola tolleranza per la latenza; se la consegna
arriva dopo `expires_at`, imposta `auto_submitted = true`. Se lei chiude la
pagina e la prova scade senza consegna, la prima rotta che la tocca
(`GET /exams/:id` o `POST /exams`) la consegna automaticamente con le bozze
salvate e la valuta, prima di rispondere.

**Forma di una simulazione** (`exam` nelle risposte seguenti):
```json
{
  "id": "uuid",
  "status": "IN_PROGRESS | GRADING | GRADED | SELF_GRADED",
  "started_at": "...",
  "expires_at": "...",
  "submitted_at": null,
  "auto_submitted": false,
  "grade": null,
  "honors": false,
  "questions": [
    {
      "position": 1,
      "prompt": "...",
      "topic": { "id", "name" },
      "answer": "bozza o risposta consegnata"
    }
  ]
}
```
- Con `status = IN_PROGRESS`, ogni elemento di `questions` contiene **solo**
  `position`, `prompt`, `topic` e `answer`. Risposta di riferimento, rubrica e
  valutazione non vengono mai inviate durante la prova.
- Dopo la consegna, ogni elemento contiene anche `reference_answer`,
  `references`, `verdict` (`correct` / `partial` / `wrong`, oppure `null` se
  non ancora valutata), `grading_source` (`AI` / `SELF` / `null`) e `feedback`
  (`{ corrections, suggestion, exampleAnswer }`, oppure `null` in
  autovalutazione). Nessun voto per singola domanda.

Rotte:

- `GET /exams` — Storico delle simulazioni, paginato. **Protetta.**
  Query: `status` (filtro; es. `IN_PROGRESS` per trovare una prova da
  riprendere), `page`, `limit`, `sort` (whitelist: `started_at`, `grade`),
  `order`. Ogni elemento di `data` ha i campi di `exam` **senza** `questions`.
- `GET /exams/:id` — Dettaglio di una simulazione: durante la prova o la
  revisione finale, a seconda di `status`. **Protetta.**
  Risposta: `{ "ok": true, "exam": {...} }`. `404` se non esiste. Se la prova
  è `IN_PROGRESS` ma scaduta, prima la consegna automaticamente (vedi sopra).
- `POST /exams` — Avvia una nuova simulazione. **Protetta.** Body vuoto.
  Estrae 6 domande a caso e crea la sessione, con le 6 righe di `FE_Attempts`
  e la risposta vuota.
  - Risposta `201`: `{ "ok": true, "exam": {...}, "resumed": false }`.
  - Se esiste già una prova `IN_PROGRESS` non scaduta, non ne crea un'altra e
    risponde `200` con quella: `{ "ok": true, "exam": {...}, "resumed": true }`.
  - `409` se nel database ci sono meno di 6 domande.
- `PUT /exams/:id/answers/:position` — Salva in bozza la risposta a una
  domanda durante la prova. **Protetta.**
  Body: `{ "answer": string }` (può essere vuota). `:position` va da 1 a 6.
  Risposta: `{ "ok": true, "updated_at": "..." }`.
  `404` se la prova o la posizione non esistono. `409` se la prova non è più
  `IN_PROGRESS` o se è oltre `expires_at` più la tolleranza.
- `POST /exams/:id/submit` — Consegna la prova e la fa valutare. **Protetta.**
  Body (opzionale): `{ "answers": [{ "position": number, "answer": string }] }`,
  con le ultime risposte non ancora salvate in bozza, così non si perde nulla.
  - Porta lo stato a `GRADING` e valuta le 6 risposte con **una sola**
    chiamata al grader. Le risposte vuote non vanno all'AI: sono `wrong`
    d'ufficio.
  - Se il grader risponde: `GRADED`, con voto e lode calcolati dal codice.
  - Se il grader non risponde (dopo i retry): `SELF_GRADED` con `grade` null.
    La revisione mostra le risposte di riferimento e aspetta
    `POST /exams/:id/self-grade`.
  - Risposta: `{ "ok": true, "exam": {...} }`, già con la revisione.
  - `409` se la prova è già stata consegnata.
- `POST /exams/:id/self-grade` — Autovalutazione di riserva, quando l'AI non
  ha risposto. **Protetta.**
  Body: `{ "verdicts": [{ "position": number, "verdict": "correct" | "partial" | "wrong" }] }`,
  con tutte e 6 le posizioni. Il punteggio interno vale 1 / 0.5 / 0; il codice
  calcola punti, voto e lode.
  Risposta: `{ "ok": true, "exam": {...} }`. `409` se la prova non è
  `SELF_GRADED` o ha già un voto.
- `POST /exams/:id/grade` — Riprova la valutazione AI di una prova rimasta
  senza voto (`GRADING` bloccata, oppure `SELF_GRADED` con `grade` null).
  **Protetta.** Body vuoto.
  Risposta: `{ "ok": true, "exam": {...} }`. `409` se la prova ha già un voto.
  `502` se il grader non risponde neanche questa volta: la prova resta
  com'era e si può ancora autovalutare.

---

## Flashcards — `/flashcards`

Ripasso libero: lei sceglie gli argomenti e il numero di domande. Il feedback
arriva subito dopo ogni risposta; niente voto e niente timer. Non esiste una
sessione: ogni risposta è un tentativo `FLASHCARD` a sé.

- `GET /flashcards` — Estrae domande a caso dagli argomenti scelti. **Protetta.**
  Query: `topics` (id separati da virgola, obbligatorio), `count` (1-50,
  default 10). Se le domande disponibili sono meno di `count`, restituisce
  tutte quelle che ci sono.
  Risposta: `{ "ok": true, "questions": [{ "id", "prompt", "topic": { "id", "name" } }] }`.
  Non include la risposta di riferimento. `400` se `topics` manca o non è valido.
- `POST /flashcards/answer` — Invia la risposta a una flashcard e la fa
  valutare subito. **Protetta.**
  Body: `{ "question_id": uuid, "answer": string }`. Una risposta vuota vale
  "non so": non va all'AI ed è `wrong` d'ufficio.
  Crea il tentativo e chiama il grader. Risposta `201`:
  ```json
  {
    "ok": true,
    "attempt": {
      "id": "uuid",
      "verdict": "correct | partial | wrong | null",
      "grading_source": "AI | null",
      "feedback": { "corrections": [], "suggestion": "...", "exampleAnswer": "..." },
      "reference_answer": "...",
      "references": ["1"]
    }
  }
  ```
  Se il grader non risponde, `verdict`, `grading_source` e `feedback` sono
  `null`: il tentativo resta da valutare e si chiude con
  `POST /attempts/:id/self-grade`. `404` se la domanda non esiste.

---

## Attempts — `/attempts`

- `POST /attempts/:id/self-grade` — Autovalutazione di riserva di una
  flashcard rimasta senza valutazione. **Protetta.**
  Body: `{ "verdict": "correct" | "partial" | "wrong" }`.
  Risposta: `{ "ok": true, "attempt": {...} }` (stessa forma di
  `POST /flashcards/answer`). `404` se il tentativo non esiste. `409` se è già
  valutato o se appartiene a una simulazione, che si autovaluta con
  `POST /exams/:id/self-grade`.

---

## Utility

- `GET /health` — Health check del server. **Pubblica.**
