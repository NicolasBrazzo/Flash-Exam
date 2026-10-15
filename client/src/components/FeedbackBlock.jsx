import { ArrowRight, CircleAlert, CircleCheck, CircleX } from "lucide-react";
import { formatReferences } from "@/utils/formatReferences";
import { verdictInfo } from "@/utils/flashcardSession";

const ICONS = { CircleCheck, CircleAlert, CircleX };

const TONES = {
  success: "border-emerald-600/40 bg-emerald-600/10 text-emerald-800 dark:text-emerald-300",
  warning: "border-amber-600/40 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  destructive: "border-destructive/40 bg-destructive/10 text-destructive",
};

const Section = ({ title, children }) => (
  <section className="space-y-1.5">
    <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
    {children}
  </section>
);

/**
 * Esito e correzione di una risposta (flashcard e revisione della simulazione).
 * Nessun voto né valore numerico: esito a parole, correzioni, suggerimento,
 * risposta esemplare, risposta di riferimento e riferimenti normativi.
 *
 * verdict          "correct" | "partial" | "wrong" | null (null: nessun esito)
 * feedback         { corrections, suggestion, exampleAnswer } | null
 * referenceAnswer  risposta di riferimento della domanda
 * references       numeri di articolo
 */
export const FeedbackBlock = ({ verdict, feedback, referenceAnswer, references }) => {
  const info = verdictInfo(verdict);
  const Icon = info ? ICONS[info.icon] : null;
  const corrections = feedback?.corrections ?? [];
  const suggestion = (feedback?.suggestion ?? "").trim();
  const exampleAnswer = (feedback?.exampleAnswer ?? "").trim();
  const refs = formatReferences(references);

  return (
    <div className="space-y-4 rounded-lg border bg-card p-4 text-base shadow-sm">
      {info && (
        <p role="status" className={`flex items-center gap-2 rounded-md border px-3 py-2 font-medium ${TONES[info.tone]}`}>
          <Icon className="size-5 shrink-0" aria-hidden="true" />
          {info.label}
        </p>
      )}

      {corrections.length > 0 && (
        <Section title="Terminologia da correggere">
          <ul className="space-y-2">
            {corrections.map((c, i) => (
              <li key={`${i}-${c.written}`} className="rounded-md bg-muted/50 px-3 py-2">
                <p className="flex flex-wrap items-center gap-2">
                  <del className="text-muted-foreground">{c.written}</del>
                  <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
                  <span className="sr-only">diventa</span>
                  <ins className="font-medium no-underline">{c.suggested}</ins>
                </p>
                {c.reason && <p className="mt-1 text-sm text-muted-foreground">{c.reason}</p>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {suggestion && (
        <Section title="Suggerimento">
          <p className="whitespace-pre-wrap">{suggestion}</p>
        </Section>
      )}

      {exampleAnswer && (
        <Section title="Risposta esemplare">
          <p className="whitespace-pre-wrap">{exampleAnswer}</p>
        </Section>
      )}

      {referenceAnswer && (
        <Section title="Risposta di riferimento">
          <p className="whitespace-pre-wrap">{referenceAnswer}</p>
        </Section>
      )}

      {refs && (
        <Section title="Riferimenti normativi">
          <p>{refs}</p>
        </Section>
      )}
    </div>
  );
};
