import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
	type ThemeId,
	type Mode,
	THEMES,
	STORAGE_KEYS,
	getSystemMode,
	ThemeContext,
} from "./theme-definitions";

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
	children,
}) => {
	const [themeId, setThemeId] = useState<ThemeId>(() => {
		const saved = localStorage.getItem(STORAGE_KEYS.theme) as ThemeId | null;
		return saved && THEMES[saved] ? saved : "midnight";
	});

	const [mode, setModeState] = useState<Mode>(() => {
		const saved = localStorage.getItem(STORAGE_KEYS.mode) as Mode | null;
		return saved || "dark";
	});

	const [opacity, setOpacityState] = useState<number>(() => {
		const saved = localStorage.getItem("orion-bg-opacity");
		return saved !== null ? parseInt(saved) : 80;
	});

	const [blur, setBlurState] = useState<number>(() => {
		const saved = localStorage.getItem("orion-bg-blur");
		return saved !== null ? parseInt(saved) : 10;
	});

	const [systemMode, setSystemMode] = useState<"light" | "dark">(getSystemMode);

	useEffect(() => {
		const mq = window.matchMedia("(prefers-color-scheme: dark)");
		const handler = (e: MediaQueryListEvent) =>
			setSystemMode(e.matches ? "dark" : "light");
		mq.addEventListener("change", handler);
		return () => mq.removeEventListener("change", handler);
	}, []);

	const resolvedMode = mode === "system" ? systemMode : mode;
	const themeDefinition = THEMES[themeId];
	const colors = themeDefinition.colors[resolvedMode];

	useEffect(() => {
		localStorage.setItem(STORAGE_KEYS.theme, themeId);
		localStorage.setItem(STORAGE_KEYS.mode, mode);

		const root = document.documentElement;
		root.setAttribute("data-theme", themeId);
		root.setAttribute("data-mode", resolvedMode);

		root.classList.toggle("dark", resolvedMode === "dark");
		root.classList.toggle("light", resolvedMode === "light");

		// Actualizar variables Flux (colores del tema activo)
		Object.entries(colors).forEach(([key, value]) => {
			if (Array.isArray(value)) {
				root.style.setProperty(`--orion-${key}-from`, value[0]);
				root.style.setProperty(`--orion-${key}-to`, value[1]);
			} else {
				root.style.setProperty(`--orion-${key}`, value);
			}
		});

		// Actualizar directamente el color de fondo de body para que el tema
		// se aplique a toda la pantalla, no solo al chrome del navegador
		document.body.style.backgroundColor = colors.bgPrimary;
		document.body.style.color = colors.textPrimary;

		// Opacity: controla la intensidad de los blobs del fondo animado
		root.style.setProperty("--orion-bg-opacity", String(opacity / 100));
		// Blur: controla el desenfoque de los blobs (40px base + slider*4)
		root.style.setProperty("--orion-bg-blur", `${20 + blur * 4}px`);
	}, [themeId, mode, resolvedMode, colors, opacity, blur]);

	const setTheme = useCallback((id: ThemeId) => {
		if (THEMES[id]) setThemeId(id);
	}, []);

	const setMode = useCallback((m: Mode) => {
		setModeState(m);
	}, []);

	const setOpacity = useCallback((v: number) => {
		setOpacityState(v);
		localStorage.setItem("orion-bg-opacity", String(v));
	}, []);

	const setBlur = useCallback((v: number) => {
		setBlurState(v);
		localStorage.setItem("orion-bg-blur", String(v));
	}, []);

	const value = useMemo(
		() => ({
			themeId,
			mode,
			resolvedMode,
			colors,
			theme: themeDefinition,
			allThemes: Object.values(THEMES),
			setTheme,
			setMode,
			opacity,
			blur,
			setOpacity,
			setBlur,
		}),
		[themeId, mode, resolvedMode, colors, themeDefinition, setTheme, setMode, opacity, blur, setOpacity, setBlur],
	);

	return (
		<ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
	);
};
