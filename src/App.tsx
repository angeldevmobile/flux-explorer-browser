import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth"; 
import { AuthProvider } from "@/contexts/AuthProvider";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { FavoritesProvider } from "@/contexts/FavoritesContext";
import { Toaster } from "@/components/ui/toaster";
import { BrowserWindow } from "@/components/browser/BrowserWindow";
import Login from "@/pages/Login";

function AppRoutes() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-400 flex items-center justify-center animate-pulse shadow-lg shadow-cyan-500/30">
            <span className="text-2xl font-bold text-white">O</span>
          </div>
          <p className="text-slate-400 text-sm">Cargando Flux...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          isAuthenticated ? <Navigate to="/browser" replace /> : <Login />
        }
      />
      <Route
        path="/browser"
        element={<BrowserWindow />}
      />
      <Route
        path="*"
        element={
          <Navigate to={isAuthenticated ? "/browser" : "/login"} replace />
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <FavoritesProvider>
            <AppRoutes />
            <Toaster />
          </FavoritesProvider>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
