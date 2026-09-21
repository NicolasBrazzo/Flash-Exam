# Progetto: sito di studio per l'esame di Diritto Privato 1

## Contesto

Sito personale per la ragazza dell'utente, studentessa di giurisprudenza. Deve preparare l'esame di **Diritto Privato 1**, che è sia scritto sia orale, con appello il **14 gennaio 2027**. Il sito le propone domande brevi basate sui suoi appunti e sul codice civile. Lei risponde **scrivendo**, e un'AI valuta la risposta sul **contenuto e sui concetti**, non sulle parole esatte.

La modalità principale è la **simulazione d'esame**: 6 domande con timer e voto finale in trentesimi, come a un esame universitario.

Il progetto è molto importante per l'utente: cura, qualità e semplicità d'uso contano.

### Materiale di studio
- Manuale: *Torrente, Manuale di diritto privato*, 25a edizione.
- Codice civile 2026, con le parti rilevanti per Privato 1: Libro I (persone e famiglia, primi titoli), Libro IV (obbligazioni, contratti, fatti illeciti), Libro VI (tutela dei diritti).
- Circa **1.200 articoli** e circa **50 argomenti** di teoria.
- Studia 2-3 ore al giorno, in sessioni da circa un'ora.
- Usa il sito da **Mac e iPad** (Safari). Il supporto offline non serve.

## Sull'utente

- Sviluppatore full stack (React, Node/Express), con preferenza per frontend e web design.
- **Odia le emoji.** Non usarle mai: né nella UI, né nel codice, né nei commenti, né nei commit, né nelle risposte. Per qualsiasi elemento visivo usa le icone di Lucide.
- Comunica con l'utente in italiano. Testi della UI in italiano; identificatori, nomi di file e commenti nel codice in inglese.

## Decisioni prese con lei

### Domande
- **Brevi, specifiche e secche**, con una risposta attesa di circa **2 righe**.
- Per gli articoli: domande anche **comma per comma**, non solo sull'articolo intero.
- **Sì** alle domande di confronto (esempio: "Differenze tra nullità e annullabilità").
- **No** alle domande inverse ("quale articolo disciplina...?").
- Le domande vengono generate, non le scrive lei. Più avanti manderà esempi di domande d'esame reali, che sono molto specifiche, da usare come riferimento di stile.

### Valutazione
- Conta il **concetto e il contenuto, non le parole esatte**. Il punteggio letterale parola per parola **non** fa parte dell'MVP.
- In diritto però la **terminologia tecnica** conta ("nullo" non è "annullabile", "può" non è "deve"). La valutazione deve segnalarla.
- L'**ordine dei commi** conta, quando la domanda riguarda più commi.
- Dopo ogni risposta lei vuole sapere:
  1. **se è giusta**: esito tra corretta, parzialmente corretta ed errata;
  2. **quali parole o espressioni modificare**: per ognuna, il testo che ha scritto, la versione corretta e il motivo in una riga;
  3. **un suggerimento con un esempio** di risposta migliore.
- **Niente percentuali** mostrate a lei. Nessun pulsante per contestare il voto. Nessun "aiutino".

### Modalità di studio
1. **Simulazione d'esame (feature principale)**: 6 domande estratte a caso, con **timer** (durata da definire). Durante la prova non c'è nessun feedback. Alla fine arrivano il **voto complessivo in trentesimi** e poi la revisione domanda per domanda, con esito, correzioni e suggerimento. Nessun voto per singola domanda.
2. **Flashcard**: lei sceglie argomenti e **numero di domande**. Feedback immediato dopo ogni risposta, nessun voto, nessun timer.
3. **Ripasso quotidiano**: ripetizione spaziata sulle domande che sta dimenticando. Nessun timer.

### Calcolo del voto
- Ogni domanda vale internamente da 0 a 5 punti, quindi 6 domande danno un massimo di 30.
- I punti derivano dalla valutazione a concetti (vedi sotto) e li calcola il codice, non l'LLM.
- Lode: default proposto, cioè 30 con tutte e 6 le risposte corrette e nessuna correzione terminologica. Da confermare con l'utente.
- Il punteggio interno di ogni risposta, da 0 a 1, alimenta anche la ripetizione spaziata, ma non viene mai mostrato a lei.

### Aspetto
- **Semplice e pulito.** Tipografia curata, molto spazio bianco, pochi colori.
- Tema chiaro e scuro che segue le impostazioni di sistema. Palette ancora da definire: parti da una base neutra.
- Design pensato per desktop (Mac) e tablet (iPad): target touch comodi e textarea ampia, usabile anche con la tastiera dell'iPad.

## Come funziona la valutazione

