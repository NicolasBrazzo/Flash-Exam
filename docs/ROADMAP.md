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
- Client: `api/client.js`, `AuthContext`, `PrivateRoute`, `AppLayout`, `Side`,
  `DataTable`, `FilterBar`, `Modal`, `Loader`, `ThemeToggle`, hook `useFetch` e
  `useMutation`, toast, validator, tema chiaro e scuro.
- Pagine: Login, Home (vuota), NotFound.

Manca tutto il dominio: nessuna tabella `FE_` oltre agli utenti, nessun service lato
client, nessuna pagina di studio. Le cartelle `server/services/` e
`client/src/services/` non esistono ancora: le crea il primo task che ne ha bisogno.

---

## Lavoro fuori dal sito (prerequisito dei dati)

Questi due task non producono codice del sito: producono i **file JSON** che il sito
importa. Si fanno in chat con Claude, a partire dai file originali di lei. Vanno
avviati presto, perché la Fase 1 e la Fase 2 senza dati veri si collaudano alla cieca.

### D.1 — JSON degli articoli del codice civile
- **Dipende da**: niente.
- **Obiettivo**: un file JSON con i circa 1.020 articoli rilevanti, testo di legge identico all'originale.
- **Cosa fare**:
  - Partire da una esportazione in **testo o .docx** dei file Pages, **mai dal PDF**:
    il PDF perde le legature tipografiche ("diritto" diventa "diri o", "fisiche" diventa "siche").
  - La conversione la fa uno **script** scritto da Claude in chat, non una trascrizione a
    mano: la struttura è regolare (`LIBRO 1°:`, `→ TITOLO I:`, `Capo I:`,
    `Art. 1321: Nozione` seguito dal testo tra virgolette, commi su righe separate).
  - Gestire i numeri con suffisso (`Art. 42-bis`, `Art. 1785-ter`), gli articoli marcati
    `(abrogato)` nella rubrica e i numeri di pagina a piè di pagina, da scartare.
  - Ogni oggetto: numero, suffisso, rubrica, libro, titolo, capo, abrogato, testo,
    commi (array ordinato).
- **Fatto quando**: un controllo a campione su una decina di articoli sparsi mostra testo
  identico all'originale; il conteggio degli articoli è coerente con l'atteso; nessun
  articolo ha testo vuoto se non è abrogato.
- **Dimensione**: M.

### D.2 — JSON delle domande di teoria
- **Dipende da**: D.1 (per citare articoli che esistono davvero in `relatedArticles`).
- **Obiettivo**: un file JSON per capitolo, con deck e domande già corredate di rubrica.
- **Cosa fare**:
  - Generare le domande in chat, **capitolo per capitolo** sugli appunti, nella forma
    descritta nel `PROGETTO.md` (`deck` + `questions`).
  - Stile: domande brevi, specifiche e secche, con risposta attesa di circa 2 righe.
    Ammesse le domande di confronto ("Differenze tra nullità e annullabilità").
    **Vietate** le domande inverse ("quale articolo disciplina…?").
  - Ogni domanda `THEORY` porta `referenceAnswer` e una `rubric` di **2-4 concetti con peso**.
  - Le domande `ARTICLE` non ripetono il testo di legge: portano solo `articleRef`
    (numero e comma opzionale).
- **Fatto quando**: il JSON passa la validazione Zod del task F2.2 e un capitolo di prova
  si importa senza errori.
- **Dimensione**: L, ricorrente: si ripete per ogni capitolo, circa 50 argomenti.

---

## Fase 0 — Fondamenta

Lavori piccoli che rendono tutto il resto più comodo. Nessuno tocca il dominio.

### F0.1 — Avvio con un solo comando
- **Dipende da**: niente.
- **Obiettivo**: un comando alla root avvia client e server insieme.
- **Cosa fare**:
  - Creare un `package.json` alla root con `concurrently` come unica dipendenza di
    sviluppo e gli script `dev` (client e server in parallelo), `dev:client`, `dev:server`
    e un `install:all` che installa le dipendenze dei due pacchetti.
  - Precisare nel `CLAUDE.md` che la root ora ha un `package.json` di soli script: i due
    pacchetti restano installati e deployati separatamente.
- **Fatto quando**: da root, `npm run dev` mostra i log di entrambi i processi e il client
  raggiunge il server.
- **Dimensione**: S.

### F0.2 — Zod lato server
- **Dipende da**: niente.
- **Obiettivo**: la dipendenza e la convenzione per validare tutto ciò che arriva da fuori.
- **Cosa fare**:
  - `npm i zod` dentro `server/`.
  - Creare `server/schemas/` come sede unica degli schemi Zod, con un breve `README` che
    fissa la regola: **tutto ciò che entra da fuori** (JSON di import, output del grader)
    passa da uno schema di questa cartella.
  - Convenzione di errore: un fallimento Zod diventa `400` con
    `{ ok: false, error: [ "percorso: messaggio", … ] }` (il client unisce gli array con `; `).
    Scrivere `server/utils/zodError.js` che fa questa conversione, con messaggi in italiano.
