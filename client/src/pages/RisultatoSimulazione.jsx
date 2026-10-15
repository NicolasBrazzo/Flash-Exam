import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { CircleAlert, CircleCheck, CircleX, Clock, House, Play, RefreshCw, RotateCcw, Send } from "lucide-react";
import { useFetch } from "@/hooks/useFetch";
import { useMutation } from "@/hooks/useMutation";
import { getExam, regradeExam, selfGradeExam } from "@/services/examService";
import { FeedbackBlock } from "@/components/FeedbackBlock";
import Loader from "@/components/Loader";
import { Button } from "@/components/ui/button";
import {
  AUTO_SUBMITTED_TEXT,
  PENDING_TEXT,
  SELF_GRADE_EMPTY_NOTE,
  answerText,
  buildSelfGradeVerdicts,
  canSubmitSelfGrade,
  formatGrade,
  initialSelfGradeChoices,
  isEmptyAnswer,
  pendingKind,
  regradeErrorText,
  resultView,
  selfGradeErrorText,
  setSelfGradeChoice,
  sortByPosition,
} from "@/utils/examResult";
import { SELF_GRADE_OPTIONS } from "@/utils/flashcardSession";

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
  refresh: "Aggiorna",
  regrade: "Riprova la valutazione",
  regrading: "Sto valutando la prova, può richiedere qualche decina di secondi",
  sendSelfGrade: "Invia autovalutazione",
  selfGradeIntro:
    "La valutazione automatica non è disponibile. Confronta ogni risposta con quella di riferimento e scegli l'esito: il voto si calcola dalle tue scelte, senza lode. Oppure riprova la valutazione automatica.",
  gradingWait: "La valutazione della prova è in corso.",
  gradingHint: "Se resta ferma per diversi minuti puoi riprovare la valutazione.",
};

const CHOICE_ICONS = { CircleCheck, CircleAlert, CircleX };

// Messaggio d'errore di un'azione
const AlertMessage = ({ message }) =>
  message ? (
    <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
      <p>{message}</p>
    </div>
  ) : null;

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

