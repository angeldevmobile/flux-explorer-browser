import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from "react";
import { authService } from "@/services/api";
import { AuthContext } from "./auth-context";
import type { User } from "./auth-context";

const GUEST_KEY = "flux_guest_mode";

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isGuest, setIsGuest] = useState(() => localStorage.getItem(GUEST_KEY) === "1");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      if (!authService.isAuthenticated()) {
        setLoading(false);
        return;
      }

      try {
        const response = await authService.getCurrentUser();
        setUser(response.data);
      } catch {
        authService.logout();
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await authService.login({ email, password });
    setUser(response.data.user);
  }, []);

  const register = useCallback(
    async (email: string, password: string, username: string) => {
      const response = await authService.register({ email, password, username });
      setUser(response.data.user);
    },
    []
  );

  const logout = useCallback(() => {
    authService.logout();
    localStorage.removeItem(GUEST_KEY);
    setUser(null);
    setIsGuest(false);
  }, []);

  const updateUser = useCallback((data: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...data } : null));
  }, []);

  const enterGuestMode = useCallback(() => {
    localStorage.setItem(GUEST_KEY, "1");
    setIsGuest(true);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      isGuest,
      loading,
      login,
      register,
      logout,
      updateUser,
      enterGuestMode,
    }),
    [user, isGuest, loading, login, register, logout, updateUser, enterGuestMode]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};