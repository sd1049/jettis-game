# Jettis Game

A free web-based 3D co-op block survival game vertical slice for Sister and Brother.

## Quick Start

```bash
npm install
npm run dev
```

Then open `http://localhost:5173`.

The local development server uses in-memory persistence by default. To save worlds in Postgres/Neon, set `DATABASE_URL` before starting the server.

## Scripts

- `npm run dev` starts the API/WebSocket server and Vite client together.
- `npm run build` builds `shared`, `client`, and `server`.
- `npm test` runs shared and server tests.
- `npm run typecheck` checks all TypeScript projects.

## Deployment Notes

The production server serves the built React client from `client/dist` and handles WebSockets on the same host. Configure:

- `DATABASE_URL`: Postgres/Neon connection string.
- `PORT`: Render or local port. Defaults to `8787`.
- `HOST`: bind address. Defaults to `127.0.0.1`; use `0.0.0.0` on hosts that require public container binding.

Render deployment config is included in `render.yaml`; see `DEPLOY.md`.

No accounts, memberships, real ads, payment flows, or public chat are included.
