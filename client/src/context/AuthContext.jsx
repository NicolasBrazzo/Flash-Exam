import { useEffect, useState } from "react";
import api from "../api/client";
import { AuthContext } from "./authContext";

const hasToken = () => !!localStorage.getItem("token");

// Valida il token salvato chiedendo al backend i dati dell'utente.
// Restituisce l'utente oppure null (e in quel caso rimuove il token).
const fetchCurrentUser = async () => {
  try {
    const res = await api.get("/auth/me");
    if (res.data.user) {
      const u = res.data.user;
      return {
        id: u.sub,
        email: u.email,
        firstName: u.first_name,
        lastName: u.last_name,
      };
    }
  } catch (err) {
    console.error("Auth check failed:", err);
  }
  localStorage.removeItem("token");
  return null;
};

export const AuthProvider = ({ children }) => {
  // Senza token non c'e' nulla da validare: si parte gia' da "non autenticato".
  const [user, setUser] = useState(() => (hasToken() ? undefined : null));
  const [loading, setLoading] = useState(hasToken);

  useEffect(() => {
    if (!hasToken()) return;
    let cancelled = false;
    fetchCurrentUser().then((u) => {
      if (cancelled) return;
      setUser(u);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (credentials) => {
    try {
      const res = await api.post("/auth/login", credentials);
      if (res.data.ok && res.data.token) {
        localStorage.setItem("token", res.data.token);
        setUser(await fetchCurrentUser());
        return { ok: true, message: "Login success" };
      }
      return { ok: false, message: res.data?.error || "Login failed" };
    } catch (err) {
      return { ok: false, message: err.message };
    }
  };

  // Logout solo lato client: il token JWT è stateless, basta rimuoverlo.
  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
