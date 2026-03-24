import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from "react";
import { authService } from "@/services/api";
import { AuthContext } from "./auth-context";
import type { User } from "./auth-context";

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
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
    setUser(null);
  }, []);

  const updateUser = useCallback((data: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...data } : null));
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      loading,
      login,
      register,
      logout,
      updateUser,
    }),
    [user, loading, login, register, logout, updateUser]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};