import { createRoot } from "react-dom/client";
import { ThemeProvider } from "./contexts/ThemeContext";
import { FavoritesProvider } from "./contexts/FavoritesContext";
import { SettingsProvider } from "./contexts/SettingsContext";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <SettingsProvider>
      <FavoritesProvider>
        <App />
      </FavoritesProvider>
    </SettingsProvider>
  </ThemeProvider>
);
