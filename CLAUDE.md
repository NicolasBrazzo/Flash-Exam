# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Study site for a single user (see [`docs/PROGETTO.md`](docs/PROGETTO.md) for the project context). Born from a full-stack management-app template and stripped back to the minimal working base: auth for the single user plus the reusable hooks/components. No public registration, no roles, no user management. Domain resources (topics, questions, exam sessions, …) are added following the recipe in [`ADDING_A_RESOURCE.md`](ADDING_A_RESOURCE.md).

Monorepo with two independently-installed packages: `client/` (React SPA) and `server/` (Express REST API backed by Supabase/PostgreSQL). The root `package.json` holds only dev scripts (plus `concurrently`): the two packages are still installed and deployed separately, each with its own `package.json` and dependencies. User-facing strings and code comments are in Italian.

Deployment (Railway for the server, Vercel for the client) is documented step-by-step in [`DEPLOY.md`](DEPLOY.md).

## Sviluppo agentico (loop su TODO.md)

Questa sezione ha la precedenza sulle altre in caso di conflitto sul *flusso di lavoro*; le regole tecniche (database, endpoint, componenti, tabelle, fetching) restano tutte valide. `TODO.md` e' l'autorizzazione a lavorare: i task di `docs/ROADMAP.md` si implementano solo se presenti in `TODO.md`.

**Workflow del loop** - ripeti finche' non restano task `aperto`:
1. Crea il branch del task `agent/<ID>` (es. `agent/DOM-1`) a partire da `agents-program` aggiornato. Se una dipendenza non e' ancora stata unita in `agents-program`, parti dal branch del task da cui dipende (PR impilate: la PR avra' per base quel branch). **Mai lavorare o committare su `main` ne' su `agents-program`.**
2. Leggi il **primo task `aperto` di `TODO.md` le cui dipendenze ("Dipende da") sono tutte `fatto`** e mettilo `in corso`. Leggi anche le sezioni "Definition of done" e "Decisioni assunte" di `TODO.md`: valgono per ogni task.
3. **Pianifica** con il subagent `planner`: file da toccare, approccio, test di accettazione da scrivere *prima* del codice.
4. Scrivi i test/controlli di accettazione del piano, poi implementa.
5. Fai passare tutti i gate: `bash scripts/gates.sh all`.
6. Fai rivedere il diff al subagent `reviewer`; correggi se il verdetto e' "DA CORREGGERE" e rilancia i gate.
7. **Un task = un branch = un commit = una PR verso `agents-program`** (conventional commits, descrizione in italiano, es. `feat(questions): ...`). Segna il task `fatto` in `TODO.md` nello stesso commit, con riassunto e scelte fatte in Note. Pusha il branch; apri la PR solo se il prompt di avvio lo chiede, con i criteri `[manuale]` elencati nella descrizione.
8. Torna a `agents-program` aggiornato (o al branch precedente, se impilato) e passa al task successivo.

**Regole**
- Massimo **3 tentativi** per far passare i gate (o la review) su un task. Al terzo fallimento: ripristina l'albero di lavoro, marca il task `bloccato` in `TODO.md` con una nota sul motivo e passa oltre.
- Se un task richiede una decisione non presa, un componente nuovo, una dipendenza nuova o una modifica a config esistente **non elencata nelle "Autorizzazioni" di `TODO.md`**, e non puoi chiedere: marcalo `bloccato` con la domanda in Note. In sessione interattiva, chiedi.
- I criteri di accettazione marcati **[manuale]** (richiedono Supabase, Gemini o un browser) non si spuntano e non impediscono il `fatto`: vanno nella descrizione della PR. Nel cloud non ci sono credenziali Supabase ne' Gemini: non tentare chiamate reali.
- I **test di accettazione definiti in fase di pianificazione sono intoccabili**: vietato modificarli, saltarli (`skip`, `only`, `xit`, `todo`) o indebolirli (asserzioni allentate, casi rimossi) per far passare i gate. Se il test e' sbagliato, il task e' `bloccato`, non "aggiustato".
- Vietato disattivare regole ESLint, aggiungere `eslint-disable` o indebolire i gate per ottenere il verde.
- **Deploy vietato in modo assoluto**: niente `vercel`, `netlify`, `railway`, `npm publish`, script di deploy, push su `main`, `push --force`, merge di PR, ne' qualunque comando che pubblichi qualcosa. Il deploy lo fa l'utente a mano. `DEPLOY.md` e `client/vercel.json` non si toccano.
- Non installare dipendenze ne' cambiare config esistenti senza chiederlo (vale anche per aggiungere un test runner).

