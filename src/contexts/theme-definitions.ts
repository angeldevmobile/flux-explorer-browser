import { createContext } from "react";

/* ═══════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════ */

export type ThemeId =
  | "midnight"
  | "aurora"
  | "ocean"
  | "sunset"
  | "forest"
  | "lavender"
  | "amoled"
  | "arctic";

export type Mode = "light" | "dark" | "system";

export interface ThemeColors {
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  accent: string;
  accentGradient: [string, string];
  accentGlow: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderHover: string;
  hoverBg: string;
  activeBg: string;
}

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  description: string;
  iconSvg: string;
  colors: {
    dark: ThemeColors;
    light: ThemeColors;
  };
}

/* ═══════════════════════════════════════════
   ICONS
   ═══════════════════════════════════════════ */

const ICON = {
  moon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`,
  aurora: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4"/><path d="m6.34 6.34 2.83 2.83"/><path d="M2 12h4"/><path d="m17.66 6.34-2.83 2.83"/><path d="M22 12h-4"/><path d="M6 20a6 6 0 0 1 12 0"/></svg>`,
  wave: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/></svg>`,
  sunset: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 10V2"/><path d="m4.93 10.93 1.41 1.41"/><path d="M2 18h2"/><path d="M20 18h2"/><path d="m19.07 10.93-1.41 1.41"/><path d="M22 22H2"/><path d="m16 6-4 4-4-4"/><path d="M16 18a4 4 0 0 0-8 0"/></svg>`,
  leaf: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.9C15.5 4.9 17 3.5 19 2c1 2 2 4.5 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>`,
  flower: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 7.5a4.5 4.5 0 1 1 4.5 4.5M12 7.5A4.5 4.5 0 1 0 7.5 12M12 7.5V9m-4.5 3a4.5 4.5 0 1 0 4.5 4.5M7.5 12H9m3 4.5a4.5 4.5 0 1 0 4.5-4.5M12 16.5V15m4.5-3a4.5 4.5 0 1 1-4.5-4.5M16.5 12H15"/><circle cx="12" cy="12" r="3"/></svg>`,
  circle: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>`,
  snowflake: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="2" x2="22" y1="12" y2="12"/><line x1="12" x2="12" y1="2" y2="22"/><path d="m20 16-4-4 4-4"/><path d="m4 8 4 4-4 4"/><path d="m16 4-4 4-4-4"/><path d="m8 20 4-4 4 4"/></svg>`,
} as const;

/* ═══════════════════════════════════════════
   DESIGN PRINCIPLES
   ───────────────────────────────────────────
   Dark mode:
     • Near-black backgrounds with subtle hue tint
     • Desaturated, refined accents (not neon)
     • Borders: 5% white opacity — invisible unless needed
     • Text hierarchy: 94%  →  55%  →  25% white

   Light mode (KEY FIX):
     • bgPrimary  = tinted page background (e.g. #eef2f8)
     • bgSecondary = pure white #ffffff  ← search bar / cards
     • bgTertiary  = very light gray for hover surfaces
     • This gives instant contrast: white card on tinted page
     • Accents are deep/accessible (WCAG AA ≥ 4.5:1)
   ═══════════════════════════════════════════ */

