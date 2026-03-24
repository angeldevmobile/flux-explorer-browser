import { useContext } from "react";
import { AuthContext, type AuthContextType } from "@/contexts/auth-context";

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe ser usado dentro de AuthProvider");
  }
  return context;
};