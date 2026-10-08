# TODO

Lista dei task per il loop agentico (workflow in [`CLAUDE.md`](CLAUDE.md), sezione "Sviluppo agentico").
Il contesto e il dettaglio dei task di dominio stanno in [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Come si compila

Un task per blocco, sotto "Task". L'agente prende **il primo task con stato `aperto`**, in ordine dall'alto.

```
### <ID> — <Titolo>
- **Stato**: aperto | in corso | fatto | bloccato
- **Descrizione**: cosa serve e perche', in poche righe.
- **Criteri di accettazione**:
  - [ ] criterio verificabile 1
  - [ ] criterio verificabile 2
- **Note**: (compilata dall'agente: commit, motivo del blocco, tentativi)
```

Regole sugli stati:
- `aperto` -> `in corso` quando l'agente inizia; `in corso` -> `fatto` solo a gate verdi e commit eseguito.
- `bloccato` dopo 3 tentativi falliti sui gate o davanti a una decisione non presa: la **Note** spiega il motivo.
- I task marcati **(ESEMPIO)** sono dimostrativi: l'agente li salta finche' non togli l'etichetta.

## Task

### BASE-1 — Riportare il lint a verde
- **Stato**: aperto
- **Descrizione**: `npm --prefix client run lint` fallisce sul codice esistente (7 errori: `react-refresh/only-export-components` in `ui/badge.jsx`, `ui/button.jsx`, `AuthContext.jsx`, `ThemeContext.jsx`; `react-hooks/immutability` in `AuthContext.jsx`; `react-hooks/use-memo` in `hooks/useFetch.js`; `no-undef` per `__dirname` in `vite.config.js`). Finche' non e' verde, il gate lint blocca ogni altro task. Correggere senza cambiare il comportamento e senza disattivare le regole globalmente.
- **Criteri di accettazione**:
  - [ ] `bash scripts/gates.sh lint` termina con exit code 0
  - [ ] `bash scripts/gates.sh build` continua a passare
  - [ ] login, logout e persistenza del token funzionano come prima (verifica manuale elencata nel piano)
  - [ ] nessuna regola ESLint disattivata a livello globale in `eslint.config.js`
- **Note**:

### ESEMPIO-1 — (ESEMPIO) Elenco e gestione delle domande (backend)
- **Stato**: aperto
- **Descrizione**: dal ROADMAP F1.3. `GET /questions` paginato secondo `client/src/FILTERS_BE.md` con filtri `q` e `topicId`; `PATCH /questions/:id` limitato a `prompt`, `answer`, `rubric`, `references` (schema Zod); `DELETE /questions/:id` con `409` se esistono tentativi collegati.
- **Criteri di accettazione**:
  - [ ] `GET /questions?topicId=...&q=...` restituisce `{ ok: true, items, pagination }` filtrati
  - [ ] `PATCH` rifiuta campi non ammessi con `400` e array di errori Zod
  - [ ] `DELETE` su domanda con tentativi risponde `409` con messaggio in italiano
  - [ ] `server/ENDPOINTS.md` e `server/postman_collection.json` aggiornati nello stesso commit
- **Note**:

### ESEMPIO-2 — (ESEMPIO) Pagina "Domande"
- **Stato**: aperto
- **Descrizione**: dal ROADMAP F1.4. Pagina con `DataTable`, `FilterBar` (ricerca e argomento), `Modal` di dettaglio, modifica e cancellazione via `useMutation`. Crea `client/src/services/` con i service delle domande e degli argomenti. Dipende da ESEMPIO-1.
- **Criteri di accettazione**:
  - [ ] rotta dentro `PrivateRoute`/`AppLayout` e voce in `MENU_ITEMS` di `Side.jsx`
  - [ ] label delle colonne in `client/src/constants/columnLabels.js`
  - [ ] usabile al tocco (nessuna funzione solo-hover), tema chiaro e scuro, solo icone Lucide
  - [ ] lint e build verdi
- **Note**:

### ESEMPIO-3 — (ESEMPIO) Algoritmo SM-2 come funzione pura
- **Stato**: aperto
- **Descrizione**: dal ROADMAP F5.2. `server/utils/sm2.js` con una funzione pura che dallo stato corrente e dal punteggio 0-1 restituisce `ease_factor`, `interval_days`, `repetitions`, `due_date`. Buon candidato per i test di accettazione automatici, ma il progetto non ha ancora un test runner: il piano deve proporre come verificarlo (vedi CLAUDE.md).
- **Criteri di accettazione**:
  - [ ] una sequenza di risposte buone fa crescere gli intervalli
  - [ ] una risposta sotto soglia riporta la domanda a ripasso immediato
  - [ ] l'`ease_factor` non scende sotto il minimo di SM-2
  - [ ] la mappatura 0-1 -> 0-5 e' dichiarata in un commento
- **Note**:
