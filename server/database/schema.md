# Struttura del Database

Backend dati: **Supabase (PostgreSQL)**. Lo schema reale vive su Supabase; questo
file è la documentazione leggibile (per umani e AI). Il file affiancato
[`schema.sql`](./schema.sql) è la fonte di verità tecnica/ricreabile.

> Documentazione mantenuta a mano. Dopo ogni modifica allo schema su Supabase,
> aggiornare **sia** questo file **sia** `schema.sql`, e registrare la modifica
> in [`CHANGELOG.md`](./CHANGELOG.md) con il numero progressivo (`#001`, `#002`, …).

## Convenzioni

- **Prefisso tabelle**: le tabelle del progetto usano il prefisso `FE_`.
  Per cambiarlo: rinominare le tabelle su Supabase e aggiornare la costante
  `TABLE_NAME` in ogni file dentro `server/models/`.
- **Colonne standard**: ogni nuova tabella include `id uuid` (PK, default
  `gen_random_uuid()`) e `created_at timestamptz` (default `now()`);
  aggiungere `updated_at` se serve tracciare le modifiche.

---

## Diagramma relazioni

```
FE_Users         (autenticazione, nessuna relazione: utente unico)

FE_Topics 1───N FE_Questions 1───N FE_Attempts N───1 FE_ExamSessions
                                    (session_id null fuori dalla simulazione)
```

- Nessuna colonna `user_id`: il sito ha una sola utente.
- Cancellazioni: `FE_Topics` → `FE_Questions` e `FE_Questions` → `FE_Attempts`
  sono `on delete restrict` (non si cancella ciò che è già stato usato);
  `FE_ExamSessions` → `FE_Attempts` è `on delete cascade`.
- `updated_at`, dove presente, non ha trigger: il model lo valorizza
  (`new Date().toISOString()`) in ogni funzione di update.

Nuove tabelle: vedi l'esempio in fondo e la ricetta in
[`../../ADDING_A_RESOURCE.md`](../../ADDING_A_RESOURCE.md).

---

## Tabella: `FE_Users`

Utenti che accedono al sito. Il sito è a utente unico: la riga viene creata da
`npm run seed` a partire dalle variabili d'ambiente `SEED_*` (vedi
`server/.env.example`). Non esiste registrazione pubblica e non esistono ruoli,
quindi nessuna colonna `isAdmin`. La `password` non viene mai restituita al
client.

| Colonna      | Tipo        | Null | Default             | Note                                         |
| ------------ | ----------- | ---- | ------------------- | -------------------------------------------- |
| `id`         | uuid        | NO   | `gen_random_uuid()` | Primary key                                  |
| `email`      | text        | NO   | —                   | Univoca. Usata per login e lookup            |
| `password`   | text        | NO   | —                   | Hash bcrypt — **mai** in chiaro, mai esposta |
| `first_name` | text        | SÌ   | —                   | Nome                                         |
| `last_name`  | text        | SÌ   | —                   | Cognome                                      |
| `created_at` | timestamptz | NO   | `now()`             | Data creazione account                       |

**Vincoli**
- `email` UNIQUE.

**Validazione applicativa**
- `email` / `password`: il login richiede entrambi i campi non vuoti.
  I validatori riusabili sono in `server/utils/` (`validateEmail`,
  `validatePassword`: min 6 caratteri, almeno 1 maiuscola, 1 numero,
  1 carattere speciale) e vanno applicati dai controller che creano o
  modificano credenziali.

---

## Tabella: `FE_Topics`

I macro argomenti studiati da lei (circa 50). Ogni domanda appartiene a un
argomento; le flashcard si scelgono per argomento.

| Colonna      | Tipo        | Null | Default             | Note                              |
| ------------ | ----------- | ---- | ------------------- | --------------------------------- |
| `id`         | uuid        | NO   | `gen_random_uuid()` | Primary key                       |
| `name`       | text        | NO   | —                   | Univoco, non vuoto                |
| `position`   | integer     | NO   | `0`                 | Ordine di studio, per gli elenchi |
| `created_at` | timestamptz | NO   | `now()`             |                                   |

