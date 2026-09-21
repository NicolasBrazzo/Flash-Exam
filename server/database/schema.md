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
FE_Users       (autenticazione)
```

La base parte con la sola tabella utenti. Le tabelle di dominio del progetto
vanno aggiunte una alla volta — vedi l'esempio in fondo e la ricetta in
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
