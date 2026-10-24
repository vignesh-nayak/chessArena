import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import "./ProtectedRoute.css";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const bootstrapping = useAuthStore((s) => s.bootstrapping);
  const accessToken = useAuthStore((s) => s.accessToken);
  const location = useLocation();

  if (bootstrapping) {
    return (
      <main className="protected-route">
        <p className="protected-route-message">Checking session…</p>
      </main>
    );
  }

  if (!accessToken) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
