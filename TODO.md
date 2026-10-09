# TODO

Lista dei task per il loop agentico. Workflow, regole e gate sono in [`CLAUDE.md`](CLAUDE.md) (sezione "Sviluppo agentico"); contesto e decisioni di prodotto in [`docs/PROGETTO.md`](docs/PROGETTO.md); descrizione originale delle fasi in [`docs/ROADMAP.md`](docs/ROADMAP.md).

> Dove `ROADMAP.md` e `server/ENDPOINTS.md` si contraddicono, vale **`server/ENDPOINTS.md`** (percorsi, nomi dei campi e forma delle risposte): è la documentazione più recente. Esempio: l'import è `POST /import/questions`, la simulazione è `/exams`, le flashcard sono `/flashcards`.

## Come si usa

- Ogni task è **una PR**: un branch `agent/<ID>`, un commit, una PR verso `agents-program`.
- L'agente prende **il primo task `aperto` le cui dipendenze ("Dipende da") sono tutte `fatto`**, in ordine dall'alto. Un task con una dipendenza non `fatto` si salta.
- Stati: `aperto` -> `in corso` -> `fatto` (solo a gate verdi, review OK e commit eseguito) oppure `bloccato` (3 tentativi falliti o decisione mancante; la **Note** dice perché).
- I criteri marcati **[manuale]** li verifica l'utente (richiedono Supabase, Gemini o un browser reale, che nel cloud non ci sono). L'agente non li spunta e non lo considera un ostacolo al `fatto`: li riporta nella descrizione della PR.
- L'agente compila **Note** con hash del commit, scelte fatte e punti da verificare.

## Definition of done (vale per ogni task, non si ripete sotto)

1. `bash scripts/gates.sh all` verde; nessun `eslint-disable`, nessuna regola allentata.
2. Se il task ha test (`node:test`, dopo TEST-1): scritti **prima** dell'implementazione e non modificati per farli passare.
3. Endpoint nuovi o modificati: `server/ENDPOINTS.md` **e** `server/postman_collection.json` coerenti con il codice nello stesso commit (le rotte sono già documentate: correggere ciò che differisce, non duplicare).
4. Ogni risposta è `{ ok: true, ... }` o `{ ok: false, error }`, errori in italiano. Input esterni validati con Zod (`config/zod.js`), mai da `"zod"`.
5. **Mai** nelle risposte API: `score`, `points` per singola domanda, `rubric` o `reference_answer` durante una prova in corso, `concepts` del grader, percentuali.
6. Frontend: solo componenti già esistenti in `components/` e `components/ui/`, `useFetch`/`useMutation`, `DataTable` con label in `columnLabels.js`, icone Lucide, **nessuna emoji**, target di tocco di almeno 44 px, nessuna funzione solo-hover, tema chiaro e scuro. Eccezione: i componenti nuovi autorizzati sotto.
7. Database invariato: lo schema `#003` è già completo per l'MVP. Se un task sembra richiedere una modifica allo schema, va `bloccato`.
8. La ROADMAP non si modifica.

## Decisioni assunte

Il `PROGETTO.md` le lascia aperte; qui sono fissate così i task sono eseguibili. Per cambiarle, modifica questa sezione **prima** di avviare il task indicato.

| # | Decisione | Usata da |
|---|---|---|
| D1 | **Lode**: solo se i 6 verdetti sono `correct`, nessuna correzione terminologica e voto 30. In autovalutazione la lode non c'è. | AI-5, PROVA-3, PROVA-4 |
| D2 | **Formula**: concetto `present` = 1, `partial` = 0,5, `absent` = 0, media pesata con i pesi della rubrica; penalità di 0,1 per ogni correzione terminologica, al massimo 0,3; punteggio interno = base meno penalità, minimo 0. Punti domanda = punteggio x 5, 2 decimali. Voto = somma dei 6 punti arrotondata all'intero. | AI-5 |
| D3 | **Navigazione in prova**: una domanda per schermata, avanti e indietro libero. | PROVA-6 |
| D4 | **Estrazione in simulazione**: su tutto il materiale, nessun filtro per argomento. | PROVA-1 |
| D5 | **Gemini**: chiamate REST con `fetch` (Node 22), nessun SDK nuovo. | AI-1, AI-3 |
| D6 | **Risposta vuota**: non va all'AI, tentativo `wrong` d'ufficio con `grading_source: "SELF"`, `grading` null, `score` 0, `points` 0. | FLASH-2, PROVA-3 |
| D7 | **Tolleranza di consegna**: 15 secondi oltre `expires_at`. | PROVA-2, PROVA-3 |

## Autorizzazioni (per `CLAUDE.md`: "chiedere prima")

Approvando e unendo questo file l'utente autorizza **solo**:
- lo script `"test": "node --test"` in `server/package.json` (TEST-1; nessuna dipendenza installata);
- il nuovo file `client/src/components/FeedbackBlock.jsx` (FLASH-4);
- la variabile opzionale `SEED_DEMO` in `server/.env.example` (SEED-1) e le variabili `GEMINI_*` (AI-1).

Qualsiasi altro componente, dipendenza o modifica di config resta vietato: il task va `bloccato`.

## Già presente (non rifare)

Schema `#003` (`FE_Topics`, `FE_Questions`, `FE_ExamSessions`, `FE_Attempts`) in `server/database/`; `POST /import/questions` con `schemas/questionsImport.schema.js`; `GET /topics`; `utils/zodError.js`; tutte le rotte documentate in `ENDPOINTS.md` e nella collection Postman. I model (`question`, `attempt`, `examSession`) e i controller `questions`, `exams`, `flashcards`, `attempts` esistono come **stub**: firme e commenti pronti, corpo vuoto. I task li riempiono senza cambiarne le firme, salvo dove scritto. Client: nessuna pagina di dominio, nessuna cartella `services/`; `pages/Simulation.jsx` è un file vuoto.

## Formato

```
### <ID> — <Titolo>
- **Stato**: aperto | in corso | fatto | bloccato
- **Dipende da**: ...
- **Descrizione**: ...
- **Criteri di accettazione**: checklist verificabile
- **Note**:
```

---

## Task

