import {
  LoginBodySchema,
  type AuthSessionResponse,
} from "@chessarena/shared";
import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ApiRequestError, apiFetch, refreshViewerRating } from "../lib/api";
import { useAuthStore } from "../store/authStore";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useAuthStore((s) => s.setSession);
  const accessToken = useAuthStore((s) => s.accessToken);
  const bootstrapping = useAuthStore((s) => s.bootstrapping);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (bootstrapping) {
    return (
      <main className="flex min-h-full items-center justify-center px-6">
        <p className="text-muted">Checking session…</p>
      </main>
    );
  }

  if (accessToken) {
    return <Navigate to="/home" replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    const parsed = LoginBodySchema.safeParse({ email, password });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!next[key]) next[key] = issue.message;
      }
      setFieldErrors(next);
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    try {
      const session = await apiFetch<AuthSessionResponse>("/api/auth/login", {
        method: "POST",
        body: parsed.data,
        retryOnUnauthorized: false,
      });
      setSession(session.accessToken, session.user);
      try {
        await refreshViewerRating();
      } catch {
        // Session is valid; the top bar fills in on the next profile read.
      }
      const from =
        typeof location.state === "object" &&
        location.state !== null &&
        "from" in location.state &&
        typeof (location.state as { from?: unknown }).from === "string"
          ? (location.state as { from: string }).from
          : "/home";
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setFormError(err.message);
      } else {
        setFormError("Could not log in. Try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-full items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <p className="mb-2 text-sm tracking-wide text-muted uppercase">
          ChessArena
        </p>
        <h1 className="mb-6 text-2xl font-medium text-text">Log in</h1>
        <form className="space-y-4" onSubmit={onSubmit} noValidate>
          <Field
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            error={fieldErrors.email}
            onChange={setEmail}
          />
          <Field
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            error={fieldErrors.password}
            onChange={setPassword}
          />
          {formError ? (
            <p className="text-sm text-red-400" role="alert">
              {formError}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-accent px-4 py-2 text-sm font-medium text-bg disabled:opacity-60"
          >
            {submitting ? "Logging in…" : "Log in"}
          </button>
        </form>
        <p className="mt-6 text-sm text-muted">
          No account?{" "}
          <Link className="text-accent hover:underline" to="/signup">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}

function Field({
  label,
  type,
  autoComplete,
  value,
  error,
  onChange,
}: {
  label: string;
  type: string;
  autoComplete: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-left text-sm">
      <span className="text-muted">{label}</span>
      <input
        type={type}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full border border-muted/40 bg-transparent px-3 py-2 text-text outline-none focus:border-accent"
      />
      {error ? <span className="mt-1 block text-red-400">{error}</span> : null}
    </label>
  );
}
