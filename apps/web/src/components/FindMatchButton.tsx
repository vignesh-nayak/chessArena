import { useEffect, useState } from "react";
import { getRealtimeSocket } from "../lib/socket";
import { useMatchmakingStore } from "../store/matchmakingStore";
import { useRealtimeStore } from "../store/realtimeStore";
import "./FindMatchButton.css";

const TIME_CONTROL = { initial: 600 as const, increment: 5 as const };

function formatElapsed(joinedAt: number, now: number): string {
  const elapsed = Math.max(0, Math.floor((now - joinedAt) / 1000));
  const minutes = Math.floor(elapsed / 60);
  const seconds = String(elapsed % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function FindMatchButton() {
  const searching = useMatchmakingStore((s) => s.searching);
  const joinedAt = useMatchmakingStore((s) => s.joinedAt);
  const error = useMatchmakingStore((s) => s.error);
  const status = useRealtimeStore((s) => s.status);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!searching) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [searching]);

  function onFind(): void {
    const client = getRealtimeSocket();
    if (!client || status !== "connected") return;
    useMatchmakingStore.getState().startSearch();
    client.emit("matchmaking:join", { timeControl: TIME_CONTROL });
  }

  function onCancel(): void {
    getRealtimeSocket()?.emit("matchmaking:leave");
    useMatchmakingStore.getState().stopSearch();
  }

  return (
    <div className="find-match">
      {searching ? (
        <>
          <p className="find-match-status" role="status">
            Searching… {joinedAt ? formatElapsed(joinedAt, now) : "0:00"}
          </p>
          <button type="button" className="find-match-cancel" onClick={onCancel}>
            Cancel
          </button>
        </>
      ) : (
        <button
          type="button"
          className="find-match-submit"
          disabled={status !== "connected"}
          onClick={onFind}
        >
          Find Match
        </button>
      )}
      {error ? (
        <p className="find-match-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