- **Fatto quando**: una rotta di prova con body malformato risponde con l'array di errori leggibili.
- **Dimensione**: S.

### F0.3 — Sidebar utilizzabile su iPad
- **Dipende da**: niente.
- **Obiettivo**: la sidebar si apre anche al tocco, non solo al passaggio del mouse.
- **Cosa fare**:
  - In `client/src/components/Side.jsx`, affiancare all'apertura in hover un controllo
    esplicito (pulsante con icona Lucide) che apre e chiude, con lo stato nel componente.
  - Verificare che le voci di menu abbiano target di tocco comodi e che l'apertura non
    dipenda da `:hover` in CSS.
- **Fatto quando**: su Safari iPad si apre, si naviga e si chiude senza mouse; su Mac il
  comportamento esistente non peggiora.
- **Dimensione**: S.

---

## Fase 1 — Articoli del codice

Prima risorsa reale del progetto: diventa **l'implementazione di riferimento** citata in
`ADDING_A_RESOURCE.md`. Va curata più delle altre, perché tutte le successive la copiano.

### F1.1 — Tabella `FE_Articles`
- **Dipende da**: niente, ma va progettata guardando il JSON di D.1.
- **Obiettivo**: la tabella degli articoli su Supabase, documentata.
- **Cosa fare**:
  - Colonne: `id` uuid PK, `number` text (il numero senza suffisso, tenuto come testo),
    `suffix` text null (`bis`, `ter`, …), `rubric` text, `book` text, `title` text,
    `chapter` text (il "Capo"), `repealed` boolean default false, `text` text,
    `commi` jsonb (array ordinato di stringhe), `created_at` timestamptz.
  - Vincoli: UNIQUE su (`number`, `suffix`); indici su `book`, su `repealed` e un indice
    per la ricerca testuale su rubrica e testo, che serve alla FilterBar.
  - Nota da scrivere in `schema.md`: il numero resta testo per non perdere i suffissi;
    per l'ordinamento numerico serve una colonna calcolata o un cast nel model. Scegliere
    una delle due e documentarla.
  - Aggiornare `schema.sql`, `schema.md` e `CHANGELOG.md` (`#003`).
- **Fatto quando**: la tabella esiste su Supabase e i tre file la descrivono allo stesso modo.
- **Dimensione**: S.

### F1.2 — Import degli articoli da JSON
- **Dipende da**: F0.2, F1.1.
- **Obiettivo**: `POST /articles/import` accetta il JSON di D.1 e popola la tabella.
- **Cosa fare**:
  - Schema Zod `server/schemas/articlesImport.schema.js`: array di articoli con i campi di
    F1.1, `commi` come array di stringhe, numero obbligatorio, suffisso opzionale.
  - `server/models/article.model.js`: `TABLE_NAME = "FE_Articles"`, funzioni `upsertMany`,
    `list`, `findById`, `findByNumber`; sentinel `DATABASE_ARTICLE_*_ERROR`.
  - `server/controllers/articles.controller.js`: rotta protetta `POST /articles/import`.
    Valida con Zod, poi **upsert idempotente** sulla chiave (`number`, `suffix`):
    reimportare lo stesso file non duplica nulla e aggiorna il testo. Inserimento a
    blocchi (per esempio 500 righe per volta), perché gli articoli sono più di mille.
    Risposta `{ ok: true, inserted, updated, skipped }`.
  - Mount in `server.js`, aggiornamento di `ENDPOINTS.md` e della collection Postman.
- **Fatto quando**: importando il file di D.1 da Postman il conteggio torna; una seconda
  importazione risponde con `inserted: 0` e non crea duplicati; un JSON malformato
  risponde `400` con errori italiani leggibili.
- **Dimensione**: M.

### F1.3 — Elenco articoli con filtri
- **Dipende da**: F1.2.
- **Obiettivo**: `GET /articles` paginato, filtrabile e ordinabile.
- **Cosa fare**:
  - Seguire `FILTERS_BE.md` alla lettera: `page`, `limit` con cap a 100, `sort` da
    whitelist (`number`, `book`, `created_at`), `order`.
  - Filtri: `q` (ricerca su rubrica e testo), `book`, `title`, `chapter`, `repealed`
    (default: abrogati esclusi), `numberFrom` e `numberTo`.
  - Risposta `{ data, pagination }` nella forma prevista dal documento.
  - `GET /articles/:id` per il dettaglio, con l'articolo completo e i commi.
- **Fatto quando**: da Postman, filtri e paginazione combinati restituiscono conteggi
  coerenti; `total` conta l'insieme filtrato, non la pagina.
- **Dimensione**: M.

