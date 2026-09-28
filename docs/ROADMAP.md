# Roadmap di implementazione

> Piano ordinato per realizzare quanto descritto in [`PROGETTO.md`](PROGETTO.md).
> Il contesto e le decisioni stanno lì; qui c'è solo **cosa fare, in che ordine e come
> capire quando un task è finito**. Per convenzioni di codice, database ed endpoint
> vale il [`CLAUDE.md`](../CLAUDE.md) alla root, che ha la precedenza su questo file.
>
> Nulla di questa roadmap va implementato in autonomia: si procede un task alla volta,
> quando l'utente lo chiede. Se un task rivela una decisione non presa, ci si ferma e
> si chiede (vedi "Decisioni da chiudere").

## Come leggere un task

Ogni task ha questa forma:

- **ID** — `F<fase>.<numero>`, stabile: si usa per riferirsi al task in chat e nei commit.
- **Dipende da** — cosa deve essere finito prima.
- **Obiettivo** — il risultato in una riga.
- **Cosa fare** — i file toccati e le scelte già decise.
- **Fatto quando** — come si verifica a mano che funziona.
- **Dimensione** — S (poche ore), M (mezza giornata o una giornata), L (più giorni).

### Regole valide per ogni task

Sono già nel `CLAUDE.md`, ma si perdono facilmente: valgono a ogni task, senza doverlo ripetere.

1. **Database**: prima di toccarlo, leggere `server/database/schema.md` e `schema.sql`.
   Dopo la modifica, aggiornare entrambi **e** registrare la voce in
   `server/database/CHANGELOG.md` con il numero progressivo (`#003`, `#004`, …).
2. **Endpoint**: ogni rotta aggiunta o modificata va riportata nello stesso commit in
   `server/ENDPOINTS.md` **e** in `server/postman_collection.json`.
3. **Risorse nuove**: seguire la ricetta in [`ADDING_A_RESOURCE.md`](../ADDING_A_RESOURCE.md)
   (model, controller, mount, documentazione, Postman, service, pagina, rotta, voce di
   sidebar, label delle colonne).
4. **Elenchi con filtri**: contratto dei parametri e forma della risposta come in
   [`client/src/FILTERS_BE.md`](../client/src/FILTERS_BE.md).
5. **Tabelle**: sempre `client/src/components/DataTable.jsx`, label in
   `client/src/constants/columnLabels.js`. Mai `<table>` scritto a mano.
6. **Chiamate al backend**: `useFetch` per le letture, `useMutation` per le scritture.
   Se nessuno dei due va bene, fermarsi e chiedere.
7. **Componenti nuovi**: prima controllare `client/src/components/` e
   `client/src/components/ui/`; se manca davvero, **chiedere il permesso prima di crearlo**.
8. **Niente emoji**, da nessuna parte. Icone solo da Lucide. Testi UI, commenti,
   messaggi di errore e commit in italiano.
9. **Niente test automatici**: la verifica è manuale, con Postman lato server e con il
   browser lato client, anche su iPad, dove l'hover non esiste.

---

## Stato di partenza

Quello che c'è già e non va rifatto:

- Login a utente unico con JWT, `middleware/auth.js` (`protect`), seed dell'utente.
- `FE_Users`, unica tabella esistente.
- `package.json` alla root con `concurrently`: `npm run dev` avvia client e server insieme.
- Zod lato server: `config/zod.js` (locale italiano), `server/schemas/` con il suo README,
  `utils/zodError.js` per la risposta `400` con l'array di errori.
- Client: `api/client.js`, `AuthContext`, `PrivateRoute`, `AppLayout`, `Side` (apribile
  anche al tocco), `DataTable`, `FilterBar`, `Modal`, `Loader`, `ThemeToggle`, hook
  `useFetch` e `useMutation`, toast, validator, tema chiaro e scuro.
- Pagine: Login, Home (vuota), NotFound.

Manca tutto il dominio: nessuna tabella `FE_` oltre agli utenti, nessun service lato
client, nessuna pagina di studio. Le cartelle `server/services/` e
`client/src/services/` non esistono ancora: le crea il primo task che ne ha bisogno.

---

