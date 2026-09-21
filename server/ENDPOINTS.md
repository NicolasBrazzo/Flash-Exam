# API Endpoints

Documentazione delle rotte del backend Express.

> Questo file è il riferimento di ogni rotta del backend: se aggiungi, rimuovi
> o modifichi un endpoint, aggiorna questo file nella stessa modifica.

## Test delle API con Postman

Nel repo è committata la collection [`postman_collection.json`](./postman_collection.json)
(Postman → File → Import). Contiene tutte le rotte con la variabile `{{baseUrl}}`
(default `http://localhost:3000` — per il deploy sostituirla con il dominio del
backend) e `{{token}}`, valorizzata automaticamente dopo Login/Register.
Se aggiungi o modifichi un endpoint, aggiorna anche la collection.

## Convenzioni generali

- **Base URL**: definito dalla porta del server (`PORT`, default `3000`). Es. `http://localhost:3000`.
- **Formato**: tutte le richieste e risposte usano JSON (`Content-Type: application/json`).
- **Formato risposta**: ogni risposta ha la forma `{ "ok": true, ... }` in caso di successo, oppure `{ "ok": false, "error": <string | string[]> }` in caso di errore.
- **Autenticazione**: le rotte protette richiedono l'header `Authorization: Bearer <token>`. Il token JWT si ottiene tramite `POST /auth/login` o `POST /auth/register`.
- **Autorizzazione admin**: alcune rotte (tutte sotto `/users`) richiedono che l'utente autenticato abbia `isAdmin: true` (middleware `isAdmin` in `middleware/isAdmin.js`, da usare dopo `protect`).

### Errori comuni di autenticazione

| Codice | Quando |
|--------|--------|
| `401 Non autenticato` | Header `Authorization` assente o non nel formato `Bearer <token>` |
| `401 Token non valido o scaduto` | Token JWT non verificabile o scaduto |
| `403 Accesso non autorizzato` | Rotta admin richiesta da un utente non admin |
| `404 Rotta non trovata` | Endpoint inesistente |
| `500 Errore interno del server` | Errore non gestito lato server |

---

## Auth — `/auth`

- `POST /auth/login` — Autenticazione utente. **Pubblica.**
- `POST /auth/register` — Registrazione pubblica. **Pubblica.**
- `GET /auth/me` — Dati dell'utente autenticato (dal token). **Protetta.**
- `POST /auth/logout` — Logout stateless (invalidazione del token a carico del client). **Pubblica.**

> ⚠️ **Attenzione** (`POST /auth/register`): la rotta accetta `isAdmin` senza
> alcun vincolo, quindi chiunque può registrarsi come amministratore. Scelta
> voluta per il template (comodità in sviluppo/demo): nei progetti derivati va
> protetta (es. codice di registrazione, whitelist, o rimozione del campo).

---

## Users — `/users`

Tutte le rotte richiedono autenticazione **e privilegi di amministratore** (`isAdmin: true`).

- `GET /users` — Elenco di tutti gli utenti.
- `GET /users/:id` — Singolo utente per ID.
- `POST /users` — Crea un nuovo utente.
- `PUT /users/:id` — Aggiorna un utente (`password` opzionale; un admin non può rimuovere i propri privilegi). `404` se l'utente non esiste, `409` se l'email è già usata da un altro utente.
- `DELETE /users/:id` — Elimina un utente. `404` se l'utente non esiste.

---

## Utility

- `GET /health` — Health check del server. **Pubblica.**
