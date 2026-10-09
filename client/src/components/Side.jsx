import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { BookOpen, ClipboardList, FileUp, House, LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { APP_NAME, APP_LOGO } from "../constants/app";
import { ThemeToggle } from "./ThemeToggle";

// Voci di menu: aggiungere qui le pagine delle risorse del progetto.
const MENU_ITEMS = [
  { icon: House, label: "Home", path: "/" },
  { icon: BookOpen, label: "Domande", path: "/domande" },
  { icon: FileUp, label: "Import", path: "/import" },
  { icon: ClipboardList, label: "Simulazione", path: "/simulazione" },
];

// Stile comune delle righe cliccabili (voci, toggle, logout): altezza 44px,
// target di tocco comodo anche su iPad
const ROW_CLASS =
  "flex w-full cursor-pointer items-center gap-3 px-4 py-3 transition-colors";
const ROW_IDLE_CLASS =
  "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground";

export const Sidebar = () => {
  // Due sorgenti di apertura: il passaggio del mouse (solo con un mouse vero)
  // e il pulsante esplicito, l'unico modo di aprirla al tocco
  const [isHovered, setIsHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const { logout } = useAuth();

  const isOpen = isHovered || isPinned;

  const close = () => {
    setIsPinned(false);
    setIsHovered(false);
  };

  const toggle = () => {
    if (isOpen) close();
    else setIsPinned(true);
  };

  // Su iPad il tocco genera anche eventi mouse emulati: filtrando sul tipo di
  // puntatore, l'apertura in hover resta solo per mouse e trackpad
  const handlePointerEnter = (e) => {
    if (e.pointerType === "mouse") setIsHovered(true);
  };
  const handlePointerLeave = (e) => {
    if (e.pointerType === "mouse") setIsHovered(false);
  };

  // Esc chiude la sidebar aperta con il pulsante
  useEffect(() => {
    if (!isPinned) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setIsPinned(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isPinned]);

  const ToggleIcon = isOpen ? PanelLeftClose : PanelLeftOpen;

  return (
    <>
      {/* Sfondo cliccabile: con la sidebar aperta dal pulsante, un tocco fuori la chiude */}
      {isPinned && (
        <div
          aria-hidden="true"
          onClick={() => setIsPinned(false)}
          className="fixed inset-0 z-40 bg-black/20"
        />
      )}

      <aside
        className={[
          "fixed left-0 top-0 z-50 flex h-full flex-col bg-sidebar",
          "transition-all duration-300 ease-in-out border-r border-sidebar-border",
          isOpen ? "w-64" : "w-16",
        ].join(" ")}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
      >
        <div className="flex h-16 items-center border-b border-sidebar-border px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-sidebar-primary">
              <span className="text-sidebar-primary-foreground font-bold text-lg">
                {APP_LOGO}
              </span>
            </div>
            {isOpen && (
              <div className="flex items-center gap-2 overflow-hidden">
                <span className="text-sidebar-foreground text-sm font-medium whitespace-nowrap">
                  {APP_NAME}
                </span>
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={toggle}
          aria-expanded={isOpen}
          aria-label={isOpen ? "Chiudi menu" : "Apri menu"}
          className={`${ROW_CLASS} ${ROW_IDLE_CLASS} mt-2`}
        >
          <ToggleIcon className="w-5 h-5 shrink-0" />
          {isOpen && (
            <span className="overflow-hidden whitespace-nowrap text-sm">
              Chiudi menu
            </span>
          )}
        </button>

        <nav className="py-2">
          {MENU_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end
              onClick={() => setIsPinned(false)}
              className={({ isActive }) =>
                [
                  ROW_CLASS,
                  isActive ?
                    "bg-sidebar-accent text-sidebar-accent-foreground"
                  : ROW_IDLE_CLASS,
                ].join(" ")
              }
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {isOpen && (
                <span className="overflow-hidden whitespace-nowrap text-sm">
                  {item.label}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto border-t border-sidebar-border py-4">
          {/* Toggle tema: Switch con etichetta da aperta, sola icona da collassata.
              In entrambi i casi l'area di tocco è l'intera riga */}
          {isOpen ?
            <ThemeToggle
              showLabel
              className="w-full justify-between px-4 py-3 text-sidebar-foreground"
            />
          : <ThemeToggle showSwitch={false} className={`${ROW_CLASS} ${ROW_IDLE_CLASS}`} />}
          <button
            type="button"
            onClick={() => logout()}
            className={`${ROW_CLASS} ${ROW_IDLE_CLASS}`}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {isOpen && (
              <span className="overflow-hidden whitespace-nowrap text-sm">
                Logout
              </span>
            )}
          </button>
        </div>
      </aside>
    </>
  );
};
