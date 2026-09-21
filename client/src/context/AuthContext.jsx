import { createContext, useContext, useEffect, useState } from "react";
import api from "../api/client";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  // Valida il token salvato chiedendo al backend i dati dell'utente
  const checkAuth = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const res = await api.get("/auth/me");
      if (res.data.user) {
        const u = res.data.user;
        setUser({
          id: u.sub,
          email: u.email,
          firstName: u.first_name,
          lastName: u.last_name,
        });
      } else {
        localStorage.removeItem("token");
        setUser(null);
      }
    } catch (err) {
      console.error("Auth check failed:", err);
      localStorage.removeItem("token");
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (credentials) => {
    try {
      const res = await api.post("/auth/login", credentials);
      if (res.data.ok && res.data.token) {
        localStorage.setItem("token", res.data.token);
        await checkAuth();
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

export const useAuth = () => useContext(AuthContext);
