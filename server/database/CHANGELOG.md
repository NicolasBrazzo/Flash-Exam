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
