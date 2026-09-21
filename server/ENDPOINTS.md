# API Endpoints

Documentazione delle rotte del backend Express.

> Questo file è il riferimento di ogni rotta del backend: se aggiungi, rimuovi
> o modifichi un endpoint, aggiorna questo file nella stessa modifica.

## Test delle API con Postman

Nel repo è committata la collection [`postman_collection.json`](./postman_collection.json)
(Postman → File → Import). Contiene tutte le rotte con la variabile `{{baseUrl}}`
(default `http://localhost:3000` — per il deploy sostituirla con il dominio del
backend) e `{{token}}`, valorizzata automaticamente dopo il Login.
Se aggiungi o modifichi un endpoint, aggiorna anche la collection.

## Convenzioni generali

- **Base URL**: definito dalla porta del server (`PORT`, default `3000`). Es. `http://localhost:3000`.
- **Formato**: tutte le richieste e risposte usano JSON (`Content-Type: application/json`).
- **Formato risposta**: ogni risposta ha la forma `{ "ok": true, ... }` in caso di successo, oppure `{ "ok": false, "error": <string | string[]> }` in caso di errore.
- **Autenticazione**: le rotte protette richiedono l'header `Authorization: Bearer <token>`. Il token JWT si ottiene tramite `POST /auth/login`.
- **Utente unico**: non esiste registrazione pubblica. L'unica utente viene creata da `npm run seed` a partire dalle variabili `SEED_*` del `.env`.
- **Logout**: è solo lato client (rimozione del token da `localStorage`), non esiste una rotta dedicata.

### Errori comuni di autenticazione

| Codice | Quando |
|--------|--------|
| `401 Non autenticato` | Header `Authorization` assente o non nel formato `Bearer <token>` |
| `401 Token non valido o scaduto` | Token JWT non verificabile o scaduto |
| `404 Rotta non trovata` | Endpoint inesistente |
| `500 Errore interno del server` | Errore non gestito lato server |

---

## Auth — `/auth`

- `POST /auth/login` — Autenticazione utente. **Pubblica.**
  Body: `{ "email": string, "password": string }`. Risposta: `{ "ok": true, "token": string }`.
  `400` se manca email o password, `401` con credenziali non valide.
- `GET /auth/me` — Dati dell'utente autenticato (letti dal token: `sub`, `email`, `first_name`, `last_name`). **Protetta.**

---

## Utility

- `GET /health` — Health check del server. **Pubblica.**
