# Technical decisions

Accumulated as ChessArena is built. Newest entries at the top within each week.

## Week 4

### Production keep-alive

**The API pings its own public health URL every 12 minutes while the production process is running.** Render sleeps a free web service after 15 minutes with no inbound HTTP request or WebSocket message. An in-process timer only counts when the request comes back through `RENDER_EXTERNAL_URL/api/health`. A failed ping retries once after 30 seconds. Local dev does not ping. The loop cannot wake a process that has already slept, crashed, or been suspended after the workspace uses its 750 free instance hours. One always-on service fits that monthly budget, and the next real request still waits on a cold start in those cases.

### Plain CSS and the phone menu

**The web styles are plain CSS.** Each component and page has its own stylesheet. Theme colors stay in `apps/web/src/index.css` and still follow `data-theme`. `tailwindcss` and `@tailwindcss/vite` are removed. The W4-F04 and W4-F05 notes below are the earlier Tailwind pass.

**A signed-in phone bar is the brand and a menu button.** At 767px and below, Puzzles, History, Leaderboard, the username and rating, and the theme toggle sit in a panel that slides in from the right. A link, Close, the dim area, or Escape closes it. Wider screens keep those links in one row. Logged-out login and signup pages do not use this bar.

**The production web build after that change.** Entry JS 433 kB (132 kB gzip). Shared CSS 12.6 kB (2.5 kB gzip), with route CSS split out: game 2.8 kB, puzzle 1.7 kB, lobby 1.5 kB, replay 1.2 kB, leaderboard 0.9 kB, history 0.7 kB. JS chunks: board UI 80 kB (24 kB gzip), game page 20 kB (6.3 kB gzip), puzzle 4.8 kB (2.0 kB gzip), lobby 4.5 kB (1.6 kB gzip), replay 2.9 kB (1.2 kB gzip), leaderboard 1.4 kB (0.7 kB gzip), history 1.3 kB (0.7 kB gzip). Home still does not load the board or Stockfish.

### W4-F06 — Documentation and release check

**The README points at the live app.** Web: https://chess-arena-riou.vercel.app. API: https://chessarena-server-uzin.onrender.com. Health returned `{ ok: true, mongo: up }`. The demo steps are written. `docs/demo.gif` is not in the repo yet.

**Production is an older deploy.** A new user signed up, played `1. e4 c6` against the computer, and opened the leaderboard. Two other accounts paired through matchmaking, and the browser spectated that game with both clocks running. The console stayed quiet on signup, the AI game, the status page, and the leaderboard. `GET /api/puzzles/daily` is 404, and `/puzzles` falls through to the status page. Puzzle mode, the theme toggle, and the later index changes are in this repo and not on that Vercel/Render build. That is a deploy gap, not a new feature. Nothing was pushed.

### W4-F05 — Performance

**Indexes follow the queries.** `username` and `email` stay unique. The leaderboard sorts stored `rating` descending, then `username`, on `{ rating: -1, username: 1 }`. A computed `$addFields` sort could not use an index. Display still treats a missing rating as 1200; new users are stored at 1200. History is newest `updatedAt` first, so the player indexes are `{ whitePlayer: 1, updatedAt: -1 }` and `{ blackPlayer: 1, updatedAt: -1 }`, not `createdAt`. Live games use `{ status: 1, updatedAt: -1 }`. Boot calls `syncIndexes()` and keeps serving if that fails.

**The home chunk does not include the board or Stockfish.** Vite’s production build: entry JS 434 kB (132 kB gzip), CSS 12 kB (3.5 kB gzip). Separate chunks: board UI 80 kB (24 kB gzip), game page 21 kB (6.7 kB gzip, including the Stockfish client), puzzle 5.1 kB, lobby 5.0 kB, replay 3.5 kB, leaderboard 1.5 kB, history 1.4 kB. `sf.js` (21 kB) and `sf.wasm` (1.7 MB) are static files. Home does not request them; the worker script loads when an AI game needs a reply. The socket client stays on the home path because matchmaking connects there. No dependency was unused. No Redis.

**A cold Render process is still slow.** The first request after sleep can take a long time. The loading pulse covers that wait. Indexes do not change it.

### W4-F04 — UI polish and dark mode

**The theme follows the OS until the player chooses.** No saved choice means `prefers-color-scheme`. The top-bar control (and the same control on login and signup) writes `chessarena-theme` as `light` or `dark`. After that, the saved choice wins, including when the OS setting changes. An inline script in `index.html` sets `data-theme` before paint.

**Light chrome is a flat gray, not an inverted board.** Page background `#f0f0f0`, text `#262421`, muted `#5c5c5c`. Accent stays `#81b64c`, and accent buttons keep dark text via `--color-on-accent`. The green/cream board is the same in both themes. There is no second board theme.

