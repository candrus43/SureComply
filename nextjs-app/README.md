# Next.js App Router Source (Reference)

This directory contains the Next.js 16 App Router source code designed for the SureComply MVP.
Due to sandbox disk space limitations (300MB /home partition), a full Next.js installation was
not possible. The production app uses TanStack Start (Vite + React) instead.

## Files included in the repo root:
- `src/lib/db.ts` — sql.js database layer
- `src/lib/utils.ts` — utility functions
- `src/styles/app.css` — Tailwind CSS
- `src/routes/` — TanStack Start routes

## Key architectural decisions:
- sql.js (pure JS SQLite) — no build-essential required
- bcryptjs for password hashing
- TanStack Start instead of Next.js due to environment constraints
- Cookie-based auth planned (not yet implemented)