export const THEMES: Record<ThemeId, ThemeDefinition> = {
  /* ── MIDNIGHT — Blue-Indigo (mejorado) ── */
  midnight: {
    id: "midnight",
    name: "Midnight",
    description: "Azul índigo profundo y refinado",
    iconSvg: ICON.moon,
    colors: {
      dark: {
        bgPrimary:   "#0f1219",
        bgSecondary: "#17192a",
        bgTertiary:  "#202535",
        accent:      "#5b8def",
        accentGradient: ["#60a5fa", "#7c3aed"],
        accentGlow:  "rgba(96, 165, 250, 0.15)",
        textPrimary: "#f1f5f9",
        textSecondary: "#94a3b8",
        textMuted:   "#475569",
        border:      "rgba(148, 163, 184, 0.08)",
        borderHover: "rgba(148, 163, 184, 0.15)",
        hoverBg:     "rgba(96, 165, 250, 0.04)",
        activeBg:    "rgba(96, 165, 250, 0.1)",
      },
      light: {
        bgPrimary:   "#f0f4f9",
        bgSecondary: "#ffffff",
        bgTertiary:  "#f8fafc",
        accent:      "#2563eb",
        accentGradient: ["#2563eb", "#7c3aed"],
        accentGlow:  "rgba(37, 99, 235, 0.12)",
        textPrimary: "#0f1419",
        textSecondary: "#475569",
        textMuted:   "#94a3b8",
        border:      "rgba(15, 20, 25, 0.1)",
        borderHover: "rgba(15, 20, 25, 0.16)",
        hoverBg:     "rgba(37, 99, 235, 0.05)",
        activeBg:    "rgba(37, 99, 235, 0.1)",
      },
    },
  },

  /* ── AURORA — Purple-Cyan (colores fríos modernos) ── */
  aurora: {
    id: "aurora",
    name: "Aurora",
    description: "Púrpura boreal y cian vibrante",
    iconSvg: ICON.aurora,
    colors: {
      dark: {
        bgPrimary:   "#0e0a19",
        bgSecondary: "#18132d",
        bgTertiary:  "#21193a",
        accent:      "#a78bfa",
        accentGradient: ["#a78bfa", "#06b6d4"],
        accentGlow:  "rgba(167, 139, 250, 0.15)",
        textPrimary: "#f3e8ff",
        textSecondary: "#c4b5fd",
        textMuted:   "#6d28d9",
        border:      "rgba(196, 181, 253, 0.1)",
        borderHover: "rgba(196, 181, 253, 0.16)",
        hoverBg:     "rgba(167, 139, 250, 0.05)",
        activeBg:    "rgba(167, 139, 250, 0.1)",
      },
      light: {
        bgPrimary:   "#faf5ff",
        bgSecondary: "#ffffff",
        bgTertiary:  "#fef3ff",
        accent:      "#7c3aed",
        accentGradient: ["#7c3aed", "#0891b2"],
        accentGlow:  "rgba(124, 58, 237, 0.12)",
        textPrimary: "#1e1b4b",
        textSecondary: "#5b21b6",
        textMuted:   "#a78bfa",
        border:      "rgba(124, 58, 237, 0.1)",
        borderHover: "rgba(124, 58, 237, 0.16)",
        hoverBg:     "rgba(124, 58, 237, 0.05)",
        activeBg:    "rgba(124, 58, 237, 0.1)",
      },
    },
  },

  /* ── OCEAN — Cyan-Blue ── */
  ocean: {
    id: "ocean",
    name: "Ocean",
    description: "Océano cian y azul profundo",
    iconSvg: ICON.wave,
    colors: {
      dark: {
        bgPrimary:   "#0a1218",
        bgSecondary: "#132540",
        bgTertiary:  "#1a3555",
        accent:      "#22d3ee",
        accentGradient: ["#22d3ee", "#3b82f6"],
        accentGlow:  "rgba(34, 211, 238, 0.15)",
        textPrimary: "#ecf0f1",
        textSecondary: "#7dd3fc",
        textMuted:   "#0e7490",
        border:      "rgba(34, 211, 238, 0.1)",
        borderHover: "rgba(34, 211, 238, 0.16)",
        hoverBg:     "rgba(34, 211, 238, 0.05)",
        activeBg:    "rgba(34, 211, 238, 0.1)",
      },
      light: {
        bgPrimary:   "#ecf7fb",
        bgSecondary: "#ffffff",
        bgTertiary:  "#f0fafb",
        accent:      "#0369a1",
        accentGradient: ["#0369a1", "#1e40af"],
        accentGlow:  "rgba(3, 105, 161, 0.12)",
        textPrimary: "#0c2540",
        textSecondary: "#164e63",
        textMuted:   "#06b6d4",
        border:      "rgba(3, 105, 161, 0.1)",
        borderHover: "rgba(3, 105, 161, 0.16)",
        hoverBg:     "rgba(3, 105, 161, 0.05)",
        activeBg:    "rgba(3, 105, 161, 0.1)",
      },
    },
  },

  /* ── SUNSET — (mantener con ajustes) ── */
  sunset: {
    id: "sunset",
    name: "Sunset",
    description: "Naranja cálido y rosa atardecer",
    iconSvg: ICON.sunset,
    colors: {
      dark: {
        bgPrimary:   "#110808",
        bgSecondary: "#1c0f0d",
        bgTertiary:  "#271613",
        accent:      "#e8703a",
        accentGradient: ["#e8703a", "#d44e72"],
        accentGlow:  "rgba(232, 112, 58, 0.15)",
        textPrimary: "#fff2ee",
        textSecondary: "#c4806c",
        textMuted:   "#6a3525",
        border:      "rgba(255, 255, 255, 0.05)",
        borderHover: "rgba(255, 255, 255, 0.1)",
        hoverBg:     "rgba(255, 255, 255, 0.03)",
        activeBg:    "rgba(232, 112, 58, 0.12)",
      },
      light: {
        bgPrimary:   "#fdf1ea",
        bgSecondary: "#ffffff",
        bgTertiary:  "#fdf7f4",
        accent:      "#c84a14",
        accentGradient: ["#c84a14", "#b02250"],
        accentGlow:  "rgba(200, 74, 20, 0.1)",
        textPrimary: "#280d04",
        textSecondary: "#7a3520",
        textMuted:   "#b87860",
        border:      "rgba(40, 10, 0, 0.07)",
        borderHover: "rgba(40, 10, 0, 0.14)",
        hoverBg:     "rgba(200, 74, 20, 0.04)",
        activeBg:    "rgba(200, 74, 20, 0.09)",
      },
    },
  },

  /* ── FOREST — Verde bosque ── */
  forest: {
    id: "forest",
    name: "Forest",
    description: "Verde bosque y lima vibrante",
    iconSvg: ICON.leaf,
    colors: {
      dark: {
        bgPrimary:   "#050e08",
        bgSecondary: "#091510",
        bgTertiary:  "#0e2018",
        accent:      "#1a9e70",
        accentGradient: ["#1a9e70", "#6ab838"],
        accentGlow:  "rgba(26, 158, 112, 0.15)",
        textPrimary: "#e8fff4",
        textSecondary: "#4da880",
        textMuted:   "#1b5e40",
        border:      "rgba(255, 255, 255, 0.05)",
        borderHover: "rgba(255, 255, 255, 0.1)",
        hoverBg:     "rgba(255, 255, 255, 0.03)",
        activeBg:    "rgba(26, 158, 112, 0.12)",
      },
      light: {
        bgPrimary:   "#edfaf2",
        bgSecondary: "#ffffff",
        bgTertiary:  "#f2fdf5",
        accent:      "#0d7a52",
        accentGradient: ["#0d7a52", "#4d9010"],
        accentGlow:  "rgba(13, 122, 82, 0.1)",
        textPrimary: "#041e10",
        textSecondary: "#1a6040",
        textMuted:   "#5a9a78",
        border:      "rgba(0, 20, 10, 0.07)",
        borderHover: "rgba(0, 20, 10, 0.14)",
        hoverBg:     "rgba(13, 122, 82, 0.04)",
        activeBg:    "rgba(13, 122, 82, 0.09)",
      },
    },
  },

  /* ── LAVENDER — Purple 💜 ── */
  lavender: {
    id: "lavender",
    name: "Lavender",
    description: "Violeta rico y amatista",
    iconSvg: ICON.flower,
    colors: {
      dark: {
        bgPrimary:   "#110b1f",
        bgSecondary: "#1a1133",
        bgTertiary:  "#251a45",
        accent:      "#c084fc",
        accentGradient: ["#c084fc", "#7c3aed"],
        accentGlow:  "rgba(192, 132, 252, 0.15)",
        textPrimary: "#faf5ff",
        textSecondary: "#ddd6fe",
        textMuted:   "#8b5cf6",
        border:      "rgba(196, 181, 253, 0.1)",
        borderHover: "rgba(196, 181, 253, 0.16)",
        hoverBg:     "rgba(192, 132, 252, 0.05)",
        activeBg:    "rgba(192, 132, 252, 0.1)",
      },
      light: {
        bgPrimary:   "#faf7ff",
        bgSecondary: "#ffffff",
        bgTertiary:  "#fef5ff",
        accent:      "#7c3aed",
        accentGradient: ["#7c3aed", "#6d28d9"],
        accentGlow:  "rgba(124, 58, 237, 0.12)",
        textPrimary: "#2e1065",
        textSecondary: "#6b21a8",
        textMuted:   "#c4b5fd",
        border:      "rgba(124, 58, 237, 0.1)",
        borderHover: "rgba(124, 58, 237, 0.16)",
        hoverBg:     "rgba(124, 58, 237, 0.05)",
        activeBg:    "rgba(124, 58, 237, 0.1)",
      },
    },
  },

  /* ── AMOLED — Gris oscuro + Cyan ── */
  amoled: {
    id: "amoled",
    name: "AMOLED",
    description: "Gris oscuro y cian vibrante",
    iconSvg: ICON.circle,
    colors: {
      dark: {
        bgPrimary:   "#111115",
        bgSecondary: "#1a1a1f",
        bgTertiary:  "#27272e",
        accent:      "#06b6d4",
        accentGradient: ["#06b6d4", "#60a5fa"],
        accentGlow:  "rgba(6, 182, 212, 0.15)",
        textPrimary: "#f8fafc",
        textSecondary: "#cbd5e1",
        textMuted:   "#64748b",
        border:      "rgba(203, 213, 225, 0.1)",
        borderHover: "rgba(203, 213, 225, 0.16)",
        hoverBg:     "rgba(6, 182, 212, 0.05)",
        activeBg:    "rgba(6, 182, 212, 0.1)",
      },
      light: {
        bgPrimary:   "#f4f4f6",
        bgSecondary: "#ffffff",
        bgTertiary:  "#f9f9fb",
        accent:      "#0891b2",
        accentGradient: ["#0891b2", "#2563eb"],
        accentGlow:  "rgba(8, 145, 178, 0.12)",
        textPrimary: "#09090b",
        textSecondary: "#52525b",
        textMuted:   "#a1a1aa",
        border:      "rgba(0, 0, 0, 0.1)",
        borderHover: "rgba(0, 0, 0, 0.16)",
        hoverBg:     "rgba(8, 145, 178, 0.05)",
        activeBg:    "rgba(8, 145, 178, 0.1)",
      },
    },
  },

  /* ── ARCTIC — Cyan puro helado ❄️ ── */
  arctic: {
    id: "arctic",
    name: "Arctic",
    description: "Cian ártico helado",
    iconSvg: ICON.snowflake,
    colors: {
      dark: {
        bgPrimary:   "#0a1318",
        bgSecondary: "#112a3a",
        bgTertiary:  "#1a3f55",
        accent:      "#06b6d4",
        accentGradient: ["#06b6d4", "#0284c7"],
        accentGlow:  "rgba(6, 182, 212, 0.15)",
        textPrimary: "#ecf7fb",
        textSecondary: "#7dd3fc",
        textMuted:   "#0e7490",
        border:      "rgba(34, 211, 238, 0.1)",
        borderHover: "rgba(34, 211, 238, 0.16)",
        hoverBg:     "rgba(6, 182, 212, 0.05)",
        activeBg:    "rgba(6, 182, 212, 0.1)",
      },
      light: {
        bgPrimary:   "#ecf9fc",
        bgSecondary: "#ffffff",
        bgTertiary:  "#f0fbff",
        accent:      "#0369a1",
        accentGradient: ["#0369a1", "#0284c7"],
        accentGlow:  "rgba(3, 105, 161, 0.12)",
        textPrimary: "#0c2838",
        textSecondary: "#155e75",
        textMuted:   "#06b6d4",
        border:      "rgba(3, 105, 161, 0.1)",
        borderHover: "rgba(3, 105, 161, 0.16)",
        hoverBg:     "rgba(3, 105, 161, 0.05)",
        activeBg:    "rgba(3, 105, 161, 0.1)",
      },
    },
  },
};

/* ═══════════════════════════════════════════
   UTILITIES & CONTEXT
   ═══════════════════════════════════════════ */

export const STORAGE_KEYS = {
  theme: "orion-theme",
  mode: "orion-mode",
} as const;

export function getSystemMode(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export interface ThemeContextType {
  themeId: ThemeId;
  mode: Mode;
  resolvedMode: "light" | "dark";
  colors: ThemeColors;
  theme: ThemeDefinition;
  allThemes: ThemeDefinition[];
  setTheme: (id: ThemeId) => void;
  setMode: (mode: Mode) => void;
  opacity: number;
  blur: number;
  setOpacity: (v: number) => void;
  setBlur: (v: number) => void;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
