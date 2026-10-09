import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Play,
  RotateCcw,
} from "lucide-react";
import { useFetch } from "@/hooks/useFetch";
import { useMutation } from "@/hooks/useMutation";
import {
  getExam,
  saveDraft,
  saveDraftKeepalive,
  startExam,
} from "@/services/examService";
import Loader from "@/components/Loader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DRAFT_DEBOUNCE_MS,
  MAX_ANSWER_LENGTH,
  aggregateSaveStatus,
  answersFromExam,
  dirtyPositions,
  isClosedError,
  needsSave,
  questionCounter,
  retryDelay,
  saveStatusText,
} from "@/utils/examDraft";
import { showInfo } from "@/utils/toast";

const LABELS = {
  title: "Simulazione",
  start: "Inizia la simulazione",
  starting: "Avvio in corso...",
  loading: "Caricamento della prova",
  retry: "Riprova",
  backToStart: "Torna all'avvio",
  previous: "Precedente",
  next: "Successiva",
  answer: "La tua risposta",
  questionsNav: "Domande della prova",
  goToResult: "Vai al risultato",
};

// Errori uniti con "; " -> elenco
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

// Avvio: testo sobrio e un solo pulsante
const AvvioSimulazione = () => {
  const navigate = useNavigate();
  // Guardia sul doppio click nello stesso istante (oltre al pulsante disabilitato)
  const startingRef = useRef(false);

  const mutation = useMutation(startExam, {
    onSuccess: ({ exam, resumed }) => {
      if (resumed) showInfo("Hai una prova in corso: l'ho ripresa");
      navigate(`/simulazione/${exam.id}`);
    },
  });

  const handleStart = async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    try {
      await mutation.mutate();
    } catch {
      // l'errore resta in mutation.error ed è mostrato sotto
    } finally {
      startingRef.current = false;
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-6 py-6">
      <h1 className="text-2xl font-semibold">{LABELS.title}</h1>
      <div className="space-y-3 text-base leading-relaxed">
        <p>Sei domande estratte a caso tra tutti gli argomenti, 40 minuti per l'intera prova.</p>
        <p className="text-muted-foreground">
          Puoi spostarti liberamente tra le domande e le risposte si salvano da sole. Nessun feedback durante la prova: la valutazione arriva dopo la consegna.
        </p>
      </div>
      <ErrorList message={mutation.error} />
      <Button className="h-11 px-4" onClick={handleStart} disabled={mutation.isLoading}>
        <Play />
        {mutation.isLoading ? LABELS.starting : LABELS.start}
      </Button>
    </div>
  );
};

