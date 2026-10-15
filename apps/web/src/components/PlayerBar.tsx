type PlayerBarProps = {
  username: string;
  ratingLabel?: string;
  sideLabel: string;
};

export function PlayerBar({
  username,
  ratingLabel = "—",
  sideLabel,
}: PlayerBarProps) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div
        aria-hidden
        className="flex h-8 w-8 items-center justify-center bg-muted/30 text-xs text-muted"
      >
        {sideLabel}
      </div>
      <div className="min-w-0 text-left">
        <p className="truncate text-sm text-text">{username}</p>
        <p className="text-xs text-muted">{ratingLabel}</p>
      </div>
    </div>
  );
}