// Prima il voto, grande e da solo; poi la revisione domanda per domanda.
// Arrivando da un'autovalutazione o da una nuova valutazione il focus va sul voto
const RisultatoValutato = ({ exam, focusGrade = false }) => {
  const gradeRef = useRef(null);
  // Lode solo con la valutazione AI (D1): in autovalutazione non c'è
  const [grade, ...rest] = formatGrade(exam.grade, exam.status === "GRADED" && exam.honors).split(" ");
  const honorsText = rest.join(" ");

  useEffect(() => {
    if (focusGrade) gradeRef.current?.focus();
  }, [focusGrade]);

  return (
    <>
      <section aria-label={LABELS.grade} className="py-6 text-center">
        <p
          ref={gradeRef}
          tabIndex={-1}
          data-testid="grade"
          className="font-display text-6xl font-semibold tabular-nums outline-none sm:text-7xl"
        >
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

// Tre pulsanti di esito per una domanda; la risposta vuota resta errata (D6)
const SceltaDomanda = ({ position, value, empty, disabled, onChoose }) => (
  <div role="group" aria-label={`Valutazione della domanda ${position}`} className="flex flex-wrap gap-2">
    {SELF_GRADE_OPTIONS.map((option) => {
      const Icon = CHOICE_ICONS[option.icon];
      const pressed = value === option.verdict;
      return (
        <Button
          key={option.verdict}
          type="button"
          variant={pressed ? "default" : "outline"}
          className="h-11 px-4"
          aria-pressed={pressed}
          disabled={disabled || (empty && option.verdict !== "wrong")}
          onClick={() => onChoose(position, option.verdict)}
        >
          <Icon aria-hidden="true" />
          {option.label}
        </Button>
      );
    })}
  </div>
);

// Autovalutazione delle 6 domande: risposta, riferimento e scelta dell'esito
const AutovalutazioneProva = ({ exam, choices, busy, onChoose }) => (
  <section aria-labelledby="exam-self-grade-title" className="space-y-4">
    <h2 id="exam-self-grade-title" className="text-xl font-semibold">
      {LABELS.review}
    </h2>
    <p className="text-base leading-relaxed text-muted-foreground">{LABELS.selfGradeIntro}</p>
    {sortByPosition(exam.questions).map((question) => {
      const empty = isEmptyAnswer(question.answer);
      return (
        <article key={question.position} className="space-y-4 rounded-lg border p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-lg font-semibold">Domanda {question.position}</h3>
            {question.topic && <span className="text-sm text-muted-foreground">{question.topic.name}</span>}
          </div>
          <p className="whitespace-pre-wrap text-base leading-relaxed">{question.prompt}</p>
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-muted-foreground">{LABELS.yourAnswer}</p>
            <p className={`whitespace-pre-wrap text-base leading-relaxed ${empty ? "italic text-muted-foreground" : ""}`}>
              {empty ? SELF_GRADE_EMPTY_NOTE : answerText(question.answer)}
            </p>
          </div>
          <FeedbackBlock
            verdict={null}
            feedback={null}
            referenceAnswer={question.reference_answer}
            references={question.references}
            announce={false}
          />
          <SceltaDomanda
            position={question.position}
            value={choices[question.position]}
            empty={empty}
            disabled={busy}
            onChoose={onChoose}
          />
        </article>
      );
    })}
  </section>
);

// Prova consegnata senza voto: autovalutazione (SELF_GRADED) o attesa (GRADING),
// sempre con il nuovo tentativo di valutazione. Le scelte restano se un'azione fallisce
const RisultatoInAttesa = ({ exam, onUpdated, onRefresh }) => {
  const kind = pendingKind(exam);
  const [choices, setChoices] = useState(() => initialSelfGradeChoices(exam.questions));
  const [selfGradeError, setSelfGradeError] = useState("");
  const [regradeError, setRegradeError] = useState("");
  // Una sola azione alla volta: autovalutazione e nuova valutazione insieme
  // potrebbero mescolare i tentativi sul server
  const busyRef = useRef(false);

  const selfGrade = useMutation(selfGradeExam, { onSuccess: onUpdated });
  const regrade = useMutation(regradeExam, { onSuccess: onUpdated });
  const busy = selfGrade.isLoading || regrade.isLoading;

  const run = async (action) => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      await action();
    } finally {
      busyRef.current = false;
    }
  };

  const handleSelfGrade = () =>
    run(async () => {
      if (!canSubmitSelfGrade(choices)) return;
      setSelfGradeError("");
      setRegradeError("");
      try {
        await selfGrade.mutate(exam.id, buildSelfGradeVerdicts(choices));
      } catch (err) {
        setSelfGradeError(selfGradeErrorText(err));
      }
    });

  const handleRegrade = () =>
    run(async () => {
      setSelfGradeError("");
      setRegradeError("");
      try {
        await regrade.mutate(exam.id);
      } catch (err) {
        setRegradeError(regradeErrorText(err, exam.status));
      }
    });

  const handleChoose = (position, verdict) => setChoices((prev) => setSelfGradeChoice(prev, position, verdict));

  const regradeButton = (
    <Button variant="outline" className="h-11 px-4" disabled={busy} onClick={handleRegrade}>
      <RotateCcw />
      {LABELS.regrade}
    </Button>
  );

  if (kind === "grading") {
    return (
      <div className="space-y-4">
        <div role="status" aria-live="polite">
          <Loader text={regrade.isLoading ? LABELS.regrading : LABELS.gradingWait} />
        </div>
        <p className="text-base leading-relaxed text-muted-foreground">{LABELS.gradingHint}</p>
        <AlertMessage message={regradeError} />
        <div className="flex flex-wrap items-center gap-3">
          {regradeButton}
          <Button variant="outline" className="h-11 px-4" disabled={busy} onClick={onRefresh}>
            <RefreshCw />
            {LABELS.refresh}
          </Button>
          <Link to="/simulazione" className={linkClass}>
            {LABELS.backToStart}
          </Link>
        </div>
      </div>
    );
  }

  if (kind !== "self_grade") {
    return (
      <div className="space-y-4">
        <p className="text-base leading-relaxed">{PENDING_TEXT}</p>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" className="h-11 px-4" onClick={onRefresh}>
            <RefreshCw />
            {LABELS.refresh}
          </Button>
          <Link to="/simulazione" className={linkClass}>
            {LABELS.backToStart}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AutovalutazioneProva exam={exam} choices={choices} busy={busy} onChoose={handleChoose} />
      <AlertMessage message={selfGradeError || regradeError} />
      <div role="status" aria-live="polite">{regrade.isLoading && <Loader text={LABELS.regrading} />}</div>
      <div className="flex flex-wrap items-center gap-3">
        <Button className="h-11 px-4" disabled={!canSubmitSelfGrade(choices) || busy} onClick={handleSelfGrade}>
          <Send />
          {LABELS.sendSelfGrade}
        </Button>
        {regradeButton}
      </div>
    </div>
  );
};

const Risultato = ({ id }) => {
  const { data, isLoading, error, refetch } = useFetch(() => getExam(id), [id]);
  // Prova restituita da autovalutazione o nuova valutazione: nessun GET in più
  const [updated, setUpdated] = useState(null);
  const exam = updated ?? data;

  const handleRefresh = () => {
    setUpdated(null);
    refetch();
  };

  if (isLoading && !exam) return <Loader text={LABELS.loading} />;

  let content;
  if (error && !updated) {
    content = <ErroreRisultato message={error} onRetry={refetch} />;
  } else if (!exam) {
    return null;
  } else {
    const view = resultView(exam);
    // Prova ancora in corso: si torna alla prova
    if (view === "in_progress") return <Navigate replace to={`/simulazione/${id}`} />;
    content =
      view === "graded" ? (
        <RisultatoValutato exam={exam} focusGrade={updated !== null} />
      ) : (
        <RisultatoInAttesa key={exam.status} exam={exam} onUpdated={setUpdated} onRefresh={handleRefresh} />
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