### BASE-1 — Riportare il lint a verde
- **Stato**: fatto
- **Dipende da**: -
- **Descrizione**: il lint del client falliva sul codice esistente (7 errori). Corretto senza cambiare il comportamento e senza disattivare regole.
- **Criteri di accettazione**:
  - [x] `bash scripts/gates.sh lint` termina con exit code 0
  - [x] `bash scripts/gates.sh build` continua a passare
  - [x] nessuna regola ESLint disattivata a livello globale in `eslint.config.js`
  - [x] login, logout e persistenza del token funzionano come prima (verifica in browser ancora da fare dall'utente)
- **Note**: commit `08a1c8e`. Resta 1 warning `exhaustive-deps` sullo spread delle deps in `useFetch`, voluto. Context e hook ora in `context/authContext.js`, `context/themeContext.js`, `hooks/useAuth.js`, `hooks/useTheme.js`.

---

### TEST-1 — Test runner del server con `node:test`
- **Stato**: fatto
- **Dipende da**: -
- **Descrizione**: il progetto non ha test. Si aggiunge il runner integrato di Node 22 (zero dipendenze) per le funzioni pure e gli schemi Zod del server, così i task successivi hanno test di accettazione veri. Il client resta senza test automatici. Il gate `test` di `scripts/gates.sh` e la CI lo eseguono già tramite `npm --prefix server run test --if-present`.
- **Criteri di accettazione**:
  - [x] `server/package.json` ha lo script `"test": "node --test"` e nessuna nuova dipendenza
  - [x] `server/test/questionsImport.schema.test.js` copre: payload valido; `topic.name` mancante; rubrica con 1 o 5 concetti; `id` di rubrica duplicati; `weight` 0, negativo o decimale; `references` non array. Ogni caso invalido produce un errore Zod
  - [x] `bash scripts/gates.sh test` esegue i test e passa; la CI li esegue
  - [x] `CLAUDE.md` (tabella dei gate e frase "Stato attuale") aggiornato: il server ha un test runner, il client no
- **Note**: commit unico del branch `agent/TEST-1` (vedi PR). 14 test in `server/test/questionsImport.schema.test.js` (11 richiesti + 3 di contorno: default `references: []`, `topic.name` vuoto, rubrica valida a 4 concetti). Ogni caso invalido verifica `ZodError`, path e codice dell'issue; solo "topic.name mancante" verifica anche il messaggio ("Campo obbligatorio" del locale in `config/zod.js`). `node --test` senza argomenti esegue ogni `.js` sotto `server/test/`: gli helper condivisi futuri vanno fuori da quella cartella (scritto in `CLAUDE.md`). Il commento in `scripts/gates.sh` ("oggi non ne esistono") è ora impreciso ma non è stato toccato (config non autorizzata). Da verificare: job "Test" della CI sulla PR.

### SEED-1 — Dati demo opzionali nel seed
- **Stato**: aperto
- **Dipende da**: -
- **Descrizione**: finché non esistono i JSON veri (lavoro D.1, fuori dal sito) servono domande per provare simulazione e flashcard. `server/database/seed.js` aggiunge, **solo con `SEED_DEMO=true`**, due argomenti di prova e le loro domande. Senza il flag il seed fa esattamente ciò che fa oggi, perché punta anche al database del deploy.
- **Criteri di accettazione**:
  - [ ] con `SEED_DEMO` assente o diverso da `true`, comportamento invariato
  - [ ] con `SEED_DEMO=true`: 2 argomenti con nome che inizia per `[DEMO] ` e almeno 4 domande ciascuno (8 in totale, serve un minimo di 6 per la simulazione); ogni domanda ha `answer` di circa 2 righe, rubrica di 2 o 3 concetti con `id` univoci e peso intero, `references` anche vuoto. Domande brevi sui concetti, mai su un articolo specifico, mai inverse
  - [ ] le righe passano per gli stessi controlli dell'import (stessa normalizzazione del prompt): rilanciare il seed non crea duplicati
  - [ ] `server/.env.example` ha `SEED_DEMO=` con un commento che avvisa di non usarlo sul database di produzione; `CLAUDE.md` (comando `npm run seed`) lo menziona
  - [ ] [manuale] `SEED_DEMO=true npm run seed` due volte di fila: la seconda non inserisce nulla
- **Note**:

---

### DOM-1 — `GET /questions` e `GET /questions/:id`
- **Stato**: fatto
- **Dipende da**: TEST-1
- **Descrizione**: elenco paginato e dettaglio delle domande, secondo `client/src/FILTERS_BE.md` e `ENDPOINTS.md`. Riempie `getQuestions` e `findQuestionById` in `models/question.model.js` e le due rotte `GET` in `controllers/questions.controller.js`.
- **Criteri di accettazione**:
  - [x] `server/utils/pagination.js` (puro): `page` default 1, `limit` default 20 con massimo 100, valori non numerici o negativi -> default, `sort` fuori whitelist -> `created_at`, `order` diverso da `asc` -> `desc`; calcola `from`/`to` per `.range()`. Test in `server/test/pagination.test.js`
  - [x] `server/utils/serializeQuestion.js` (puro) converte la riga DB nella forma API `{ id, topic: { id, name }, prompt, reference_answer, rubric, references, created_at, updated_at }` (`answer` -> `reference_answer`, `article_refs` -> `references`); test dedicato
  - [x] `GET /questions`: filtri `topic_id` (uguaglianza) e `q` (`ilike` sul prompt, con `%` e `_` dell'input resi letterali), `sort` in whitelist `created_at`/`prompt`, `.order()` sempre presente, risposta `{ ok: true, data, pagination: { total, page, limit, totalPages } }`, `totalPages` con `Math.ceil`, pagina oltre l'ultima -> `data: []` con `200`
  - [x] `GET /questions/:id`: `{ ok: true, question }`; id inesistente o non uuid -> `404` "Domanda non trovata"
  - [x] errori DB -> `500` generico, nessun dettaglio interno nella risposta
  - [ ] [manuale] da Postman: filtro per argomento, ricerca testuale, seconda pagina
- **Note**: commit unico del branch `agent/DOM-1`, impilato su `agent/TEST-1` (vedi PR). Utility pure: `utils/pagination.js` (`parsePagination`, `getRange`, `buildPagination`), `utils/serializeQuestion.js`, `utils/sqlFilters.js` (`escapeLike` per backslash, `%` e `_`; `isUuid`). Scelte: `topic_id` non uuid -> `200` con `data: []` senza interrogare il DB (un filtro per uguaglianza su un id impossibile non trova nulla; evita l'errore Postgres `22P02` che diventerebbe un 500); parametri vuoti (`q=`, `topic_id=`) = nessun filtro; id non uuid -> `404`; ordinamento secondario su `id` per pagine stabili (le domande dello stesso import hanno lo stesso `created_at`); pagina oltre l'ultima: PostgREST risponde `PGRST103`, il model rifà un count `head` con gli stessi filtri e restituisce `data: []` con il totale. Test: 32 nuovi (pagination, serializeQuestion, sqlFilters, model e rotte con un client Supabase finto iniettato in `require.cache`). Non gestiti (fuori criterio): `*` nella ricerca resta un jolly di PostgREST; `page` enorme (oltre 1e21) finisce in 500. Da verificare: fallback `PGRST103` ed escape di `ilike` su Supabase reale.

### DOM-2 — `PATCH` e `DELETE /questions/:id`
- **Stato**: fatto
- **Dipende da**: DOM-1
- **Descrizione**: correggere e cancellare una domanda. Riempie `updateQuestion`, `deleteQuestion` e `hasAttemptsForQuestion` (`attempt.model.js`) e le rotte `PATCH`/`DELETE`.
- **Criteri di accettazione**:
  - [x] `schemas/questionPatch.schema.js`: body parziale con almeno un campo tra `topic_id` (uuid), `prompt`, `reference_answer`, `rubric`, `references`; stesse regole dell'import (rubrica 2-4 concetti con `id` univoci e peso intero positivo). I frammenti riusabili si esportano da `questionsImport.schema.js` **senza cambiare il comportamento dell'import** (i test di TEST-1 restano verdi). Test in `server/test/questionPatch.schema.test.js`: body vuoto, campo sconosciuto, rubrica invalida
  - [x] `PATCH`: valida con `safeParse` + `sendZodError`; mappa `reference_answer` -> `answer` e `references` -> `article_refs`; valorizza `updated_at`; risposta `{ ok: true, question }` nella forma API; `404` se la domanda o il `topic_id` non esistono; `409` se esiste già nell'argomento una domanda con lo stesso prompt normalizzato
  - [x] `DELETE`: `409` con il messaggio esatto di `ENDPOINTS.md` se la domanda ha tentativi; altrimenti cancella e risponde `{ ok: true }`; `404` se non esiste
  - [ ] [manuale] da Postman: correzione di una domanda, cancellazione di una senza tentativi
- **Note**: commit unico del branch `agent/DOM-2`, impilato su `agent/DOM-1` (vedi PR). `schemas/questionPatch.schema.js` riusa `requiredText`, `rubricSchema` e `referencesSchema` dell'import (unico cambio all'import: l'export di `requiredText`); `topic_id` validato con `z.guid` (qualsiasi uuid ben formato, come `isUuid`); nessun default, quindi un campo assente resta invariato e `references: []` svuota. Il 409 per prompt duplicato si rileva solo dal `23505` dell'indice univoco (atomico, senza race, e la domanda non confligge con se stessa): messaggio "Nell'argomento esiste già una domanda con lo stesso testo", documentato in `ENDPOINTS.md`. `topic_id` controllato prima dell'update (404 "Argomento non trovato", che vince se mancano sia domanda sia argomento). `updated_at` valorizzato nel model. DELETE: `hasAttemptsForQuestion` (count `head`) poi delete; il `23503` della FK resta come rete di sicurezza -> stesso 409. Id non uuid -> 404. Test: 42 nuovi (`questionPatch.schema.test.js`, `questions.write.test.js` con Supabase finto). Non gestito: argomento cancellato tra il controllo e l'update -> 500 (oggi non esiste una rotta che cancella argomenti). Da verificare: 409 e `maybeSingle` su update/delete senza righe con Supabase reale.

### DOM-3 — Pagina "Domande" (elenco)
- **Stato**: fatto
- **Dipende da**: DOM-1, SEED-1
- **Descrizione**: la vista di consultazione del materiale. Crea `client/src/services/` (prima cartella) e la prima pagina di dominio, che diventa il riferimento per le successive: `ADDING_A_RESOURCE.md` e `CLAUDE.md` ("Page pattern") vanno aggiornati con il riferimento a questa pagina.
- **Criteri di accettazione**:
  - [x] `services/topicsService.js` (`getTopics` -> `res.data.topics`) e `services/questionsService.js` (`getQuestions(params)` -> `{ data, pagination }`): usano l'istanza `api`, fanno l'unwrap e rilanciano `Error(message)`
  - [x] `QUESTIONS_COLUMN_LABELS` in `constants/columnLabels.js` (prompt, argomento, riferimenti)
  - [x] `pages/Domande.jsx` alla rotta `/domande` dentro `PrivateRoute` e `AppLayout`; voce "Domande" (icona Lucide) in `MENU_ITEMS` di `Side.jsx`
  - [x] `useFetch` con i filtri nelle deps; `FilterBar` con ricerca testuale e select dell'argomento (opzione "Tutti"); `DataTable` con paginazione collegata a `pagination`; cambiando un filtro si torna a pagina 1
  - [x] stati di caricamento (`Loader`), errore (messaggio + "Riprova" con `refetch`) e vuoto ("Nessuna domanda trovata") resi nella pagina
  - [x] `riferimenti` mostrati come testo compatto ("art. 1, 2"), vuoto se assenti
  - [ ] [manuale] su Safari iPad: filtri e paginazione usabili al tocco; tema chiaro e scuro
- **Note**: commit unico del branch `agent/DOM-3`, impilato su `agent/DOM-2` (vedi PR); SEED-1 (dipendenza) è `fatto` sulla sua PR separata e serve solo per avere dati demo, non per il codice. Creati `services/topicsService.js`, `services/questionsService.js`, `utils/formatReferences.js` ("art. 1, 2", sempre "art.") e `pages/Domande.jsx` (rotta `/domande`, voce "Domande" con icona `BookOpen`). Estesi due componenti esistenti, in modo retrocompatibile (nessun componente nuovo): `FilterBar` ha il tipo `text` e campi/pulsanti alti 44 px con testo a 16 px (niente zoom su iPad); `DataTable` ha le props opzionali `pagination` + `onPageChange` (Precedente/Successiva, "Pagina X di Y"). Pagina: ricerca con debounce di 300 ms (setState solo nella callback del timer), ogni cambio di filtro torna a pagina 1, `FilterBar` sempre montata; loader a tutta area solo al primo caricamento, nei ricaricamenti la tabella resta montata (`aria-busy`) così il focus da tastiera non si perde, e i cambi pagina durante una richiesta sono ignorati; etichette dei filtri in una costante della pagina. Se gli argomenti non si caricano la pagina resta usabile senza quel filtro. Verifiche: `node scripts/checks/formatReferences.check.mjs` (9 casi; il client non ha un test runner e lo script non è collegato ai gate), controlli grep del piano, render in Chromium con API finta in tema chiaro e scuro (controlli da 44 px, nessun errore in console, focus mantenuto). Il controllo del piano "nessun eslint-disable in client/src" è stato applicato come "nessuno aggiunto": ne esiste uno dal primo commit in `hooks/useMutation.js`, non toccato. Fuori perimetro, da valutare in un task a parte: `useFetch` non scarta le risposte arrivate in ritardo (una ricerca lenta può sovrascrivere quella nuova); `Loader` ha colori fissi poco leggibili nel tema scuro. `ADDING_A_RESOURCE.md` e `CLAUDE.md` indicano ora la risorsa domande come riferimento.

### DOM-4 — Dettaglio, modifica e cancellazione di una domanda
- **Stato**: fatto
- **Dipende da**: DOM-2, DOM-3
- **Descrizione**: dalla riga si apre il dettaglio; da lì si corregge o si cancella.
- **Criteri di accettazione**:
  - [x] `Modal` di dettaglio: argomento, prompt, risposta di riferimento, rubrica (concetto e peso), riferimenti
  - [x] `Modal` di modifica con `*Form` inline e `formState` locale: modifica `prompt`, `answer`, `references` (voci separate da virgola) e, per ogni concetto **esistente**, testo e peso; non si aggiungono né tolgono concetti (fuori perimetro); validazione client dentro la mutation fn con `useMutation`, `PATCH` via `questionsService.updateQuestion`, `refetch()` e toast in `onSuccess`; errore `409`/`400` del server mostrato nel form
  - [x] cancellazione: `Modal` di conferma, `DELETE` via service; sul `409` si mostra il messaggio del server e la domanda resta; sul successo `refetch()`
  - [x] se la pagina cancellata resta vuota si torna alla pagina precedente
  - [x] nessun componente nuovo; textarea con testo da almeno 16 px (niente zoom automatico su iPad)
  - [ ] [manuale] correzione di una domanda e cancellazione di una senza tentativi, da browser
- **Note**: commit unico del branch `agent/DOM-4`, impilato su `agent/DOM-3` (vedi PR). Dalla colonna "Domanda" (ora un pulsante, raggiungibile da tastiera) si apre il `Modal` di dettaglio; da lì "Modifica" (form inline `QuestionForm` con `formState` locale) ed "Elimina" (`Modal` di conferma). Funzioni pure in `utils/questionForm.js` (`questionToFormState`, `parseReferences`, `validateQuestionForm` con gli stessi testi del server, `formStateToPatch`, `pageAfterDelete`), verificate da `scripts/checks/questionForm.check.mjs` (29 casi). `questionsService` ha `updateQuestion` e `deleteQuestion`. Scelte: il PATCH invia solo i campi cambiati (la rubrica intera, con gli stessi id, se cambia un testo o un peso); se non cambia nulla il form mostra "Nessuna modifica da salvare"; errori di validazione, 400 e 409 mostrati nel form come elenco (`role="alert"`); il modale non si chiude durante un salvataggio o una cancellazione; dopo la cancellazione dell'unico elemento di una pagina successiva alla prima si torna alla precedente, altrimenti `refetch()`. Nell'interfaccia il campo `answer` del criterio è "Risposta di riferimento" (`reference_answer` nell'API). Estesi in modo retrocompatibile due componenti esistenti (nessun componente nuovo): `Modal` (pulsante chiudi da 44 px, prop `size` md/lg, chiusura con Esc, contenuto scrollabile entro il 90% dell'altezza) e `DataTable` (cella con `onClick` resa come `<button>`). Textarea e input del form a 16 px (niente zoom su iPad), controlli alti almeno 44 px. Verifiche: gate, controlli statici del piano, scenari in Chromium con API finta (tema chiaro e scuro, tastiera, PATCH, 409/400, DELETE, ritorno di pagina). Fuori perimetro: focus trap nel dialog e ritorno del focus alla chiusura (passando dal dettaglio alla modifica il focus finisce sul body); le osservazioni di DOM-3 su `useFetch` e `Loader` restano valide.

### DOM-5 — Pagina "Import"
- **Stato**: aperto
- **Dipende da**: DOM-3
- **Descrizione**: importare i JSON delle domande dal sito, senza passare da Postman.
- **Criteri di accettazione**:
  - [ ] `services/importService.js` -> `POST /import/questions`
  - [ ] `pages/Import.jsx` alla rotta `/import`, voce in `MENU_ITEMS` (icona Lucide): selezione di un file `.json` **oppure** incolla in una textarea ampia (su iPad il selettore file è scomodo); il file selezionato riempie la textarea
  - [ ] il JSON si parsa nel browser: se non è sintassi valida, errore italiano chiaro **senza** chiamare il server
  - [ ] `useMutation`; esito `201` come riepilogo (nome argomento, "creato" o "già esistente", domande inserite, domande ignorate); `400`: l'`error` arriva già unito con `; ` dal client Axios, la pagina lo separa e mostra un elenco voce per voce; `409` con il messaggio del server
  - [ ] la pagina non si rompe con file vuoti o enormi; il pulsante è disabilitato durante la richiesta
  - [ ] [manuale] import di un argomento di prova, reimport (0 inserite), file sbagliato
- **Note**:

---

### AI-1 — Configurazione di Gemini
- **Stato**: aperto
- **Dipende da**: TEST-1
- **Descrizione**: chiave e modello solo lato server, con fallimento immediato all'avvio se mancano.
- **Criteri di accettazione**:
  - [ ] `server/config/gemini.js`: legge `GEMINI_API_KEY` e `GEMINI_MODEL` e **lancia all'import** se mancano, sul modello di `config/jwt.js`; esporta chiave, modello e URL base. Nessun valore di default per la chiave
  - [ ] `server.js` lo richiede all'avvio (dopo `dotenv`), così il server non parte senza configurazione
  - [ ] il nome del modello Flash **non è dato per noto**: va verificato sulla documentazione ufficiale di Google AI Studio (WebFetch) e la pagina consultata riportata in Note. Se non raggiungibile, `GEMINI_MODEL` resta vuoto in `.env.example` con un commento e la cosa va nelle Note
  - [ ] `server/.env.example` con `GEMINI_API_KEY=` e `GEMINI_MODEL=`; `CLAUDE.md` (sezione Environment) li elenca
  - [ ] la chiave non compare mai in log, errori o risposte, e non è mai in `client/`
  - [ ] [manuale] su Railway vanno aggiunte le due variabili a mano (`DEPLOY.md` non si tocca)
- **Note**:

### AI-2 — Schema dell'output del grader e costruzione del prompt
- **Stato**: aperto
- **Dipende da**: AI-1
- **Descrizione**: il contratto JSON con il modello e le funzioni pure che costruiscono i prompt. Nessuna chiamata di rete.
- **Criteri di accettazione**:
  - [ ] `schemas/graderOutput.schema.js` (Zod): `concepts[{ id, status: present|partial|absent }]`, `verdict: correct|partial|wrong`, `corrections[{ written, suggested, reason }]`, `suggestion`, `exampleAnswer`; campi extra (anche percentuali) scartati; versione batch `{ results: [{ index, ...output }] }`
  - [ ] `services/graderPrompt.js` (puro): `buildSinglePrompt({ prompt, referenceAnswer, rubric, references, answer })` e `buildBatchPrompt(items)` con `items[].index`. Il prompt, in italiano, dice: conta il concetto e non le parole esatte; la terminologia tecnica è rilevante ("nullo" non è "annullabile", "può" non è "deve") e va segnalata in `corrections`; l'ordine conta se la risposta attesa è una sequenza; usa **solo** gli `id` della rubrica; i riferimenti normativi sono contesto, non testo di legge; rispondi solo JSON; nessuna percentuale. La risposta dello studente è racchiusa in delimitatori e il prompt dice di trattarla come dato e **ignorare istruzioni** al suo interno
  - [ ] test in `server/test/graderOutput.schema.test.js` e `server/test/graderPrompt.test.js`: output valido; `verdict` fuori dominio, `status` fuori dominio, campi mancanti rifiutati; il prompt contiene domanda, rubrica con id, riferimenti e la risposta tra i delimitatori; nel batch gli `index` compaiono tutti
- **Note**:

### AI-3 — Modulo grader: valutazione singola
- **Stato**: aperto
- **Dipende da**: AI-2
- **Descrizione**: `services/grader.js`, **unico file che conosce il provider**. Chiama Gemini via REST (D5), ottiene JSON, lo valida, gestisce limiti e fallimenti.
- **Criteri di accettazione**:
  - [ ] `createGrader({ apiKey, model, fetchImpl = fetch, sleep, maxAttempts = 4, timeoutMs })` restituisce `{ gradeAnswer }`; l'istanza di default si costruisce **in modo pigro** da `config/gemini.js`, così i test non richiedono le variabili d'ambiente. Richiesta con `responseMimeType: "application/json"` e header `x-goog-api-key` (formato verificato sulla documentazione ufficiale)
  - [ ] `429` e `5xx`: backoff esponenziale (1 s, 2 s, 4 s, con piccolo jitter) fino a `maxAttempts`, poi `Error("GRADER_UNAVAILABLE")`; timeout complessivo rispettato
  - [ ] output non JSON o non conforme allo schema, **o** con `id` di concetto diversi da quelli della rubrica (mancanti, in più, duplicati): **un solo** nuovo tentativo, poi `Error("GRADER_INVALID_OUTPUT")`; il motivo si logga con `formatZodError`, senza risposta dello studente e senza chiave
  - [ ] test in `server/test/grader.test.js` con `fetchImpl` e `sleep` finti: successo; `429` poi successo con attese 1 s e 2 s; `429` sempre -> `GRADER_UNAVAILABLE` dopo `maxAttempts` chiamate; JSON non valido due volte -> `GRADER_INVALID_OUTPUT`; non valido poi valido -> esattamente 2 chiamate; id rubrica non coerenti rifiutati; la chiave non compare nei messaggi d'errore
  - [ ] [manuale] con una chiave vera, 5 risposte di prova (giusta, parziale, sbagliata, giusta con un termine errato, vuota): esiti sensati
- **Note**:

### AI-4 — Modulo grader: valutazione in batch
- **Stato**: aperto
- **Dipende da**: AI-3
- **Descrizione**: la simulazione valuta le risposte in **una sola chiamata**. `gradeBatch` si aggiunge a `createGrader`, con la stessa gestione di 429, timeout e output non valido.
- **Criteri di accettazione**:
  - [ ] `gradeBatch(items)` con `items[]` = `{ index, prompt, referenceAnswer, rubric, references, answer }` (da 1 a 6 elementi, `index` scelto dal chiamante: la posizione in prova); restituisce una `Map` o un oggetto `index -> output`
  - [ ] una sola chiamata HTTP per batch; validazione: stessi `index` richiesti, nessuno mancante, in più o duplicato; per ciascuno le regole sugli id della rubrica di AI-3; fallimento -> un solo nuovo tentativo dell'intera chiamata, poi `GRADER_INVALID_OUTPUT`
  - [ ] batch vuoto -> restituisce risultato vuoto **senza chiamare la rete**
  - [ ] test in `server/test/graderBatch.test.js`: 6 elementi in 1 chiamata; `index` mancante rifiutato; `index` duplicato rifiutato; subset di posizioni (es. 1, 3, 4) gestito; `429` con backoff come nel caso singolo
- **Note**:

### AI-5 — Calcolo del punteggio e del voto
- **Stato**: aperto
- **Dipende da**: TEST-1
- **Descrizione**: `server/utils/scoring.js`, funzioni pure che implementano D1 e D2. Sono gli unici numeri che determinano il voto: formula e penalità documentate in commento in cima al file.
- **Criteri di accettazione**:
  - [ ] `computeScore({ rubric, concepts, corrections })` -> punteggio interno 0-1 (D2); `computePoints(score)` -> 0-5 con 2 decimali; `selfGradeScore(verdict)` -> 1 / 0,5 / 0; `emptyAnswerResult()` -> verdetto `wrong`, punteggio 0, punti 0 (D6); `computeExamGrade(attempts)` -> `{ grade, honors }` con voto intero 0-30 e lode per D1
  - [ ] test in `server/test/scoring.test.js`: tutti i concetti `present` e nessuna correzione -> 1 e 5 punti; tutti `absent` -> 0; concetti pieni con 1 correzione -> sotto il massimo; 5 correzioni -> penalità limitata a 0,3; pesi diversi (peso 2 `present` + peso 1 `absent` -> 2/3); 6 domande da 5 punti -> 30 con lode; 6 da 5 ma una con correzione -> 29 o meno senza lode; 5 corrette e una `partial` -> niente lode; autovalutazione -> mai lode; arrotondamento del voto
  - [ ] nessun export restituisce o formatta percentuali
- **Note**:

---

### FLASH-1 — `GET /flashcards`: estrazione delle domande
- **Stato**: aperto
- **Dipende da**: DOM-1
- **Descrizione**: domande a caso sugli argomenti scelti. Riempie `getRandomQuestionsByTopics` e la rotta `GET /flashcards`; introduce l'utilità di estrazione casuale riusata dalla simulazione.
- **Criteri di accettazione**:
  - [ ] `utils/random.js` (puro): `shuffle(array, rng = Math.random)` (Fisher-Yates, non muta l'input) e `pickRandom(array, n, rng)`; test in `server/test/random.test.js` con `rng` deterministico (nessun elemento perso né duplicato, `n` maggiore della lunghezza -> tutti)
  - [ ] `getRandomQuestionsByTopics(topicIds, count)`: legge gli id delle domande degli argomenti, ne sceglie `count` a caso in JS e carica solo quelle, con l'argomento; nessuna ripetizione
  - [ ] query `topics` (id uuid separati da virgola, obbligatorio) e `count` (intero 1-50, default 10); `400` con messaggio italiano se `topics` manca o contiene valori non uuid o `count` non è valido; se le domande sono meno di `count` restituisce quelle che ci sono
  - [ ] risposta `{ ok: true, questions: [{ id, prompt, topic: { id, name } }] }`: **mai** `answer`, `rubric` o `references`. Il parsing della query è una funzione pura con test
  - [ ] [manuale] 10 domande su due argomenti: arrivano 10 domande pertinenti e diverse
- **Note**:

### FLASH-2 — `POST /flashcards/answer`: valutazione immediata e fallback
- **Stato**: aperto
- **Dipende da**: FLASH-1, AI-3, AI-5
- **Descrizione**: salva la risposta, la fa valutare dal grader e restituisce il feedback. Se l'AI non risponde, lo studio non si ferma. Riempie `findAttemptById`, `createFlashcardAttempt`, `updateAttempt` e la rotta.
- **Criteri di accettazione**:
  - [ ] `utils/serializeAttempt.js` (puro): dall'attempt e dalla domanda alla forma `{ id, verdict, grading_source, feedback: { corrections, suggestion, exampleAnswer } | null, reference_answer, references }`. Test in `server/test/serializeAttempt.test.js`: l'oggetto prodotto **non contiene mai** `score`, `points`, `concepts`, `rubric`, `grading`
  - [ ] body validato (`question_id` uuid, `answer` stringa, massimo 5000 caratteri -> `400`); domanda inesistente -> `404`
  - [ ] ordine: prima si crea il tentativo con la risposta (nulla si perde), poi si valuta
  - [ ] risposta vuota o di soli spazi: niente AI, tentativo `wrong` d'ufficio (D6), `feedback` null
  - [ ] successo: `gradeAnswer` poi `computeScore`/`computePoints`; `updateAttempt` salva `verdict`, `grading` (output validato completo), `grading_source: "AI"`, `points`, `score`, `graded_at` rispettando i CHECK dello schema; risposta `201 { ok: true, attempt }`
  - [ ] il grader fallisce (`GRADER_UNAVAILABLE` o `GRADER_INVALID_OUTPUT`): il tentativo resta non valutato, risposta `201` con `verdict`, `grading_source`, `feedback` a `null` e `reference_answer` valorizzata; l'errore è loggato senza dati sensibili
  - [ ] [manuale] con chiave valida arriva la valutazione; con chiave finta scatta il fallback
- **Note**:

### FLASH-3 — `POST /attempts/:id/self-grade`
- **Stato**: aperto
- **Dipende da**: FLASH-2
- **Descrizione**: l'autovalutazione di riserva di una flashcard rimasta senza valutazione. Riempie la rotta in `controllers/attempts.controller.js`.
- **Criteri di accettazione**:
  - [ ] body `{ verdict }` validato (`correct|partial|wrong`) -> `400` altrimenti; tentativo inesistente o id non uuid -> `404`
  - [ ] `409` se il tentativo è già valutato o appartiene a una simulazione (`session_id` non nullo), con il messaggio che rimanda a `POST /exams/:id/self-grade`
  - [ ] salva `verdict`, `grading_source: "SELF"`, `score = selfGradeScore(verdict)`, `points = computePoints(score)`, `graded_at`, `grading` null; risposta `{ ok: true, attempt }` nella stessa forma di FLASH-2 (con `feedback: null`)
  - [ ] [manuale] fallback di FLASH-2 seguito dall'autovalutazione
- **Note**:

### FLASH-4 — Pagina "Flashcard": scelta, domande e feedback
- **Stato**: aperto
- **Dipende da**: FLASH-2, DOM-3
- **Descrizione**: studiare con feedback immediato, senza voto né timer. Crea il blocco di feedback condiviso con la revisione della simulazione (componente autorizzato in questo file). Il caso `verdict: null` (AI non disponibile) arriva in FLASH-5.
- **Criteri di accettazione**:
  - [ ] `components/FeedbackBlock.jsx` (nuovo, autorizzato): riceve `verdict`, `feedback` (può essere `null`), `referenceAnswer`, `references`; mostra esito con icona Lucide ed etichetta italiana (corretta, parzialmente corretta, errata), correzioni (testo scritto -> versione corretta, motivo), suggerimento, risposta esemplare, risposta di riferimento e riferimenti normativi; **mai** percentuali o punteggi; usabile al tocco
  - [ ] `services/flashcardsService.js` (`getFlashcards`, `answerFlashcard`)
  - [ ] `pages/Flashcard.jsx` alla rotta `/flashcard`, voce in `MENU_ITEMS`. Impostazione: argomenti da `getTopics` come elenco di toggle (target 44 px, "Tutti" e "Nessuno") e numero di domande 1-50 (default 10); "Inizia" disabilitato senza argomenti
  - [ ] ciclo: una domanda per schermata, textarea ampia (testo da almeno 16 px), "Invia" -> stato di attesa con `Loader` ("Sto valutando la risposta") -> `FeedbackBlock` sotto la risposta -> "Avanti"; "Non so" invia la risposta vuota; nessun voto, nessun timer, nessuna percentuale
  - [ ] se arrivano meno domande di quelle richieste la sessione prosegue con quelle ricevute; se zero, messaggio chiaro
  - [ ] [manuale] una sessione da 10 domande con feedback coerenti, su Mac e iPad
- **Note**:

### FLASH-5 — Flashcard: fallback di autovalutazione, riepilogo e Home
- **Stato**: aperto
- **Dipende da**: FLASH-3, FLASH-4
- **Descrizione**: chiude il percorso flashcard e sistema la Home.
- **Criteri di accettazione**:
  - [ ] `services/attemptsService.js` (`selfGradeAttempt`)
  - [ ] se la risposta ha `verdict: null`: si mostra la risposta di riferimento e tre pulsanti (corretta, parzialmente corretta, errata); la scelta chiama il service, poi si mostra `FeedbackBlock` con l'esito e la risposta di riferimento; un errore non perde la schermata
  - [ ] fine sessione: riepilogo sobrio con **solo** il numero di domande svolte, senza punteggi né conteggi per esito, e due azioni ("Nuova sessione", "Home")
  - [ ] `pages/Home.jsx`: titolo e un punto di ingresso verso "Flashcard" (link con icona Lucide); niente statistiche, promemoria o gamification
  - [ ] [manuale] fallback provato con chiave finta
- **Note**:

---

### PROVA-1 — Avvio della simulazione e lettura (`POST /exams`, `GET /exams/:id`)
- **Stato**: aperto
- **Dipende da**: DOM-1, FLASH-1
- **Descrizione**: estrae 6 domande, crea la sessione e le 6 righe di `FE_Attempts` con risposta vuota, restituisce la prova. Riempie i model `examSession` e `attempt` (create/find), `getRandomQuestions` e le due rotte.
- **Criteri di accettazione**:
  - [ ] `config/exam.js` con `EXAM_QUESTIONS = 6`, `EXAM_DURATION_MINUTES = 40`, `EXAM_GRACE_SECONDS = 15` (D7)
  - [ ] `utils/serializeExam.js` (puro) per **tutti** gli stati, come in `ENDPOINTS.md`: con `IN_PROGRESS` ogni domanda ha solo `position`, `prompt`, `topic`, `answer`; dopo la consegna aggiunge `reference_answer`, `references`, `verdict`, `grading_source`, `feedback`. Mai `score`, `points`, `rubric`, `concepts`. Test in `server/test/serializeExam.test.js` che verifica l'assenza di `reference_answer` e `rubric` in `IN_PROGRESS` e di `score`/`points`/`concepts`/`rubric` sempre
  - [ ] `POST /exams` (body vuoto): se esiste una prova `IN_PROGRESS` **non scaduta** risponde `200 { ok: true, exam, resumed: true }` senza crearne un'altra; altrimenti estrae 6 domande **distinte** (D4), crea sessione (`started_at` e `expires_at` decisi dal server) e 6 attempt (`mode: "EXAM"`, `position` 1-6) e risponde `201 { ..., resumed: false }`; meno di 6 domande nel database -> `409` con messaggio italiano
  - [ ] una `IN_PROGRESS` scaduta non viene ripresa; la sua consegna automatica è PROVA-4 (lasciare il punto di aggancio indicato con un commento che cita PROVA-4)
  - [ ] se la creazione degli attempt fallisce dopo quella della sessione, la sessione viene rimossa (nessuna prova a metà)
  - [ ] `GET /exams/:id`: `{ ok: true, exam }`, `404` se non esiste o non è uuid
  - [ ] [manuale] due avvii consecutivi dopo una consegna danno estrazioni diverse; ricaricando, `answer` e `expires_at` coincidono
- **Note**:

### PROVA-2 — Salvataggio in bozza (`PUT /exams/:id/answers/:position`)
- **Stato**: aperto
- **Dipende da**: PROVA-1
- **Descrizione**: le risposte si salvano sul server mentre lei scrive.
- **Criteri di accettazione**:
  - [ ] `utils/examTime.js` (puro): `isWithinDeadline(exam, now, graceSeconds)`; test in `server/test/examTime.test.js` (prima, esattamente a, dentro la tolleranza, oltre)
  - [ ] body `{ answer }` stringa (anche vuota, massimo 5000 caratteri -> `400`); `position` intero 1-6 altrimenti `400`
  - [ ] `404` se la prova o la posizione non esistono; `409` se la prova non è `IN_PROGRESS` o è oltre `expires_at` più la tolleranza
  - [ ] aggiorna solo `answer` e `updated_at` dell'attempt; risposta `{ ok: true, updated_at }`
  - [ ] [manuale] scrivere, ricaricare: la bozza c'è; dopo i 40 minuti più tolleranza: `409`
- **Note**:

### PROVA-3 — Consegna e voto (`POST /exams/:id/submit`)
- **Stato**: aperto
- **Dipende da**: PROVA-2, AI-4, AI-5
- **Descrizione**: valuta le risposte salvate in **una sola chiamata batch**, calcola voto e lode. La logica sta in un servizio riusabile (serve a PROVA-4), il controller resta sottile.
- **Criteri di accettazione**:
  - [ ] `services/examGrading.js` con `submitExam(id, { answers, now })` e `gradeExam(id)`
  - [ ] transizione atomica `IN_PROGRESS` -> `GRADING` con update condizionato su `status` (nuovo parametro opzionale di `updateExamSession`, firma retrocompatibile): una consegna doppia o concorrente dà `409` "Prova già consegnata" e non valuta due volte
  - [ ] `auto_submitted = now > expires_at`, deciso dal server; `answers` opzionale nel body (`[{ position, answer }]`, validato) accettato solo entro `expires_at` più tolleranza e salvato prima della valutazione; oltre, si valutano le bozze già salvate
  - [ ] risposte vuote: niente AI, `wrong` d'ufficio (D6), 0 punti; le altre in **una** chiamata `gradeBatch` con `index = position`; per ogni attempt `computeScore`/`computePoints` e salvataggio con i campi di valutazione tutti insieme (CHECK dello schema)
  - [ ] voto e lode da `computeExamGrade`; stato `GRADED`; risposta `{ ok: true, exam }` con la revisione completa tramite `serializeExam` (nessun voto per singola domanda)
  - [ ] grader fallito dopo i retry: stato `SELF_GRADED`, `grade` null, nessun attempt valutato, la prova **non si perde**; risposta `200 { ok: true, exam }`
  - [ ] `404` prova inesistente; `409` già consegnata; test dei pezzi puri estratti (selezione delle risposte da valutare, assemblaggio del risultato) in `server/test/examGrading.test.js`
  - [ ] [manuale] prova completa da Postman: voto plausibile e sei revisioni; consegna oltre i 40 minuti -> `auto_submitted: true`
- **Note**:

### PROVA-4 — Autovalutazione, nuovo tentativo di valutazione e scadenza senza consegna
- **Stato**: aperto
- **Dipende da**: PROVA-3
- **Descrizione**: le ultime tre rotte della simulazione e la consegna automatica di una prova scaduta e abbandonata.
- **Criteri di accettazione**:
  - [ ] `POST /exams/:id/self-grade`: body `{ verdicts: [{ position, verdict }] }` con **tutte** le 6 posizioni una volta sola, verdetti validi, altrimenti `400`; `409` se la prova non è `SELF_GRADED` o ha già un voto; salva per attempt `verdict`, `grading_source: "SELF"`, punteggio 1/0,5/0, punti; calcola `grade` con `computeExamGrade`, **senza lode** (D1); lo stato resta `SELF_GRADED` e `grade` è valorizzato; risposta `{ ok: true, exam }`
  - [ ] `POST /exams/:id/grade`: ammessa se `GRADING` bloccata oppure `SELF_GRADED` con `grade` null (`409` se ha già un voto); riusa `gradeExam`; successo -> `GRADED` e `{ ok: true, exam }`; grader fallito -> `502` e la prova resta com'era
  - [ ] `GET /exams/:id` e `POST /exams`: una prova `IN_PROGRESS` con `expires_at` oltre la tolleranza viene consegnata automaticamente (`auto_submitted: true`, bozze salvate, stessa valutazione di PROVA-3) **prima** di rispondere; il punto di aggancio lasciato da PROVA-1 viene sostituito
  - [ ] test dei pezzi puri (validazione dei `verdicts`, decisione "è da liquidare?") in `server/test/examSettle.test.js`
  - [ ] [manuale] chiave finta -> `SELF_GRADED` -> autovalutazione; ripristino della chiave -> `POST /exams/:id/grade`
- **Note**:

### PROVA-5 — Storico delle simulazioni e verifica finale della documentazione API
- **Stato**: aperto
- **Dipende da**: PROVA-4, FLASH-3
- **Descrizione**: `GET /exams` paginato, poi un controllo di coerenza di tutto il backend con `ENDPOINTS.md` e Postman.
- **Criteri di accettazione**:
  - [ ] `GET /exams`: `status` (filtro), `page`, `limit`, `sort` (whitelist `started_at`, `grade`), `order`, con `utils/pagination.js`; ogni elemento è l'`exam` **senza** `questions`; `{ ok: true, data, pagination }`
  - [ ] ogni rotta del server (`auth`, `import`, `topics`, `questions`, `exams`, `flashcards`, `attempts`) è confrontata con `server/ENDPOINTS.md` e con `server/postman_collection.json`: percorsi, metodi, body, codici di stato e nomi dei campi corrispondono al codice; le differenze si correggono nei documenti (o, se è il codice a essere sbagliato, nel codice) e si elencano in Note
  - [ ] la collection Postman ha body di esempio validi per ogni richiesta con body, e la cartella `Exams` è nell'ordine d'uso (avvia, bozza, consegna)
- **Note**:

---

### PROVA-6 — Pagina della prova: avvio, domande e bozza
- **Stato**: aperto
- **Dipende da**: PROVA-2, DOM-3
- **Descrizione**: svolgere la simulazione con la calma di un esame vero. Questo task copre avvio, navigazione e salvataggio; timer e consegna sono PROVA-7.
- **Criteri di accettazione**:
  - [ ] `services/examService.js` (`startExam`, `getExam`, `saveDraft`, `submitExam`, `selfGradeExam`, `regradeExam`); il file vuoto `pages/Simulation.jsx` viene rimosso
  - [ ] `pages/Simulazione.jsx` alle rotte `/simulazione` (avvio) e `/simulazione/:id` (prova), voce in `MENU_ITEMS`. Avvio: testo sobrio (sei domande, 40 minuti, nessun feedback durante la prova) e un solo pulsante; il pulsante chiama `POST /exams`: con `resumed: true` un toast avvisa che la prova in corso è stata ripresa; poi naviga a `/simulazione/:id`. Ricaricare `/simulazione/:id` ricarica con `GET /exams/:id`
  - [ ] prova: una domanda per schermata, avanti e indietro libero (D3), indicatore "Domanda 2 di 6" e sei pallini cliccabili per saltare, textarea ampia (testo da almeno 16 px, comoda con la tastiera dell'iPad)
  - [ ] salvataggio in bozza con debounce (circa 800 ms), alla navigazione tra domande, a `visibilitychange` e prima di lasciare la pagina, **senza interrompere la scrittura** (la textarea non perde focus né cursore); indicatore discreto "Salvato" o "Salvataggio non riuscito, riprovo"; un errore di salvataggio non blocca la scrittura
  - [ ] nessun feedback, nessun aiutino, nessun pulsante di contestazione durante la prova
  - [ ] se `GET /exams/:id` restituisce una prova già consegnata, si va a `/simulazione/:id/risultato`
  - [ ] [manuale] scrivere, chiudere la scheda, riaprire: le risposte ci sono; su iPad la tastiera non copre il campo
- **Note**:

### PROVA-7 — Timer, consegna manuale e automatica
- **Stato**: aperto
- **Dipende da**: PROVA-3, PROVA-6
- **Descrizione**: il tempo si legge sempre da `expires_at`, la consegna è sempre decisa dal server.
- **Criteri di accettazione**:
  - [ ] timer sobrio in un sottocomponente **interno al file della pagina** (nessun file nuovo in `components/`): `mm:ss` calcolati da `expires_at` e dall'ora corrente a ogni tick, mai da un contatore incrementale; `role="timer"`, senza annunci vocali a ogni secondo; nessun rosso, lampeggio o allarme; resta corretto dopo ricarica e dopo che la scheda è rimasta in background
  - [ ] consegna anticipata: pulsante "Consegna" -> `Modal` di conferma esplicita ("Non potrai modificare le risposte") -> `POST /exams/:id/submit`
  - [ ] allo scadere: consegna automatica **senza conferma**, che invia nel body `answers` con il testo corrente delle 6 risposte; una sola consegna anche con più tick o doppio click (guardia sullo stato)
  - [ ] durante la consegna: `Loader` a pagina con testo che spiega l'attesa ("Sto valutando la prova, può richiedere qualche decina di secondi"); la chiamata non ha un timeout client più corto del server
  - [ ] a consegna avvenuta, qualunque esito (`GRADED` o `SELF_GRADED`), si naviga a `/simulazione/:id/risultato`; errore di rete o `409` mostrano un messaggio e permettono di riaprire la pagina senza perdere le risposte
  - [ ] [manuale] una prova intera su iPad fino allo scadere: la consegna parte da sola
- **Note**:

### PROVA-8 — Pagina del risultato: voto e revisione
- **Stato**: aperto
- **Dipende da**: PROVA-7, FLASH-4
- **Descrizione**: il voto e poi la revisione, nell'ordine in cui lei li vuole.
- **Criteri di accettazione**:
  - [ ] rotta `/simulazione/:id/risultato` in `Simulazione.jsx` (o file di pagina dedicato): `GET /exams/:id`; se è `IN_PROGRESS` rimanda alla prova
  - [ ] con `GRADED`: prima il **voto in trentesimi** grande e da solo ("27/30", con "con lode" se `honors`); poi, sotto, la revisione domanda per domanda: argomento, domanda, la sua risposta, `FeedbackBlock` (esito, correzioni, suggerimento, risposta esemplare, risposta di riferimento, riferimenti normativi)
  - [ ] **nessun** voto per singola domanda, nessuna percentuale, nessun pulsante per contestare; si segnala se la consegna è stata automatica
  - [ ] risposte vuote mostrate come "Nessuna risposta"
  - [ ] [manuale] leggibile su iPad e Mac, in tema chiaro e scuro
- **Note**:

### PROVA-9 — Risultato in fallback e Home
- **Stato**: aperto
- **Dipende da**: PROVA-4, PROVA-8
- **Descrizione**: la prova non si perde mai, anche se l'AI non risponde. Completa la Home.
- **Criteri di accettazione**:
  - [ ] `SELF_GRADED` con `grade` null: per ogni domanda la sua risposta e la risposta di riferimento con tre pulsanti (corretta, parzialmente corretta, errata); invio unico delle 6 scelte a `POST /exams/:id/self-grade`, abilitato solo a scelte complete; poi la vista del voto come in PROVA-8, senza lode
  - [ ] pulsante "Riprova la valutazione" -> `POST /exams/:id/grade`; sul `502` messaggio chiaro e restano disponibili autovalutazione e nuovo tentativo
  - [ ] stato `GRADING` rimasto aperto: messaggio di attesa con `Loader` e "Riprova la valutazione"
  - [ ] `pages/Home.jsx` ha l'ingresso "Simulazione" accanto a "Flashcard", stessa sobrietà
  - [ ] [manuale] fallback con chiave finta e poi recupero con chiave valida
- **Note**:

---

## Fuori dai task (non iniziare)

- **D.1 — JSON delle domande**: lavoro dell'utente con Claude in chat, argomento per argomento, da testo o `.docx` e mai da PDF. I file `docs/DEF. C.C..docx` e `docs/pdf privato 1.docx` sono materiale di studio per quel lavoro, non specifiche del software.
- **Ripasso con SM-2, storico con andamento dei voti, statistiche, ritocchi di design** (ROADMAP Fasi 5 e 6): rimandati a dopo l'MVP, da pianificare con l'utente.
- **Deploy** (ROADMAP F6.4): sempre a mano, mai dell'agente.
