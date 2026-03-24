import { createContext } from "react";

export interface Favorite {
  id: string;
  title: string;
  url: string;
  icon?: string;
}

export interface FavoritesContextType {
  favorites: Favorite[];
  addFavorite: (favorite: Omit<Favorite, "id">) => Promise<void>;
  removeFavorite: (id: string) => Promise<void>;
  isFavorite: (url: string) => boolean;
  getFavoriteByUrl: (url: string) => Favorite | undefined;
  loading: boolean;
  count: number;
}

export const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

export function extractApiError(error: unknown, fallback: string): string {
  if (
    error &&
    typeof error === "object" &&
    "response" in error &&
    error.response &&
    typeof error.response === "object" &&
    "data" in error.response &&
    error.response.data &&
    typeof error.response.data === "object" &&
    "error" in error.response.data
  ) {
    return (error.response as { data: { error: string } }).data.error || fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}