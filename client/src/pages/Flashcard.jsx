import { useEffect, useRef, useState } from "react";
import { Check, Circle, Play, RotateCcw, Send } from "lucide-react";
import { useFetch } from "@/hooks/useFetch";
import { useMutation } from "@/hooks/useMutation";
import { getTopics } from "@/services/topicsService";
import { answerFlashcard, getFlashcards } from "@/services/flashcardsService";
import { FeedbackBlock } from "@/components/FeedbackBlock";
import Loader from "@/components/Loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_COUNT,
  MAX_ANSWER_LENGTH,
  MAX_COUNT,
  MIN_COUNT,
  canStart,
  isLastQuestion,
  parseCount,
  selectAll,
  sessionCounter,
  toggleTopic,
} from "@/utils/flashcardSession";

const LABELS = {
  title: "Flashcard",
  intro: "Scegli gli argomenti e quante domande vuoi. Dopo ogni risposta arriva subito la correzione: niente voto e niente timer.",
  topics: "Argomenti",
  all: "Tutti",
  none: "Nessuno",
  count: "Numero di domande",
  start: "Inizia",
  starting: "Preparazione...",
  noTopics: "Nessun argomento: importa prima le domande.",
  noQuestions: "Nessuna domanda disponibile per gli argomenti scelti.",
  retry: "Riprova",
  answer: "La tua risposta",
  send: "Invia",
  dontKnow: "Non so",
  grading: "Sto valutando la risposta",
  next: "Avanti",
  finish: "Termina",
  done: "Sessione terminata.",
  newSession: "Nuova sessione",
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

// Impostazione: argomenti (toggle da 44 px) e numero di domande
const ImpostazioneFlashcard = ({ selected, setSelected, countRaw, setCountRaw, onStart }) => {
  const { data: topics, isLoading, error, refetch } = useFetch(getTopics, []);
  const [notice, setNotice] = useState(null);
  const startingRef = useRef(false);

  const mutation = useMutation(getFlashcards, {
    onSuccess: (questions) => {
      if (questions.length === 0) setNotice(LABELS.noQuestions);
      else onStart(questions);
    },
  });

  const { error: countError } = parseCount(countRaw);
  // Gli argomenti senza domande non si possono scegliere
  const selectable = (topics ?? []).filter((topic) => topic.question_count > 0);

  const handleStart = async () => {
    if (startingRef.current || !canStart(selected, countRaw)) return;
    startingRef.current = true;
    setNotice(null);
    try {
      await mutation.mutate(selected, parseCount(countRaw).value);
    } catch {
      // l'errore resta in mutation.error ed è mostrato sotto
    } finally {
      startingRef.current = false;
    }
  };

  if (isLoading && !topics) return <Loader text="Caricamento degli argomenti" />;

  if (error) {
    return (
      <div className="space-y-3">
        <ErrorList message={error} />
        <Button variant="outline" className="h-11 px-4" onClick={refetch}>
          <RotateCcw />
          {LABELS.retry}
        </Button>
      </div>
    );
  }

  if (selectable.length === 0) {
    return <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground shadow-sm">{LABELS.noTopics}</p>;
  }

  return (
    <div className="space-y-6">
      <fieldset className="space-y-3">
        <legend className="mb-3 text-sm font-medium">{LABELS.topics}</legend>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="h-11 px-4" onClick={() => setSelected(selectAll(selectable))}>
              {LABELS.all}
            </Button>
            <Button type="button" variant="outline" className="h-11 px-4" onClick={() => setSelected([])}>
              {LABELS.none}
            </Button>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {(topics ?? []).map((topic) => {
            const pressed = selected.includes(topic.id);
            const disabled = topic.question_count === 0;
            const Icon = pressed ? Check : Circle;
            return (
              <button
                key={topic.id}
                type="button"
                aria-pressed={pressed}
                disabled={disabled}
                onClick={() => setSelected((prev) => toggleTopic(prev, topic.id))}
                className={[
                  "flex min-h-11 items-center gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                  pressed ? "border-primary bg-primary/10 font-medium" : "border-input bg-background",
                ].join(" ")}
              >
                <Icon className={`size-4 shrink-0 ${pressed ? "text-primary" : "text-muted-foreground"}`} aria-hidden="true" />
                <span className="flex-1">{topic.name}</span>
                <span className="text-xs text-muted-foreground">{topic.question_count} domande</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="max-w-xs space-y-1.5">
        <Label htmlFor="flashcard-count">{LABELS.count}</Label>
        <Input
          id="flashcard-count"
          type="number"
          inputMode="numeric"
          min={MIN_COUNT}
          max={MAX_COUNT}
          step={1}
          className="h-11 text-base"
          aria-invalid={countError ? true : undefined}
          aria-describedby={countError ? "flashcard-count-error" : undefined}
          value={countRaw}
          onChange={(e) => setCountRaw(e.target.value)}
        />
        {countError && (
          <p id="flashcard-count-error" className="text-sm text-destructive">
            {countError}
          </p>
        )}
      </div>

      {notice && <p className="rounded-md border bg-muted/50 p-3 text-sm">{notice}</p>}
      <ErrorList message={mutation.error} />

      <Button className="h-11 px-4" onClick={handleStart} disabled={!canStart(selected, countRaw) || mutation.isLoading}>
        <Play />
        {mutation.isLoading ? LABELS.starting : LABELS.start}
      </Button>
    </div>
  );
};

// Ciclo: una domanda per schermata, risposta, correzione, avanti
const SessioneFlashcard = ({ questions, onFinish }) => {
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [attempt, setAttempt] = useState(null);
  const sendingRef = useRef(false);
  const textareaRef = useRef(null);
  const nextRef = useRef(null);

  const mutation = useMutation(answerFlashcard, { onSuccess: setAttempt });
  const question = questions[index];
  const last = isLastQuestion(index, questions.length);
  const locked = mutation.isLoading || attempt !== null;

  // Arrivato l'esito, i pulsanti di invio spariscono: il focus va su "Avanti"
  useEffect(() => {
    if (attempt) nextRef.current?.focus();
  }, [attempt]);

  const send = async (text) => {
    if (sendingRef.current || attempt) return;
    sendingRef.current = true;
    try {
      await mutation.mutate(question.id, text);
    } catch {
      // l'errore resta in mutation.error; il testo resta nella textarea
    } finally {
      sendingRef.current = false;
    }
  };

  // "Non so": nessuna risposta (sbagliata d'ufficio sul server, D6)
  const handleDontKnow = () => {
    setAnswer("");
    send("");
  };

  const handleNext = () => {
    if (last) {
      onFinish();
      return;
    }
    mutation.reset();
    setAttempt(null);
    setAnswer("");
    setIndex((i) => i + 1);
    textareaRef.current?.focus();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-semibold" aria-live="polite">
          {sessionCounter(index, questions.length)}
        </h2>
        {question.topic && <span className="text-sm text-muted-foreground">{question.topic.name}</span>}
      </div>

      <p id="flashcard-question" className="whitespace-pre-wrap text-lg leading-relaxed">
        {question.prompt}
      </p>

      <div className="space-y-1.5">
        <label htmlFor="flashcard-answer" className="sr-only">
          {LABELS.answer}
        </label>
        <Textarea
          id="flashcard-answer"
          ref={textareaRef}
          aria-describedby="flashcard-question"
          className="min-h-48 text-base leading-relaxed"
          maxLength={MAX_ANSWER_LENGTH}
          readOnly={locked}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
        />
      </div>

      <ErrorList message={mutation.error} />

      {!attempt && (
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" className="h-11 px-4" onClick={handleDontKnow} disabled={mutation.isLoading}>
            {LABELS.dontKnow}
          </Button>
          <Button className="h-11 px-4" onClick={() => send(answer)} disabled={mutation.isLoading || answer.trim() === ""}>
            <Send />
            {LABELS.send}
          </Button>
        </div>
      )}

      {mutation.isLoading && <Loader text={LABELS.grading} />}

      {attempt && (
        <div className="space-y-4">
          {/* FLASH-5: con verdict null (AI non disponibile) qui va l'autovalutazione */}
          <FeedbackBlock
            verdict={attempt.verdict}
            feedback={attempt.feedback}
            referenceAnswer={attempt.reference_answer}
            references={attempt.references}
          />
          <div className="flex justify-end">
            <Button ref={nextRef} className="h-11 px-4" onClick={handleNext}>
              {last ? LABELS.finish : LABELS.next}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

// Ripasso libero con correzione immediata: impostazione -> ciclo -> fine
export const Flashcard = () => {
  const [phase, setPhase] = useState("setup");
  const [questions, setQuestions] = useState([]);
  const [sessionKey, setSessionKey] = useState(0);
  const [selected, setSelected] = useState([]);
  const [countRaw, setCountRaw] = useState(String(DEFAULT_COUNT));
  const newSessionRef = useRef(null);

  // A fine sessione il focus va su "Nuova sessione"
  useEffect(() => {
    if (phase === "done") newSessionRef.current?.focus();
  }, [phase]);

  const handleStart = (list) => {
    setQuestions(list);
    setSessionKey((k) => k + 1);
    setPhase("session");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{LABELS.title}</h1>
        {phase === "setup" && <p className="text-sm text-muted-foreground">{LABELS.intro}</p>}
      </div>

      {phase === "setup" && (
        <ImpostazioneFlashcard
          selected={selected}
          setSelected={setSelected}
          countRaw={countRaw}
          setCountRaw={setCountRaw}
          onStart={handleStart}
        />
      )}

      {phase === "session" && (
        <SessioneFlashcard key={sessionKey} questions={questions} onFinish={() => setPhase("done")} />
      )}

      {phase === "done" && (
        // FLASH-5: riepilogo sobrio (solo il numero di domande svolte) e "Home"
        <div className="space-y-4 rounded-lg border bg-card p-4 shadow-sm">
          <p>{LABELS.done}</p>
          <Button ref={newSessionRef} className="h-11 px-4" onClick={() => setPhase("setup")}>
            <RotateCcw />
            {LABELS.newSession}
          </Button>
        </div>
      )}
    </div>
  );
};
