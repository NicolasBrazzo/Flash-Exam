// Controlli e trasformazioni sui valori dei filtri prima di passarli al database

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Rende letterali i caratteri speciali di LIKE/ILIKE (backslash, % e _)
const escapeLike = (value) => value.replace(/[\\%_]/g, "\\$&");

// Uuid ben formato (qualsiasi versione): evita query destinate all'errore 22P02
const isUuid = (value) => typeof value === "string" && UUID_REGEX.test(value);

module.exports = {
  escapeLike,
  isUuid,
};
