import "./PlayerBar.css";

type PlayerBarProps = {
  username: string;
  ratingLabel?: string;
  sideLabel: string;
  clockLabel?: string | null;
  clockLow?: boolean;
};

export function PlayerBar({
  username,
  ratingLabel = "—",
  sideLabel,
  clockLabel = null,
  clockLow = false,
}: PlayerBarProps) {
  return (
    <div className="player-bar">
      <div aria-hidden className="player-bar-side">
        {sideLabel}
      </div>
      <div className="player-bar-meta">
        <p className="player-bar-name">{username}</p>
        <p className="player-bar-rating">{ratingLabel}</p>
      </div>
      {clockLabel ? (
        <p className={clockLow ? "player-bar-clock player-bar-clock--low" : "player-bar-clock"}>
          {clockLabel}
        </p>
      ) : null}
    </div>
  );
}
