// Query di GET /flashcards: topics (id uuid separati da virgola) e count (1-50)
const { isUuid } = require("./sqlFilters");

const DEFAULT_COUNT = 10;
const MAX_COUNT = 50;
const MAX_TOPICS = 100;

const fail = (error) => ({ ok: false, error });

// -> { ok: true, topicIds, count } | { ok: false, error } (messaggi italiani)
const parseFlashcardQuery = (query = {}) => {
  const { topics, count } = query;

  // parametro ripetuto o in forma di oggetto (topics[]=..., topics[a]=...)
  if (topics !== undefined && typeof topics !== "string") {
    return fail("Il parametro topics va indicato una sola volta");
  }

  // le virgole in più (",," o finale) si ignorano
  const segments = (topics ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (segments.length === 0) return fail("Indica almeno un argomento (parametro topics)");
  if (!segments.every(isUuid)) {
    return fail("Il parametro topics contiene valori che non sono id di argomento validi");
  }

  const topicIds = [...new Set(segments.map((id) => id.toLowerCase()))];
  if (topicIds.length > MAX_TOPICS) {
    return fail(`Puoi scegliere al massimo ${MAX_TOPICS} argomenti (parametro topics)`);
  }

  // parametro vuoto = default, come negli altri elenchi
  if (count === undefined || count === "") return { ok: true, topicIds, count: DEFAULT_COUNT };
  if (typeof count !== "string") return fail("Il parametro count va indicato una sola volta");

  const n = /^[0-9]+$/.test(count) ? Number(count) : NaN;
  if (!Number.isInteger(n) || n < 1 || n > MAX_COUNT) {
    return fail(`Il parametro count deve essere un intero tra 1 e ${MAX_COUNT}`);
  }

  return { ok: true, topicIds, count: n };
};

module.exports = { parseFlashcardQuery };