### F1.4 — Pagina "Articoli"
- **Dipende da**: F1.3.
- **Obiettivo**: consultare gli articoli dal sito, con tabella e filtri.
- **Cosa fare**:
  - `client/src/services/articlesService.js`, prima cartella `services/` del progetto:
    wrappa `api`, fa l'unwrap di `data` e `pagination`, rilancia gli errori come `Error(message)`.
  - `client/src/pages/Articoli.jsx`: `useFetch` legato ai filtri, `DataTable` per l'elenco,
    `FilterBar` per ricerca, libro e "mostra abrogati", `Modal` per il dettaglio con
    rubrica, testo e commi numerati.
  - `ARTICLES_COLUMN_LABELS` in `client/src/constants/columnLabels.js`.
  - Rotta in `App.jsx` dentro `PrivateRoute` e `AppLayout`; voce in `MENU_ITEMS` di `Side.jsx`.
  - Cura della lettura: il testo di legge è il contenuto principale della pagina, quindi
    misura di riga contenuta, spaziatura generosa, commi ben separati.
- **Fatto quando**: si trova un articolo per numero e per parola, il dettaglio mostra i
  commi nell'ordine giusto, la pagina è usabile al tocco su iPad.
- **Dimensione**: M.

### F1.5 — Pagina "Import"
- **Dipende da**: F1.2.
- **Obiettivo**: importare i JSON dal sito, senza passare da Postman.
- **Cosa fare**:
  - `client/src/pages/Import.jsx`: selezione di un file `.json` **oppure** incolla del
    contenuto in una textarea ampia, perché su iPad il selettore di file è scomodo.
  - `useMutation` verso `POST /articles/import`; esito mostrato come riepilogo (inseriti,
    aggiornati, ignorati) e, in caso di `400`, elenco leggibile degli errori di
    validazione, voce per voce.
  - La pagina nasce qui per gli articoli ed è predisposta a ospitare anche l'import delle
    domande (F2.4), con una scelta del tipo di import.
- **Fatto quando**: l'import completo del codice civile va a buon fine dal browser e un
  file sbagliato mostra errori comprensibili senza rompere la pagina.
- **Dimensione**: M.

---

## Fase 2 — Domande di teoria

### F2.1 — Tabelle `FE_Decks` e `FE_Questions`
- **Dipende da**: F1.1.
- **Obiettivo**: il contenitore delle domande, sia di teoria sia sugli articoli.
- **Cosa fare**:
  - `FE_Decks`: `id`, `title` text not null, `chapter` text, `tags` jsonb (array di
    stringhe), `created_at`.
  - `FE_Questions`: `id`, `deck_id` uuid FK null (le domande a template non hanno deck),
    `type` text con CHECK in (`ARTICLE`, `THEORY`), `prompt` text not null, `article_id`
    uuid FK verso `FE_Articles` null, `comma` int null, `reference_answer` text null,
    `rubric` jsonb null (array di `{ id, concept, weight }`), `related_articles` jsonb null,
    `tags` jsonb, `active` boolean default true, `source` text con CHECK in
    (`IMPORT`, `TEMPLATE`), `created_at`.
  - Vincoli applicativi da documentare: `THEORY` richiede `reference_answer`, `ARTICLE`
    richiede `article_id`.
  - Indici su `deck_id`, `type`, `active` e un indice GIN su `tags` per i filtri per argomento.
  - `schema.sql`, `schema.md`, `CHANGELOG.md` (`#004`).
- **Fatto quando**: le tabelle esistono e i CHECK rifiutano i valori fuori dominio.
- **Dimensione**: S.

### F2.2 — Import delle domande da JSON
- **Dipende da**: F0.2, F2.1.
- **Obiettivo**: `POST /questions/import` accetta il formato `{ deck, questions }` di D.2.
- **Cosa fare**:
  - Schema Zod `server/schemas/questionsImport.schema.js`, con **unione discriminata su `type`**:
    - `THEORY`: `prompt`, `referenceAnswer`, `rubric` (da 2 a 4 elementi, peso intero
      positivo), `relatedArticles` opzionale, `tags`;
    - `ARTICLE`: `prompt`, `articleRef` (`number`, `comma` opzionale), `tags`.
  - `server/models/deck.model.js` e `server/models/question.model.js`.
  - `server/controllers/questions.controller.js`: crea o riusa il deck in base al titolo,
    risolve `articleRef` verso `FE_Articles` con un **errore parlante** se l'articolo non
    esiste (va importato prima il codice), inserisce le domande con `source: "IMPORT"`.
  - Idempotenza: reimportare lo stesso capitolo non deve duplicare le domande. Decidere e
    documentare la chiave; proposta: `deck_id` più `prompt` normalizzato.
  - `ENDPOINTS.md` e collection Postman.
- **Fatto quando**: un capitolo di prova si importa, si reimporta senza duplicati, e un
  riferimento a un articolo inesistente produce un errore che dice quale numero manca.
- **Dimensione**: M.

