import { useEffect, useState } from "react";
import { currentTheme, setThemeChoice, subscribeTheme, type ThemeChoice } from "../lib/theme";
import "./ThemeToggle.css";

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeChoice>(() => currentTheme());

  useEffect(() => subscribeTheme(setTheme), []);

  const next: ThemeChoice = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={next === "light" ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setThemeChoice(next)}
    >
      {next === "light" ? "Light" : "Dark"}
    </button>
  );
}
