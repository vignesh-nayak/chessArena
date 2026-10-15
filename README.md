# ChessArena

Real-time multiplayer chess platform (MERN). Week 1: monorepo scaffold, MongoDB health check, deploy pipeline, and email/password auth.

## Live demo

| Surface | URL |
|---------|-----|
| Web (Vercel) | _TBD — deploy and paste URL_ |
| API (Render) | _TBD — deploy and paste URL_ |

Free-tier cold starts: the first hit to the Render API after idle can take several seconds. Retry once if health looks slow.

## Stack

- **Web:** Vite + React + TypeScript + TailwindCSS → Vercel
- **API:** Express + TypeScript + Mongoose → Render
- **DB:** MongoDB Atlas
- **Shared:** zod schemas in `packages/shared`

## Monorepo layout

```
chessArena/
  apps/web/          # Vite React frontend
  apps/api/          # Express API
  packages/shared/   # Shared types + zod schemas
  PRD/               # Feature PRDs
  DECISIONS.md       # Technical tradeoffs
```

## Local setup

### Prerequisites

- Node.js 20+
- A MongoDB Atlas cluster (connection string)

### Install

```bash
npm install
```

### Environment

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Edit `apps/api/.env`:

- `MONGODB_URI` — your Atlas connection string
- `CORS_ORIGIN` — `http://localhost:5173` for local web
- `PORT` — optional, defaults to `4000`
- `JWT_ACCESS_SECRET` — long random string (access tokens)
- `JWT_REFRESH_SECRET` — different long random string (refresh cookies)

Edit `apps/web/.env`:

- `VITE_API_URL` — `http://localhost:4000`

Never commit `.env` files. Secrets stay out of git.

### Run

```bash
npm run dev
```

- Web: http://localhost:5173
- API health: http://localhost:4000/api/health → `{ "ok": true, "mongo": "up" }`
- Auth: `/signup`, `/login`, protected `/home` (access token in memory; refresh via httpOnly cookie)
- Play vs AI: pick Easy / Medium / Hard on `/home`, then play on `/game/:id` (Stockfish runs in a browser worker)

### Auth flow (local)

1. Open `/signup`, create an account → lands on `/home`.
2. Reload the page → session restores via `POST /api/auth/refresh` then `GET /api/users/me`.
3. Log out → refresh cookie cleared; `/home` redirects to `/login`.

### Build

```bash
npm run build
```

## Deploy order

1. **MongoDB Atlas** — create a free cluster, database user, and network access. For Render free tier (no stable egress IP), allow `0.0.0.0/0`.
2. **API on Render** — connect this repo (Blueprint uses `render.yaml`). Set:
   - `MONGODB_URI`
   - `CORS_ORIGIN` = your Vercel URL (e.g. `https://your-app.vercel.app`)
   - `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` (long random values; `NODE_ENV=production` enables `SameSite=None; Secure` on the refresh cookie)
3. **Web on Vercel** — import the same repo. Root directory is the repo root; `vercel.json` builds the web app. Set:
   - `VITE_API_URL` = your Render API URL (no trailing slash), e.g. `https://chessarena-api.onrender.com`

After deploy, open the Vercel URL. You should see **ChessArena API status: OK**. Confirm in the browser Network tab that the request to `/api/health` is not blocked by CORS (status 200, no CORS error).

### Verifying CORS

1. Open the production web URL.
2. DevTools → Network → select the `health` request.
3. Request URL should be your Render host. Response headers should include `Access-Control-Allow-Origin` matching your Vercel origin (not `*`).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Build shared once, then watch shared + api + web |
| `npm run build` | Production build all workspaces |
| `npm run typecheck` | TypeScript check all workspaces |
| `npm start` | Start the built API |

## Technical decisions

See [DECISIONS.md](DECISIONS.md).
