import { Link, Navigate, useParams } from "react-router-dom";
import { Clock, House, Play, RotateCcw } from "lucide-react";
import { useFetch } from "@/hooks/useFetch";
import { getExam } from "@/services/examService";
import { FeedbackBlock } from "@/components/FeedbackBlock";
import Loader from "@/components/Loader";
import { Button } from "@/components/ui/button";
import {
  AUTO_SUBMITTED_TEXT,
  PENDING_TEXT,
  answerText,
  formatGrade,
  isEmptyAnswer,
  resultView,
  sortByPosition,
} from "@/utils/examResult";

const LABELS = {
  title: "Risultato della simulazione",
  loading: "Caricamento del risultato",
  retry: "Riprova",
  backToStart: "Torna all'avvio",
  grade: "Voto",
  review: "Revisione",
  yourAnswer: "La tua risposta",
  newExam: "Nuova simulazione",
  home: "Torna alla Home",
};

const linkClass = "inline-flex min-h-11 items-center gap-2 px-2 text-sm underline";

// Errore o 404: messaggio, nuovo tentativo e ritorno all'avvio
const ErroreRisultato = ({ message, onRetry }) => (
  <div className="space-y-4">
    <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
      <p>{message}</p>
    </div>
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="outline" className="h-11 px-4" onClick={onRetry}>
        <RotateCcw />
        {LABELS.retry}
      </Button>
      <Link to="/simulazione" className={linkClass}>
        {LABELS.backToStart}
      </Link>
    </div>
  </div>
);

// Una domanda della revisione: argomento, testo, risposta e correzione.
// Nessun voto per singola domanda
const RevisioneDomanda = ({ question }) => {
  const empty = isEmptyAnswer(question.answer);
  return (
    <article className="space-y-4 rounded-lg border p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-lg font-semibold">Domanda {question.position}</h3>
        {question.topic && <span className="text-sm text-muted-foreground">{question.topic.name}</span>}
      </div>
      <p className="whitespace-pre-wrap text-base leading-relaxed">{question.prompt}</p>
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-muted-foreground">{LABELS.yourAnswer}</p>
        <p className={`whitespace-pre-wrap text-base leading-relaxed ${empty ? "italic text-muted-foreground" : ""}`}>
          {answerText(question.answer)}
        </p>
      </div>
      <FeedbackBlock
        verdict={question.verdict}
        feedback={question.feedback}
        referenceAnswer={question.reference_answer}
        references={question.references}
        announce={false}
      />
    </article>
  );
};

// Prima il voto, grande e da solo; poi la revisione domanda per domanda
const RisultatoValutato = ({ exam }) => {
  // Lode solo con la valutazione AI (D1): in autovalutazione non c'è
  const [grade, ...rest] = formatGrade(exam.grade, exam.status === "GRADED" && exam.honors).split(" ");
  const honorsText = rest.join(" ");
  return (
    <>
      <section aria-label={LABELS.grade} className="py-6 text-center">
        <p data-testid="grade" className="font-display text-6xl font-semibold tabular-nums sm:text-7xl">
          {grade}
          {honorsText && <span className="mt-2 block text-2xl font-medium sm:text-3xl"> {honorsText}</span>}
        </p>
      </section>

      {exam.auto_submitted && (
        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Clock className="size-4" aria-hidden="true" />
          {AUTO_SUBMITTED_TEXT}
        </p>
      )}

      <section aria-labelledby="exam-review-title" className="space-y-4">
        <h2 id="exam-review-title" className="text-xl font-semibold">
          {LABELS.review}
        </h2>
        {sortByPosition(exam.questions).map((question) => (
          <RevisioneDomanda key={question.position} question={question} />
        ))}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Link to="/simulazione" className={linkClass}>
          <Play className="size-4" aria-hidden="true" />
          {LABELS.newExam}
        </Link>
        <Link to="/" className={linkClass}>
          <House className="size-4" aria-hidden="true" />
          {LABELS.home}
        </Link>
      </div>
    </>
  );
};

const Risultato = ({ id }) => {
  const { data, isLoading, error, refetch } = useFetch(() => getExam(id), [id]);

  if (isLoading && !data) return <Loader text={LABELS.loading} />;

  let content;
  if (error) {
    content = <ErroreRisultato message={error} onRetry={refetch} />;
  } else if (!data) {
    return null;
  } else {
    const view = resultView(data);
    // Prova ancora in corso: si torna alla prova
    if (view === "in_progress") return <Navigate replace to={`/simulazione/${id}`} />;
    content =
      view === "graded" ? (
        <RisultatoValutato exam={data} />
      ) : (
        // PROVA-9: autovalutazione (SELF_GRADED senza voto), attesa con Loader e
        // "Riprova la valutazione" (GRADING)
        <div className="space-y-4">
          <p className="text-base leading-relaxed">{PENDING_TEXT}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" className="h-11 px-4" onClick={refetch}>
              <RotateCcw />
              {LABELS.retry}
            </Button>
            <Link to="/simulazione" className={linkClass}>
              {LABELS.backToStart}
            </Link>
          </div>
        </div>
      );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-semibold">{LABELS.title}</h1>
      {content}
    </div>
  );
};

// /simulazione/:id/risultato
export const RisultatoSimulazione = () => {
  const { id } = useParams();
  return <Risultato key={id} id={id} />;
};
