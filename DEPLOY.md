# Deploy Jettis Game

This app is configured for a free Render web service using `render.yaml`.

## Prerequisites

- A GitHub or GitLab repository containing this project.
- A Render account connected to that Git provider.
- A Neon Postgres database connection string for persistent world codes.

## Render Deployment

1. Push this repository to GitHub or GitLab.
2. In Render, create a new Blueprint from the repo.
3. Render will read `render.yaml` and create a free Node web service.
4. When prompted for `DATABASE_URL`, paste the Neon pooled connection string.
5. Wait for the deploy to finish, then open the `*.onrender.com` URL.

## Environment Variables

- `NODE_VERSION=24.14.1`
- `HOST=0.0.0.0`
- `DATABASE_URL=postgresql://...`

`DATABASE_URL` is marked `sync: false` in `render.yaml` so the database password is never committed to Git.

## Notes

- Render free services can sleep when idle, so the first visit after a while may be slow.
- Without `DATABASE_URL`, the app still runs, but save codes are stored only in server memory and can disappear after restarts.
- `/health` is the Render health check endpoint.
