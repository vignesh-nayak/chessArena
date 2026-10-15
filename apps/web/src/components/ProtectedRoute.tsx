import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const bootstrapping = useAuthStore((s) => s.bootstrapping);
  const accessToken = useAuthStore((s) => s.accessToken);
  const location = useLocation();

  if (bootstrapping) {
    return (
      <main className="flex min-h-full items-center justify-center px-6">
        <p className="text-muted">Checking session…</p>
      </main>
    );
  }

  if (!accessToken) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