**Loading, empty, and errors share one pattern.** Game, replay, and puzzle show a board-shaped pulse. Lists use a short pulse. Empty copy is one line for no games, an empty lobby, and no solved puzzles. Socket errors and failed API calls use one dismissible banner. Login, signup, and session bootstrap keep their own messages. A failed game, puzzle, leaderboard, history, or profile load also keeps the inline message.

**Design-spec check.** Board stays the main element; side panels stack under it on a narrow screen. No new cards, shadows, or fonts. Legal-move dots, last-move tint, and the classic board colors are unchanged. Checked at a 390px-wide viewport for home, lobby, game, puzzles, and leaderboard. A physical phone was not available here.

### W4-F03 — Automated testing

**`npm test` is one Jest run.** It builds `@chessarena/shared` first, then the API suite. The old `node:test` files now live in that suite. Jest runs with `--experimental-vm-modules` and `--runInBand`.

**The suite covers critical paths only.** Chess rules (legal move, illegal move, checkmate), ELO (win, draw, loss, and K after 30 games), JWT (round-trip, garbage, a refresh token used as access, and an already-expired access token), signup through `GET /api/users/me`, one AI move (`e2e4` stored as `e4`), and matchmaking as a pure queue pairing. Sockets and the browser are not in this suite. There is no Stockfish process and no coverage target.

**Integration tests use an in-memory MongoDB.** Each API file starts and stops its own `mongodb-memory-server`. Nothing here talks to Atlas. The shared login limiter is cleared for localhost before each HTTP test so the 429 case cannot starve signup.

### W4-F02 — Security hardening

**Login and signup share one in-memory limit of 5 requests per 15 minutes per IP.** The sixth attempt returns `429` with `RATE_LIMITED` and “Too many attempts — try again later.” The counter lives on the API process and resets on restart. One Render instance is the assumption; a second instance would need a shared store.

**Production trusts exactly one proxy hop.** `trust proxy` is `1` only when `NODE_ENV=production`, so Render’s `X-Forwarded-For` is the client IP. Locally the socket address is used, which keeps a client from spoofing the limit by sending that header.

**CORS stays an explicit allowlist.** `CORS_ORIGIN=*` fails at boot. Helmet is on for the usual headers, with CSP and COEP off and `Cross-Origin-Resource-Policy: cross-origin`, so the Vercel app can still read the Render API.

**What this pass did not add.** Refresh-token reuse detection and 2FA are not built. Production cookies stay `httpOnly`, `Secure`, and `SameSite=None` because the web and API are different sites; CSRF beyond that cookie policy is out of scope. Passwords stay bcrypt cost 12. JWT secrets stay in the environment only. Socket connections still require a valid access token.

### W4-F01 — Puzzle mode

**The solution stays on the server.** `GET /api/puzzles/daily` returns the FEN, theme, and difficulty, not the SAN line. Each of the solver's moves is posted as a prefix. A correct prefix returns only the opponent's next reply and the position after that reply. The puzzle rating changes only when the full line is solved the first time.

**A wrong try does not change `puzzleRating`.** The player can retry from the same position. Failures are not stored, so a refresh starts the position over. A solve is one `PuzzleAttempt` row. The unique `(userId, puzzleId)` index makes a duplicate submit return already-solved instead of a second increment.

**Puzzle rating uses the game ELO helper.** `nextRating(puzzleRating, puzzle.rating, 1, puzzlesSolved)` treats the puzzle as the opponent and the solve as a win. K is 32 until 30 solves, then 16, using `puzzlesSolved` the way game rating uses `ratingHistory` length. Losses are not applied, because a retry would otherwise drain rating.

**The daily puzzle is Lichess’s daily puzzle, one position for everyone.** `GET /api/puzzles/daily` calls `https://lichess.org/api/puzzle/daily` with the `User-Agent` `ChessArena`. The UCI line is converted to SAN on the server and stored under that UTC date. A later request the same day reads the cache. The solution is not sent to the browser. Lichess puzzle data is CC0, and the page links to `https://lichess.org/training/{id}`.

**If Lichess is down, the last cached daily puzzle is served.** With no cache, the day falls back to a hash of the UTC date into the seeded set. `apps/api/src/data/puzzles.json` holds those 60 fallback positions. `npm run seed:puzzles -w @chessarena/api` replays every line with chess.js and refuses to write if any move is illegal. Reseeding does not delete cached Lichess rows.

## Week 3

### W3-F06 — Game history and replay

**History lists every game the user played, as White or Black.** `GET /api/games/history` returns both seats, newest update first, with each player’s username and rating. Finished games open at `/game/:id/replay`. In-progress games stay on the live board. Any logged-in user can replay a game that is not in progress. The client steps through the stored SAN list from the start position. Move timestamps are not stored.