**Vincoli**
- `name` UNIQUE, CHECK non vuoto dopo `btrim`.

**Validazione applicativa**
- L'import delle domande crea l'argomento se `name` non esiste, altrimenti lo
  riusa. Un argomento con domande non si può cancellare (FK `restrict`).

---

## Tabella: `FE_Questions`

Le domande di teoria, generate fuori dal sito e importate da JSON. Nessuna
domanda su un articolo specifico: le domande sono sui concetti.

| Colonna        | Tipo        | Null | Default             | Note                                            |
| -------------- | ----------- | ---- | ------------------- | ----------------------------------------------- |
| `id`           | uuid        | NO   | `gen_random_uuid()` | Primary key                                     |
| `topic_id`     | uuid        | NO   | —                   | FK → `FE_Topics.id`, `on delete restrict`       |
| `prompt`       | text        | NO   | —                   | Testo della domanda, non vuoto                  |
| `answer`       | text        | NO   | —                   | Risposta di riferimento, non vuota              |
| `rubric`       | jsonb       | NO   | —                   | Array di 2-4 `{ id, concept, weight }`          |
| `article_refs` | text[]      | NO   | `'{}'`              | Riferimenti normativi, es. `{"1","2","42-bis"}` |
| `created_at`   | timestamptz | NO   | `now()`             |                                                 |
| `updated_at`   | timestamptz | NO   | `now()`             | Valorizzato dal model a ogni update             |