## Lavoro fuori dal sito (prerequisito dei dati)

### D.1 — JSON delle domande
- **Dipende da**: niente.
- **Obiettivo**: un file JSON per argomento, con domande già corredate di risposta di
  riferimento, rubrica e riferimenti normativi.
- **Cosa fare**:
  - Generare le domande in chat con Claude, **argomento per argomento**, a partire dagli
    appunti e dal codice civile, nella forma descritta nel `PROGETTO.md`
    (`topic` + `questions`).
  - Passare il materiale come **testo o .docx** esportato da Pages, **mai come PDF**: il
    PDF perde le legature tipografiche ("diritto" diventa "diri o").
  - Stile: domande brevi, specifiche e secche, con risposta attesa di circa 2 righe.
    Ammesse le domande di confronto ("Differenze tra nullità e annullabilità").
    **Vietate** le domande inverse ("quale articolo disciplina…?") e quelle su un
    articolo specifico ("Cosa dispone l'art. 1541 c.c.?").
  - Ogni domanda porta `answer`, una `rubric` di **2-4 concetti con peso** e
    `references` (numeri degli articoli collegati, anche vuoto).
- **Fatto quando**: il JSON passa la validazione Zod del task F1.2 e un argomento di prova
  si importa senza errori.
- **Dimensione**: L, ricorrente: si ripete per ogni argomento, circa 50.

Va avviato presto: senza dati reali la Fase 1 si collauda su file finti.

---

## Fase 1 — Argomenti e domande

Prima risorsa reale del progetto: diventa **l'implementazione di riferimento** citata in
`ADDING_A_RESOURCE.md`. Va curata più delle altre, perché tutte le successive la copiano.

### F1.1 — Schema del database
- **Dipende da**: niente.
- **Obiettivo**: tutte le tabelle dell'MVP su Supabase, documentate, in un'unica modifica.
- **Cosa fare**:
  - `FE_Topics`: `name` univoco, `position` (ordine di studio).
  - `FE_Questions`: `topic_id` FK obbligatoria, `prompt`, `answer`, `rubric` jsonb (array
    di `{ id, concept, weight }`), `article_refs` (array di numeri di articolo; nel JSON e
    nelle API il campo è `references`). Indice univoco su `topic_id` più `prompt`
    normalizzato, contro i doppioni all'import.
  - `FE_ExamSessions`: `started_at`, `expires_at` (inizio più 40 minuti, deciso dal
    server), `submitted_at`, `auto_submitted`, `status` con CHECK (`IN_PROGRESS`,
    `GRADING`, `GRADED`, `SELF_GRADED`), `grade` (0-30, null finché non valutata), `honors`.
  - `FE_Attempts`: `question_id` FK, `session_id` FK null, `mode` con CHECK (`EXAM`,
    `FLASHCARD`), `position` (1-6, solo in simulazione), `answer`, `verdict` con CHECK
    (`correct`, `partial`, `wrong`), `grading` jsonb (output del grader validato),
    `grading_source` con CHECK (`AI`, `SELF`), `points` (0-5), `score` (0-1),
    `graded_at`. UNIQUE su (`session_id`,
    `position`).
  - Nessuna colonna `user_id`: l'utente è una sola.
  - `schema.sql`, `schema.md`, `CHANGELOG.md` (`#003`).
- **Fatto quando**: le tabelle esistono su Supabase, i CHECK rifiutano i valori fuori
  dominio e i tre file le descrivono allo stesso modo.
- **Dimensione**: S.

### F1.2 — Import delle domande da JSON
- **Dipende da**: F1.1.
- **Obiettivo**: `POST /questions/import` accetta il formato `{ topic, questions }` di D.1.
- **Cosa fare**:
  - Schema Zod `server/schemas/questionsImport.schema.js`: `topic.name` obbligatorio;
    per ogni domanda `prompt`, `answer`, `rubric` (da 2 a 4 elementi, `id` univoci, peso
    intero positivo), `references` (array di stringhe, anche vuoto).
  - `server/models/topic.model.js` e `server/models/question.model.js`.
  - `server/controllers/questions.controller.js`: crea o riusa l'argomento in base al
    nome, poi inserisce le domande. Risposta `{ ok: true, topic, inserted, skipped }`.
  - Idempotenza: reimportare lo stesso argomento non deve duplicare le domande. Chiave
    proposta: `topic_id` più `prompt` normalizzato (spazi e maiuscole).
  - `ENDPOINTS.md` e collection Postman.