**Gate** (`scripts/gates.sh`, stessi comandi usati da hook e CI `.github/workflows/agent-gates.yml`):

| Gate | Comando | Cosa fa |
| --- | --- | --- |
| lint | `bash scripts/gates.sh lint` | `npm --prefix client run lint` |
| typecheck | `bash scripts/gates.sh typecheck` | progetto in JS: `node --check` su `server/**/*.js` |
| build | `bash scripts/gates.sh build` | `npm --prefix client run build` |
| test | `bash scripts/gates.sh test` | script `test` di client/server **se presente**: oggi solo il server (`node --test` su `server/test/*.test.js`) |
| e2e | `bash scripts/gates.sh e2e` | script `test:e2e` del client **se presente** |
| tutti | `bash scripts/gates.sh all` | tutti i precedenti in sequenza |

Stato attuale: il **server** ha un test runner (`node:test` integrato in Node 22, zero dipendenze): `npm --prefix server test` esegue i file `server/test/*.test.js`, che coprono funzioni pure e schemi Zod. Ogni `.js` dentro `server/test/` viene eseguito come test, quindi gli helper condivisi vanno dentro i file di test o fuori da quella cartella. Il **client** non ha test automatici: i suoi criteri di accettazione si verificano con lint, build e la checklist manuale del piano.

Hook (`.claude/settings.json`): dopo ogni Edit/Write parte `gates.sh quick` (lint + typecheck); a fine turno parte `gates.sh test`; un hook blocca i `git commit` su `main`/`master`. Setup dell'environment web: `scripts/cloud-setup.sh`.

## Mandatory working rules

**Database changes:**
- Before doing ANYTHING that touches the database (schema changes, new tables/columns, altering constraints, or even reasoning about the data model), first read the files in `server/database/` (`schema.md` and `schema.sql`).
- Every time you make a change to the database, record it in `server/database/CHANGELOG.md`, tagged with the sequential change number (`#001`, `#002`, …). Keep `schema.md` and `schema.sql` in sync as well — they are maintained by hand.

**New resources:**
- To add a new resource (table + endpoints + page), follow the step-by-step recipe in [`ADDING_A_RESOURCE.md`](ADDING_A_RESOURCE.md). The reference implementation is the **questions** resource: `server/models/question.model.js` + `server/controllers/questions.controller.js` on the backend, `client/src/services/questionsService.js` + `client/src/pages/Domande.jsx` on the frontend.
- For list endpoints with query-string filters, pagination, or sorting, follow the conventions and reference implementation in [`client/src/FILTERS_BE.md`](client/src/FILTERS_BE.md).

**Endpoints:**
- Whenever you need to consult the API to debug an issue or to add/modify routes, always read [`server/ENDPOINTS.md`](server/ENDPOINTS.md) first — it is the reference for every backend route.
- If you add, remove, or modify an endpoint, you MUST update `server/ENDPOINTS.md` **and** the Postman collection (`server/postman_collection.json`) to reflect the change in the same edit.

**Frontend tables:**
- To create or modify any table (frontend), always look at and use [`client/src/components/DataTable.jsx`](client/src/components/DataTable.jsx) — every table in the app goes through this component. Do not hand-roll `<table>` markup.
- Column header names must be defined in [`client/src/constants/columnLabels.js`](client/src/constants/columnLabels.js) (one label map per resource), not inlined in the page.

**Frontend data fetching:**
- For any backend call from a page, use (where possible) [`client/src/hooks/useFetch.js`](client/src/hooks/useFetch.js) for reads and [`client/src/hooks/useMutation.js`](client/src/hooks/useMutation.js) for writes. If neither hook fits the case, stop and ask the user how to proceed.

**Components:**
- Every time you think you need to create a component, first check whether it already exists (`client/src/components/` and `client/src/components/ui/`). If it does not, ask the user for permission before creating it.

## Commands

**Root** (convenience scripts only, run from the repo root):
- `npm run install:all` — installs root, `server/` and `client/` dependencies
- `npm run dev` — starts server and client together (via `concurrently`, prefixed logs)
- `npm run dev:server` / `npm run dev:client` — starts one side only