L'LLM riceve la domanda, il materiale di riferimento e la risposta di lei, e restituisce **solo JSON** validato con Zod. Esempio di struttura:

```json
{
  "concepts": [{ "id": "c1", "status": "present" }, { "id": "c2", "status": "partial" }],
  "verdict": "partial",
  "corrections": [{ "written": "è nullo", "suggested": "è annullabile", "reason": "L'incapacità naturale determina annullabilità, non nullità" }],
  "suggestion": "Ricorda di citare il termine di prescrizione.",
  "exampleAnswer": "..."
}
```

- **Domande di teoria**: il riferimento è una **griglia di 2-4 concetti chiave con pesi**, generata insieme alla domanda.
- **Domande sugli articoli**: il riferimento è il **testo ufficiale dell'articolo o del comma**, preso dal database degli articoli. La griglia è opzionale; se manca, i concetti li estrae l'LLM dal testo.
- I punti (0-5) e il punteggio interno (0-1) li calcola il codice a partire dagli stati dei concetti e dai pesi, con una penalità per le correzioni terminologiche.
- **Simulazione**: le 6 risposte si valutano alla fine in **una sola chiamata** (batch), così l'attesa è una sola e si rispettano i limiti di richieste.
- **Fallback**: se l'API non risponde, il sito mostra la risposta di riferimento e lei si autovaluta (giusta, parziale, sbagliata). Lo studio non deve mai bloccarsi.
- Provider: **Gemini, piano gratuito** di Google AI Studio, modello Flash (verifica sulla documentazione ufficiale il nome corrente). Limiti indicativi di 10-15 richieste al minuto, quindi retry con backoff esponenziale sui 429. Il provider va isolato dietro un'interfaccia `Grader`, così si può cambiare toccando un solo file.

## Da dove arrivano domande e articoli

### Articoli del codice (import automatico, senza AI)
Il file del codice civile preparato da lei ha una struttura molto regolare:
- intestazioni `LIBRO 1°: ...`, `→ TITOLO I: ...`, `Capo I: ...`;
- ogni articolo nella forma `Art. 1321: Nozione`, seguita dal testo tra virgolette;
- commi su righe separate; numeri con suffisso (`Art. 42-bis`, `Art. 1785-ter`);
- articoli segnati come `(abrogato)` nella rubrica;
- circa 1.020 articoli, numeri di pagina a piè di pagina da scartare.

Serve un **parser** che trasformi il file in record `Article` (numero, suffisso, rubrica, libro, titolo, capo, abrogato sì/no, testo, commi). Gli articoli abrogati si importano ma si escludono dalle domande. Dagli articoli si possono generare domande **a template** senza AI, per esempio "Cosa dispone l'art. 1541 c.c.?" oppure "Cosa prevede il comma 2 dell'art. 1543 c.c.?".

**Attenzione**: i PDF esportati da Pages perdono le legature tipografiche in estrazione. Per esempio "diritto" diventa "diri o" e "fisiche" diventa "siche". Per questo il parser deve lavorare su una **esportazione in testo o .docx** dei file originali di Pages, non sul PDF.

### Domande di teoria (import JSON)
Gli appunti di teoria sono discorsivi, organizzati per capitoli e argomenti, con titoli in maiuscolo (per esempio `IL CONTRATTO DI SPEDIZIONE [1737-1741]`) e citazioni di articoli nel testo. Le domande vengono generate **fuori dal sito**, da Claude in chat, capitolo per capitolo, e importate come JSON tramite una pagina di import. Lo schema Zod sta in `packages/shared`.

```json
{
  "deck": { "title": "Il contratto - Causa", "chapter": "Il contratto", "tags": ["causa"] },
  "questions": [
    {
      "type": "THEORY",
      "prompt": "Cosa si intende per causa concreta del contratto?",
      "referenceAnswer": "La funzione economico-individuale che il singolo contratto è diretto a realizzare, cioè la sintesi degli interessi concretamente perseguiti dalle parti.",
      "rubric": [
        { "id": "c1", "concept": "Funzione economico-individuale del singolo contratto", "weight": 2 },
        { "id": "c2", "concept": "Sintesi degli interessi concreti delle parti", "weight": 1 }
      ],
      "relatedArticles": ["1325", "1343"],
      "tags": ["causa"]
    },
    {
      "type": "ARTICLE",
      "prompt": "Cosa prevede il comma 1 dell'art. 1543 c.c.?",
      "articleRef": { "number": "1543", "comma": 1 },
      "tags": ["vendita di eredità"]
    }
  ]
}
```

Le domande di tipo `ARTICLE` nel JSON prendono il testo di riferimento dal database degli articoli, quindi non lo ripetono.

