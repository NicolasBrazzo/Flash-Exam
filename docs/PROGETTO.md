# Progetto: sito di studio per l'esame di Diritto Privato 1

> Questo documento descrive il **contesto e le decisioni** del progetto. Non è una lista di cose da implementare subito: si implementa solo ciò che l'utente chiede passo per passo. Per convenzioni di codice, database ed endpoint vale il `CLAUDE.md` alla root del repository, che ha la precedenza.

## Contesto

Sito personale per la ragazza dell'utente, studentessa di giurisprudenza. Deve preparare l'esame di **Diritto Privato 1**, che è sia scritto sia orale, con appello il **14 gennaio 2027**. Il sito le propone domande brevi basate sui suoi appunti e sul codice civile. Lei risponde **scrivendo**, e un'AI valuta la risposta sul **contenuto e sui concetti**, non sulle parole esatte.

La modalità principale è la **simulazione d'esame**: 6 domande in 40 minuti e voto finale in trentesimi, come a un esame universitario.

Il progetto è molto importante per l'utente: cura, qualità e semplicità d'uso contano.

### Materiale di studio
- Manuale: *Torrente, Manuale di diritto privato*, 25a edizione.
- Codice civile 2026, con le parti rilevanti per Privato 1: Libro I (persone e famiglia, primi titoli), Libro IV (obbligazioni, contratti, fatti illeciti), Libro VI (tutela dei diritti).
- Circa **50 argomenti** di teoria.
- Studia 2-3 ore al giorno, in sessioni da circa un'ora.
- Usa il sito da **Mac e iPad** (Safari). Il supporto offline non serve. Su iPad l'hover non esiste: ogni interazione deve funzionare anche al tocco.

Il codice civile è **materiale da cui si generano le domande**, non un contenuto del sito: il sito non importa né mostra gli articoli (vedi "Da dove arrivano le domande").

## Sull'utente

- Sviluppatore full stack (React, Node/Express), con preferenza per frontend e web design. Il repository nasce dal suo template gestionale.
- **Odia le emoji.** Non usarle mai: né nella UI, né nel codice, né nei commenti, né nei commit, né nelle risposte. Per qualsiasi elemento visivo usa le icone di Lucide.
- Comunica con l'utente in italiano. Testi della UI, commenti e messaggi di errore in italiano, come da convenzione del template.

## Stack tecnico

La base è il template dell'utente: vedi `CLAUDE.md` per architettura e convenzioni.

- **JavaScript** (non TypeScript): client in JSX con moduli ES, server in CommonJS.
- **Client**: React 19, Vite, React Router, Tailwind v4, shadcn/ui, Lucide. Le chiamate al server passano dal client Axios e dagli hook `useFetch` e `useMutation`.
- **Server**: Express con architettura a strati (controller come router, model come accesso puro a Supabase), risposte nella forma `{ ok, ... }`.
- **Database**: **Supabase** (Postgres), con tabelle con prefisso **`FE_`** (compresa `FE_Users`), PK uuid e `created_at`, secondo le convenzioni di `server/database/schema.md`.
- **Autenticazione**: JWT stateless nell'header `Authorization`, un solo utente creato con il seed. Nessuna registrazione e nessun ruolo.
- **Validazione**: **Zod** lato server, per il JSON di import delle domande e per l'output del grader AI. In JavaScript è l'unica garanzia sulla forma dei dati che arrivano da fuori.
- **AI per la valutazione**: **Gemini, piano gratuito** di Google AI Studio, modello Flash (verifica sulla documentazione ufficiale il nome corrente). Limiti indicativi di 10-15 richieste al minuto, quindi retry con backoff esponenziale sui 429. La chiave API resta solo sul server.
- **Deploy**: server su Railway, client su Vercel, come da `DEPLOY.md`.
- **Niente test automatici**, niente PWA, niente offline.

## Decisioni prese con lei

### Domande
- **Brevi, specifiche e secche**, con una risposta attesa di circa **2 righe**.
- **Nessuna domanda su un articolo specifico** ("Cosa dispone l'art. 1541 c.c.?", "Cosa prevede il comma 2 dell'art. 1543?"): non le servono. Le domande sono sui **concetti**, anche quando la risposta si trova negli articoli. Esempio: "Come si acquisisce la capacità giuridica?" (la risposta è nell'art. 1 c.c., ma la domanda non chiede l'articolo).
- **Sì** alle domande di confronto (esempio: "Differenze tra nullità e annullabilità").
- **No** alle domande inverse ("quale articolo disciplina...?").
- Ogni domanda appartiene a un **argomento**: i macro argomenti che lei studia (circa 50). Sono la base per scegliere cosa ripassare nelle flashcard.
- Le domande vengono generate, non le scrive lei. Più avanti manderà esempi di domande d'esame reali, che sono molto specifiche, da usare come riferimento di stile.