### F2.3 — Elenco e gestione delle domande
- **Dipende da**: F2.2.
- **Obiettivo**: vedere, filtrare e disattivare le domande.
- **Cosa fare**:
  - `GET /decks` (elenco semplice con conteggio delle domande) e `GET /questions` paginato
    secondo `FILTERS_BE.md`, con filtri `q`, `deck_id`, `type`, `tag`, `active`, `source`.
  - `PATCH /questions/:id` limitato a ciò che serve davvero: `active`, `prompt`,
    `reference_answer`, `rubric`. Validazione nel controller.
  - `DELETE /questions/:id` solo se serve per ripulire un import sbagliato: da valutare
    con l'utente prima di scriverlo.
- **Fatto quando**: da Postman si filtra per deck e per tag e si disattiva una domanda.
- **Dimensione**: M.

### F2.4 — Pagina "Domande"
- **Dipende da**: F2.3, F1.5.
- **Obiettivo**: la vista di controllo sul materiale, per capire cosa c'è e cosa è attivo.
- **Cosa fare**:
  - `client/src/services/questionsService.js` e `client/src/services/decksService.js`.
  - `client/src/pages/Domande.jsx`: `DataTable` con prompt, tipo, deck, tag e stato;
    `FilterBar` con ricerca, deck, tipo, tag e "solo attive"; `Modal` di dettaglio che
    mostra risposta di riferimento e rubrica, oppure il testo dell'articolo per le
    domande `ARTICLE`; toggle attiva e disattiva con `useMutation` e `refetch()`.
  - `QUESTIONS_COLUMN_LABELS` in `columnLabels.js`; rotta e voce di sidebar.
  - Estendere `Import.jsx` con l'import delle domande.
- **Fatto quando**: dopo l'import di due capitoli la pagina li mostra entrambi, filtrabili.
- **Dimensione**: M.

---

## Fase 3 — Domande a template dagli articoli

### F3.1 — Generatore di prompt
- **Dipende da**: F2.1.
- **Obiettivo**: da un articolo si ricavano domande senza usare l'AI.
- **Cosa fare**:
  - `server/utils/questionTemplates.js`: funzioni pure che, dato un articolo,
    restituiscono i prompt. Due forme già decise: "Cosa dispone l'art. 1541 c.c.?" per
    l'articolo intero e "Cosa prevede il comma 2 dell'art. 1543 c.c.?" per il singolo comma.
  - Regole: saltare gli articoli **abrogati**; generare la domanda per comma solo se
    l'articolo ha più di un comma; comporre correttamente il numero con suffisso
    ("art. 42-bis c.c.").
- **Fatto quando**: eseguendo la funzione su una manciata di articoli i prompt sono in
  italiano corretto, compresi i casi con suffisso.
- **Dimensione**: S.

### F3.2 — Endpoint di generazione
- **Dipende da**: F3.1, F2.2.
- **Obiettivo**: `POST /questions/generate` crea in blocco le domande `ARTICLE`.
- **Cosa fare**:
  - Body: perimetro della generazione (`book`, `title`, `chapter`, `numberFrom`,
    `numberTo`) e opzioni (`includeCommi` sì o no).
  - Inserisce con `type: "ARTICLE"`, `source: "TEMPLATE"`, `article_id` e `comma`
    valorizzati, nessun `deck_id`, `active: true`.
  - **Idempotente**: se la domanda per quell'articolo o comma esiste già, non la ricrea.
    Risposta `{ ok: true, created, skipped }`.
  - `ENDPOINTS.md` e collection Postman.
- **Fatto quando**: generando sul Libro IV il conteggio è coerente con gli articoli non
  abrogati; rieseguendo, `created` è 0.
- **Dimensione**: M.

### F3.3 — Comando dalla UI
- **Dipende da**: F3.2, F2.4.
- **Obiettivo**: lanciare la generazione senza Postman.
- **Cosa fare**: una sezione nella pagina Domande (oppure in Import) con la scelta del
  perimetro e un pulsante di generazione, `useMutation`, riepilogo del risultato e
  `refetch()` dell'elenco. Avviso chiaro prima di generare su un perimetro ampio.
- **Fatto quando**: dalla pagina si genera per un libro e le domande compaiono nell'elenco.
- **Dimensione**: S.

---

## Fase 4 — Valutazione con AI

È il cuore del progetto ed è la parte più incerta. Conviene costruirla e collaudarla
**prima** della simulazione, usando le flashcard come banco di prova.

### F4.1 — Configurazione del provider
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

### F4.2 — Modulo grader
- **Dipende da**: F4.1, F0.2.
- **Obiettivo**: un unico modulo che, date domanda, materiale di riferimento e risposta,
  restituisce il giudizio validato.
