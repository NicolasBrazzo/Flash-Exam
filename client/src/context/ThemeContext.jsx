import { createContext, useContext, useLayoutEffect, useState } from "react";

const ThemeContext = createContext(null);

// Chiave in localStorage e classe applicata su <html> (allineata al blocco
// `.dark` e al @custom-variant di index.css).
const STORAGE_KEY = "theme";

export const ThemeProvider = ({ children }) => {
  // Default "light" salvo scelta salvata dall'utente: NON legge la
  // preferenza di sistema (scelta di progetto).
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || "light";
    } catch {
      return "light";
    }
  });

  // Applica la classe su <html> e persiste. useLayoutEffect riduce il flash.
  useLayoutEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // localStorage non disponibile: il tema resta comunque applicato in memoria
    }
  }, [theme]);

  const toggleTheme = () =>
    setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <ThemeContext.Provider
      value={{ theme, isDark: theme === "dark", toggleTheme, setTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
