// Paginazione degli endpoint di elenco (convenzioni in client/src/FILTERS_BE.md)

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const DEFAULT_SORT = "created_at";

// Intero positivo dalla query string, altrimenti il default
const positiveInt = (value, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) && n >= 1 ? n : fallback;
};

// Range di .range() di Supabase: estremi inclusi
const getRange = (page, limit) => {
  const from = (page - 1) * limit;
  return { from, to: from + limit - 1 };
};

// page, limit, sort e order dalla query string, con default, tetto e whitelist
const parsePagination = (query = {}, { sortable = [DEFAULT_SORT] } = {}) => {
  const page = positiveInt(query.page, DEFAULT_PAGE);
  const limit = Math.min(MAX_LIMIT, positiveInt(query.limit, DEFAULT_LIMIT));
  const sort = sortable.includes(query.sort) ? query.sort : DEFAULT_SORT;
  const order = query.order === "asc" ? "asc" : "desc";

  return { page, limit, sort, order, ...getRange(page, limit) };
};

// Blocco `pagination` della risposta
const buildPagination = (total, page, limit) => {
  const count = total ?? 0;
  return { total: count, page, limit, totalPages: Math.ceil(count / limit) };
};

module.exports = {
  parsePagination,
  getRange,
  buildPagination,
};