- **Fatto quando**: un argomento di prova si importa, si reimporta senza duplicati, e un
  JSON malformato risponde `400` con errori italiani leggibili.
- **Dimensione**: M.

### F1.3 — Elenco e gestione delle domande
- **Dipende da**: F1.2.
- **Obiettivo**: vedere, filtrare, correggere e cancellare le domande.
- **Cosa fare**:
  - `GET /topics`: elenco semplice, ordinato per `position`, con il conteggio delle domande.
  - `GET /questions` paginato secondo `FILTERS_BE.md`, con filtri `q` (ricerca su prompt e
    risposta) e `topicId`.
  - `PATCH /questions/:id` limitato a `prompt`, `answer`, `rubric`, `references`.
    Validazione con lo stesso schema Zod della singola domanda di F1.2.
  - `DELETE /questions/:id`: non esiste un flag "attiva", quindi una domanda che non serve
    si cancella. Una domanda con tentativi registrati **non si cancella** (FK `restrict`):
    risposta `409` con un messaggio parlante; la si può sempre correggere con il `PATCH`.
- **Fatto quando**: da Postman si filtra per argomento, si corregge una domanda e se ne
  cancella una.
- **Dimensione**: M.

### F1.4 — Pagina "Domande"
- **Dipende da**: F1.3.
- **Obiettivo**: la vista di controllo sul materiale, per capire cosa c'è.
- **Cosa fare**:
  - `client/src/services/topicsService.js` e `client/src/services/questionsService.js`,
    prima cartella `services/` del progetto: wrappano `api`, fanno l'unwrap di `data` e
    `pagination`, rilanciano gli errori come `Error(message)`.
  - `client/src/pages/Domande.jsx`: `useFetch` legato ai filtri, `DataTable` con prompt,
    argomento e riferimenti; `FilterBar` con ricerca e argomento; `Modal` di dettaglio con
    risposta di riferimento, rubrica e riferimenti; modifica e cancellazione con
    `useMutation` e `refetch()`.
  - `QUESTIONS_COLUMN_LABELS` in `columnLabels.js`; rotta in `App.jsx` dentro
    `PrivateRoute` e `AppLayout`; voce in `MENU_ITEMS` di `Side.jsx`.
- **Fatto quando**: dopo l'import di due argomenti la pagina li mostra entrambi,
  filtrabili, e la pagina è usabile al tocco su iPad.
- **Dimensione**: M.

### F1.5 — Pagina "Import"
- **Dipende da**: F1.2.
- **Obiettivo**: importare i JSON dal sito, senza passare da Postman.
- **Cosa fare**:
  - `client/src/pages/Import.jsx`: selezione di un file `.json` **oppure** incolla del
    contenuto in una textarea ampia, perché su iPad il selettore di file è scomodo.
  - `useMutation` verso `POST /questions/import`; esito mostrato come riepilogo (argomento,
    inserite, ignorate) e, in caso di `400`, elenco leggibile degli errori di
    validazione, voce per voce.
- **Fatto quando**: l'import di un argomento va a buon fine dal browser e un file sbagliato
  mostra errori comprensibili senza rompere la pagina.
- **Dimensione**: M.

---

## Fase 2 — Valutazione con AI

È il cuore del progetto ed è la parte più incerta. Conviene costruirla e collaudarla
**prima** della simulazione, usando le flashcard come banco di prova.

### F2.1 — Configurazione del provider
- **Dipende da**: niente.
- **Obiettivo**: chiave Gemini sul server e modello corretto.
- **Cosa fare**:
  - Chiave dal piano gratuito di Google AI Studio, in `server/.env` come `GEMINI_API_KEY`,
    più `GEMINI_MODEL` per il nome del modello Flash: **verificarlo sulla documentazione
    ufficiale al momento dell'implementazione**, non darlo per noto. Aggiornare `.env.example`.
  - La chiave resta **solo lato server**: mai in `client/.env`, mai dentro una risposta.
  - Fallire subito all'avvio se manca la chiave, come già fa `config/jwt.js`.
