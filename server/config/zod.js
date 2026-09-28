const { z } = require("zod");

// Nomi dei tipi comprensibili per l'utente, usati nei messaggi di errore
const TYPE_NAMES = {
  string: "testo",
  number: "numero",
  int: "numero intero",
  bigint: "numero intero",
  boolean: "vero/falso",
  array: "elenco",
  object: "oggetto",
  date: "data",
  null: "null",
  undefined: "nessun valore",
  nan: "NaN",
  decimal: "numero decimale",
};

const typeName = (type) => TYPE_NAMES[type] || type;

const receivedType = (input) => {
  if (input === null) return "null";
  if (Array.isArray(input)) return "array";
  if (typeof input === "number" && Number.isNaN(input)) return "nan";
  if (typeof input === "number" && !Number.isInteger(input)) return "decimal";
  return typeof input;
};

// Locale italiano di Zod, con i messaggi sui tipi riscritti in italiano pieno.
// Per tutti gli altri casi (undefined) vale il messaggio del locale.
z.config(z.locales.it());
z.config({
  customError: (issue) => {
    if (issue.code !== "invalid_type") return undefined;
    if (issue.input === undefined) return "Campo obbligatorio";
    return `Tipo non valido: atteso ${typeName(issue.expected)}, ricevuto ${typeName(receivedType(issue.input))}`;
  },
});

// Gli schemi importano `z` da qui, non da "zod", così la configurazione è sempre attiva
module.exports = { z };
