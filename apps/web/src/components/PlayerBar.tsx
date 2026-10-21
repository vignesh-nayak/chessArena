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
    <div className="flex items-center gap-3 py-2">
      <div
        aria-hidden
        className="flex h-8 w-8 items-center justify-center bg-muted/30 text-xs text-muted"
      >
        {sideLabel}
      </div>
      <div className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm text-text">{username}</p>
        <p className="text-xs text-muted">{ratingLabel}</p>
      </div>
      {clockLabel ? (
        <p
          className={
            clockLow
              ? "shrink-0 text-sm tabular-nums text-red-400"
              : "shrink-0 text-sm tabular-nums text-text"
          }
        >
          {clockLabel}
        </p>
      ) : null}
    </div>
  );
}