The package-specific commands below run from inside `client/` or `server/` respectively.

**Client** (`client/`):
- `npm run dev` — Vite dev server
- `npm run build` — production build
- `npm run lint` — ESLint (flat config in `eslint.config.js`)
- `npm run preview` — serve the built bundle

**Server** (`server/`):
- `npm run dev` — nodemon (auto-reload) on `server.js`
- `npm start` — plain `node server.js`
- `npm run seed` — creates the single application user (idempotent upsert on the email), reading `SEED_EMAIL`, `SEED_PASSWORD`, `SEED_FIRST_NAME` and `SEED_LAST_NAME` from `.env`; it fails fast if any is missing. With `SEED_DEMO=true` it also inserts two demo topics (`[DEMO] ...`, 8 questions from `server/database/demoData.js`) through the same schema and dedupe as the import, so re-running it adds nothing; never set it against the production database. Domain entities get added to `server/database/seed.js`.

**Server tests** (`server/`): `npm test` runs `node --test` (built-in runner, no dependencies) on `server/test/*.test.js`. The client has no test suite (see "Sviluppo agentico" for the gates that stand in for it).

## Environment

Both sides require `.env` files (copy from the committed `.env.example`); the app throws on startup if key vars are missing.

- `server/.env`: `PORT`, `SUPABASE_URL`, `SUPABASE_KEY`, `JWT_SECRET` (required — `config/jwt.js` fails fast if absent), `FRONTEND_URL` (CORS origin), `NODE_ENV`, plus `SEED_EMAIL`, `SEED_PASSWORD`, `SEED_FIRST_NAME`, `SEED_LAST_NAME` (used only by `npm run seed`). Optional: `JWT_EXPIRES_IN` (default `7d`), `SALT_ROUNDS` (default `10`), `SEED_DEMO` (`true` adds the demo data to `npm run seed`; not for production).
- `client/.env`: `VITE_API_URL` — base URL of the backend, consumed by `src/api/client.js`.

## Backend architecture

Layered, CommonJS. Request flows: **route/controller → model → Supabase**.

- `server.js` — app entry. Mounts one router under `/auth`; plus `/health`, a 404 handler, and a global error handler. New resource routers get mounted here.
- `controllers/*.controller.js` — these ARE the Express routers (each exports `express.Router()`), not thin controllers. They own routing, input validation, business rules, and HTTP responses. Business logic lives here, not in models.
- `models/*.model.js` — pure Supabase data access. Every function queries a table (name in a `TABLE_NAME` constant at the top) and throws a sentinel `Error("DATABASE_*_ERROR")` on failure. No validation or HTTP concerns.
- `config/db_connection.js` — single shared Supabase client (exported as `supabase`), imported by all models.
- `config/jwt.js` — centralizes JWT secret/expiry/salt config.
- `config/zod.js` — configures Zod with the Italian locale (plus Italian type-error messages) and re-exports `z`. Schemas import `z` from here, never from `"zod"` directly.
- `schemas/*.schema.js` — Zod schemas. **Everything that comes from outside** (import JSON, AI grader output) is validated by a schema in this folder; conventions in `schemas/README.md`.
- `middleware/auth.js` — exported as `protect`. Verifies `Authorization: Bearer <token>`, attaches decoded payload (`{ sub, email, first_name, last_name }`) to `req.user`. Applied per-route, not globally.
- `utils/validate*.js` — standalone validators reused across controllers (`validateEmail`, `validatePassword`). They are not wired to a route yet: use them in the controllers that create or modify data.
- `utils/zodError.js` — `formatZodError(error)` turns a `ZodError` into an array of `"path: message"` strings (max 50); `sendZodError(res, error)` sends the standard `400 { ok: false, error: [...] }`.

**Conventions to follow when adding endpoints:**
- Every response is JSON shaped `{ ok: true, ... }` or `{ ok: false, error }`. `error` is usually a string but can be an **array** (e.g. `validatePassword` returns a list of failures) — the client joins arrays with `; `.
- Protected routes: pass `protect` as route middleware.
- Validate in the controller, then delegate persistence to the model. External payloads use `schema.safeParse(req.body)` and, on failure, `sendZodError`; after that, use `parsed.data`, not `req.body`.
- Error strings are Italian and returned to the user.

