# Technical decisions

Accumulated as ChessArena is built. Newest entries at the top within each week.

## Week 1

### W1-F07 — User profile and stats

**Profile is a read-only client of `GET /api/users/me`.** Stats are not cached in the auth Zustand user; each `/profile` visit refetches `/me` so W/L/D stay correct after a finished game.

**Stats mutate only inside `completeGame`.** Mate, draw, and resign increment counters; abandoned games do not. No profile write endpoints in Week 1.

**Shared `TopBar`** puts username → `/profile` on home, game, and profile screens (rating slot deferred to W3-F01).

### W1-F06 — AI opponent (Stockfish)

**Client-side Stockfish WASM worker** (`stockfish@19` lite single-threaded) instead of a server engine process. Keeps Render free-tier CPU free, avoids cold-start engine boot, and leaves the API stateless for move validation.

**Lite single-threaded build** (`stockfish-19-lite-single.js` + `.wasm`, ~1.8MB) over the large multi-threaded engine (~99MB). No `SharedArrayBuffer` / COOP-COEP headers required, so Vercel deploy stays unchanged. Large multi-thread rejected for binary size and cross-origin isolation complexity.

**Assets copied into `public/engine/` as `sf.js` + `sf.wasm`** from `node_modules/stockfish/bin` at Vite buildStart. Renamed because Vite can intercept the package’s original `stockfish-19-lite-single.*` URLs and serve SPA HTML in dev. Worker + WASM stay same-origin and adjacent. Generated copies are gitignored.

**Client proposes AI UCI; server still validates** via the same `PATCH /api/games/:id/move` path when it is Black’s turn on an AI game owned by the requester. Never apply a client FEN.

**Difficulty mapping (skill / depth / movetime ms):** Easy `5 / 6 / 400`, Medium `10 / 12 / 800`, Hard `20 / 15 / 1500`. `go` stops at depth or movetime, whichever comes first.

### W1-F05 — Game lifecycle API

**Server re-validates every move** with `@chessarena/shared` before persist. Client highlights are UX only; illegal drops snap back when the API returns `ILLEGAL_MOVE`.

**Persisted moves are SAN**; FEN is updated after each accepted move. `stateFromSans` rebuilds `uciHistory` on load so threefold repetition still works from stored history.

**`completeGame(game, result)`** is the single completion path (stats now; ELO hooks in W3-F01). Human is White vs AI; resign sets `result: "black"`.

**Human moves only while it is White’s turn.** Black replies arrive in W1-F06 via the same `PATCH .../move` once Stockfish runs client-side.

**Dashboard stays at `/home`** (Play vs AI + difficulty + recent games). Public `/` remains the health status page from W1-F01.

### W1-F04 — Chess rules engine

**Single `chess.js` wrapper in `@chessarena/shared`** (`createGame`, `tryMove`, `getLegalMoves`, `getPieceColor`) consumed by `apps/web` and `apps/api`. Client uses it for legal-move highlights and local preview; the server will re-validate every move from W1-F05 onward so both sides stay aligned.

**Rejected:** server-only validation (highlights would lag on every selection); client-only validation (unacceptable once games persist).

**UCI in, SAN out** matches the API contract for `PATCH /api/games/:id/move`. Promotion without a piece character returns `illegal`, not a separate reason — the board opens the chooser when `getLegalMoves` marks `promotion: true`.

**Optional `uciHistory` on `GameState`** replays from the start so `chess.js` can detect threefold repetition during local play. FEN alone is enough for mate/stalemate/material; W1-F05 can persist move lists and rebuild history on load.

### W1-F03 — Chess board UI

**`react-chessboard` v5 + local `chess.js` in `apps/web`** for highlights and move application. The shared rules package arrives in W1-F04; this feature owns the board-first layout and interaction UX only.

**Signed-in user is always White; orientation stays `"white"`.** Both sides can still be moved on `/game/:id` so a full local game is playable before AI (W1-F06). Black’s bar is a placeholder label. In-memory Zustand only — refresh resets the position until W1-F05.

**Promotion chooser lives in the side panel** (flat Q/R/B/N buttons), not a card-style modal, to keep chrome minimal.

### W1-F02 — Authentication & sessions

**Access JWT in Zustand memory + refresh JWT in httpOnly cookie** instead of storing both in localStorage. XSS cannot read the refresh token from JS; the short-lived access token (15 min) is enough for API calls until silent refresh.

**Separate `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`** so a leaked access signing key cannot forge refresh tokens (and vice versa).

**Refresh cookie: `SameSite=Lax` locally, `SameSite=None; Secure` in production.** Lax works when web (`:5173`) and API (`:4000`) share the localhost site. Vercel and Render are different sites, so production cross-origin `fetch` with credentials requires `None` + `Secure`. Documented as a deliberate deviation from the original Lax-only PRD line.

**bcrypt cost 12** (above the ≥10 floor). Password hashes use Mongoose `select: false` and never appear in JSON responses.

**`GET /api/users/me` shipped with auth** (shape owned by W1-F07) so the client can restore the user after a full page reload via refresh → me. Profile UI remains W1-F07.

### W1-F01 — Project scaffold & deploy pipeline

**Monorepo via npm workspaces** (`apps/web`, `apps/api`, `packages/shared`) instead of two repos or plain `client/` + `server/` folders. Shared zod/types stay in one package; one `npm install` and one local `npm run dev` command.

**Backend host: Render (free tier)** over Railway for docs consistency with the PRD. Frontend on Vercel; database on MongoDB Atlas.

**Health check returns HTTP 200 with `{ ok: true, mongo: "up" | "down" }`** even when Mongo is disconnected. The process stays up so the status page and deploy health probe can report DB state without a crash loop. Missing required env vars still fail fast at boot.

**Shared zod `HealthResponseSchema`** is the first cross-app contract: API builds the payload, web validates the JSON. Establishes the validation pattern for later auth/game schemas.

**Status page uses design-system neutrals** (`#262421` background, `#81b64c` accent, system fonts) — minimal placeholder, not a marketing landing page. Web calls the API URL directly (no Vite proxy) so CORS is exercised the same way in local and production.
