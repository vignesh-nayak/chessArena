import { Link } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

export function TopBar() {
  const user = useAuthStore((s) => s.user);

  return (
    <header className="flex items-center justify-between px-4 py-3">
      <Link
        to="/home"
        className="text-sm tracking-wide text-muted uppercase hover:text-accent"
      >
        ChessArena
      </Link>
      {user ? (
        <Link
          to="/profile"
          className="text-sm text-muted hover:text-accent"
        >
          {user.username}
        </Link>
      ) : (
        <span className="text-sm text-muted">—</span>
      )}
    </header>
  );
}