- **Cosa fare**:
  - `server/services/grader.js`, unico punto che conosce il provider: cambiarlo deve
    costare un solo file.
  - Costruzione del prompt, con il riferimento scelto in base al tipo di domanda:
    - `THEORY`: la **rubrica** di 2-4 concetti con pesi, più la risposta di riferimento;
    - `ARTICLE`: il **testo ufficiale** dell'articolo o del comma preso da `FE_Articles`;
      la rubrica è opzionale e, se manca, i concetti li estrae il modello dal testo.
  - Istruzioni di valutazione: conta il **concetto**, non le parole esatte, ma la
    **terminologia tecnica** è rilevante ("nullo" non è "annullabile", "può" non è "deve")
    e l'**ordine dei commi** conta quando la domanda ne riguarda più di uno.
  - Output **solo JSON**, validato con Zod in `server/schemas/graderOutput.schema.js`:
    `concepts[{ id, status: present | partial | absent }]`,
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

### F4.3 — Calcolo del punteggio
- **Dipende da**: F4.2.
- **Obiettivo**: dai concetti ai punti, **calcolati dal codice**, non dall'LLM.
- **Cosa fare**:
  - `server/utils/scoring.js`, funzioni pure: dagli stati dei concetti e dai pesi si ricava
    il **punteggio interno da 0 a 1** (`present` pieno, `partial` metà, `absent` zero,
    pesato), con **penalità per le correzioni terminologiche**; da lì i **punti da 0 a 5**
    della singola domanda.
  - Documentare in commento la formula e la penalità scelte: sono gli unici numeri che
    determinano il voto, devono restare leggibili e modificabili.
  - Il punteggio interno non esce mai verso il client come numero mostrabile: serve al voto
    complessivo e alla ripetizione spaziata.
- **Fatto quando**: i casi limite tornano a mano: tutti i concetti presenti e nessuna
  correzione dà il massimo; tutti assenti dà zero; concetti pieni ma con correzione
  terminologica scende sotto il massimo.
- **Dimensione**: M.

