// Riferimenti normativi in forma compatta: ["1", "2"] -> "art. 1, 2".
// Stringa vuota se non ce ne sono.
export const formatReferences = (references) => {
  if (!Array.isArray(references)) return "";
  const items = references
    .filter((ref) => typeof ref === "string")
    .map((ref) => ref.trim())
    .filter(Boolean);
  return items.length > 0 ? `art. ${items.join(", ")}` : "";
};
