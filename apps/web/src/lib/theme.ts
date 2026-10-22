export const THEME_STORAGE_KEY = "chessarena-theme";

export type ThemeChoice = "light" | "dark";

const THEME_EVENT = "chessarena-theme";

export function readStoredTheme(): ThemeChoice | null {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : null;
  } catch {
    return null;
  }
}

export function systemTheme(): ThemeChoice {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function currentTheme(): ThemeChoice {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function applyTheme(theme: ThemeChoice): void {
  document.documentElement.dataset.theme = theme;
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: theme }));
}

export function setThemeChoice(theme: ThemeChoice): void {
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  applyTheme(theme);
}

/** Follows the OS only while the user has not saved a choice. */
export function watchSystemTheme(): () => void {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => {
    if (readStoredTheme()) return;
    applyTheme(media.matches ? "dark" : "light");
  };
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

export function subscribeTheme(listener: (theme: ThemeChoice) => void): () => void {
  const onTheme = (event: Event) => {
    const detail = (event as CustomEvent<ThemeChoice>).detail;
    if (detail === "light" || detail === "dark") listener(detail);
  };
  window.addEventListener(THEME_EVENT, onTheme);
  return () => window.removeEventListener(THEME_EVENT, onTheme);
}
