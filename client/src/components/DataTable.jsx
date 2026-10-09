import { useState } from "react";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  Edit,
  Trash,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { sortByField } from "../utils/sortHelpers";

const SortIcon = ({ field, sortField, sortDirection }) => {
  if (sortField !== field) return <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />;
  return sortDirection === "asc"
    ? <ChevronUp className="h-3.5 w-3.5 text-foreground" /> 
    : <ChevronDown className="h-3.5 w-3.5 text-foreground" />;
};

const HEADER_CLASS =
  "px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide";

/**
 * Tabella generica guidata dalla configurazione delle colonne.
 *
 * columns: array di oggetti
 *   - key            chiave del campo sull'item (e chiave React della colonna)
 *   - label          intestazione della colonna
 *   - sortable       true per abilitare l'ordinamento sulla colonna
 *   - sortType       "string" | "number" | "boolean" | "date" (default "string")
 *   - render(item)   render custom della cella (default: item[key])
 *   - onClick(item)  rende la cella cliccabile (es. apertura dettagli)
 *
 * data: array di item; la riga usa item.id || item._id come chiave
 *
 * actions: { onEdit(item), onDelete(item) } — se presente aggiunge la colonna Azioni
 *
 * pagination + onPageChange (opzionali, insieme): paginazione lato server.
 *   - pagination     { page, totalPages } (forma di FILTERS_BE.md)
 *   - onPageChange   riceve il numero della pagina richiesta
 *   Aggiunge sotto la tabella i pulsanti Precedente/Successiva e "Pagina X di Y".
 *   Con la paginazione, `sortable` ordinerebbe solo la pagina corrente: meglio
 *   ordinare lato server e non marcare le colonne come sortable.
 */
export const DataTable = ({ columns, data, actions, pagination, onPageChange }) => {
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState("desc");

  const handleSort = (field) => {
    if (sortField !== field) {
      setSortField(field);
      setSortDirection("desc");
      return;
    }
    setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
  };

  const sortConfig = Object.fromEntries(
    columns
      .filter((col) => col.sortable)
      .map((col) => [col.key, { type: col.sortType || "string" }]),
  );

  const sortedData = sortField
    ? sortByField(data, sortField, sortDirection, sortConfig)
    : data || [];

  const cellClass = (col) =>
    col.onClick
      ? "px-4 py-3 font-medium text-primary cursor-pointer hover:underline"
      : "px-4 py-3";

  const showPagination = Boolean(pagination && onPageChange) && pagination.totalPages > 0;

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-card overflow-x-auto shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              {columns.map((col) =>
                col.sortable ? (
                  <th
                    key={col.key}
                    className={`${HEADER_CLASS} cursor-pointer select-none hover:text-foreground transition-colors`}
                    onClick={() => handleSort(col.key)}
                    title={`Clicca per ordinare per ${col.label.toLowerCase()}`}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {col.label}
                      <SortIcon
                        field={col.key}
                        sortField={sortField}
                        sortDirection={sortDirection}
                      />
                    </span>
                  </th>
                ) : (
                  <th key={col.key} className={HEADER_CLASS}>
                    {col.label}
                  </th>
                ),
              )}
              {actions && <th className={HEADER_CLASS}>Azioni</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sortedData.map((item) => (
              <tr
                key={item.id || item._id}
                className="hover:bg-muted/30 transition-colors"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cellClass(col)}
                    onClick={col.onClick ? () => col.onClick(item) : undefined}
                  >
                    {col.render ? col.render(item) : item[col.key]}
                  </td>
                ))}
                {actions && (
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {actions.onEdit && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => actions.onEdit(item)}
                        >
                          <Edit />
                        </Button>
                      )}
                      {actions.onDelete && (
                        <Button
                          variant="destructive"
                          size="icon-sm"
                          onClick={() => actions.onDelete(item)}
                        >
                          <Trash />
                        </Button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showPagination && (
        <nav
          aria-label="Paginazione"
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <Button
            variant="outline"
            className="h-11 min-w-11 px-4"
            disabled={pagination.page <= 1}
            onClick={() => onPageChange(pagination.page - 1)}
          >
            <ChevronLeft />
            Precedente
          </Button>
          <span className="text-sm text-muted-foreground" aria-live="polite">
            Pagina {pagination.page} di {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            className="h-11 min-w-11 px-4"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => onPageChange(pagination.page + 1)}
          >
            Successiva
            <ChevronRight />
          </Button>
        </nav>
      )}
    </div>
  );
};
