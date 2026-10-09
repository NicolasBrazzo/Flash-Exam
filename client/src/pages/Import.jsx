import { useRef, useState } from "react";
import { FileUp, Upload } from "lucide-react";
import { useMutation } from "@/hooks/useMutation";
import { importQuestions } from "@/services/importService";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  MAX_FILE_BYTES,
  parseImportText,
  summarizeImport,
} from "@/utils/importJson";

const LABELS = {
  json: "JSON dell'argomento",
  chooseFile: "Scegli un file .json",
  submit: "Importa",
  submitting: "Import in corso...",
  topic: "Argomento",
  inserted: "Domande inserite",
  skipped: "Domande ignorate (già presenti)",
};

const PLACEHOLDER = `{
  "topic": { "name": "..." },
  "questions": [ ... ]
}`;

// Errori uniti con "; " (errore locale, array del server) -> elenco
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

// Import del JSON di un argomento: da file (riempie la textarea) o incollato
export const Import = () => {
  const [text, setText] = useState("");
  const [localError, setLocalError] = useState(null);
  const [summary, setSummary] = useState(null);
  const fileInputRef = useRef(null);

  const mutation = useMutation(importQuestions, {
    onSuccess: (result) => setSummary(summarizeImport(result)),
  });

  // Ogni nuovo testo rende vecchi errori e riepilogo
  const clearResult = () => {
    setLocalError(null);
    setSummary(null);
    mutation.reset();
  };

  const handleTextChange = (e) => {
    setText(e.target.value);
    clearResult();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    // stesso file selezionabile di nuovo
    e.target.value = "";
    if (!file) return;
    clearResult();
    if (file.size > MAX_FILE_BYTES) {
      setLocalError("Il file è troppo grande: dividi l'argomento in più file");
      return;
    }
    try {
      setText(await file.text());
    } catch {
      setLocalError("Impossibile leggere il file");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (mutation.isLoading) return;
    clearResult();
    const parsed = parseImportText(text);
    if (!parsed.ok) {
      setLocalError(parsed.error);
      return;
    }
    try {
      await mutation.mutate(parsed.data);
    } catch {
      // l'errore resta in mutation.error ed è mostrato sotto
    }
  };

  const error = localError || mutation.error;

  return (
    <div className="space-y-4 px-6 py-6">
      <h1 className="text-2xl font-semibold">Import</h1>
      <p className="text-sm text-muted-foreground">
        Un file per argomento. Le domande già presenti nell'argomento vengono ignorate, quindi si può reimportare lo stesso file senza creare doppioni.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            type="button"
            variant="outline"
            className="h-11 px-4"
            onClick={() => fileInputRef.current?.click()}
            disabled={mutation.isLoading}
          >
            <FileUp />
            {LABELS.chooseFile}
          </Button>
          <span className="text-sm text-muted-foreground">oppure incolla il JSON qui sotto</span>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="import-json">{LABELS.json}</Label>
          <Textarea
            id="import-json"
            className="min-h-80 font-mono text-base"
            spellCheck={false}
            autoComplete="off"
            placeholder={PLACEHOLDER}
            value={text}
            readOnly={mutation.isLoading}
            onChange={handleTextChange}
          />
        </div>

        <ErrorList message={error} />

        {summary && (
          <div role="status" className="rounded-md border bg-muted/50 p-3 text-sm">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              <dt className="text-muted-foreground">{LABELS.topic}</dt>
              <dd>
                <span className="font-medium">{summary.topicName}</span> ({summary.topicStatus})
              </dd>
              <dt className="text-muted-foreground">{LABELS.inserted}</dt>
              <dd>{summary.inserted}</dd>
              <dt className="text-muted-foreground">{LABELS.skipped}</dt>
              <dd>{summary.skipped}</dd>
            </dl>
          </div>
        )}

        <div className="flex justify-end">
          <Button type="submit" className="h-11 px-4" disabled={mutation.isLoading}>
            <Upload />
            {mutation.isLoading ? LABELS.submitting : LABELS.submit}
          </Button>
        </div>
      </form>
    </div>
  );
};
