-- =============================================================================
-- Schema del database (Supabase / PostgreSQL)
-- =============================================================================
-- Fonte di verità tecnica/ricreabile. La documentazione leggibile è in
-- schema.md (mantenere allineati i due file dopo ogni modifica).
--
-- NOTA: questo file è ricostruito dal codice applicativo (models, controllers,
-- validators), NON esportato da Supabase. Verificare default, nullability e
-- vincoli reali sulla dashboard ed eventualmente correggere qui.
--
-- CONVENZIONE PREFISSO: le tabelle del progetto usano il prefisso `FE_`.
-- Per cambiarlo: rinominare le tabelle su Supabase e aggiornare la costante
-- TABLE_NAME in ogni file dentro server/models/.
--
-- CONVENZIONE COLONNE: ogni nuova tabella include `id uuid` (PK, default
-- gen_random_uuid()) e `created_at` (e, se serve tracciare le modifiche,
-- `updated_at`).
-- =============================================================================

-- Estensione per gen_random_uuid() (di norma già attiva su Supabase)
create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Tabella: FE_Users
-- -----------------------------------------------------------------------------
create table if not exists "FE_Users" (
    "id"         uuid        primary key default gen_random_uuid(),
    "email"      text        not null unique,
    "password"   text        not null,           -- hash bcrypt, mai in chiaro
    "first_name" text,
    "last_name"  text,
    "created_at" timestamptz not null default now()
);

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
