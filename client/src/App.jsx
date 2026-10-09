import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Login } from "./pages/Login.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { useTheme } from "./hooks/useTheme";
import { PrivateRoute } from "./components/PrivateRoute.jsx";
import { Home } from "./pages/Home.jsx";
import { AppLayout } from "./layouts/AppLayout.jsx";
import { ToastContainer } from "react-toastify";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NotFound } from "./pages/NotFound.jsx";
import { Domande } from "./pages/Domande.jsx";
import { Import } from "./pages/Import.jsx";

const queryClient = new QueryClient();

// Toast allineati al tema corrente (consuma useTheme, quindi vive dentro ThemeProvider).
function ThemedToastContainer() {
  const { isDark } = useTheme();
  return <ToastContainer theme={isDark ? "dark" : "light"} />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route element={<PrivateRoute />}>
                <Route element={<AppLayout />}>
                  <Route path="/" element={<Home />} />
                  <Route path="/domande" element={<Domande />} />
                  <Route path="/import" element={<Import />} />
                </Route>
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
        <ThemedToastContainer />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
