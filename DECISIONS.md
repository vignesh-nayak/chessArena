# Technical decisions

Accumulated as ChessArena is built. Newest entries at the top within each week.

## Week 3

### W3-F05 — Leaderboard

**The leaderboard is an authenticated read of `User.rating`.** `GET /api/leaderboard?limit=50` returns `{ items }` sorted by rating descending, then username ascending so ties stay stable. `limit` defaults to 50 and rejects values outside 1–100. Each row is `{ userId, username, rating, stats }`. The page refetches on mount, so a finished game shows up after navigation without a client cache.

**Ratings move only on completed PvP games.** `completeGame` applies the standard ELO formula for both humans and appends `ratingHistory`. K is 32 until that history has 30 entries, then 16. AI results still change win/loss/draw stats only. New users start at 1200.

## Week 2

### W2-F07 — In-game chat

**Chat is ephemeral and room-scoped.** `chat:message` accepts `{ gameId, text }` from a PvP participant only. The server trims the text, rejects empty or over-200-character messages, then broadcasts `chat:newMessage` as `{ gameId, from, text, sentAt }` to that game room. `from` is the username loaded from Mongo, not a client-supplied name. HTML is not interpreted; the client renders the string as text.

**There is no replay on join.** Messages live only in the open page. A refresh starts an empty list and shows messages sent after that socket is in the room. Post-game messages stay allowed while a participant is still connected, matching the “until both leave” rule. Spectators cannot send.

**Spam control is an in-memory window of 5 messages per 10 seconds per user per game.** Over the limit, only the sender gets `Slow down`. The limit is process-local, same as lobby presence.

### W2-F06 — Resign and draw offers

**PvP resign and draw offers stay on the game socket.** `game:resign` completes the game for the opponent with reason `resign`. `game:offerDraw` stores `drawOfferedBy` and broadcasts the existing `game:stateUpdate`. `game:respondDraw` either completes a draw with reason `agreement` or clears the offer. The same per-game queue used for moves serializes these actions, so a second resign after the game is already finished is only an error to that caller.

**A draw offer does not survive a reply or a move.** Decline clears `drawOfferedBy`. A legal move also clears it, which was already true for live sync. The offerer cannot accept their own offer. AI games still resign through `PATCH /api/games/:id/resign`.

### W2-F04 — Realtime game sync

**PvP moves are server-authoritative over the game room.** The client sends a UCI intent with `game:move`. The API rebuilds the position from stored SAN, checks that the socket user is the side to move, validates with the shared chess wrapper, then persists. Only after that save does the room get `game:stateUpdate`. Illegal and out-of-turn attempts emit `error` to the mover only.

**One rich `game:stateUpdate` is both the join snapshot and the move broadcast.** Payload is `{ gameId, fen, lastMove, turn, moves, status, result, drawOfferedBy }`. `lastMove` is `{ from, to, promotion? }`. Mate and draw also emit `game:ended { gameId, result, reason }` after `completeGame`. A successful move clears `drawOfferedBy` so a later draw-offer feature does not survive a ply.

**`PATCH /api/games/:id/move` rejects `gameType: "pvp"`.** AI games stay on REST. PvP has a single transport so a tampered client cannot apply a move the opponent never sees. The board stays read-only until the socket is connected, and `game:join` runs again after reconnect so the room membership lost on disconnect is restored from Mongo.

### W2-F03 — Challenge flow

**Challenges live in memory for 60 seconds.** `challenge:send` creates one pending challenge between two lobby users. Accept is single-winner: the challenge is removed before the game document is created, so a second accept fails. Decline and expiry notify the sender with `challenge:declined`.

**Colors are random.** `Math.random() < 0.5` makes the sender White. Accept persists a `pvp` game with both players as ObjectIds, `aiDifficulty: null`, `socketRoomId`, and `drawOfferedBy: null`. Both players' current lobby sockets join that room and each receives `game:started` with their own color.

**Other pending challenges involving either player are cancelled on accept.** A player already in an `in_progress` PvP game cannot send or accept. Self-challenges are rejected.

**Both participants can load `GET /api/games/:id`.** The board orients to the signed-in color. Live move sync stays on the existing REST path until W2-F04 sockets; PvP resign stays on the later socket flow.

### W2-F02 — Lobby and presence

**Lobby membership is a Socket.io room plus an in-memory map on the API process.** A user is online in the lobby only after `lobby:join`, not merely because their socket authenticated. `lobby:onlineUsers` is one row per `userId`; extra tabs are extra socket ids on that row. The last lobby socket to leave or disconnect removes the user.

**Usernames come from Mongo on join**, not from the client. Later tabs reuse the cached username. A deleted user gets an `error` event and is not listed.

**Busy / in-progress PvP is deferred to W2-F03.** This payload stays `{ userId, username }`. Challenge buttons are visible but disabled until the challenge handshake exists.

**Multi-instance presence would need Redis.** One Render instance is the Week 2 assumption; the map is not shared across processes.

### W2-F01 — Realtime infrastructure

**Socket.io on the same HTTP server as Express** instead of a second process or port. One Render web service already terminates TLS and proxies WebSocket upgrades; a single instance does not need sticky sessions or a Redis adapter.

**Room-per-game is the architecture direction.** Each live game will be a Socket.io room (exactly two players in Week 2; spectators join the same room later). Handlers will emit to the room, not to every connected socket. Lobby and challenge features stay out of this bootstrap; `registerLobbyHandlers(io)` is the plug-in point.

**Rejected:** REST polling (higher latency, worse turn UX) and SSE (one-way, so it cannot carry client moves). Multi-instance scaling with Redis is future work only.

**Handshake auth is the access JWT** (`auth: { token }`), verified with the same `verifyAccessToken` used by REST. `socket.data.userId` is set only after verification. Missing or invalid tokens are rejected before `connection`. Multiple sockets per user are allowed; presence dedupe is W2-F02.

**Client reconnects with Socket.io defaults, then refreshes the access token only on auth failures.** Network blips use the built-in reconnect. `Authentication required` / `Invalid or expired token` stop the retry, call the existing silent `POST /api/auth/refresh` helper, and connect again with the new token. If refresh fails or returns the same rejected token, the client records “Realtime disconnected” and does not loop. Server `error` events `{ message }` land in a realtime store for later toasts; no indicator UI in this feature.

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