### F4.4 — Tabella `FE_Attempts`
- **Dipende da**: F2.1.
- **Obiettivo**: conservare ogni risposta data e la sua valutazione.
- **Cosa fare**:
  - Colonne: `id`, `question_id` FK, `answer` text, `mode` text con CHECK in
    (`EXAM`, `FLASHCARD`, `REVIEW`), `evaluation` jsonb (l'output del grader), `score`
    numeric da 0 a 1, `points` int da 0 a 5, `self_assessed` boolean default false,
    `session_id` uuid null, `created_at`.
  - Indici su `question_id` e `created_at`.
  - `schema.sql`, `schema.md`, `CHANGELOG.md` (`#005`).
- **Fatto quando**: la tabella esiste e accetta un tentativo scritto a mano.
- **Dimensione**: S.

### F4.5 — Endpoint di valutazione singola e fallback
- **Dipende da**: F4.2, F4.3, F4.4.
- **Obiettivo**: `POST /attempts` valuta una risposta e la salva; se l'AI non risponde, lo
  studio non si ferma.
- **Cosa fare**:
  - `POST /attempts`, protetta: body `{ questionId, answer, mode }`. Recupera la domanda e
    il materiale di riferimento, chiama il grader, calcola punteggio e punti, salva e
    restituisce esito, correzioni e suggerimento. **Mai percentuali.**
  - **Fallback**: se il grader fallisce dopo i retry, risposta
    `{ ok: true, fallback: true, referenceAnswer }` senza valutazione. Il client mostra la
    risposta di riferimento e lei si autovaluta.
  - `POST /attempts/self` per registrare l'autovalutazione (corretta, parziale, errata),
    con `self_assessed: true` e un punteggio interno convenzionale (1, 0.5, 0).
  - `ENDPOINTS.md` e collection Postman.
- **Fatto quando**: con la chiave valida la valutazione arriva e viene salvata; con una
  chiave finta il fallback scatta e l'autovalutazione si registra.
- **Dimensione**: M.

---

## Fase 5 — Simulazione d'esame

La funzione principale. Da qui in poi conta molto anche l'esperienza d'uso.

### F5.1 — Tabella `FE_ExamSessions`
- **Dipende da**: F4.4.
- **Obiettivo**: la prova come entità persistente, così si può riprendere e rivedere.
- **Cosa fare**:
  - Colonne: `id`, `question_ids` jsonb (array ordinato dei sei id), `started_at`
    timestamptz, `submitted_at` timestamptz null, `auto_submitted` boolean default false,
    `grade` int null (trentesimi), `lode` boolean default false, `created_at`.
  - `FE_Attempts.session_id` referenzia questa tabella.
  - `schema.sql`, `schema.md`, `CHANGELOG.md` (`#006`).
- **Fatto quando**: la tabella esiste ed è collegata ai tentativi.
- **Dimensione**: S.

### F5.2 — Avvio della prova
- **Dipende da**: F5.1, F2.3.
- **Obiettivo**: `POST /exam/sessions` estrae 6 domande e fa partire il timer.
- **Cosa fare**:
  - Estrazione casuale fra le domande **attive**, escludendo quelle legate ad articoli
    **abrogati**, senza ripetizioni nella stessa prova. Se filtrare per argomento va
    deciso con l'utente: il default è estrarre su tutto il materiale.
  - `started_at` lo decide il **server**: è la sola fonte di verità del tempo, il client non
    deve poter allungare la prova.
  - Risposta: id della sessione, le sei domande con `id`, `prompt` e `type` soltanto
    (**nessun riferimento, nessuna risposta attesa**) e la scadenza calcolata a 40 minuti.
  - `GET /exam/sessions/:id` per riprendere una prova aperta (pagina ricaricata, iPad che
    si blocca): restituisce domande e tempo residuo.
- **Fatto quando**: due avvii consecutivi danno estrazioni diverse; la risposta non contiene
  mai il materiale di riferimento; ricaricando, il tempo residuo è coerente.
- **Dimensione**: M.

### F5.3 — Consegna e voto
- **Dipende da**: F5.2, F4.2, F4.3.
- **Obiettivo**: `POST /exam/sessions/:id/submit` valuta tutto e restituisce il voto.
- **Cosa fare**:
  - Body: le sei risposte, anche vuote. Consegna anticipata o automatica: il flag
    `auto_submitted` lo decide il server confrontando l'orario con `started_at` più 40
    minuti. Oltre la scadenza le risposte **nuove** non si accettano: vale quanto era già
    stato salvato.
  - Valutazione in **una sola chiamata batch** al grader: una sola attesa e rispetto dei
    limiti di richieste al minuto.
  - Punti da 0 a 5 per domanda (F4.3), la somma è il voto in trentesimi. **Lode**: esiste un
    default proposto (30 con tutte e sei le risposte corrette e nessuna correzione
    terminologica), **da confermare con l'utente prima di scrivere il codice**.
  - Salvataggio dei sei `FE_Attempts` con `mode: "EXAM"` e `session_id`, e della sessione con
    voto e lode. Una sessione già consegnata non si riconsegna.
  - Se il grader fallisce: la sessione resta consegnata ma non valutata, con la revisione in
    modalità autovalutazione (F4.5). La prova non si perde mai.
  - `GET /exam/sessions/:id/result`: voto e revisione domanda per domanda con esito,
    correzioni, suggerimento e risposta esemplare. **Nessun voto per singola domanda,
    nessuna percentuale.**
- **Fatto quando**: una prova completa da Postman restituisce un voto plausibile e sei
  revisioni; una consegna oltre i 40 minuti risulta automatica.
- **Dimensione**: L.

### F5.4 — Pagina della prova
- **Dipende da**: F5.2.
- **Obiettivo**: svolgere la simulazione con la calma di un esame vero.
- **Cosa fare**:
  - `client/src/services/examService.js` e `client/src/pages/Simulazione.jsx`.
  - Schermata di avvio sobria: cosa succede (sei domande, 40 minuti, nessun feedback durante
    la prova) e un solo pulsante.
  - Durante la prova: una domanda per schermata con navigazione avanti e indietro, oppure le
    sei in sequenza — **da decidere con l'utente**; textarea ampia e comoda con la tastiera
    dell'iPad; indicatore di avanzamento; **timer discreto**, che non metta ansia.
  - Risposte tenute nello stato locale e salvate in `localStorage` per sopravvivere a una
    ricarica; il tempo residuo si ricalcola sempre dal server, mai dal client.
  - Allo scadere: consegna automatica senza chiedere conferma. Consegna anticipata con una
    conferma esplicita.
  - **Nessun feedback durante la prova**, nessun aiutino, nessun pulsante di contestazione.
  - Il timer o la barra di avanzamento potrebbero richiedere un componente nuovo:
    **chiedere il permesso prima di crearlo**.
- **Fatto quando**: una prova intera si svolge su iPad senza intoppi; ricaricando la pagina
  non si perdono le risposte; allo scadere la consegna parte da sola.
- **Dimensione**: L.

### F5.5 — Pagina del risultato
- **Dipende da**: F5.3, F5.4.
- **Obiettivo**: il voto e poi la revisione, nell'ordine in cui lei li vuole.
- **Cosa fare**:
  - Prima il **voto in trentesimi**, con la lode se prevista: grande, pulito, da solo.
  - Poi la revisione domanda per domanda: la sua risposta, l'esito (corretta, parzialmente
    corretta, errata), le **correzioni** (testo scritto, versione corretta, motivo in una
    riga), il **suggerimento** e la risposta esemplare.
  - Attesa della valutazione gestita bene: la chiamata batch è lunga, serve uno stato di
    attesa che spieghi cosa sta succedendo, con il `Loader` esistente.
  - Niente percentuali, niente punteggio per singola domanda, niente pulsante per contestare.
  - Se la valutazione è in fallback: revisione con la risposta di riferimento e i tre
    pulsanti di autovalutazione.
