import { useEffect, useState } from "react";
import { Pencil, RotateCcw, Save, Trash2 } from "lucide-react";
import { useFetch } from "@/hooks/useFetch";
import { useMutation } from "@/hooks/useMutation";
import {
  deleteQuestion,
  getQuestions,
  updateQuestion,
} from "@/services/questionsService";
import { getTopics } from "@/services/topicsService";
import { DataTable } from "@/components/DataTable";
import { FilterBar } from "@/components/FilterBar";
import Loader from "@/components/Loader";
import Modal from "@/components/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { QUESTIONS_COLUMN_LABELS } from "@/constants/columnLabels";
import { formatReferences } from "@/utils/formatReferences";
import {
  formStateToPatch,
  pageAfterDelete,
  questionToFormState,
  validateQuestionForm,
} from "@/utils/questionForm";
import { showSuccess } from "@/utils/toast";

const PAGE_SIZE = 20;

// Etichette dei filtri (quelle delle colonne stanno in constants/columnLabels.js)
const FILTER_LABELS = {
  q: "Cerca",
  topic_id: "Argomento",
};
const SEARCH_DEBOUNCE_MS = 300;

// Etichette dei campi del dettaglio e del form
const FIELD_LABELS = {
  topic: "Argomento",
  prompt: "Domanda",
  reference_answer: "Risposta di riferimento",
  rubric: "Rubrica",
  concept: "Concetto",
  weight: "Peso",
  references: "Riferimenti",
  referencesHint: "Riferimenti (numeri di articolo separati da virgola)",
};

