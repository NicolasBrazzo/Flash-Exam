import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { useFetch } from "@/hooks/useFetch";
import { getQuestions } from "@/services/questionsService";
import { getTopics } from "@/services/topicsService";
import { DataTable } from "@/components/DataTable";
import { FilterBar } from "@/components/FilterBar";
import Loader from "@/components/Loader";
import { Button } from "@/components/ui/button";
import { QUESTIONS_COLUMN_LABELS } from "@/constants/columnLabels";
import { formatReferences } from "@/utils/formatReferences";

const PAGE_SIZE = 20;

// Etichette dei filtri (quelle delle colonne stanno in constants/columnLabels.js)
const FILTER_LABELS = {
  q: "Cerca",
  topic_id: "Argomento",
};
const SEARCH_DEBOUNCE_MS = 300;

const COLUMNS = [
  {
    key: "prompt",
    label: QUESTIONS_COLUMN_LABELS.prompt,
    render: (item) => <span className="line-clamp-3">{item.prompt}</span>,
  },
  {
    key: "topic",
    label: QUESTIONS_COLUMN_LABELS.topic,
    render: (item) => item.topic?.name ?? "",
  },
  {
    key: "references",
    label: QUESTIONS_COLUMN_LABELS.references,
    render: (item) => formatReferences(item.references),
  },
];

// Elenco delle domande con ricerca nel testo, filtro per argomento e paginazione
// lato server. Pagina di riferimento per gli elenchi delle risorse.
export const Domande = () => {
  // Testo digitato (subito nel campo) e testo cercato (dopo il debounce)
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [topicId, setTopicId] = useState("");
  const [page, setPage] = useState(1);

  // La ricerca parte quando si smette di scrivere; un nuovo testo riporta a pagina 1
  useEffect(() => {
    const timer = setTimeout(() => {
      const next = searchInput.trim();
      if (next === debouncedQ) return;
      setDebouncedQ(next);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput, debouncedQ]);

  const { data, isLoading, error, refetch } = useFetch(
    () =>
      getQuestions({
        q: debouncedQ || undefined,
        topic_id: topicId || undefined,
        page,
        limit: PAGE_SIZE,
      }),
    [debouncedQ, topicId, page],
  );

  const { data: topics, error: topicsError } = useFetch(getTopics, []);

  const filters = [
    {
      key: "q",
      label: FILTER_LABELS.q,
      type: "text",
      placeholder: "Testo della domanda",
    },
    {
      key: "topic_id",
      label: FILTER_LABELS.topic_id,
      type: "select",
      options: (topics || []).map((topic) => ({ value: topic.id, label: topic.name })),
    },
  ];

  const handleFiltersChange = (values) => {
    setSearchInput(values.q);
    if (values.topic_id !== topicId) {
      setTopicId(values.topic_id);
      setPage(1);
    }
  };

  // Durante un ricaricamento la pagina in corso resta visibile: i pulsanti di
  // paginazione non si smontano (il focus da tastiera resta al suo posto) e un
  // nuovo cambio di pagina aspetta la fine della richiesta
  const handlePageChange = (nextPage) => {
    if (!isLoading) setPage(nextPage);
  };

  const renderResults = () => {
    // Loader a tutta area solo al primo caricamento
    if (isLoading && !data) return <Loader text="Caricamento domande" />;

    if (error) {
      return (
        <div className="flex flex-col items-start gap-3 rounded-lg border bg-card p-4 shadow-sm">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" className="h-11 px-4" onClick={refetch}>
            <RotateCcw />
            Riprova
          </Button>
        </div>
      );
    }

    if (!data || data.data.length === 0) {
      return (
        <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground shadow-sm">
          Nessuna domanda trovata
        </p>
      );
    }

    return (
      <DataTable
        columns={COLUMNS}
        data={data.data}
        pagination={data.pagination}
        onPageChange={handlePageChange}
      />
    );
  };

  return (
    <div className="space-y-4 px-6 py-6">
      <h1 className="text-2xl font-semibold">Domande</h1>

      <FilterBar
        filters={filters}
        values={{ q: searchInput, topic_id: topicId }}
        onChange={handleFiltersChange}
      />
      {topicsError && (
        <p className="text-sm text-destructive">
          Argomenti non disponibili: {topicsError}
        </p>
      )}

      <div aria-busy={isLoading} className={isLoading ? "opacity-60 transition-opacity" : "transition-opacity"}>
        {renderResults()}
      </div>
    </div>
  );
};
