import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ErrorToast } from "./components/ErrorToast";
import { BoardLoading, ListLoading } from "./components/LoadingState";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { SocketProvider } from "./components/SocketProvider";
import { bootstrapSession } from "./lib/api";
import { useGameStartedNavigation } from "./hooks/useGameStartedNavigation";
import { useMatchmaking } from "./hooks/useMatchmaking";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { ProfilePage } from "./pages/ProfilePage";
import { SignupPage } from "./pages/SignupPage";
import { StatusPage } from "./pages/StatusPage";

const GamePage = lazy(() =>
  import("./pages/GamePage").then((m) => ({ default: m.GamePage })),
);
const ReplayPage = lazy(() =>
  import("./pages/ReplayPage").then((m) => ({ default: m.ReplayPage })),
);
const LobbyPage = lazy(() =>
  import("./pages/LobbyPage").then((m) => ({ default: m.LobbyPage })),
);
const LeaderboardPage = lazy(() =>
  import("./pages/LeaderboardPage").then((m) => ({ default: m.LeaderboardPage })),
);
const HistoryPage = lazy(() =>
  import("./pages/HistoryPage").then((m) => ({ default: m.HistoryPage })),
);
const PuzzlePage = lazy(() =>
  import("./pages/PuzzlePage").then((m) => ({ default: m.PuzzlePage })),
);

function guarded(page: ReactNode, fallback: ReactNode) {
  return (
    <ProtectedRoute>
      <Suspense fallback={fallback}>{page}</Suspense>
    </ProtectedRoute>
  );
}

export default function App() {
  useEffect(() => {
    void bootstrapSession();
  }, []);

  return (
    <SocketProvider>
      <BrowserRouter>
        <ErrorToast />
        <GameStartedListener />
        <Routes>
          <Route path="/" element={<StatusPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route
            path="/home"
            element={
              <ProtectedRoute>
                <HomePage />
              </ProtectedRoute>
            }
          />
          <Route path="/lobby" element={guarded(<LobbyPage />, <ListLoading />)} />
          <Route
            path="/leaderboard"
            element={guarded(<LeaderboardPage />, <ListLoading />)}
          />
          <Route path="/history" element={guarded(<HistoryPage />, <ListLoading />)} />
          <Route path="/puzzles" element={guarded(<PuzzlePage />, <BoardLoading />)} />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/game/:id/replay"
            element={guarded(<ReplayPage />, <BoardLoading />)}
          />
          <Route path="/game/:id" element={guarded(<GamePage />, <BoardLoading />)} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </SocketProvider>
  );
}

function GameStartedListener() {
  useGameStartedNavigation();
  useMatchmaking();
  return null;
}
