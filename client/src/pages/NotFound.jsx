import { Link } from "react-router-dom";
import { Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_NAME, APP_LOGO, NOT_FOUND } from "../constants/app";

// Pagina 404 (rotta catch-all "*"): intercetta gli URL non gestiti e riporta
// l'utente in carreggiata. I testi vivono in src/constants/app.js (NOT_FOUND);
// lo stile riusa i token shadcn condivisi con il resto del sito.
export const NotFound = () => {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="mx-auto flex w-full max-w-5xl items-center px-6 pt-5">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary font-data text-xs font-semibold text-primary-foreground">
            {APP_LOGO}
          </span>
          <span className="text-sm font-semibold tracking-tight">{APP_NAME}</span>
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 pb-16 text-center">
        <span
          aria-hidden="true"
          className="font-display text-[clamp(4rem,16vw,9rem)] font-bold leading-none tracking-tight text-muted-foreground"
        >
          {NOT_FOUND.code}
        </span>

        {/* Le regole globali h2 di index.css (24px/700) stanno fuori dai layer
            e vincono sulle utility Tailwind: per questo size e peso usano "!". */}
        <h2 className="mt-6 font-sans text-3xl! font-semibold! tracking-tight">
          {NOT_FOUND.title}
        </h2>

        <p className="mx-auto mt-4 max-w-md text-lg leading-relaxed text-muted-foreground">
          {NOT_FOUND.subtitle}
        </p>

        <Button asChild size="lg" className="mt-8 h-11 px-6">
          <Link to="/">
            <Home aria-hidden="true" />
            {NOT_FOUND.ctaHome}
          </Link>
        </Button>
      </main>
    </div>
  );
};