- **Fatto quando**: una chiamata di prova al modello risponde e il client non vede mai la chiave.
- **Dimensione**: S.

### F2.2 — Modulo grader
- **Dipende da**: F2.1.
- **Obiettivo**: un unico modulo che, date domanda, materiale di riferimento e risposta,
  restituisce il giudizio validato.
- **Cosa fare**:
  - `server/services/grader.js`, unico punto che conosce il provider: cambiarlo deve
    costare un solo file.
  - Costruzione del prompt: domanda, **risposta di riferimento**, **rubrica** di 2-4
    concetti con pesi e, come solo contesto, i riferimenti normativi.
  - Istruzioni di valutazione: conta il **concetto**, non le parole esatte, ma la
    **terminologia tecnica** è rilevante ("nullo" non è "annullabile", "può" non è "deve")
    e l'**ordine** conta quando la risposta attesa è una sequenza.
  - Output **solo JSON**, validato con Zod in `server/schemas/graderOutput.schema.js`:
    `concepts[{ id, status: present | partial | absent }]` con gli `id` della rubrica,
    `verdict: correct | partial | wrong`,
    `corrections[{ written, suggested, reason }]`, `suggestion`, `exampleAnswer`.
    Se l'output non è conforme: un solo nuovo tentativo, poi fallimento pulito.
  - **Retry con backoff esponenziale sui 429** (limiti indicativi di 10-15 richieste al
    minuto), con numero massimo di tentativi e timeout complessivo.
  - Funzione **batch** che valuta più risposte in una sola chiamata, con l'output ancorato
    all'indice della domanda: serve alla simulazione.
  - Nessuna percentuale nell'output: non deve esistere un numero da mostrare a lei.
- **Fatto quando**: su cinque risposte di prova (giusta, parziale, sbagliata, giusta ma con
  un termine errato, vuota) gli esiti sono sensati e il JSON passa sempre la validazione Zod.
- **Dimensione**: L.

### F2.3 — Calcolo del punteggio
- **Dipende da**: F2.2.
- **Obiettivo**: dai concetti ai punti, **calcolati dal codice**, non dall'LLM.
- **Cosa fare**:
  - `server/utils/scoring.js`, funzioni pure: dagli stati dei concetti e dai pesi della
    rubrica si ricava il **punteggio interno da 0 a 1** (`present` pieno, `partial` metà,
    `absent` zero, pesato), con **penalità per le correzioni terminologiche**; da lì i
    **punti da 0 a 5** della singola domanda.
  - Documentare in commento la formula e la penalità scelte: sono gli unici numeri che
    determinano il voto, devono restare leggibili e modificabili.
  - Il punteggio interno non esce mai verso il client come numero mostrabile: serve al voto
    complessivo e, dopo l'MVP, alla ripetizione spaziata.
- **Fatto quando**: i casi limite tornano a mano: tutti i concetti presenti e nessuna
  correzione dà il massimo; tutti assenti dà zero; concetti pieni ma con correzione
  terminologica scende sotto il massimo.
- **Dimensione**: M.

### F2.4 — Endpoint di valutazione singola e fallback
- **Dipende da**: F2.2, F2.3, F1.1.
- **Obiettivo**: `POST /attempts` valuta una risposta e la salva; se l'AI non risponde, lo
  studio non si ferma.
- **Cosa fare**:
  - `POST /attempts`, protetta: body `{ questionId, answer }`, `mode: "FLASHCARD"` fissato
    dal server. Recupera la domanda, chiama il grader, calcola punteggio e punti, salva e
    restituisce esito, correzioni, suggerimento e riferimenti. **Mai percentuali.**
  - **Fallback**: se il grader fallisce dopo i retry, salva il tentativo senza valutazione
    e risponde `{ ok: true, fallback: true, attemptId, referenceAnswer }`. Il client mostra
    la risposta di riferimento e lei si autovaluta.
  - `POST /attempts/:id/self` per registrare l'autovalutazione (corretta, parziale,
    errata), con `grading_source: "SELF"` e un punteggio interno convenzionale (1, 0.5, 0).
  - `ENDPOINTS.md` e collection Postman.
