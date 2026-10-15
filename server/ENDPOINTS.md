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
- **Formato risposta**: ogni risposta (tranne `GET /health`) ha la forma `{ "ok": true, ... }` in caso di successo, oppure `{ "ok": false, "error": <string | string[]> }` in caso di errore.
- **Autenticazione**: le rotte protette richiedono l'header `Authorization: Bearer <token>`. Il token JWT si ottiene tramite `POST /auth/login`.
- **Utente unico**: non esiste registrazione pubblica. L'unica utente viene creata da `npm run seed` a partire dalle variabili `SEED_*` del `.env`.
- **Logout**: è solo lato client (rimozione del token da `localStorage`), non esiste una rotta dedicata.

### Errori comuni di autenticazione

| Codice | Quando |
|--------|--------|
| `401 Non autenticato` | Header `Authorization` assente o non nel formato `Bearer <token>` |
| `401 Token non valido o scaduto` | Token JWT non verificabile o scaduto |
| `400 Il body della richiesta non è un JSON valido` | Body non leggibile come JSON (con `Content-Type: application/json`) |
| `404 Rotta non trovata` | Endpoint inesistente |
| `413 Il body della richiesta è troppo grande` | Body oltre il limite di `express.json` (100 kB) |
| `500 Errore interno del server` | Errore non gestito lato server |

---

## Auth — `/auth`

- `POST /auth/login` — Autenticazione utente. **Pubblica.**
  Body: `{ "email": string, "password": string }`. Risposta: `{ "ok": true, "token": string }`.
  `400` `"Email e password sono obbligatorie"` se manca email o password,
  `401` `"Credenziali non valide"` con credenziali non valide.
- `GET /auth/me` — Dati dell'utente autenticato (letti dal token: `sub`, `email`, `first_name`, `last_name`). **Protetta.**
  Risposta: `{ "ok": true, "user": { "sub", "email", "first_name", "last_name", "iat", "exp" } }`
  (il payload del token, con emissione e scadenza).

---

## Regole comuni alle rotte di dominio

Valgono per tutte le sezioni seguenti. Tutte le rotte di dominio sono **protette**.

- **Dati mai esposti**: `score` (punteggio interno 0-1) e `points` (punti 0-5 della singola domanda) non escono mai dalle API. Di una simulazione si restituiscono solo `grade` e `honors`. Dell'output del grader si espone solo `feedback`: `{ corrections, suggestion, exampleAnswer }`. `concepts` resta sul server.
- **Nomi dei campi**: `answer` è sempre la risposta scritta da lei; `reference_answer` è la risposta di riferimento della domanda (colonna `answer` di `FE_Questions`). `references` è l'array dei riferimenti normativi (colonna `article_refs`).
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
  - `409` `"Alcune domande sono state inserite nel frattempo da un altro import: riprova"`
    se, mentre l'import era in corso, un altro import ha inserito una delle
    stesse domande: non viene inserito nulla e basta riprovare.

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
salvate e la valuta, prima di rispondere. Lo storico (`GET /exams`) è in sola
lettura e non consegna nulla.

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
  Query:
  - `status`: filtro, uno tra `IN_PROGRESS`, `GRADING`, `GRADED`,
    `SELF_GRADED` (es. `IN_PROGRESS` per trovare una prova da riprendere).
    Vuoto o assente: nessun filtro. Un valore diverso (minuscolo, sconosciuto
    o ripetuto) non trova nulla: `200` con `data: []`.
  - `page` (default 1), `limit` (default 20, massimo 100).
  - `sort`: whitelist `started_at` (default) e `grade`; le prove senza voto
    vanno sempre in fondo. `order`: `asc`, qualunque altro valore vale `desc`.
  Risposta: `{ "ok": true, "data": [...], "pagination": {...} }`; ogni elemento
  di `data` ha i campi di `exam` **senza** `questions` (`id`, `status`,
  `started_at`, `expires_at`, `submitted_at`, `auto_submitted`, `grade`,
  `honors`). Una pagina oltre l'ultima restituisce `data: []` con il totale.
  L'elenco non consegna le prove scadute: una prova abbandonata resta
  `IN_PROGRESS` finché non la tocca `GET /exams/:id` o `POST /exams`.
- `GET /exams/:id` — Dettaglio di una simulazione: durante la prova o la
  revisione finale, a seconda di `status`. **Protetta.**
  Risposta: `{ "ok": true, "exam": {...} }`. `404` `"Simulazione non trovata"`
  se non esiste o se l'id non è un uuid. Se la prova è `IN_PROGRESS` ma
  scaduta oltre la tolleranza, prima la consegna automaticamente con le bozze
  salvate (`auto_submitted: true`) e la valuta come `submit`: la risposta
  contiene già la revisione (`GRADED`, oppure `SELF_GRADED` se il grader non
  risponde).
