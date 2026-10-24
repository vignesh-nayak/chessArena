import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ThemeToggle } from "./ThemeToggle";
import { useAuthStore } from "../store/authStore";
import "./TopBar.css";

export function TopBar() {
  const user = useAuthStore((s) => s.user);
  const rating = useAuthStore((s) => s.rating);
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function close() {
    setOpen(false);
  }

  return (
    <header className="topbar">
      <Link to="/home" className="topbar-brand" onClick={close}>
        ChessArena
      </Link>
      {user ? (
        <>
          <button
            type="button"
            className="topbar-menu-button"
            aria-expanded={open}
            aria-controls="topbar-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((current) => !current)}
          >
            <span className="topbar-menu-icon" aria-hidden="true" />
          </button>
          {open ? (
            <button
              type="button"
              className="topbar-backdrop"
              aria-label="Close menu"
              onClick={close}
            />
          ) : null}
          <nav
            id="topbar-menu"
            className={open ? "topbar-nav topbar-nav--open" : "topbar-nav"}
          >
            <button type="button" className="topbar-close" onClick={close}>
              Close
            </button>
            <Link to="/puzzles" className="topbar-link" onClick={close}>
              Puzzles
            </Link>
            <Link to="/history" className="topbar-link" onClick={close}>
              History
            </Link>
            <Link to="/leaderboard" className="topbar-link" onClick={close}>
              Leaderboard
            </Link>
            <Link to="/profile" className="topbar-profile" onClick={close}>
              <span>{user.username}</span>
              {rating != null ? <span>{rating}</span> : null}
            </Link>
            <ThemeToggle />
          </nav>
        </>
      ) : (
        <ThemeToggle />
      )}
    </header>
  );
}