- **Fatto quando**: con la chiave valida la valutazione arriva e viene salvata; con una
  chiave finta il fallback scatta e l'autovalutazione si registra.
- **Dimensione**: M.

---

## Fase 3 — Simulazione d'esame

La funzione principale. Da qui in poi conta molto anche l'esperienza d'uso.

### F3.1 — Avvio della prova
- **Dipende da**: F1.3.
- **Obiettivo**: `POST /exam/sessions` estrae 6 domande e fa partire il timer.
- **Cosa fare**:
  - Estrazione casuale di 6 domande distinte. Se filtrare per argomento va deciso con
    l'utente: il default è estrarre su tutto il materiale.
  - Crea la sessione e **subito le 6 righe di `FE_Attempts`** (`mode: "EXAM"`, `position`
    da 1 a 6, risposta vuota): l'ordine delle domande lo garantisce il database.
  - `started_at` ed `expires_at` li decide il **server**: è la sola fonte di verità del
    tempo, il client non deve poter allungare la prova.
  - Risposta: id della sessione, scadenza e le sei domande con `position`, `id` e
    `prompt` soltanto (**nessuna risposta di riferimento, nessuna rubrica**).
  - `GET /exam/sessions/:id` per riprendere una prova aperta (pagina ricaricata, iPad che
    si blocca): restituisce domande, risposte salvate e tempo residuo.
- **Fatto quando**: due avvii consecutivi danno estrazioni diverse; la risposta non contiene
  mai il materiale di riferimento; ricaricando, tempo residuo e risposte sono coerenti.
- **Dimensione**: M.

### F3.2 — Salvataggio in bozza
- **Dipende da**: F3.1.
- **Obiettivo**: le risposte si salvano sul server mentre lei scrive.
- **Cosa fare**:
  - `PUT /exam/sessions/:id/answers/:position` con `{ answer }`: aggiorna la riga di
    `FE_Attempts` corrispondente. Rifiutato se la sessione è già consegnata o scaduta.
  - Lato client il salvataggio parte con un debounce e al cambio di domanda, senza
    interrompere la scrittura.
- **Fatto quando**: scrivendo, chiudendo la scheda e riaprendo la prova, le risposte ci sono.
- **Dimensione**: S.

### F3.3 — Consegna e voto
- **Dipende da**: F3.2, F2.2, F2.3.
- **Obiettivo**: `POST /exam/sessions/:id/submit` valuta tutto e restituisce il voto.
- **Cosa fare**:
  - Valuta le risposte **già salvate** in `FE_Attempts`: oltre la scadenza non si accettano
    risposte nuove. `auto_submitted` lo decide il server confrontando l'orario con
    `expires_at`. Il client può mandare con la consegna l'ultima bozza non ancora salvata,
    accettata solo entro la scadenza.
  - Valutazione in **una sola chiamata batch** al grader: una sola attesa e rispetto dei
    limiti di richieste al minuto. Stato `GRADING` durante l'attesa, poi `GRADED`.
  - Punti da 0 a 5 per domanda (F2.3), la somma è il voto in trentesimi. **Lode**: esiste un
    default proposto (30 con tutte e sei le risposte corrette e nessuna correzione
    terminologica), **da confermare con l'utente prima di scrivere il codice**.
  - Una sessione già consegnata non si riconsegna.
  - Se il grader fallisce: la sessione resta consegnata, con la revisione in modalità
    autovalutazione (stato `SELF_GRADED`, F2.4). La prova non si perde mai.
  - `GET /exam/sessions/:id/result`: voto e revisione domanda per domanda con esito,
    correzioni, suggerimento, risposta esemplare e riferimenti. **Nessun voto per singola
    domanda, nessuna percentuale.**
- **Fatto quando**: una prova completa da Postman restituisce un voto plausibile e sei
  revisioni; una consegna oltre i 40 minuti risulta automatica.
- **Dimensione**: L.