// Una domanda per schermata (D3), con salvataggio in bozza che non interrompe
// la scrittura: una sola textarea sempre montata, stato dei salvataggi nei ref
const ProvaDomande = ({ exam }) => {
  const examId = exam.id;
  const questions = [...exam.questions].sort((a, b) => a.position - b.position);

  const [answers, setAnswers] = useState(() => answersFromExam(exam));
  const [current, setCurrent] = useState(0);
  const [saveStatus, setSaveStatus] = useState("idle");
  const [closedMessage, setClosedMessage] = useState("");

  // Testo corrente, ultimo salvato, in volo, timer, tentativi falliti
  const answersRef = useRef(null);
  const savedRef = useRef(null);
  if (answersRef.current === null) answersRef.current = answersFromExam(exam);
  if (savedRef.current === null) savedRef.current = answersFromExam(exam);
  const inFlightRef = useRef({});
  const timersRef = useRef({});
  const failedRef = useRef({});
  const closedRef = useRef(false);
  const everSavedRef = useRef(false);
  // Pagina smontata: nessun nuovo timer né tentativo (un salvataggio in volo
  // può terminare dopo l'uscita dalla pagina)
  const stoppedRef = useRef(false);

  const { mutate: saveMutate } = useMutation(saveDraft);

  const refreshStatus = () => {
    const next = aggregateSaveStatus({
      inFlightCount: Object.keys(inFlightRef.current).length,
      failedCount: Object.values(failedRef.current).filter((n) => n > 0).length,
      dirtyCount: dirtyPositions(answersRef.current, savedRef.current).length,
      closed: closedRef.current,
      everSaved: everSavedRef.current,
    });
    setSaveStatus(next);
  };

  const clearTimer = (position) => {
    clearTimeout(timersRef.current[position]);
    delete timersRef.current[position];
  };

  const schedule = (position, delay) => {
    clearTimer(position);
    if (stoppedRef.current) return;
    timersRef.current[position] = setTimeout(() => save(position), delay);
  };

  const save = async (position) => {
    clearTimer(position);
    if (closedRef.current || stoppedRef.current) return;
    const text = answersRef.current[position];
    // Un solo salvataggio alla volta per posizione: alla fine si ricontrolla
    if (inFlightRef.current[position] !== undefined) return;
    if (!needsSave(text, savedRef.current[position], undefined)) {
      refreshStatus();
      return;
    }

    inFlightRef.current[position] = text;
    refreshStatus();
    try {
      await saveMutate(examId, position, text);
      savedRef.current[position] = text;
      failedRef.current[position] = 0;
      everSavedRef.current = true;
    } catch (err) {
      if (isClosedError(err)) {
        // Prova consegnata o scaduta: niente più salvataggi né tentativi
        closedRef.current = true;
        Object.keys(timersRef.current).forEach((p) => clearTimer(p));
        setClosedMessage(err.message);
      } else {
        failedRef.current[position] = (failedRef.current[position] ?? 0) + 1;
        schedule(position, retryDelay(failedRef.current[position]));
      }
    } finally {
      delete inFlightRef.current[position];
      const changed = answersRef.current[position] !== savedRef.current[position];
      if (!closedRef.current && changed && !timersRef.current[position]) {
        schedule(position, DRAFT_DEBOUNCE_MS);
      }
      refreshStatus();
    }
  };

  const question = questions[current];
  const position = question.position;

  const handleChange = (e) => {
    const value = e.target.value;
    answersRef.current = { ...answersRef.current, [position]: value };
    setAnswers(answersRef.current);
    if (closedRef.current) return;
    schedule(position, DRAFT_DEBOUNCE_MS);
    refreshStatus();
  };

  // Cambio domanda: la risposta lasciata si salva subito
  const goTo = (index) => {
    if (index === current || index < 0 || index >= questions.length) return;
    save(position);
    setCurrent(index);
  };

  // Scheda in background, pagina che si chiude o navigazione altrove: le
  // risposte non ancora salvate partono con fetch keepalive
  useEffect(() => {
    const timers = timersRef.current;
    stoppedRef.current = false;
    // Invio idempotente: una risposta inviata due volte (visibilitychange e poi
    // pagehide) non fa danni
    const sendDirty = (track) => {
      if (closedRef.current) return;
      for (const p of dirtyPositions(answersRef.current, savedRef.current)) {
        const text = answersRef.current[p];
        saveDraftKeepalive(examId, p, text).then((ok) => {
          if (ok && track && answersRef.current[p] === text) savedRef.current[p] = text;
        });
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") sendDirty(true);
    };
    const handlePageHide = () => sendDirty(false);

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeunload", handlePageHide);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", handlePageHide);
      stoppedRef.current = true;
      Object.values(timers).forEach((t) => clearTimeout(t));
      sendDirty(false);
    };
  }, [examId]);

  const statusText = saveStatusText(saveStatus, closedMessage);
  const StatusIcon =
    saveStatus === "saved" ? Check
    : saveStatus === "saving" ? Loader2
    : saveStatus === "error" || saveStatus === "closed" ? AlertCircle
    : null;

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-6 py-6">
      {/* PROVA-7: timer e pulsante Consegna qui */}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-semibold">{questionCounter(current, questions.length)}</h1>
        {question.topic && <span className="text-sm text-muted-foreground">{question.topic.name}</span>}
      </div>

      <p id="exam-question" className="whitespace-pre-wrap text-lg leading-relaxed">
        {question.prompt}
      </p>

      <div className="space-y-2">
        <label htmlFor="exam-answer" className="sr-only">
          {LABELS.answer}
        </label>
        <Textarea
          id="exam-answer"
          aria-describedby="exam-question"
          className="min-h-64 text-base leading-relaxed"
          maxLength={MAX_ANSWER_LENGTH}
          value={answers[position]}
          onChange={handleChange}
        />
        <p
          role="status"
          aria-live="polite"
          className={`flex min-h-6 items-center gap-1.5 text-sm ${saveStatus === "closed" ? "text-destructive" : "text-muted-foreground"}`}
        >
          {StatusIcon && <StatusIcon className={`size-4 ${saveStatus === "saving" ? "animate-spin" : ""}`} />}
          <span>{statusText}</span>
          {saveStatus === "closed" && (
            <Link to={`/simulazione/${examId}/risultato`} className="ml-2 underline">
              {LABELS.goToResult}
            </Link>
          )}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" className="h-11 px-4" disabled={current === 0} onClick={() => goTo(current - 1)}>
          <ChevronLeft />
          {LABELS.previous}
        </Button>
        <nav aria-label={LABELS.questionsNav} className="flex flex-wrap gap-2">
          {questions.map((q, i) => {
            const written = answers[q.position].trim() !== "";
            const isCurrent = i === current;
            return (
              <button
                key={q.position}
                type="button"
                onClick={() => goTo(i)}
                aria-current={isCurrent ? "step" : undefined}
                aria-label={written ? `Domanda ${q.position}, risposta scritta` : `Domanda ${q.position}`}
                className={[
                  "relative inline-flex size-11 items-center justify-center rounded-full border text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  written ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background text-foreground",
                  isCurrent ? "ring-2 ring-ring ring-offset-2 ring-offset-background" : "",
                ].join(" ")}
              >
                {q.position}
                {written && <Check className="absolute -right-0.5 -top-0.5 size-3.5 rounded-full bg-background text-primary" />}
              </button>
            );
          })}
        </nav>
        <Button
          variant="outline"
          className="h-11 px-4"
          disabled={current === questions.length - 1}
          onClick={() => goTo(current + 1)}
        >
          {LABELS.next}
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
};

// Prova: caricata dal server; se è già consegnata si va al risultato
const ProvaInCorso = ({ id }) => {
  const { data, isLoading, error, refetch } = useFetch(() => getExam(id), [id]);

  if (isLoading && !data) return <Loader text={LABELS.loading} />;

  if (error) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-6 py-6">
        <h1 className="text-2xl font-semibold">{LABELS.title}</h1>
        <ErrorList message={error} />
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" className="h-11 px-4" onClick={refetch}>
            <RotateCcw />
            {LABELS.retry}
          </Button>
          <Link to="/simulazione" className="inline-flex min-h-11 items-center px-2 text-sm underline">
            {LABELS.backToStart}
          </Link>
        </div>
      </div>
    );
  }

  if (!data) return null;

  if (data.status !== "IN_PROGRESS") {
    return <Navigate replace to={`/simulazione/${id}/risultato`} />;
  }

  return <ProvaDomande exam={data} />;
};

// /simulazione (avvio) e /simulazione/:id (prova)
export const Simulazione = () => {
  const { id } = useParams();
  return id ? <ProvaInCorso key={id} id={id} /> : <AvvioSimulazione />;
};