- `POST /exams` — Avvia una nuova simulazione. **Protetta.** Body vuoto.
  Estrae 6 domande a caso e crea la sessione, con le 6 righe di `FE_Attempts`
  e la risposta vuota.
  - Risposta `201`: `{ "ok": true, "exam": {...}, "resumed": false }`.
  - Se esiste già una prova `IN_PROGRESS` non scaduta (entro `expires_at` più
    la tolleranza), non ne crea un'altra e risponde `200` con quella:
    `{ "ok": true, "exam": {...}, "resumed": true }`. Una prova scaduta non
    viene ripresa: prima viene consegnata automaticamente e valutata (si
    ritrova nello storico), poi se ne crea una nuova.
  - `409` `"Servono almeno 6 domande per avviare una simulazione"` se nel
    database ci sono meno di 6 domande.
- `PUT /exams/:id/answers/:position` — Salva in bozza la risposta a una
  domanda durante la prova. **Protetta.**
  Body: `{ "answer": string }` (può essere vuota, massimo 5000 caratteri,
  salvata così com'è). `:position` è un intero da 1 a 6.
  Risposta: `{ "ok": true, "updated_at": "..." }`.
  Controlli nell'ordine: id non uuid -> `404` `"Simulazione non trovata"`;
  posizione non valida -> `400` `"Posizione non valida: deve essere un intero da 1 a 6"`;
  body non valido -> `400` con l'elenco degli errori; prova inesistente ->
  `404` `"Simulazione non trovata"`; prova non più `IN_PROGRESS` -> `409`
  `"Simulazione già consegnata"`; oltre `expires_at` più la tolleranza (15
  secondi) -> `409` `"Tempo scaduto: la simulazione non accetta più risposte"`;
  posizione assente -> `404` `"Domanda non trovata in questa simulazione"`.
- `POST /exams/:id/submit` — Consegna la prova e la fa valutare. **Protetta.**
  Body (opzionale): `{ "answers": [{ "position": number, "answer": string }] }`,
  con le ultime risposte non ancora salvate in bozza, così non si perde nulla
  (posizioni da 1 a 6 non ripetute, al massimo 6 elementi, risposte fino a
  5000 caratteri; body assente o `{}` ammesso).
  - Porta lo stato a `GRADING` con un update condizionato (atomico): una
    consegna doppia o concorrente riceve `409` e non valuta due volte.
  - `auto_submitted` lo decide il server: `true` se la consegna arriva dopo
    `expires_at`. Le `answers` si salvano solo fino a `expires_at` più la
    tolleranza (15 secondi); oltre si ignorano senza errore e si valutano le
    bozze già salvate.
  - Valuta le 6 risposte con **una sola** chiamata al grader. Le risposte
    vuote non vanno all'AI: sono `wrong` d'ufficio, 0 punti. Se sono tutte
    vuote non c'è nessuna chiamata e il voto è 0.
  - Se il grader risponde: `GRADED`, con voto e lode calcolati dal codice.
  - Se il grader non risponde (dopo i retry) o restituisce un output non
    valido: `200` con `SELF_GRADED`, `grade` null e nessuna risposta
    valutata. La revisione mostra le risposte di riferimento e aspetta
    `POST /exams/:id/self-grade`.
  - Risposta: `{ "ok": true, "exam": {...} }`, già con la revisione.
  - `400` se il body non è valido (elenco degli errori). `404`
    `"Simulazione non trovata"` se la prova non esiste o l'id non è un uuid.
    `409` `"Simulazione già consegnata"` se la prova non è più
    `IN_PROGRESS`. `500` per un errore interno: la prova resta `GRADING` e,
    dopo 5 minuti, si rivaluta con `POST /exams/:id/grade`.
- `POST /exams/:id/self-grade` — Autovalutazione di riserva, quando l'AI non
  ha risposto. **Protetta.**
  Body: `{ "verdicts": [{ "position": number, "verdict": "correct" | "partial" | "wrong" }] }`,
  con tutte e 6 le posizioni, ciascuna una volta sola.
  - Il punteggio interno vale 1 / 0.5 / 0; il codice calcola punti e voto.
    In autovalutazione **non c'è la lode**: `honors` resta `false`.
  - Le risposte vuote restano `wrong` d'ufficio, qualunque verdetto arrivi
    (la posizione va comunque inviata).
  - Lo stato resta `SELF_GRADED`, con `grade` valorizzato.
  Risposta: `{ "ok": true, "exam": {...} }`. `400` se il body non è valido
  (elenco degli errori). `404` `"Simulazione non trovata"` se la prova non
  esiste o l'id non è un uuid. `409` `"Simulazione già valutata"` se la prova
  ha già un voto, `409`
  `"La simulazione non è in attesa di autovalutazione"` se non è
  `SELF_GRADED`.
- `POST /exams/:id/grade` — Riprova la valutazione AI di una prova rimasta
  senza voto: `SELF_GRADED` con `grade` null, oppure `GRADING` bloccata
  (consegnata da più di 5 minuti: una consegna in corso non si tocca).
  **Protetta.** Body vuoto. Stessa valutazione di `submit`, con una sola
  chiamata al grader.
  Risposta: `{ "ok": true, "exam": {...} }` con stato `GRADED`. `404`
  `"Simulazione non trovata"` se la prova non esiste o l'id non è un uuid. `409` `"Simulazione già valutata"`
  se ha già un voto, `"Simulazione non ancora consegnata"` se è
  `IN_PROGRESS`, `"Valutazione già in corso: riprova tra qualche minuto"` se
  è `GRADING` da meno di 5 minuti. `502`
  `"Valutazione AI non disponibile: riprova più tardi"` se il grader non
  risponde neanche questa volta: la prova resta com'era (una `SELF_GRADED` si può ancora
  autovalutare, una `GRADING` resta `GRADING`).