// Errori uniti con "; " (validazione client o array del server) -> elenco
const ErrorList = ({ message }) => {
  if (!message) return null;
  const items = message.split("; ");
  return (
    <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
      {items.length === 1 ? (
        <p>{items[0]}</p>
      ) : (
        <ul className="list-disc space-y-1 pl-5">
          {items.map((item, i) => (
            <li key={`${i}-${item}`}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

const QuestionDetails = ({ question }) => (
  <dl className="space-y-4 text-sm">
    <div>
      <dt className="text-muted-foreground">{FIELD_LABELS.topic}</dt>
      <dd>{question.topic?.name ?? ""}</dd>
    </div>
    <div>
      <dt className="text-muted-foreground">{FIELD_LABELS.prompt}</dt>
      <dd className="whitespace-pre-wrap font-medium">{question.prompt}</dd>
    </div>
    <div>
      <dt className="text-muted-foreground">{FIELD_LABELS.reference_answer}</dt>
      <dd className="whitespace-pre-wrap">{question.reference_answer}</dd>
    </div>
    <div>
      <dt className="text-muted-foreground">{FIELD_LABELS.rubric}</dt>
      <dd>
        <ul className="mt-1 space-y-1">
          {question.rubric.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-4 rounded-md bg-muted/50 px-3 py-2">
              <span>{item.concept}</span>
              <span className="shrink-0 text-muted-foreground">peso {item.weight}</span>
            </li>
          ))}
        </ul>
      </dd>
    </div>
    <div>
      <dt className="text-muted-foreground">{FIELD_LABELS.references}</dt>
      <dd>{formatReferences(question.references) || "Nessuno"}</dd>
    </div>
  </dl>
);

// Form di modifica: testo della domanda, risposta, riferimenti e, per ogni
// concetto esistente, testo e peso (i concetti non si aggiungono né tolgono)
const QuestionForm = ({ question, onSubmit, onCancel, isSaving, error }) => {
  const [formState, setFormState] = useState(() => questionToFormState(question));

  const setField = (field, value) => setFormState((prev) => ({ ...prev, [field]: value }));
  const setConcept = (index, field, value) =>
    setFormState((prev) => ({
      ...prev,
      rubric: prev.rubric.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    }));

  const handleSubmit = (e) => {
    e.preventDefault();
    // l'errore resta nello stato di useMutation e viene mostrato sotto
    onSubmit(formState).catch(() => {});
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="question-prompt">{FIELD_LABELS.prompt}</Label>
        <Textarea
          id="question-prompt"
          className="min-h-20 text-base"
          value={formState.prompt}
          onChange={(e) => setField("prompt", e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="question-answer">{FIELD_LABELS.reference_answer}</Label>
        <Textarea
          id="question-answer"
          className="min-h-28 text-base"
          value={formState.reference_answer}
          onChange={(e) => setField("reference_answer", e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="question-references">{FIELD_LABELS.referencesHint}</Label>
        <Input
          id="question-references"
          className="h-11 text-base"
          autoComplete="off"
          value={formState.references}
          onChange={(e) => setField("references", e.target.value)}
        />
      </div>
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">{FIELD_LABELS.rubric}</legend>
        {formState.rubric.map((item, i) => (
          <div key={item.id} className="flex flex-wrap items-end gap-3 rounded-md border p-3">
            <div className="min-w-48 flex-1 space-y-1.5">
              <Label htmlFor={`concept-${item.id}`}>
                {FIELD_LABELS.concept} {i + 1}
              </Label>
              <Textarea
                id={`concept-${item.id}`}
                className="min-h-11 text-base"
                value={item.concept}
                onChange={(e) => setConcept(i, "concept", e.target.value)}
              />
            </div>
            <div className="w-24 space-y-1.5">
              <Label htmlFor={`weight-${item.id}`}>{FIELD_LABELS.weight}</Label>
              <Input
                id={`weight-${item.id}`}
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                className="h-11 text-base"
                value={item.weight}
                onChange={(e) => setConcept(i, "weight", e.target.value)}
              />
            </div>
          </div>
        ))}
      </fieldset>

      <ErrorList message={error} />

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" className="h-11 px-4" onClick={onCancel} disabled={isSaving}>
          Annulla
        </Button>
        <Button type="submit" className="h-11 px-4" disabled={isSaving}>
          <Save />
          {isSaving ? "Salvataggio..." : "Salva"}
        </Button>
      </div>
    </form>
  );
};

const COLUMNS_BASE = [
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

  // Modale aperto: dettaglio, modifica o conferma di cancellazione
  const [modal, setModal] = useState({ type: null, question: null });

  const saveMutation = useMutation(
    async (formState) => {
      const errors = validateQuestionForm(formState);
      if (errors.length > 0) throw new Error(errors.join("; "));
      const patch = formStateToPatch(modal.question, formState);
      if (Object.keys(patch).length === 0) throw new Error("Nessuna modifica da salvare");
      return updateQuestion(modal.question.id, patch);
    },
    {
      onSuccess: () => {
        showSuccess("Domanda aggiornata");
        setModal({ type: null, question: null });
        refetch();
      },
    },
  );

  const deleteMutation = useMutation(() => deleteQuestion(modal.question.id), {
    onSuccess: () => {
      showSuccess("Domanda eliminata");
      setModal({ type: null, question: null });
      const nextPage = pageAfterDelete(data?.data.length ?? 0, page);
      if (nextPage !== page) setPage(nextPage);
      else refetch();
    },
  });

  const isMutating = saveMutation.isLoading || deleteMutation.isLoading;

  const openModal = (type, question) => {
    saveMutation.reset();
    deleteMutation.reset();
    setModal({ type, question });
  };

  const closeModal = () => {
    if (!isMutating) setModal({ type: null, question: null });
  };

  const columns = [
    {
      key: "prompt",
      label: QUESTIONS_COLUMN_LABELS.prompt,
      render: (item) => <span className="line-clamp-3">{item.prompt}</span>,
      onClick: (item) => openModal("view", item),
    },
    ...COLUMNS_BASE,
  ];

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
        columns={columns}
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

      <Modal isOpen={modal.type === "view"} onClose={closeModal} title="Dettaglio domanda" size="lg">
        {modal.question && (
          <div className="space-y-5">
            <QuestionDetails question={modal.question} />
            <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
              <Button
                variant="destructive"
                className="h-11 px-4"
                onClick={() => openModal("delete", modal.question)}
              >
                <Trash2 />
                Elimina
              </Button>
              <Button className="h-11 px-4" onClick={() => openModal("edit", modal.question)}>
                <Pencil />
                Modifica
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={modal.type === "edit"} onClose={closeModal} title="Modifica domanda" size="lg">
        {modal.question && (
          <QuestionForm
            question={modal.question}
            onSubmit={saveMutation.mutate}
            onCancel={closeModal}
            isSaving={saveMutation.isLoading}
            error={saveMutation.error}
          />
        )}
      </Modal>

      <Modal isOpen={modal.type === "delete"} onClose={closeModal} title="Eliminare la domanda?">
        {modal.question && (
          <div className="space-y-4 text-sm">
            <p className="line-clamp-4 font-medium">{modal.question.prompt}</p>
            <p className="text-muted-foreground">
              La cancellazione è definitiva. Una domanda già usata in una prova o in una flashcard non si può eliminare.
            </p>
            <ErrorList message={deleteMutation.error} />
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" className="h-11 px-4" onClick={closeModal} disabled={deleteMutation.isLoading}>
                Annulla
              </Button>
              <Button
                variant="destructive"
                className="h-11 px-4"
                disabled={deleteMutation.isLoading}
                onClick={() => deleteMutation.mutate().catch(() => {})}
              >
                <Trash2 />
                Elimina
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