### F3.4 — Pagina della prova
- **Dipende da**: F3.2.
- **Obiettivo**: svolgere la simulazione con la calma di un esame vero.
- **Cosa fare**:
  - `client/src/services/examService.js` e `client/src/pages/Simulazione.jsx`.
  - Schermata di avvio sobria: cosa succede (sei domande, 40 minuti, nessun feedback durante
    la prova) e un solo pulsante.
  - Durante la prova: una domanda per schermata con navigazione avanti e indietro, oppure le
    sei in sequenza — **da decidere con l'utente**; textarea ampia e comoda con la tastiera
    dell'iPad; indicatore di avanzamento; **timer discreto**, che non metta ansia.
  - Il tempo residuo si ricalcola sempre da `expires_at`, mai da un contatore del client.
  - Allo scadere: consegna automatica senza chiedere conferma. Consegna anticipata con una
    conferma esplicita.
  - **Nessun feedback durante la prova**, nessun aiutino, nessun pulsante di contestazione.
  - Il timer o la barra di avanzamento potrebbero richiedere un componente nuovo:
    **chiedere il permesso prima di crearlo**.
- **Fatto quando**: una prova intera si svolge su iPad senza intoppi; ricaricando la pagina
  non si perdono le risposte; allo scadere la consegna parte da sola.
- **Dimensione**: L.

### F3.5 — Pagina del risultato
- **Dipende da**: F3.3, F3.4.
- **Obiettivo**: il voto e poi la revisione, nell'ordine in cui lei li vuole.
- **Cosa fare**:
  - Prima il **voto in trentesimi**, con la lode se prevista: grande, pulito, da solo.
  - Poi la revisione domanda per domanda: la sua risposta, l'esito (corretta, parzialmente
    corretta, errata), le **correzioni** (testo scritto, versione corretta, motivo in una
    riga), il **suggerimento**, la risposta esemplare e i riferimenti normativi.
  - Attesa della valutazione gestita bene: la chiamata batch è lunga, serve uno stato di
    attesa che spieghi cosa sta succedendo, con il `Loader` esistente.
  - Niente percentuali, niente punteggio per singola domanda, niente pulsante per contestare.
  - Se la valutazione è in fallback: revisione con la risposta di riferimento e i tre
    pulsanti di autovalutazione.
- **Fatto quando**: il risultato si legge bene su iPad e su Mac, in tema chiaro e scuro.
- **Dimensione**: M.

---

## Fase 4 — Flashcard

### F4.1 — Estrazione per la sessione
- **Dipende da**: F1.3.
- **Obiettivo**: `GET /questions/draw` restituisce N domande sugli argomenti scelti.
- **Cosa fare**:
  - Parametri: `count` con un massimo ragionevole e `topicIds` (uno o più argomenti).
    Nessuna ripetizione nella stessa sessione.
  - Come in F3.1, la risposta non contiene il materiale di riferimento.
- **Fatto quando**: chiedendo 10 domande su due argomenti arrivano 10 domande pertinenti.
- **Dimensione**: S.

### F4.2 — Pagina "Flashcard"
- **Dipende da**: F4.1, F2.4.
- **Obiettivo**: studiare con feedback immediato, senza voto e senza timer.
- **Cosa fare**:
  - Schermata di impostazione: scelta degli **argomenti** e del **numero di domande**;
    poi si parte.
  - Ciclo: domanda, textarea, invio, `POST /attempts`, feedback subito sotto (esito,
    correzioni, suggerimento, risposta esemplare, riferimenti), avanti.
  - **Nessun voto, nessun timer, nessuna percentuale.** A fine sessione un riepilogo sobrio
    di quante domande sono state fatte, senza punteggi.
  - Il blocco di feedback è lo stesso della revisione d'esame: **riusare** quello di F3.5
    invece di scriverne un secondo. Se diventa un componente condiviso, chiedere il permesso
    di crearlo.
- **Fatto quando**: una sessione da 10 domande si completa con feedback coerenti e senza
  attese anomale (i limiti di richieste al minuto reggono il ritmo di studio).
- **Dimensione**: M.

**Qui si chiude l'MVP.**

---

## Fase 5 — Ripasso quotidiano e ripetizione spaziata (dopo l'MVP)

> **Rimandata**: il ripasso quotidiano non fa parte dell'MVP. Questa fase resta come
> riferimento e non va implementata finché l'utente non la chiede.

