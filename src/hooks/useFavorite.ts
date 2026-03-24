import { useContext } from "react";
import { FavoritesContext, type FavoritesContextType } from "@/contexts/definitions-favorite";

export const useFavorites = (): FavoritesContextType => {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error("useFavorites debe ser usado dentro de FavoritesProvider");
  }
  return context;
};