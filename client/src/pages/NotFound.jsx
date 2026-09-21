import { useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Home } from "lucide-react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { Button } from "@/components/ui/button";
import { useAuth } from "../context/AuthContext";
import { APP_NAME, APP_LOGO, HOME, NOT_FOUND } from "../constants/app";

gsap.registerPlugin(useGSAP);

// Pagina 404 (rotta catch-all "*"): intercetta gli URL non gestiti e riporta
// l'utente in carreggiata. I testi vivono in src/constants/app.js (NOT_FOUND);
// lo stile riusa i token shadcn condivisi del gestionale in light mode.
// L'animazione d'ingresso gira solo se l'utente non ha chiesto "riduci movimento".
export const NotFound = () => {
  const scope = useRef(null);
  const { user } = useAuth();

  // Bottone secondario coerente con la HomePage: se loggato porta alla
  // dashboard, altrimenti al login.
  const authTo = user ? "/dashboard" : "/login";

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const tl = gsap.timeline({ defaults: { ease: "power4.out" } });

        tl.from(".js-404", { yPercent: 20, autoAlpha: 0, filter: "blur(12px)", duration: 0.9 })
          .from(".js-title", { y: 24, autoAlpha: 0, duration: 0.7 }, "-=0.5")
          .from(".js-sub", { y: 16, autoAlpha: 0, duration: 0.6 }, "-=0.45")
          .from(".js-cta-row > *", { y: 14, autoAlpha: 0, duration: 0.5, stagger: 0.1 }, "-=0.35");
      });
    },
    { scope }
  );

  return (
    // La pagina usa i token shadcn condivisi del gestionale in light mode
    // (nessuna classe "dark", nessuna palette a parte).
    <div
      ref={scope}
      className="relative flex min-h-screen flex-col overflow-hidden bg-background text-foreground"
    >
      <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between px-6 pt-5">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary font-data text-xs font-semibold text-primary-foreground">
            {APP_LOGO}
          </span>
          <span className="text-sm font-semibold tracking-tight">{APP_NAME}</span>
        </Link>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 pb-16 text-center">
        {/* Grande numero decorativo: font display, gradiente sui token. */}
        <span
          aria-hidden="true"
          className="js-404 bg-linear-to-b from-foreground to-foreground/40 bg-clip-text font-display text-[clamp(6rem,22vw,12rem)] font-bold leading-none tracking-tight text-transparent"
        >
          {NOT_FOUND.code}
        </span>

        {/* Le regole globali h2 di index.css (24px/700) stanno fuori dai layer
            e vincono sulle utility Tailwind: per questo size e peso usano "!". */}
        <h2 className="js-title mt-6 font-sans text-3xl! font-semibold! tracking-tight">
          {NOT_FOUND.title}
        </h2>

        <p className="js-sub mx-auto mt-4 max-w-md text-lg leading-relaxed text-muted-foreground">
          {NOT_FOUND.subtitle}
        </p>

        <div className="js-cta-row mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" className="h-11 px-6 shadow-md">
            <Link to="/">
              <Home aria-hidden="true" />
              {NOT_FOUND.ctaHome}
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="h-11 px-6">
            <Link to={authTo}>
              {user ? HOME.ctaLogged : HOME.ctaPrimary}
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </main>
    </div>
  );
};
