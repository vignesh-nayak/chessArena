export type StockfishGoParams = {
  fen: string;
  skill: number;
  depth: number;
  movetime: number;
};

const ENGINE_URL = "/engine/sf.js";

function parseBestMove(line: string): string | null {
  if (!line.startsWith("bestmove ")) return null;
  const parts = line.split(/\s+/);
  const move = parts[1];
  if (!move || move === "(none)") return null;
  return move;
}

type PendingSearch = {
  resolve: (move: string) => void;
  reject: (err: Error) => void;
};

/**
 * Client wrapper around Stockfish.js WASM running as a dedicated Worker.
 * Speaks UCI; never applies moves itself — callers submit UCI to the API.
 */
export class StockfishEngine {
  private worker: Worker | null = null;
  private ready: Promise<void> | null = null;
  private pending: PendingSearch | null = null;
  /** Drop the next bestmove after an abort so it cannot resolve a newer search. */
  private ignoreNextBestMove = false;

  async init(): Promise<void> {
    if (this.ready) return this.ready;

    this.ready = new Promise<void>((resolve, reject) => {
      try {
        const worker = new Worker(ENGINE_URL);
        this.worker = worker;

        const onError = () => {
          cleanup();
          reject(new Error("Stockfish worker failed to load"));
        };

        const cleanup = () => {
          worker.removeEventListener("error", onError);
        };

        worker.addEventListener("error", onError);

        worker.onmessage = (event: MessageEvent<string>) => {
          const line =
            typeof event.data === "string" ? event.data : String(event.data);

          if (line === "uciok") {
            cleanup();
            resolve();
            return;
          }

          const best = parseBestMove(line);
          if (!best) return;

          if (this.ignoreNextBestMove) {
            this.ignoreNextBestMove = false;
            return;
          }

          if (!this.pending) return;

          const { resolve: resolveSearch } = this.pending;
          this.pending = null;
          resolveSearch(best);
        };

        worker.postMessage("uci");
      } catch (err) {
        reject(
          err instanceof Error
            ? err
            : new Error("Could not start Stockfish worker"),
        );
      }
    });

    return this.ready;
  }

  async go(params: StockfishGoParams): Promise<string> {
    await this.init();
    if (!this.worker) {
      throw new Error("Stockfish worker is not available");
    }

    this.stop();

    return new Promise<string>((resolve, reject) => {
      this.pending = { resolve, reject };

      const w = this.worker!;
      w.postMessage(`setoption name Skill Level value ${params.skill}`);
      w.postMessage(`position fen ${params.fen}`);
      w.postMessage(`go depth ${params.depth} movetime ${params.movetime}`);
    });
  }

  /** Abort the current search; late bestmove results are ignored. */
  stop(): void {
    if (this.pending) {
      this.ignoreNextBestMove = true;
      this.worker?.postMessage("stop");
      const { reject } = this.pending;
      this.pending = null;
      reject(new Error("Stockfish search aborted"));
    }
  }

  terminate(): void {
    this.stop();
    this.worker?.terminate();
    this.worker = null;
    this.ready = null;
    this.ignoreNextBestMove = false;
  }
}
