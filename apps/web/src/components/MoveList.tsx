import { useEffect, useRef } from "react";
import "./MoveList.css";

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
        className={selected ? "move-list-move move-list-move--selected" : "move-list-move"}
        onClick={() => onSelectPly(ply)}
      >
        {san}
      </button>
    );
  }

  return (
    <div className="move-list">
      <p className="move-list-label">Moves</p>
      <div className="move-list-body">
        {rows.length === 0 ? (
          <p className="move-list-empty">No moves yet</p>
        ) : (
          rows.map((row) => {
            const whitePly = (row.number - 1) * 2 + 1;
            return (
              <div key={row.number} className="move-list-row">
                <span className="move-list-number">{row.number}.</span>
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
