import { useEffect, useRef } from "react";

type MoveListProps = {
  moves: string[];
  currentPly?: number;
  onSelectPly?: (ply: number) => void;
};

export function MoveList({ moves, currentPly, onSelectPly }: MoveListProps) {
  const endRef = useRef<HTMLDivElement | null>(null);
  const currentRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (onSelectPly) {
      currentRef.current?.scrollIntoView({ block: "nearest" });
      return;
    }
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [currentPly, moves.length, onSelectPly]);

  const rows: { number: number; white?: string; black?: string }[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    rows.push({
      number: i / 2 + 1,
      white: moves[i],
      black: moves[i + 1],
    });
  }

  function moveCell(san: string | undefined, ply: number) {
    if (!san) return <span />;
    const selected = currentPly === ply;
    if (!onSelectPly) {
      return <span>{san}</span>;
    }
    return (
      <button
        type="button"
        ref={selected ? currentRef : undefined}
        className={
          selected
            ? "text-left font-medium text-accent"
            : "text-left text-text hover:text-accent"
        }
        onClick={() => onSelectPly(ply)}
      >
        {san}
      </button>
    );
  }

  return (
    <div className="flex max-h-48 min-h-32 flex-col overflow-hidden lg:max-h-none lg:flex-1">
      <p className="mb-2 text-xs tracking-wide text-muted uppercase">Moves</p>
      <div className="flex-1 overflow-y-auto text-sm leading-7 text-text">
        {rows.length === 0 ? (
          <p className="text-muted">No moves yet</p>
        ) : (
          rows.map((row) => {
            const whitePly = (row.number - 1) * 2 + 1;
            return (
              <div
                key={row.number}
                className="grid grid-cols-[2rem_1fr_1fr] gap-2"
              >
                <span className="text-muted">{row.number}.</span>
                {moveCell(row.white, whitePly)}
                {moveCell(row.black, whitePly + 1)}
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}
