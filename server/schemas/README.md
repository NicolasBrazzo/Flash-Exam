# schemas/

Sede unica degli schemi [Zod](https://zod.dev) del server.

## Regola

**Tutto ciò che entra da fuori passa da uno schema di questa cartella**: i JSON di import
(domande) e l'output del grader AI. Nessun controller si fida di questi dati
senza averli prima validati qui.

La validazione "leggera" dei body delle rotte ordinarie (email, password, campi singoli)
resta nel controller con i validator di `utils/`, come da `CLAUDE.md`.

## Convenzioni

- Un file per schema: `<nome>.schema.js` (es. `questionsImport.schema.js`,
  `graderOutput.schema.js`), in CommonJS, che esporta lo schema.
- Importare `z` da `config/zod.js`, **mai direttamente da `"zod"`**: lì è attivo il locale
  italiano con i messaggi di errore riscritti.

  ```js
  const { z } = require("../config/zod");

  const questionsImportSchema = z.object({
    topic: z.object({ name: z.string().min(1) }),
    questions: z.array(
      z.object({
        prompt: z.string().min(1),
        answer: z.string().min(1),
        references: z.array(z.string()),
      })
    ),
  });

  module.exports = { questionsImportSchema };
  ```

- Messaggi personalizzati, quando servono, in italiano:
  `z.string().min(1, "La domanda non può essere vuota")`.

## Uso nel controller

Si usa sempre `safeParse` e, in caso di fallimento, `sendZodError` di `utils/zodError.js`:

```js
const { questionsImportSchema } = require("../schemas/questionsImport.schema");
const { sendZodError } = require("../utils/zodError");

router.post("/import", protect, async (req, res) => {
  const parsed = questionsImportSchema.safeParse(req.body);
  if (!parsed.success) return sendZodError(res, parsed.error);

  // da qui in poi si usa parsed.data, non req.body
});
```

## Forma dell'errore

Un fallimento risponde `400` con un array di stringhe `"percorso: messaggio"`, che il
client unisce con `; `:

```json
{
  "ok": false,
  "error": [
    "questions[3].prompt: Campo obbligatorio",
    "questions[7].references[0]: Tipo non valido: atteso testo, ricevuto numero"
  ]
}
```

Gli errori restituiti sono al massimo 50; oltre, l'ultima voce dice quanti ne sono stati
omessi. Per l'output del grader si usa invece `formatZodError` (stesso modulo) solo per il
log: l'utente non vede quegli errori, vede il fallback.
