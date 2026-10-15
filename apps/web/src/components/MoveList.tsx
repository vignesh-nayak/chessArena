import { useEffect, useRef } from "react";

type MoveListProps = {
  moves: string[];
};

export function MoveList({ moves }: MoveListProps) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [moves.length]);

  const rows: { number: number; white?: string; black?: string }[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    rows.push({
      number: i / 2 + 1,
      white: moves[i],
      black: moves[i + 1],
    });
  }

  return (
    <div className="flex max-h-48 min-h-32 flex-col overflow-hidden lg:max-h-none lg:flex-1">
      <p className="mb-2 text-xs tracking-wide text-muted uppercase">Moves</p>
      <div className="flex-1 overflow-y-auto text-sm leading-7 text-text">
        {rows.length === 0 ? (
          <p className="text-muted">No moves yet</p>
        ) : (
          rows.map((row) => (
            <div key={row.number} className="grid grid-cols-[2rem_1fr_1fr] gap-2">
              <span className="text-muted">{row.number}.</span>
              <span>{row.white}</span>
              <span>{row.black ?? ""}</span>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}