- **Fatto quando**: il risultato si legge bene su iPad e su Mac, in tema chiaro e scuro.
- **Dimensione**: M.

---

## Fase 6 — Flashcard

### F6.1 — Estrazione per la sessione
- **Dipende da**: F2.3.
- **Obiettivo**: `GET /questions/draw` restituisce N domande sugli argomenti scelti.
- **Cosa fare**:
  - Parametri: `count` con un massimo ragionevole, più `tags`, `deckId`, `type`. Solo
    domande attive, articoli abrogati esclusi, nessuna ripetizione nella stessa sessione.
  - Come in F5.2, la risposta non contiene il materiale di riferimento.
- **Fatto quando**: chiedendo 10 domande su due argomenti arrivano 10 domande pertinenti.
- **Dimensione**: S.

### F6.2 — Pagina "Flashcard"
- **Dipende da**: F6.1, F4.5.
- **Obiettivo**: studiare con feedback immediato, senza voto e senza timer.
- **Cosa fare**:
  - Schermata di impostazione: scelta degli **argomenti** (tag e deck) e del **numero di
    domande**; poi si parte.
  - Ciclo: domanda, textarea, invio, `POST /attempts` con `mode: "FLASHCARD"`, feedback
    subito sotto (esito, correzioni, suggerimento, risposta esemplare), avanti.
  - **Nessun voto, nessun timer, nessuna percentuale.** A fine sessione un riepilogo sobrio
    di quante domande sono state fatte, senza punteggi.
  - Il blocco di feedback è lo stesso della revisione d'esame: **riusare** quello di F5.5
    invece di scriverne un secondo. Se diventa un componente condiviso, chiedere il permesso
    di crearlo.
- **Fatto quando**: una sessione da 10 domande si completa con feedback coerenti e senza
  attese anomale (i limiti di richieste al minuto reggono il ritmo di studio).
- **Dimensione**: M.

---

## Fase 7 — Ripasso quotidiano e ripetizione spaziata

### F7.1 — Tabella `FE_ReviewStates`
- **Dipende da**: F2.1.
- **Obiettivo**: lo stato di ripasso per ogni domanda.
- **Cosa fare**:
  - Colonne: `id`, `question_id` FK **UNIQUE**, `ease_factor` numeric default 2.5,
    `interval` int default 0 (giorni), `repetitions` int default 0, `due_date` date,
    `last_reviewed_at` timestamptz null, `created_at`.
  - Indice su `due_date`.
  - `schema.sql`, `schema.md`, `CHANGELOG.md` (`#007`).
- **Fatto quando**: la tabella esiste e il vincolo garantisce un solo stato per domanda.
- **Dimensione**: S.

### F7.2 — Algoritmo SM-2
- **Dipende da**: F7.1, F4.3.
- **Obiettivo**: dal punteggio interno 0-1 alla data del prossimo ripasso.
- **Cosa fare**:
  - `server/utils/sm2.js`, funzione pura: dato lo stato corrente e il punteggio da 0 a 1,
    restituisce il nuovo `ease_factor`, `interval`, `repetitions` e `due_date`.
  - Mappatura dichiarata in commento dal punteggio 0-1 alla qualità 0-5 di SM-2.
  - Regola classica: sotto la soglia di sufficienza si riparte da un intervallo breve;
    l'ease factor non scende sotto il minimo previsto dall'algoritmo.
- **Fatto quando**: simulando a mano una sequenza di risposte buone gli intervalli crescono;
  una risposta sbagliata riporta la domanda a ripasso immediato.
- **Dimensione**: M.

### F7.3 — Aggiornamento dello stato a ogni risposta
- **Dipende da**: F7.2, F4.5, F5.3.
- **Obiettivo**: tutte le modalità alimentano la ripetizione spaziata.
- **Cosa fare**:
  - Dopo ogni `FE_Attempts` salvato — in **simulazione, flashcard e ripasso** — aggiornare o
    creare lo stato di ripasso della domanda con SM-2.
  - Il fallimento dell'aggiornamento non deve far fallire la risposta all'utente: è un
    effetto collaterale, va isolato e loggato.
  - I tentativi in autovalutazione aggiornano lo stato con il punteggio convenzionale di F4.5.
- **Fatto quando**: dopo una simulazione le sei domande hanno uno stato di ripasso coerente
  con gli esiti.
- **Dimensione**: M.

### F7.4 — Sessione di ripasso
- **Dipende da**: F7.3.
- **Obiettivo**: `GET /review/due` e la sessione quotidiana.
- **Cosa fare**:
  - `GET /review/due`: domande con `due_date` non successiva a oggi, ordinate dalla più in
    ritardo, con un conteggio totale che serve alla Home. Se e come far entrare nel ripasso
    le domande mai incontrate è da decidere con l'utente; proposta: solo quelle già
    incontrate almeno una volta.
  - Le risposte si registrano con `POST /attempts` e `mode: "REVIEW"`: nessun endpoint nuovo
    di valutazione.