**Data model** (see `server/database/schema.sql` + `schema.md`, kept in sync manually — they are reconstructed from app code, NOT exported from Supabase; changes are logged in `server/database/CHANGELOG.md`):
- `FE_Users` (uuid id, email unique, bcrypt password, first_name, last_name, created_at) — the only base table. Single user, created by `npm run seed` from the `SEED_*` env vars; no roles.
- Table-name prefix is `FE_`; new tables follow the column conventions in `schema.md` (uuid PK + `created_at`).

## Auth model

Stateless JWT, single user, no roles. `POST /auth/login` returns a token; the client stores it in `localStorage` and sends it via an Axios request interceptor. `logout` is client-side only (removes the token) — there is no logout route. There is **no registration**: the only account is created by `npm run seed`, which reads `SEED_EMAIL`, `SEED_PASSWORD`, `SEED_FIRST_NAME` and `SEED_LAST_NAME` from `server/.env`.

## Frontend architecture

React 19 + Vite + React Router 7 + Tailwind CSS v4 + shadcn/ui (Radix) components. JavaScript (JSX), not TypeScript.

- `src/api/client.js` — the single configured Axios instance. Request interceptor injects the bearer token; response interceptor **normalizes all errors** to `{ status, message }` (joins array errors, handles network-down). Always call the API through this instance.
- `src/context/AuthContext.jsx` — `AuthProvider` + `useAuth()`. On mount, validates the stored token via `/auth/me` and exposes `{ user, loading, login, logout }`. `user` is `undefined` while loading, then `null` or a user object.
- `src/components/PrivateRoute.jsx` — route guard; renders `<Outlet/>` when authenticated, redirects to `/login` otherwise. In `App.jsx`, protected pages nest inside `PrivateRoute` → `AppLayout`. `/` is the protected Home (landing after login); the only public route is `/login`, plus the catch-all `*` (NotFound).
- `src/services/*Service.js` — one module per resource wrapping `api` calls; unwrap the response (e.g. return `res.data.items`) and re-throw errors as plain `Error(message)`. Existing: `topicsService.js`, `questionsService.js`.
- `src/hooks/useFetch.js` — for GETs; auto-runs on mount/deps change, returns `{ data, isLoading, error, refetch }`.
- `src/hooks/useMutation.js` — for POST/PUT/DELETE; manual `mutate(...)`, returns `{ mutate, isLoading, error, reset }`, supports `{ onSuccess, onError }`. (Note: `@tanstack/react-query` is also installed and wraps the app, but pages currently use these custom hooks.)
- `src/utils/toast.js` — `showSuccess` / `showError` wrappers over react-toastify (`<ToastContainer/>` mounted in `App.jsx`).
- `src/utils/validators/` — client-side validators mirroring the server's; re-exported via `validators/index.js`.
- `src/constants/columnLabels.js` — Italian column-header label maps for the tables (one map per resource, e.g. `QUESTIONS_COLUMN_LABELS`).
- `src/constants/app.js` — app name/logo branding (`APP_NAME`, currently the provisional "Studio", and `APP_LOGO`) and `NOT_FOUND` (copy for the 404 page). Customize here, plus `<title>` in `index.html`. Shared design tokens and the `--font-display`/`--font-data` fonts live in `index.css`.
- `src/components/ui/` — shadcn/ui primitives (configured via `components.json`); other reusable components (`DataTable`, `FilterBar`, `Modal`, `Loader`, `Side`, `PrivateRoute`) live in `src/components/`. `FilterBar` is the config-driven filter strip meant to pair with `useFetch` deps (types `select`, `month`, `text`; backend contract in `client/src/FILTERS_BE.md`). `DataTable` takes optional `pagination` + `onPageChange` for server-side pagination.

**Page pattern** (reference for lists with filters and pagination: `pages/Domande.jsx` — always-mounted `FilterBar`, debounced search in the `useFetch` deps, back to page 1 on every filter change, `DataTable` with `pagination`/`onPageChange`, loading/error-with-retry/empty states in the page): a page composes `useFetch` for the list + `useMutation` for create/update/delete, an inline `*Form` subcomponent driven by local `formState`, a `Modal` for create/edit and another for view-details, client-side validation inside the mutation fn (throw to surface `saveError`), and `refetch()` in `onSuccess`.

**Imports:** the `@/` alias maps to `client/src/` (configured in both `vite.config.js` and `jsconfig.json`). Both `@/...` and relative imports are used in the codebase.