**Vincoli**
- CHECK `rubric`: array con 2-4 elementi (la forma dei singoli elementi la
  valida Zod all'import).
- Indice univoco su (`topic_id`, `prompt` normalizzato: `btrim`, spazi
  multipli ridotti a uno, minuscolo): chiave di idempotenza dell'import.

**Validazione applicativa**
- `rubric`: `id` univoci nella domanda, `concept` non vuoto, `weight` intero
  positivo (schema Zod dell'import).
- La colonna si chiama `article_refs` perché `references` è una parola
  riservata di Postgres; nel JSON di import e nelle API il campo è `references`.
- Una domanda con tentativi non si può cancellare (FK `restrict` da
  `FE_Attempts`): il controller risponde con un errore parlante. Si può però
  correggere.

---

## Tabella: `FE_ExamSessions`

Una simulazione d'esame: 6 domande in 40 minuti, voto in trentesimi. Le
domande estratte sono le righe di `FE_Attempts` con `session_id` e
`position`, non una colonna di questa tabella.

| Colonna          | Tipo        | Null | Default             | Note                                        |
| ---------------- | ----------- | ---- | ------------------- | ------------------------------------------- |
| `id`             | uuid        | NO   | `gen_random_uuid()` | Primary key                                 |
| `started_at`     | timestamptz | NO   | `now()`             | Deciso dal server                           |
| `expires_at`     | timestamptz | NO   | —                   | `started_at` + 40 minuti, deciso dal server |
| `submitted_at`   | timestamptz | SÌ   | —                   | Momento della consegna                      |
| `auto_submitted` | boolean     | NO   | `false`             | Consegna avvenuta allo scadere              |
| `status`         | text        | NO   | `'IN_PROGRESS'`     | Vedi valori sotto                           |
| `grade`          | smallint    | SÌ   | —                   | Voto 0-30, null finché non valutata         |
| `honors`         | boolean     | NO   | `false`             | Lode                                        |
| `created_at`     | timestamptz | NO   | `now()`             |                                             |

**Valori di `status`**
- `IN_PROGRESS`: prova in corso, le risposte si salvano in bozza.
- `GRADING`: consegnata, valutazione AI in corso.
- `GRADED`: valutata dall'AI, voto disponibile.
- `SELF_GRADED`: l'AI non ha risposto, revisione in autovalutazione.

**Vincoli**
- CHECK `expires_at > started_at`.
- CHECK: fuori da `IN_PROGRESS`, `submitted_at` è valorizzato.
- CHECK: `GRADED` richiede `grade`.
- CHECK: `honors` solo con `grade = 30`.

---

## Tabella: `FE_Attempts`

Ogni risposta data, in simulazione o in flashcard, con la sua valutazione.
All'avvio di una simulazione si creano subito 6 righe (`position` 1-6,
`answer` vuota) che vengono aggiornate mentre lei scrive.

| Colonna          | Tipo         | Null | Default             | Note                                           |
| ---------------- | ------------ | ---- | ------------------- | ---------------------------------------------- |
| `id`             | uuid         | NO   | `gen_random_uuid()` | Primary key                                    |
| `question_id`    | uuid         | NO   | —                   | FK → `FE_Questions.id`, `on delete restrict`   |
| `session_id`     | uuid         | SÌ   | —                   | FK → `FE_ExamSessions.id`, `on delete cascade` |
| `mode`           | text         | NO   | —                   | `EXAM` / `FLASHCARD`                           |
| `position`       | smallint     | SÌ   | —                   | 1-6, solo in simulazione                       |
| `answer`         | text         | NO   | `''`                | Risposta scritta (vuota = non risposta)        |
| `verdict`        | text         | SÌ   | —                   | `correct` / `partial` / `wrong`                |
| `grading`        | jsonb        | SÌ   | —                   | Output del grader, già validato con Zod        |
| `grading_source` | text         | SÌ   | —                   | `AI` / `SELF` (autovalutazione di fallback)    |
| `points`         | numeric(3,2) | SÌ   | —                   | Punti 0-5, calcolati dal codice                |
| `score`          | numeric(4,3) | SÌ   | —                   | Punteggio interno 0-1, **mai mostrato a lei**  |
| `graded_at`      | timestamptz  | SÌ   | —                   | Momento della valutazione                      |
| `created_at`     | timestamptz  | NO   | `now()`             |                                                |
| `updated_at`     | timestamptz  | NO   | `now()`             | Valorizzato dal model (salvataggi in bozza)    |

**Vincoli**
- CHECK: `mode = 'EXAM'` richiede `session_id` e `position`; le altre
  modalità li vogliono entrambi null.
- CHECK: `verdict`, `grading_source`, `points`, `score` e `graded_at` sono
  tutti valorizzati (tentativo valutato) oppure tutti null (non ancora
  valutato).
- CHECK: `grading_source = 'AI'` richiede `grading`.
- UNIQUE (`session_id`, `position`) e UNIQUE (`session_id`, `question_id`):
  in una prova ogni posizione e ogni domanda compaiono una volta sola.

**Validazione applicativa**
- In autovalutazione `score` vale 1 / 0.5 / 0 (corretta / parziale / errata).
- Oltre `expires_at` della sessione le risposte non si aggiornano più.
- Dopo l'MVP: `REVIEW` si aggiunge al CHECK di `mode`, con il ripasso.

---

## Esempio: aggiungere una tabella di dominio

Traccia da seguire quando il progetto ha bisogno di una nuova risorsa:

```sql
create table if not exists "FE_Questions" (
    "id"         uuid        primary key default gen_random_uuid(),
    "prompt"     text        not null,
    "note"       text,
    "created_at" timestamptz not null default now()
);
```

Checklist:
1. Creare la tabella su Supabase.
2. Aggiungerla a `schema.sql` e documentarla qui (colonne, vincoli, validazioni).
3. Registrare la modifica in `CHANGELOG.md` con il numero progressivo.
4. Se ha stati/enum, preferire un vincolo `CHECK` e documentare i valori validi.
5. Indici sui campi usati per filtri e lookup frequenti.
