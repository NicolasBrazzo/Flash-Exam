# Changelog del database

Registro delle modifiche allo schema, in ordine cronologico e con numero
progressivo. Ogni voce indica: cosa è cambiato, perché, e l'SQL eseguito
su Supabase. Tenere allineati [`schema.sql`](./schema.sql) e
[`schema.md`](./schema.md) a ogni modifica.

---

## #001 — Schema iniziale

Tabella `T_Users` per l'autenticazione (uuid PK, email univoca, password
bcrypt, nome e cognome, `created_at`). Il sito ha una sola utente, creata
da `npm run seed`: non esiste registrazione pubblica e non esistono ruoli,
quindi nessuna colonna `isAdmin`.

```sql
create extension if not exists "pgcrypto";

create table if not exists "T_Users" (
    "id"         uuid        primary key default gen_random_uuid(),
    "email"      text        not null unique,
    "password"   text        not null,
    "first_name" text,
    "last_name"  text,
    "created_at" timestamptz not null default now()
);
```

> Da eseguire manualmente nel SQL Editor di Supabase.

---

## #002 — Rinominata `T_Users` in `FE_Users`

Il prefisso delle tabelle del progetto passa da `T_` (neutro, ereditato dal
template) a `FE_`. Aggiornate le costanti `TABLE_NAME` in
`server/models/user.model.js` e `USERS_TABLE` in `server/database/seed.js`.

```sql
alter table "T_Users" rename to "FE_Users";
```

> Da eseguire manualmente nel SQL Editor di Supabase.
> Se la tabella non è ancora stata creata, salta questo comando: basta
> eseguire `schema.sql`, che ora crea direttamente `FE_Users`.

---

## #003 — Tabelle di dominio dell'MVP

Prime tabelle di dominio: argomenti, domande, simulazioni e tentativi. Il sito
non contiene gli articoli del codice civile (le domande sono sui concetti, non
sui singoli articoli): i riferimenti normativi sono un array di testo sulla
domanda. Il ripasso quotidiano (`FE_ReviewStates`, modalità `REVIEW`) è
rimandato a dopo l'MVP.

- `FE_Topics`: i macro argomenti, nome univoco e posizione.
- `FE_Questions`: domanda con argomento obbligatorio, risposta di riferimento,
  rubrica (2-4 concetti) e riferimenti normativi (`article_refs`). La colonna
  non si chiama `references` perché è una parola riservata di Postgres; nel
  JSON di import e nelle API il campo resta `references`. Indice univoco su
  argomento più prompt normalizzato, chiave di idempotenza dell'import.
- `FE_ExamSessions`: la prova, con scadenza decisa dal server, stato e voto.
- `FE_Attempts`: ogni risposta data. In simulazione le 6 righe si creano
  all'avvio con la risposta vuota (bozze salvate durante la prova).
- Cancellazione: una domanda con tentativi **non si può cancellare**
  (`on delete restrict`), così lo storico delle simulazioni resta intatto; lo
  stesso vale per un argomento con domande. Cancellare una sessione cancella i
  suoi tentativi.
- `updated_at` su `FE_Questions` e `FE_Attempts` senza trigger: lo
  valorizzano i model a ogni update.

```sql
-- -----------------------------------------------------------------------------
-- Tabella: FE_Topics
-- -----------------------------------------------------------------------------
create table if not exists "FE_Topics" (
    "id"         uuid        primary key default gen_random_uuid(),
    "name"       text        not null unique check (btrim("name") <> ''),
    "position"   integer     not null default 0,   -- ordine di studio
    "created_at" timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Tabella: FE_Questions
-- -----------------------------------------------------------------------------
create table if not exists "FE_Questions" (
    "id"           uuid        primary key default gen_random_uuid(),
    "topic_id"     uuid        not null references "FE_Topics" ("id") on delete restrict,
    "prompt"       text        not null check (btrim("prompt") <> ''),
    "answer"       text        not null check (btrim("answer") <> ''),
    "rubric"       jsonb       not null check (
                                   jsonb_typeof("rubric") = 'array'
                                   and jsonb_array_length("rubric") between 2 and 4
                               ),
    "article_refs" text[]      not null default '{}',   -- es. {"1","2","42-bis"}
    "created_at"   timestamptz not null default now(),
    "updated_at"   timestamptz not null default now()
);

-- Chiave di idempotenza dell'import: stesso argomento + stesso prompt normalizzato
create unique index if not exists "FE_Questions_topic_prompt_uidx"
    on "FE_Questions" ("topic_id", lower(regexp_replace(btrim("prompt"), '\s+', ' ', 'g')));

-- -----------------------------------------------------------------------------
-- Tabella: FE_ExamSessions
-- -----------------------------------------------------------------------------
create table if not exists "FE_ExamSessions" (
    "id"             uuid        primary key default gen_random_uuid(),
    "started_at"     timestamptz not null default now(),
    "expires_at"     timestamptz not null,           -- started_at + 40 minuti, deciso dal server
    "submitted_at"   timestamptz,
    "auto_submitted" boolean     not null default false,
    "status"         text        not null default 'IN_PROGRESS'
                                 check ("status" in ('IN_PROGRESS', 'GRADING', 'GRADED', 'SELF_GRADED')),
    "grade"          smallint    check ("grade" between 0 and 30),
    "honors"         boolean     not null default false,
    "created_at"     timestamptz not null default now(),

    check ("expires_at" > "started_at"),
    check ("status" = 'IN_PROGRESS' or "submitted_at" is not null),
    check ("status" <> 'GRADED' or "grade" is not null),
    check (not "honors" or coalesce("grade" = 30, false))
);

-- -----------------------------------------------------------------------------
-- Tabella: FE_Attempts
-- -----------------------------------------------------------------------------
create table if not exists "FE_Attempts" (
    "id"             uuid         primary key default gen_random_uuid(),
    "question_id"    uuid         not null references "FE_Questions" ("id") on delete restrict,
    "session_id"     uuid         references "FE_ExamSessions" ("id") on delete cascade,
    "mode"           text         not null check ("mode" in ('EXAM', 'FLASHCARD')),
    "position"       smallint     check ("position" between 1 and 6),
    "answer"         text         not null default '',
    "verdict"        text         check ("verdict" in ('correct', 'partial', 'wrong')),
    "grading"        jsonb,                            -- output del grader validato con Zod
    "grading_source" text         check ("grading_source" in ('AI', 'SELF')),
    "points"         numeric(3,2) check ("points" between 0 and 5),
    "score"          numeric(4,3) check ("score" between 0 and 1),
    "graded_at"      timestamptz,
    "created_at"     timestamptz  not null default now(),
    "updated_at"     timestamptz  not null default now(),

    -- In simulazione: sessione e posizione obbligatorie; fuori: entrambe assenti
    check (
        ("mode" = 'EXAM' and "session_id" is not null and "position" is not null)
        or ("mode" <> 'EXAM' and "session_id" is null and "position" is null)
    ),
    -- Valutazione: tutti i campi presenti oppure tutti assenti
    check (
        ("verdict" is null and "grading_source" is null and "points" is null
            and "score" is null and "graded_at" is null)
        or ("verdict" is not null and "grading_source" is not null and "points" is not null
            and "score" is not null and "graded_at" is not null)
    ),
    -- Una valutazione AI porta sempre l'output del grader
    check ("grading_source" is distinct from 'AI' or "grading" is not null),

    unique ("session_id", "position"),
    unique ("session_id", "question_id")
);
```

> Da eseguire manualmente nel SQL Editor di Supabase.