## Ripetizione spaziata
Per l'MVP basta **SM-2**, alimentato dal punteggio interno da 0 a 1. Ogni domanda ha il suo stato di ripasso (ease factor, intervallo, ripetizioni, data di scadenza). Le risposte date in simulazione e in flashcard aggiornano anche questo stato.

## Stack tecnico (deciso)

- **TypeScript** ovunque.
- **Monorepo** con pnpm workspaces:
  - `apps/web`: React con **Vite** (SPA, niente Next), Tailwind, **shadcn/ui**, **Lucide**, **TanStack Query** per lo stato server, **Context** per utente e tema, React Router.
  - `apps/api`: **Express**, **Prisma**, **PostgreSQL**.
  - `packages/shared`: schemi Zod (import, output del grader), tipi, logica del voto e SM-2.
- **Autenticazione**: un solo utente, lei. Hash della password in una variabile d'ambiente, JWT in un cookie httpOnly, middleware che protegge le rotte.
- **Deploy** (più avanti): frontend su **Vercel** con un rewrite di `/api/*` verso **Railway**, dove girano API e Postgres, così i cookie risultano sullo stesso dominio, importante per Safari. In sviluppo, il proxy di Vite inoltra `/api` all'API locale.
- **Niente test automatici**: si procede snelli. Unica eccezione ragionevole: uno script manuale per verificare il parser degli articoli sul file reale.
- **Niente PWA e niente offline**. Al massimo, più avanti, un manifest per aggiungere il sito alla schermata Home dell'iPad.

## Modello dati (bozza)

- `Article`: numero, suffisso (bis, ter...), rubrica, libro, titolo, capo, abrogato, testo, commi (array ordinato).
- `Deck`: titolo, capitolo, tag.
- `Question`: deck, tipo (ARTICLE o THEORY), prompt, riferimento all'articolo e al comma opzionale, referenceAnswer opzionale, rubric come Json opzionale, articoli correlati, tag, attiva sì/no.
- `Attempt`: question, risposta, modalità (EXAM, FLASHCARD, REVIEW), risultato della valutazione come Json, punteggio interno, sessione opzionale, data.
- `ExamSession`: domande estratte, inizio, fine, durata del timer, voto in trentesimi, lode.
- `ReviewState`: question, easeFactor, interval, repetitions, dueDate.

## Perimetro dell'MVP (obiettivo: 1-2 settimane, così lei lo usa per circa 3 mesi prima dell'esame)

1. Login.
2. Parser e import del codice civile, con una pagina per consultare gli articoli.
3. Import del JSON delle domande di teoria.
4. Generazione delle domande a template dagli articoli.
5. Grader con Gemini, con fallback di autovalutazione.
6. **Simulazione d'esame**: 6 domande, timer, voto in trentesimi e revisione finale.
7. Flashcard con scelta di argomenti e numero di domande.
8. Ripasso quotidiano con SM-2 e una home con le domande in scadenza.

Dopo l'MVP: storico delle simulazioni con l'andamento dei voti, statistiche per argomento, ritocchi di design.

## Ancora da decidere

- **Durata del timer** della simulazione e formato reale dello scritto (numero di domande, tempo): da chiedere a lei.
- Regola della lode (è stato proposto un default).
- Statistiche e progressi, promemoria, gamification: non ancora chiesti a lei. Non implementare nulla di tutto questo per ora.
- Palette esatta.
- Esempi di domande d'esame reali, che lei manderà più avanti.

## Stato e prossimi passi

Se la base del monorepo non esiste ancora, creala **nella cartella corrente** (non in una sottocartella), seguendo lo stack descritto sopra. Prima di farlo, controlla sulle documentazioni ufficiali la procedura attuale per Tailwind e per `shadcn init` con Vite. Servono: script di root (`dev` per avviare web e api insieme, `build`, `db:migrate`, `db:studio`), `.env.example`, un README breve, git inizializzato, la rotta `/api/health`, il login funzionante e le pagine segnaposto (Home, Simulazione, Flashcard, Ripasso, Articoli, Import).

Se la base esiste già, **allinea schema Prisma, schemi Zod e pagine a questo documento**. In particolare: il punteggio letterale non fa più parte dell'MVP, il grader a concetti è il sistema principale e la simulazione d'esame è la feature centrale.

Ordine consigliato dopo la base:
1. Parser del codice civile, da provare sull'esportazione in testo del file reale, e import nel database.
2. Schemi Zod per l'import e per l'output del grader, poi pagina di import.
3. Grader con Gemini, poi la simulazione d'esame completa.
4. Flashcard e ripasso con SM-2.

Fermati alla fine di ogni passo, riassumi cosa hai fatto e chiedi conferma all'utente prima di procedere.