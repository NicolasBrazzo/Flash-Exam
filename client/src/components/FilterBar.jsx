import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * Barra filtri generica, guidata dalla configurazione (come DataTable).
 * Va usata come componente controllato insieme a useFetch:
 *
 *   const [filters, setFilters] = useState({ stato: "", mese: "" });
 *   const { data } = useFetch(() => fetchItems(filters), [filters]);
 *   <FilterBar filters={FILTERS} values={filters} onChange={setFilters} />
 *
 * filters: array di oggetti
 *   - key       chiave del filtro (diventa il query param)
 *   - label     etichetta mostrata sopra il campo
 *   - type      "select" | "month" | "text" (default "select")
 *   - options   per i select: array di { value, label }
 *   - placeholder  per i campi di testo (ricerca libera)
 *
 * Campi e pulsanti sono alti 44px con testo a 16px: target di tocco comodo e
 * niente zoom automatico di Safari su iPad quando si mette a fuoco un campo.
 *
 * values:   oggetto { key: valore } (stringa vuota = filtro non attivo)
 * onChange: riceve il nuovo oggetto values completo
 */
const FIELD_CLASS = "h-11 text-base";

export const FilterBar = ({ filters, values, onChange }) => {
  const setValue = (key, value) => onChange({ ...values, [key]: value });

  const emptyValues = Object.fromEntries(filters.map((f) => [f.key, ""]));
  const hasActiveFilters = filters.some((f) => values[f.key]);

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4 shadow-sm">
      {filters.map((filter) => (
        <div
          key={filter.key}
          className={filter.type === "text" ? "min-w-60 flex-1 space-y-1.5" : "min-w-40 space-y-1.5"}
        >
          <Label htmlFor={`filter-${filter.key}`}>{filter.label}</Label>
          {filter.type === "text" ? (
            <Input
              id={`filter-${filter.key}`}
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              placeholder={filter.placeholder}
              className={FIELD_CLASS}
              value={values[filter.key] || ""}
              onChange={(e) => setValue(filter.key, e.target.value)}
            />
          ) : filter.type === "month" ? (
            <Input
              id={`filter-${filter.key}`}
              type="month"
              className={FIELD_CLASS}
              value={values[filter.key] || ""}
              onChange={(e) => setValue(filter.key, e.target.value)}
            />
          ) : (
            <Select
              id={`filter-${filter.key}`}
              className={FIELD_CLASS}
              value={values[filter.key] || ""}
              onChange={(e) => setValue(filter.key, e.target.value)}
            >
              <option value="">Tutti</option>
              {(filter.options || []).map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          )}
        </div>
      ))}

      {hasActiveFilters && (
        <Button
          type="button"
          variant="ghost"
          className="h-11 px-4"
          onClick={() => onChange(emptyValues)}
        >
          Azzera filtri
        </Button>
      )}
    </div>
  );
};