- **Fatto quando**: forzando a mano qualche `due_date` nel passato, l'elenco le restituisce.
- **Dimensione**: S.

### F7.5 — Pagina "Ripasso" e Home
- **Dipende da**: F7.4, F6.2.
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

## Fase 8 — Dopo l'MVP

Da affrontare solo a MVP consegnato e usato per qualche giorno di studio vero.

### F8.1 — Storico delle simulazioni
- **Dipende da**: F5.3.
- `GET /exam/sessions` paginato secondo `FILTERS_BE.md` e una pagina con `DataTable`: data,
  voto, se la consegna è stata automatica, accesso alla revisione già svolta. Andamento dei
  voti nel tempo, in forma semplice e leggibile.
- **Dimensione**: M.

### F8.2 — Statistiche per argomento
- **Dipende da**: F8.1.
- Aggregazione dei tentativi per tag e per deck, per mostrare dove è più debole.
  **Da concordare prima con lei**: statistiche e progressi non le sono ancora stati chiesti,
  e il `PROGETTO.md` dice esplicitamente di non implementarli per ora.
- **Dimensione**: M.

### F8.3 — Rifiniture di design
- **Dipende da**: MVP completo.
- Palette definitiva e nome del sito (per ora il provvisorio "Studio"), revisione della
  tipografia e degli spazi, controllo dei target di tocco su iPad, verifica del tema scuro su
  tutte le pagine nuove.
- **Dimensione**: M.

### F8.4 — Deploy e collaudo sui dispositivi reali
- **Dipende da**: MVP completo.
- Server su Railway e client su Vercel secondo [`DEPLOY.md`](../DEPLOY.md); variabili
  d'ambiente di produzione (compresa `GEMINI_API_KEY`), `FRONTEND_URL` per la CORS, `baseUrl`
  della collection Postman aggiornata. Collaudo finale su Safari Mac e Safari iPad.
- **Dimensione**: M.

---

## Ordine consigliato

```
D.1 ─────────────┐
                 ├─> F1.1 -> F1.2 -> F1.3 -> F1.4 -> F1.5
F0.1 F0.2 F0.3 ──┘                                    │
                                                      v
                              D.2 ──> F2.1 -> F2.2 -> F2.3 -> F2.4
                                                      │
                                                      ├─> F3.1 -> F3.2 -> F3.3
                                                      │
                                 F4.1 -> F4.2 -> F4.3 -> F4.4 -> F4.5
                                                      │
                                 F5.1 -> F5.2 -> F5.3 -> F5.4 -> F5.5
                                                      │
                                                      ├─> F6.1 -> F6.2
                                                      │
                                 F7.1 -> F7.2 -> F7.3 -> F7.4 -> F7.5
                                                      │
                                                      v
                                 F8.1  F8.2  F8.3  F8.4
```

Tre note sull'ordine:

- **D.1 e D.2 vanno avviati subito**: senza dati reali, la Fase 1 e la Fase 2 si collaudano
  su file finti e i problemi veri (legature, suffissi, articoli abrogati) si scoprono tardi.
- La **Fase 4 può partire in parallelo** alla Fase 2 o alla Fase 3: dipende solo
  dall'esistenza di qualche domanda, ed è la parte più incerta, quindi va toccata presto.
- La **Fase 6 è il banco di prova del grader**: se aspettare la Fase 5 dà fastidio, si
  possono anticipare F6.1 e F6.2 subito dopo F4.5 e affrontare la simulazione con il grader
  già collaudato.

---

## Decisioni da chiudere

Da confermare con l'utente **prima** del task indicato, non durante.

| Decisione | Serve per | Stato |
|---|---|---|
| Regola della lode | F5.3 | Default proposto: 30 con tutte e sei corrette e nessuna correzione terminologica |
| Formula dei punti e penalità terminologica | F4.3 | Da definire nei numeri esatti |
| Navigazione durante la prova: sei domande in sequenza o avanti e indietro | F5.4 | Da decidere |
| Filtro per argomento nella simulazione | F5.2 | Proposta: nessun filtro, si estrae su tutto |
| Domande mai incontrate nel ripasso quotidiano | F7.4 | Proposta: escluse finché non incontrate almeno una volta |
| Cancellazione delle domande (`DELETE /questions/:id`) | F2.3 | Da valutare: serve davvero? |
| Chiave di idempotenza dell'import domande | F2.2 | Proposta: `deck_id` più `prompt` normalizzato |
| Statistiche e progressi | F8.2 | Non ancora chiesti a lei: non implementare |
| Palette e nome definitivo del sito | F8.3 | Provvisorio: "Studio" |
| Esempi di domande d'esame reali | D.2 | Li manderà lei più avanti; fino ad allora vale lo stile già deciso |
