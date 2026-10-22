import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { watchSystemTheme } from "./lib/theme";
import "./index.css";

watchSystemTheme();

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element #root not found");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