---

## Flashcards — `/flashcards`

Ripasso libero: lei sceglie gli argomenti e il numero di domande. Il feedback
arriva subito dopo ogni risposta; niente voto e niente timer. Non esiste una
sessione: ogni risposta è un tentativo `FLASHCARD` a sé.

- `GET /flashcards` — Estrae domande a caso dagli argomenti scelti. **Protetta.**
  Query: `topics` (id uuid separati da virgola, obbligatorio; duplicati e
  virgole in più ignorati, al massimo 100 argomenti), `count` (intero 1-50,
  default 10; vuoto = default). Domande distinte, in ordine casuale. Se le
  domande disponibili sono meno di `count`, restituisce tutte quelle che ci
  sono; argomenti inesistenti o senza domande danno `questions: []`.
  Risposta: `{ "ok": true, "questions": [{ "id", "prompt", "topic": { "id", "name" } }] }`.
  Non include risposta di riferimento, rubrica né riferimenti. `400` con
  messaggio italiano se `topics` manca o contiene valori non uuid, se `count`
  non è un intero 1-50 o se un parametro è ripetuto.
- `POST /flashcards/answer` — Invia la risposta a una flashcard e la fa
  valutare subito. **Protetta.**
  Body: `{ "question_id": uuid, "answer": string }` (massimo 5000 caratteri,
  salvata così com'è). Una risposta vuota o di soli spazi vale "non so": non va
  all'AI ed è `wrong` d'ufficio, con `grading_source: "SELF"` e `feedback: null`.
  Crea prima il tentativo con la risposta, poi chiama il grader. Risposta `201`:
  ```json
  {
    "ok": true,
    "attempt": {
      "id": "uuid",
      "verdict": "correct | partial | wrong | null",
      "grading_source": "AI | SELF | null",
      "feedback": { "corrections": [], "suggestion": "...", "exampleAnswer": "..." },
      "reference_answer": "...",
      "references": ["1"]
    }
  }
  ```
  `feedback` è valorizzato solo con `grading_source: "AI"`; nessun punteggio
  nella risposta. Se il grader non risponde, `verdict`, `grading_source` e
  `feedback` sono `null`: il tentativo resta da valutare e si chiude con
  `POST /attempts/:id/self-grade`. `400` se il body non è valido (`question_id`
  non uuid, `answer` non testo o oltre 5000 caratteri, campi in più), con
  l'elenco degli errori. `404` `"Domanda non trovata"` se la domanda non
  esiste. `500` se il
  salvataggio fallisce o la valutazione dà un errore inatteso (il tentativo,
  se già creato, resta salvato e da valutare).

---

## Attempts — `/attempts`

- `POST /attempts/:id/self-grade` — Autovalutazione di riserva di una
  flashcard rimasta senza valutazione. **Protetta.**
  Body: `{ "verdict": "correct" | "partial" | "wrong" }` (campi in più rifiutati).
  Il punteggio interno vale 1 / 0.5 / 0 e il codice calcola i punti; nessun
  punteggio nella risposta.
  Risposta `200`: `{ "ok": true, "attempt": {...} }` (stessa forma di
  `POST /flashcards/answer`, con `grading_source: "SELF"` e `feedback: null`).
  `400` se il body non è valido (elenco degli errori). `404`
  `"Tentativo non trovato"` se non esiste o l'id non è un uuid. `409`
  `"Tentativo già valutato"` se è già valutato (anche da un'autovalutazione
  arrivata nel frattempo); `409`
  `"Il tentativo appartiene a una simulazione: usa POST /exams/:id/self-grade"`
  se appartiene a una simulazione. `500` se il salvataggio fallisce.

---

## Utility

- `GET /health` — Health check del server. **Pubblica.**
  Risposta `200`: `{ "status": "ok" }` (senza `ok`: la usano i controlli di
  salute del deploy).
