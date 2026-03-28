import { useState, useEffect, useCallback, useMemo, ReactNode } from "react";
import { favoriteService } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  FavoritesContext,
  extractApiError,
  type Favorite,
} from "./definitions-favorite";

export const FavoritesProvider = ({ children }: { children: ReactNode }) => {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { isAuthenticated, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await favoriteService.getFavorites();
        if (!cancelled) {
          setFavorites(data.map((f) => ({ id: f.id, title: f.title, url: f.url, icon: f.icon || undefined })));
        }
      } catch {
        // silencioso
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, authLoading]);

  const addFavorite = useCallback(async (favorite: Omit<Favorite, "id">) => {
    try {
      const saved = await favoriteService.addFavorite(favorite);
      setFavorites((prev) => [...prev, { id: saved.id, title: saved.title, url: saved.url, icon: saved.icon || undefined }]);
    } catch (error) {
      toast({ title: "Error", description: extractApiError(error, "No se pudo guardar el favorito"), variant: "destructive" });
    }
  }, [toast]);

  const removeFavorite = useCallback(async (id: string) => {
    setFavorites((f) => f.filter((fav) => fav.id !== id));
    try {
      await favoriteService.deleteFavorite(id);
    } catch (error) {
      toast({ title: "Error", description: extractApiError(error, "No se pudo eliminar el favorito"), variant: "destructive" });
    }
  }, [toast]);

  const isFavorite = useCallback((url: string) => favorites.some((f) => f.url === url), [favorites]);
  const getFavoriteByUrl = useCallback((url: string) => favorites.find((f) => f.url === url), [favorites]);

  const value = useMemo(() => ({
    favorites, addFavorite, removeFavorite, isFavorite, getFavoriteByUrl, loading, count: favorites.length,
  }), [favorites, addFavorite, removeFavorite, isFavorite, getFavoriteByUrl, loading]);

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
};
