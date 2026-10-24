import { HealthResponseSchema } from "@chessarena/shared";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getApiBase } from "../lib/api";
import { useAuthStore } from "../store/authStore";
import "./StatusPage.css";

type Status =
  | { kind: "loading" }
  | { kind: "ok" }
  | { kind: "mongo-down" }
  | { kind: "error"; message: string };

export function StatusPage() {
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    let cancelled = false;

    async function checkHealth() {
      try {
        const res = await fetch(`${getApiBase()}/api/health`, {
          credentials: "include",
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const json: unknown = await res.json();
        const parsed = HealthResponseSchema.safeParse(json);
        if (!parsed.success) {
          throw new Error("Invalid health response shape");
        }
        if (cancelled) return;
        setStatus(
          parsed.data.mongo === "up" ? { kind: "ok" } : { kind: "mongo-down" },
        );
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Network request failed";
        setStatus({ kind: "error", message });
      }
    }

    void checkHealth();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="status-page">
      <div className="status-card">
        <p className="status-kicker">ChessArena</p>
        <StatusLine status={status} />
        <div className="status-actions">
          {user ? (
            <Link className="status-link" to="/home">
              Continue as {user.username}
            </Link>
          ) : (
            <>
              <Link className="status-link" to="/login">
                Log in
              </Link>
              <Link className="status-link--muted" to="/signup">
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function StatusLine({ status }: { status: Status }) {
  switch (status.kind) {
    case "loading":
      return (
        <h1 className="status-heading status-heading--muted">
          ChessArena API status: checking…
        </h1>
      );
    case "ok":
      return (
        <h1 className="status-heading status-heading--ok">
          ChessArena API status: OK
        </h1>
      );
    case "mongo-down":
      return (
        <h1 className="status-heading status-heading--text">
          ChessArena API status: API up, MongoDB down
        </h1>
      );
    case "error":
      return (
        <div>
          <h1 className="status-heading status-heading--text">
            ChessArena API status: unreachable
          </h1>
          <p className="status-detail">{status.message}</p>
        </div>
      );
  }
}
