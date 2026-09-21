import { BrowserRouter, Route, Routes } from "react-router-dom";
import { HomePage } from "./pages/HomePage.jsx";
import { Login } from "./pages/Login.jsx";
import { Register } from "./pages/Register.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { ThemeProvider, useTheme } from "./context/ThemeContext.jsx";
import { PrivateRoute } from "./components/PrivateRoute.jsx";
import { Dashboard } from "./pages/Dashboard.jsx";
import { AppLayout } from "./layouts/AppLayout.jsx";
import { ToastContainer } from "react-toastify";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Users } from "./pages/Users.jsx";
import { NotFound } from "./pages/NotFound.jsx";

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
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route element={<PrivateRoute />}>
                <Route element={<AppLayout />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/users" element={<Users />} />
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
