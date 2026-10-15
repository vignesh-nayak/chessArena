import { useMemo, type CSSProperties } from "react";
import { Chessboard } from "react-chessboard";
import type {
  PieceDropHandlerArgs,
  PieceHandlerArgs,
  SquareHandlerArgs,
} from "react-chessboard";
import { getPieceColor, type LegalMoveTarget } from "@chessarena/shared";

const BOARD_LIGHT = "#f0d9b5";
const BOARD_DARK = "#769656";
const LAST_MOVE = "rgba(255, 255, 0, 0.35)";
const CHECK = "rgba(235, 70, 70, 0.72)";
const SELECTED = "rgba(129, 182, 76, 0.55)";

export type ChessBoardProps = {
  fen: string;
  orientation: "white" | "black";
  lastMove?: { from: string; to: string };
  arePiecesDraggable: boolean;
  onMove: (
    from: string,
    to: string,
    promotion?: string,
  ) => boolean | void | Promise<boolean>;
  selectedSquare?: string | null;
  legalTargets?: LegalMoveTarget[];
  checkSquare?: string | null;
  turn: "w" | "b";
  onSelectSquare?: (square: string | null) => void;
};

export function ChessBoard({
  fen,
  orientation,
  lastMove,
  arePiecesDraggable,
  onMove,
  selectedSquare = null,
  legalTargets = [],
  checkSquare = null,
  turn,
  onSelectSquare,
}: ChessBoardProps) {
  const squareStyles = useMemo(() => {
    const styles: Record<string, CSSProperties> = {};

    if (lastMove) {
      styles[lastMove.from] = {
        backgroundColor: LAST_MOVE,
      };
      styles[lastMove.to] = {
        backgroundColor: LAST_MOVE,
      };
    }

    if (selectedSquare) {
      styles[selectedSquare] = {
        ...(styles[selectedSquare] ?? {}),
        backgroundColor: SELECTED,
      };
    }

    for (const target of legalTargets) {
      if (target.capture) {
        styles[target.to] = {
          ...(styles[target.to] ?? {}),
          background:
            "radial-gradient(transparent 0%, transparent 62%, rgba(0,0,0,0.28) 63%, rgba(0,0,0,0.28) 72%, transparent 73%)",
          boxShadow: "inset 0 0 0 2px rgba(0,0,0,0.18)",
        };
      } else {
        styles[target.to] = {
          ...(styles[target.to] ?? {}),
          background:
            "radial-gradient(rgba(0,0,0,0.28) 18%, transparent 19%)",
        };
      }
    }

    if (checkSquare) {
      styles[checkSquare] = {
        backgroundColor: CHECK,
      };
    }

    return styles;
  }, [checkSquare, lastMove, legalTargets, selectedSquare]);

  const options = useMemo(() => {
    function handleDrop({
      sourceSquare,
      targetSquare,
    }: PieceDropHandlerArgs): boolean {
      if (!targetSquare) return false;
      // Controlled board: keep fen until the API accepts the move.
      void Promise.resolve(onMove(sourceSquare, targetSquare));
      return false;
    }

    function handleSquareClick({ square }: SquareHandlerArgs) {
      onSelectSquare?.(square);
    }

    function handlePieceClick({ square }: PieceHandlerArgs) {
      if (!square) return;
      onSelectSquare?.(square);
    }

    return {
      id: "chessarena-board",
      position: fen,
      boardOrientation: orientation,
      showNotation: true,
      allowDragging: arePiecesDraggable,
      allowDragOffBoard: false,
      animationDurationInMs: 180,
      lightSquareStyle: { backgroundColor: BOARD_LIGHT },
      darkSquareStyle: { backgroundColor: BOARD_DARK },
      squareStyles,
      boardStyle: {
        width: "100%",
        height: "100%",
        borderRadius: 0,
        boxShadow: "none",
      },
      canDragPiece: ({ square }: PieceHandlerArgs) => {
        if (!arePiecesDraggable || !square) return false;
        return getPieceColor({ fen }, square) === turn;
      },
      onPieceDrop: handleDrop,
      onSquareClick: handleSquareClick,
      onPieceClick: handlePieceClick,
    };
  }, [
    arePiecesDraggable,
    fen,
    onMove,
    onSelectSquare,
    orientation,
    squareStyles,
    turn,
  ]);

  return (
    <div className="aspect-square w-full max-w-[min(70vh,100%)]">
      <Chessboard options={options} />
    </div>
  );
}
