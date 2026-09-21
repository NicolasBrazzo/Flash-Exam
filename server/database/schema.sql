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
