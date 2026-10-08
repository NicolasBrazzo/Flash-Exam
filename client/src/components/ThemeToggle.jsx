import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "../hooks/useTheme";

// Controllo del tema riutilizzabile (Sidebar + pagine pubbliche).
// - default: icona Sole/Luna + Switch shadcn (versione compatta).
// - showLabel: aggiunge l'etichetta "Tema scuro" (Sidebar aperta).
// - showSwitch={false}: sola icona cliccabile (Sidebar collassata, dove lo
//   Switch non ci starebbe).
export const ThemeToggle = ({ showLabel = false, showSwitch = true, className }) => {
  const { isDark, toggleTheme } = useTheme();
  const Icon = isDark ? Moon : Sun;

  if (!showSwitch) {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        aria-label="Attiva tema scuro"
        className={cn(
          "flex cursor-pointer items-center text-muted-foreground transition-colors hover:text-foreground",
          className,
        )}
      >
        <Icon aria-hidden="true" className="w-5 h-5 shrink-0" />
      </button>
    );
  }

  // Con l'etichetta la riga intera è un <label>: il tocco sul testo aziona lo
  // Switch, così il target non si riduce al solo interruttore (iPad)
  const Wrapper = showLabel ? "label" : "div";

  return (
    <Wrapper className={cn("flex items-center gap-3", showLabel && "cursor-pointer", className)}>
      <span className="flex items-center gap-3 text-muted-foreground">
        <Icon aria-hidden="true" className="w-5 h-5 shrink-0" />
        {showLabel && (
          <span className="overflow-hidden whitespace-nowrap text-sm">Tema scuro</span>
        )}
      </span>
      <Switch
        checked={isDark}
        onCheckedChange={toggleTheme}
        aria-label="Attiva tema scuro"
      />
    </Wrapper>
  );
};