### F5.1 — Tabella `FE_ReviewStates` e modalità `REVIEW`
- **Dipende da**: F1.1.
- **Obiettivo**: lo stato di ripasso per ogni domanda.
- **Cosa fare**:
  - Colonne: `id`, `question_id` FK **UNIQUE**, `ease_factor` numeric default 2.5,
    `interval_days` int default 0, `repetitions` int default 0, `due_date` date,
    `last_reviewed_at` timestamptz null, `created_at`. Indice su `due_date`.
  - Aggiungere `REVIEW` al CHECK di `FE_Attempts.mode`.
  - `schema.sql`, `schema.md`, `CHANGELOG.md`.
- **Fatto quando**: la tabella esiste e il vincolo garantisce un solo stato per domanda.
- **Dimensione**: S.

### F5.2 — Algoritmo SM-2
- **Dipende da**: F5.1, F2.3.
- **Obiettivo**: dal punteggio interno 0-1 alla data del prossimo ripasso.
- **Cosa fare**:
  - `server/utils/sm2.js`, funzione pura: dato lo stato corrente e il punteggio da 0 a 1,
    restituisce il nuovo `ease_factor`, `interval_days`, `repetitions` e `due_date`.
  - Mappatura dichiarata in commento dal punteggio 0-1 alla qualità 0-5 di SM-2.
  - Regola classica: sotto la soglia di sufficienza si riparte da un intervallo breve;
    l'ease factor non scende sotto il minimo previsto dall'algoritmo.
- **Fatto quando**: simulando a mano una sequenza di risposte buone gli intervalli crescono;
  una risposta sbagliata riporta la domanda a ripasso immediato.
- **Dimensione**: M.

### F5.3 — Aggiornamento dello stato a ogni risposta
- **Dipende da**: F5.2, F2.4, F3.3.
- **Obiettivo**: tutte le modalità alimentano la ripetizione spaziata.
- **Cosa fare**:
  - Dopo ogni tentativo valutato — in **simulazione, flashcard e ripasso** — aggiornare o
    creare lo stato di ripasso della domanda con SM-2.
  - Il fallimento dell'aggiornamento non deve far fallire la risposta all'utente: è un
    effetto collaterale, va isolato e loggato.
  - I tentativi in autovalutazione aggiornano lo stato con il punteggio convenzionale di F2.4.
- **Fatto quando**: dopo una simulazione le sei domande hanno uno stato di ripasso coerente
  con gli esiti.
- **Dimensione**: M.

### F5.4 — Sessione di ripasso
- **Dipende da**: F5.3.
- **Obiettivo**: `GET /review/due` e la sessione quotidiana.
- **Cosa fare**:
  - `GET /review/due`: domande con `due_date` non successiva a oggi, ordinate dalla più in
    ritardo, con un conteggio totale che serve alla Home. Se e come far entrare nel ripasso
    le domande mai incontrate è da decidere con l'utente.
  - Le risposte si registrano con `POST /attempts` e `mode: "REVIEW"`: nessun endpoint nuovo
    di valutazione.
- **Fatto quando**: forzando a mano qualche `due_date` nel passato, l'elenco le restituisce.
- **Dimensione**: S.

### F5.5 — Pagina "Ripasso" e Home
- **Dipende da**: F5.4, F4.2.
- **Obiettivo**: aprire il sito e sapere cosa fare oggi.
- **Cosa fare**:
  - `client/src/pages/Ripasso.jsx`: stesso ciclo delle flashcard (feedback immediato, nessun
    timer, nessun voto) ma alimentato da `GET /review/due`.
  - `client/src/pages/Home.jsx`: quante domande sono in scadenza oggi e tre punti di ingresso,
    Simulazione, Flashcard e Ripasso. Sobria: nessuna statistica, nessuna gamification,
    nessun promemoria, perché non le sono ancora stati chiesti.
- **Fatto quando**: la Home mostra il numero corretto di domande in scadenza e il ripasso si
  svolge fino a svuotare la coda del giorno.
- **Dimensione**: M.

---

## Fase 6 — Altro dopo l'MVP

