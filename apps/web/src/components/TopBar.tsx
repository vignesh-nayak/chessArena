import { Link } from "react-router-dom";
import { ThemeToggle } from "./ThemeToggle";
import { useAuthStore } from "../store/authStore";

export function TopBar() {
  const user = useAuthStore((s) => s.user);
  const rating = useAuthStore((s) => s.rating);

  return (
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
      <Link
        to="/home"
        className="text-sm tracking-wide text-muted uppercase hover:text-accent"
      >
        ChessArena
      </Link>
      {user ? (
        <nav className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
          <Link to="/puzzles" className="text-sm text-muted hover:text-accent">
            Puzzles
          </Link>
          <Link
            to="/history"
            className="text-sm text-muted hover:text-accent"
          >
            History
          </Link>
          <Link
            to="/leaderboard"
            className="text-sm text-muted hover:text-accent"
          >
            Leaderboard
          </Link>
          <Link
            to="/profile"
            className="flex items-center gap-2 text-sm text-muted hover:text-accent"
          >
            <span>{user.username}</span>
            {rating != null ? <span>{rating}</span> : null}
          </Link>
          <ThemeToggle />
        </nav>
      ) : (
        <ThemeToggle />
      )}
    </header>
  );
}
