import { TopBar } from "./TopBar";
import "./LoadingState.css";

export function LoadingPulse({
  lines = 3,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`loading-pulse ${className}`.trim()} role="status" aria-label="Loading">
      {Array.from({ length: lines }, (_, index) => (
        <div
          key={index}
          className="loading-pulse-line"
          style={{ width: `${100 - index * 12}%` }}
        />
      ))}
    </div>
  );
}

export function ListLoading() {
  return (
    <div className="list-loading">
      <TopBar />
      <main className="list-loading-main">
        <LoadingPulse lines={5} className="loading-pulse--offset" />
      </main>
    </div>
  );
}

export function BoardLoading() {
  return (
    <div className="board-loading">
      <TopBar />
      <div className="board-loading-layout" role="status" aria-label="Loading">
        <div className="board-loading-square" />
        <div className="board-loading-side">
          <div className="board-loading-line board-loading-line--two-thirds" />
          <div className="board-loading-line board-loading-line--half" />
          <div className="board-loading-line board-loading-line--three-quarters" />
        </div>
      </div>
    </div>
  );
}
