import type { ReactNode } from "react";
import "./EmptyState.css";

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="empty-state">{children}</p>;
}
