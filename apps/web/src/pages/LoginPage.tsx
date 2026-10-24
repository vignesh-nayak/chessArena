import {
  LoginBodySchema,
  type AuthSessionResponse,
} from "@chessarena/shared";
import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { TestAccountNote } from "../components/TestAccountNote";
import { ThemeToggle } from "../components/ThemeToggle";
import { ApiRequestError, apiFetch, refreshViewerRating } from "../lib/api";
import { useAuthStore } from "../store/authStore";
import "./LoginPage.css";

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
      <main className="login-checking">
        <p className="login-checking-text">Checking session…</p>
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
        toast: false,
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
    <main className="login-page">
      <div className="login-theme">
        <ThemeToggle />
      </div>
      <div className="login-card">
        <p className="login-kicker">ChessArena</p>
        <h1 className="login-title">Log in</h1>
        <TestAccountNote />
        <form className="login-form" onSubmit={onSubmit} noValidate>
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
            <p className="login-error" role="alert">
              {formError}
            </p>
          ) : null}
          <button type="submit" disabled={submitting} className="login-submit">
            {submitting ? "Logging in…" : "Log in"}
          </button>
        </form>
        <p className="login-switch">
          No account?{" "}
          <Link className="login-switch-link" to="/signup">
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
    <label className="login-field">
      <span className="login-field-label">{label}</span>
      <input
        type={type}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="login-field-input"
      />
      {error ? <span className="login-field-error">{error}</span> : null}
    </label>
  );
}
