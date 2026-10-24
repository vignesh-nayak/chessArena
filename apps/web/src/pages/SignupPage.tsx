import {
  SignupBodySchema,
  type AuthSessionResponse,
} from "@chessarena/shared";
import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { TestAccountNote } from "../components/TestAccountNote";
import { ThemeToggle } from "../components/ThemeToggle";
import { ApiRequestError, apiFetch, refreshViewerRating } from "../lib/api";
import { useAuthStore } from "../store/authStore";
import "./SignupPage.css";

export function SignupPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const accessToken = useAuthStore((s) => s.accessToken);
  const bootstrapping = useAuthStore((s) => s.bootstrapping);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (bootstrapping) {
    return (
      <main className="signup-checking">
        <p className="signup-checking-text">Checking session…</p>
      </main>
    );
  }

  if (accessToken) {
    return <Navigate to="/home" replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    const parsed = SignupBodySchema.safeParse({ username, email, password });
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
      const session = await apiFetch<AuthSessionResponse>("/api/auth/signup", {
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
      navigate("/home", { replace: true });
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setFormError(err.message);
      } else {
        setFormError("Could not sign up. Try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="signup-page">
      <div className="signup-theme">
        <ThemeToggle />
      </div>
      <div className="signup-card">
        <p className="signup-kicker">ChessArena</p>
        <h1 className="signup-title">Sign up</h1>
        <TestAccountNote />
        <form className="signup-form" onSubmit={onSubmit} noValidate>
          <Field
            label="Username"
            type="text"
            autoComplete="username"
            value={username}
            error={fieldErrors.username}
            onChange={setUsername}
          />
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
            autoComplete="new-password"
            value={password}
            error={fieldErrors.password}
            onChange={setPassword}
          />
          {formError ? (
            <p className="signup-error" role="alert">
              {formError}
            </p>
          ) : null}
          <button type="submit" disabled={submitting} className="signup-submit">
            {submitting ? "Creating account…" : "Create account"}
          </button>
        </form>
        <p className="signup-switch">
          Already have an account?{" "}
          <Link className="signup-switch-link" to="/login">
            Log in
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
    <label className="signup-field">
      <span className="signup-field-label">{label}</span>
      <input
        type={type}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="signup-field-input"
      />
      {error ? <span className="signup-field-error">{error}</span> : null}
    </label>
  );
}
