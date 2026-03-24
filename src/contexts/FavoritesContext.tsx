import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from "react";
import { favoriteService, authService } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import {
  FavoritesContext,
  extractApiError,
  type Favorite,
} from "./definitions-favorite";

export const FavoritesProvider = ({ children }: { children: ReactNode }) => {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!authService.isAuthenticated()) return;

    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const data = await favoriteService.getFavorites();
        if (!cancelled) {
          setFavorites(
            data.map((fav) => ({
              id: fav.id,
              title: fav.title,
              url: fav.url,
              icon: fav.icon || undefined,
            }))
          );
        }
      } catch {
        // silencioso en carga inicial
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  const addFavorite = useCallback(async (favorite: Omit<Favorite, "id">) => {
    if (!authService.isAuthenticated()) {
      toast({
        title: "Inicia sesión",
        description: "Necesitas una cuenta para guardar favoritos",
        variant: "destructive",
      });
      return;
    }

    try {
      const newFav = await favoriteService.addFavorite(favorite);
      setFavorites((prev) => [
        ...prev,
        {
          id: newFav.id,
          title: newFav.title,
          url: newFav.url,
          icon: newFav.icon || undefined,
        },
      ]);
      toast({ title: "⭐ Favorito guardado" });
    } catch (error) {
      toast({
        title: "Error",
        description: extractApiError(error, "No se pudo agregar el favorito"),
        variant: "destructive",
      });
    }
  }, [toast]);

  const removeFavorite = useCallback(async (id: string) => {
    const prev = favorites;
    setFavorites((f) => f.filter((fav) => fav.id !== id));

    try {
      await favoriteService.deleteFavorite(id);
    } catch (error) {
      setFavorites(prev);
      toast({
        title: "Error",
        description: extractApiError(error, "No se pudo eliminar el favorito"),
        variant: "destructive",
      });
    }
  }, [favorites, toast]);

  const isFavorite = useCallback(
    (url: string) => favorites.some((f) => f.url === url),
    [favorites]
  );

  const getFavoriteByUrl = useCallback(
    (url: string) => favorites.find((f) => f.url === url),
    [favorites]
  );

  const value = useMemo(
    () => ({
      favorites,
      addFavorite,
      removeFavorite,
      isFavorite,
      getFavoriteByUrl,
      loading,
      count: favorites.length,
    }),
    [favorites, addFavorite, removeFavorite, isFavorite, getFavoriteByUrl, loading]
  );

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
};