### Valutazione
- Conta il **concetto e il contenuto, non le parole esatte**. Nessun punteggio letterale parola per parola.
- In diritto però la **terminologia tecnica** conta ("nullo" non è "annullabile", "può" non è "deve"). La valutazione deve segnalarla.
- L'**ordine** conta quando la risposta attesa è una sequenza (per esempio i requisiti o le fasi elencati da una norma).
- Dopo ogni risposta lei vuole sapere:
  1. **se è giusta**: esito tra corretta, parzialmente corretta ed errata;
  2. **quali parole o espressioni modificare**: per ognuna, il testo che ha scritto, la versione corretta e il motivo in una riga;
  3. **un suggerimento con un esempio** di risposta migliore.
- **Niente percentuali** mostrate a lei. Nessun pulsante per contestare il voto. Nessun "aiutino".

### Modalità di studio
1. **Simulazione d'esame (feature principale)**: 6 domande estratte a caso, con **timer di 40 minuti** per l'intera prova. Allo scadere la prova si consegna automaticamente con le risposte scritte fino a quel momento; lei può anche consegnare prima. Durante la prova non c'è nessun feedback. Alla fine arrivano il **voto complessivo in trentesimi** e poi la revisione domanda per domanda, con esito, correzioni e suggerimento. Nessun voto per singola domanda.
2. **Flashcard**: lei sceglie gli **argomenti** e il **numero di domande**. Feedback immediato dopo ogni risposta, nessun voto, nessun timer.
3. **Ripasso quotidiano** (rimandato a dopo l'MVP): ripetizione spaziata sulle domande che sta dimenticando. Nessun timer.

### Calcolo del voto
- Ogni domanda vale internamente da 0 a 5 punti, quindi 6 domande danno un massimo di 30.
- I punti derivano dalla valutazione a concetti (vedi sotto) e li calcola il codice, non l'LLM.
- Lode: default proposto, cioè 30 con tutte e 6 le risposte corrette e nessuna correzione terminologica. Da confermare con l'utente.
- Il punteggio interno di ogni risposta, da 0 a 1, viene salvato (dopo l'MVP alimenterà la ripetizione spaziata), ma non viene mai mostrato a lei.

### Aspetto
- **Semplice e pulito.** Tipografia curata, molto spazio bianco, pochi colori.
- Tema chiaro e scuro: già presente nel template.
- Design pensato per Mac e iPad: target touch comodi e textarea ampia, usabile anche con la tastiera dell'iPad.

## Come funziona la valutazione

L'LLM riceve la domanda, il materiale di riferimento e la risposta di lei, e restituisce **solo JSON**, validato con Zod sul server. Esempio di struttura:

```json
{
  "concepts": [{ "id": "c1", "status": "present" }, { "id": "c2", "status": "partial" }],
  "verdict": "partial",
  "corrections": [{ "written": "è nullo", "suggested": "è annullabile", "reason": "L'incapacità naturale determina annullabilità, non nullità" }],
  "suggestion": "Ricorda di citare il termine di prescrizione.",
  "exampleAnswer": "..."
}
```

- Il materiale di riferimento di ogni domanda è la **risposta di riferimento** più la **rubrica**: una griglia di **2-4 concetti chiave con pesi**, generata insieme alla domanda. La rubrica tiene stabile il voto: senza, l'LLM ricaverebbe i concetti a ogni valutazione e la stessa risposta potrebbe prendere voti diversi.
- I **riferimenti normativi** della domanda (per esempio artt. 1 e 2 c.c.) si mostrano nella revisione come rimando per lo studio; al grader arrivano solo come contesto, non come testo di legge.
- I punti (0-5) e il punteggio interno (0-1) li calcola il codice a partire dagli stati dei concetti e dai pesi, con una penalità per le correzioni terminologiche.
- **Simulazione**: le 6 risposte si valutano alla fine in **una sola chiamata** (batch), così l'attesa è una sola e si rispettano i limiti di richieste.
- **Fallback**: se l'API non risponde, il sito mostra la risposta di riferimento e lei si autovaluta (giusta, parziale, sbagliata). Lo studio non deve mai bloccarsi.
- Il provider è isolato in un unico modulo del server (per esempio `services/grader.js`), così si può cambiare toccando un solo file.

## Da dove arrivano le domande

Il sito **non genera domande e non contiene parser**: riceve solo file JSON. Le domande vengono generate **fuori dal sito**, da Claude in chat, **argomento per argomento**, a partire dagli appunti di teoria e dal codice civile, e importate tramite una pagina di import con validazione Zod.

Gli appunti di teoria sono discorsivi, organizzati per capitoli e argomenti, con titoli in maiuscolo (per esempio `IL CONTRATTO DI SPEDIZIONE [1737-1741]`) e citazioni di articoli nel testo.

**Attenzione**: i PDF esportati da Pages perdono le legature tipografiche in estrazione. Per esempio "diritto" diventa "diri o" e "fisiche" diventa "siche". Per questo il materiale va passato a Claude come **esportazione in testo o .docx** dei file originali di Pages, non come PDF.

Formato del JSON di import (un file per argomento):

```json
{
  "topic": { "name": "Capacità giuridica e capacità d'agire" },
  "questions": [
    {
      "prompt": "Come si acquisisce la capacità giuridica?",
      "answer": "Si acquisisce al momento della nascita. I diritti che la legge riconosce a favore del concepito sono subordinati all'evento della nascita.",
      "rubric": [
        { "id": "c1", "concept": "Acquisto con la nascita", "weight": 2 },
        { "id": "c2", "concept": "Diritti del concepito subordinati alla nascita", "weight": 1 }
      ],
      "references": ["1"]
    }
  ]
}
```

- `topic.name` identifica l'argomento: se esiste già si riusa, altrimenti si crea.
- `references` elenca i numeri degli articoli del codice civile collegati (con l'eventuale suffisso, per esempio `"42-bis"`); può essere vuoto.

## Ripetizione spaziata
> **Rimandata a dopo l'MVP**: non implementare finché l'utente non lo chiede. Quanto segue resta come riferimento.

Basta **SM-2**, alimentato dal punteggio interno da 0 a 1. Ogni domanda ha il suo stato di ripasso (ease factor, intervallo, ripetizioni, data di scadenza). Le risposte date in simulazione e in flashcard aggiornano anche questo stato. La logica sta in un modulo del server (per esempio `utils/sm2.js`).

## Modello dati

I dettagli (colonne, vincoli, indici) stanno in `server/database/schema.md` e `schema.sql`, che hanno la precedenza su questo riepilogo. Colonne JSON come `jsonb`. Nessuna colonna `user_id`: l'utente è una sola.

- `FE_Topics`: i macro argomenti. Nome univoco e posizione (ordine di studio).
- `FE_Questions`: argomento (FK obbligatoria), prompt, risposta di riferimento, rubrica (jsonb, 2-4 concetti con peso), riferimenti normativi (array di numeri di articolo).
- `FE_ExamSessions`: inizio, scadenza (decisa dal server), consegna, consegna automatica sì/no, stato, voto in trentesimi, lode.
- `FE_Attempts`: ogni risposta data. Domanda, sessione opzionale, modalità (EXAM, FLASHCARD), posizione nella prova, risposta, esito, risultato della valutazione (jsonb), fonte della valutazione (AI o autovalutazione), punti e punteggio interno. All'avvio di una simulazione si creano subito le 6 righe con la risposta vuota: così le domande estratte hanno un ordine garantito e le risposte si salvano in bozza durante la prova.
- Dopo l'MVP: `FE_ReviewStates` (domanda, ease_factor, interval, repetitions, due_date) e la modalità REVIEW.

## Perimetro dell'MVP (obiettivo: 1-2 settimane)

1. Base pulita dal template: login per un solo utente e Home vuota.
2. Argomenti e domande: import del JSON e una pagina per consultarle (DataTable e FilterBar).
3. Grader con Gemini, con fallback di autovalutazione.
4. **Simulazione d'esame**: 6 domande, timer di 40 minuti, voto in trentesimi e revisione finale.
5. Flashcard con scelta di argomenti e numero di domande.

Dopo l'MVP: ripasso quotidiano con SM-2 e una Home con le domande in scadenza, storico delle simulazioni con l'andamento dei voti, statistiche per argomento, ritocchi di design.

## Ancora da decidere

- Regola della lode (è stato proposto un default).
- Statistiche e progressi, promemoria, gamification: non ancora chiesti a lei. Non implementare nulla di tutto questo per ora.
- Consultazione del codice civile dentro il sito: non richiesta. Se servirà, sarà una tabella a parte, senza toccare le domande.
- Palette esatta e nome definitivo del sito (per ora "Studio").
- Esempi di domande d'esame reali, che lei manderà più avanti.
