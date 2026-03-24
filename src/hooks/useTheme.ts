import { useContext } from "react";
import { ThemeContext, type ThemeContextType, type ThemeColors } from "@/contexts/theme-definitions";

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme debe ser usado dentro de ThemeProvider");
  }
  return context;
};

export const useColors = (): ThemeColors => {
  const { colors } = useTheme();
  return colors;
};