### W3-F05 — Leaderboard

**The leaderboard is an authenticated read of `User.rating`.** `GET /api/leaderboard?limit=50` returns `{ items }` sorted by rating descending, then username ascending so ties stay stable. A missing rating sorts and displays as 1200, the same default new users receive. `limit` defaults to 50 and rejects values outside 1–100. Each row is `{ userId, username, rating, stats }`. The page refetches on mount, so a finished game shows up after navigation without a client cache. How that number changes is W3-F01.

### W3-F04 — Spectator mode

**Spectators share the game room and are not stored.** A logged-in socket sends `spectate:join` for an in-progress PvP game it is not playing. The socket’s `role` becomes `spectator` for that game id, and it joins the same room as the players. The join emits `spectate:stateUpdate` plus the existing `game:stateUpdate` and `game:clockUpdate` to that socket only. Later moves, clocks, and `game:ended` are the room broadcasts. `spectate:leave`, navigation away, or disconnect drops the socket from the room. A player `game:join` clears the spectator role so the same socket can play afterward. Move, resign, draw, and chat from that role are rejected. `GET /api/games/:id` is readable for any logged-in user when the game is PvP; AI games stay participant-only. Finished games are shown from that read and are not joined.

**Ten thousand spectators on one Node process is out of scope.** Fan-out and CPU would need a Redis adapter, a separate broadcast tier, or an SSE CDN. None of that is built.

### W3-F03 — Game clocks and timeout

**PvP clocks are server-owned.** Each timed game keeps `turnStartedAt` in memory. The live time is `storedMs - (now - turnStartedAt)` for the side to move; the other side stays put. A 250ms tick emits `game:clockUpdate` and does not write Mongo. A move subtracts the elapsed time and then adds 5 seconds. If the clock is already at 0, the move is ignored and that side loses. Disconnect does not pause the clock. AI games and older PvP games with no `timeControl` stay untimed.

**A flag is a normal completed loss.** The server emits `game:timeout` and `game:ended` with reason `timeout`, and `completeGame` updates ratings. Client clocks only display the server values, counting the active side locally between updates and snapping back on the next packet. After a process restart, in-progress timed games resume from the saved remaining with a new `turnStartedAt`, so downtime is not deducted.

### W3-F02 — Matchmaking queue

**Find Match is an in-memory queue on the API process.** A player joins with `matchmaking:join` and leaves with `matchmaking:leave` or a disconnect of that socket. The only supported control is 10+5 (`{ initial: 600, increment: 5 }` seconds). Rating is read from the user document, and a missing rating counts as 1200.

**The longest-waiting player is matched first, using only that player's window.** The window is `min(400, 100 + 50 * floor(waitSeconds / 10))`. They take the oldest opponent inside it, so a 20-second wait at 1400 can pair with a 1200 who just joined. A fixed ±200 band was rejected because it either waits too long for close matches or never reaches a fair wider gap. A mutual-window rule was rejected so a long search can finish instead of waiting for the newer player to widen too. Pairing is checked every second. Both players are reserved before the game document is created, and accepting a direct challenge reserves them too, so one person cannot start two games. Pending challenges for the matched players are cancelled. Direct challenges otherwise stay available while searching.

**Matchmade games store clock fields and do not run them yet.** `timeControl`, `whiteTimeRemaining`, and `blackTimeRemaining` (600000 ms each) are written on the match document. Countdown and timeout belong to W3-F03. Challenge and AI games still omit those fields.

### W3-F01 — ELO rating system

**Ratings are computed on the server and only displayed by the client.** The pure functions live in `apps/api/src/lib/elo.ts`. `completeGame` applies them when a PvP game completes and appends `ratingHistory` as `{ rating, date, gameId }`. K comes from the history length before that append: 32 while it is under 30, then 16. The result is `Math.round`, then clamped at 0. An even match that ends in a win moves by K/2, so 1200 vs 1200 with K=32 becomes 1216 and 1184. New users start at 1200.

**AI games and abandoned games do not change rating.** AI completion still increments win/loss/draw stats. If one player document is missing, the handler logs, increments stats for whoever exists, and skips the rating math.

**The signed-in rating is display state, not part of the login summary.** `GET /api/users/me`, each player on a game payload (`rating: null` on the AI seat), and `lobby:onlineUsers` carry the number. The top bar, player bars, and lobby list render it. After a PvP `game:ended`, the client refetches that game and `/me` so the bars and top bar update without a full reload. A lobby tab that never rejoins keeps the rating from join time. The optional post-game delta toast is deferred. Unit tests use Node’s test runner for these functions; the Jest suite stays with W4-F03.

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