Da affrontare solo a MVP consegnato e usato per qualche giorno di studio vero.

### F6.1 — Storico delle simulazioni
- **Dipende da**: F3.3.
- `GET /exam/sessions` paginato secondo `FILTERS_BE.md` e una pagina con `DataTable`: data,
  voto, se la consegna è stata automatica, accesso alla revisione già svolta. Andamento dei
  voti nel tempo, in forma semplice e leggibile.
- **Dimensione**: M.

### F6.2 — Statistiche per argomento
- **Dipende da**: F6.1.
- Aggregazione dei tentativi per argomento, per mostrare dove è più debole.
  **Da concordare prima con lei**: statistiche e progressi non le sono ancora stati chiesti,
  e il `PROGETTO.md` dice esplicitamente di non implementarli per ora.
- **Dimensione**: M.

### F6.3 — Rifiniture di design
- **Dipende da**: MVP completo.
- Palette definitiva e nome del sito (per ora il provvisorio "Studio"), revisione della
  tipografia e degli spazi, controllo dei target di tocco su iPad, verifica del tema scuro su
  tutte le pagine nuove.
- **Dimensione**: M.

### F6.4 — Deploy e collaudo sui dispositivi reali
- **Dipende da**: MVP completo.
- Server su Railway e client su Vercel secondo [`DEPLOY.md`](../DEPLOY.md); variabili
  d'ambiente di produzione (compresa `GEMINI_API_KEY`), `FRONTEND_URL` per la CORS, `baseUrl`
  della collection Postman aggiornata. Collaudo finale su Safari Mac e Safari iPad.
- **Dimensione**: M.

---

## Ordine consigliato

```
D.1 ─────┐
         v
F1.1 -> F1.2 -> F1.3 -> F1.4
           │       │
           │       └──> F1.5
           v
F2.1 -> F2.2 -> F2.3 -> F2.4
                          │
                          ├─> F4.1 -> F4.2          (flashcard: banco di prova del grader)
                          │
F3.1 -> F3.2 -> F3.3 -> F3.4 -> F3.5                (simulazione)
                          │
                          v
                    fine dell'MVP
                          │
                          v
         F5.1 -> F5.2 -> F5.3 -> F5.4 -> F5.5       (ripasso)
         F6.1  F6.2  F6.3  F6.4
```

Tre note sull'ordine:

- **D.1 va avviato subito**: senza dati reali, la Fase 1 si collauda su file finti e i
  problemi veri (stile delle domande, qualità delle rubriche) si scoprono tardi.
- La **Fase 2 può partire in parallelo** alla Fase 1 dopo F1.1: dipende solo dall'esistenza
  di qualche domanda, ed è la parte più incerta, quindi va toccata presto.
- La **Fase 4 è il banco di prova del grader**: conviene farla subito dopo F2.4 e affrontare
  la simulazione con il grader già collaudato.

---

## Decisioni da chiudere

Da confermare con l'utente **prima** del task indicato, non durante.

| Decisione | Serve per | Stato |
|---|---|---|
| Cancellazione di una domanda con tentativi registrati | F1.1, F1.3 | Decisa: bloccata (FK `restrict`), lo storico resta intatto |
| Chiave di idempotenza dell'import domande | F1.2 | Nello schema (#003): indice univoco su `topic_id` più `prompt` normalizzato |
| Regola della lode | F3.3 | Default proposto: 30 con tutte e sei corrette e nessuna correzione terminologica |
| Formula dei punti e penalità terminologica | F2.3 | Da definire nei numeri esatti |
| Navigazione durante la prova: sei domande in sequenza o avanti e indietro | F3.4 | Da decidere |
| Filtro per argomento nella simulazione | F3.1 | Proposta: nessun filtro, si estrae su tutto |
| Domande mai incontrate nel ripasso quotidiano | F5.4 | Rimandata con la Fase 5 (dopo l'MVP) |
| Statistiche e progressi | F6.2 | Non ancora chiesti a lei: non implementare |
| Palette e nome definitivo del sito | F6.3 | Provvisorio: "Studio" |
| Esempi di domande d'esame reali | D.1 | Li manderà lei più avanti; fino ad allora vale lo stile già deciso |
