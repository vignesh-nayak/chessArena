import { Link } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

export function TopBar() {
  const user = useAuthStore((s) => s.user);
  const rating = useAuthStore((s) => s.rating);

  return (
    <header className="flex items-center justify-between px-4 py-3">
      <Link
        to="/home"
        className="text-sm tracking-wide text-muted uppercase hover:text-accent"
      >
        ChessArena
      </Link>
      {user ? (
        <nav className="flex items-center gap-4">
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
        </nav>
      ) : (
        <span className="text-sm text-muted">—</span>
      )}
    </header>
  );
}
