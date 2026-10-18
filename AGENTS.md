# AGENTS.md

Instructions for coding agents working in this folder. Full rationale: `docs/interview-tool-scope-and-decisions.md`.

Working process: see `_docs/process.md`.

## Purpose

A web app for running system-design interviews. An interviewer creates a session (no login), shares a link, and both parties work on a shared real-time diagram. v1 runs locally only.

## Stack

- Backend: FastAPI (Python), REST for session management, one WebSocket endpoint for live sync.
- Frontend: React + Vite, Excalidraw embedded behind a thin wrapper component (swappable later).
- Storage: SQLite via SQLAlchemy (keep it Postgres-compatible).
- Sync: simple relay. The server holds board state and broadcasts element updates, merging with Excalidraw element versioning. No CRDT.

## Layout

```
AGENTS.md      this file
openapi.yaml   REST API contract
backend/       FastAPI app + tests/
frontend/      React + Vite app
docs/          scope and design docs
```

## Roles and sessions

- Creating a session returns three long, unguessable links: interviewer, candidate, observer. Each carries a default role.
- Roles: one interviewer, one candidate (edit or read-only, toggled live by the interviewer), any number of read-only observers.
- Lifecycle: created (candidate waits in lobby) -> started -> ended (interviewer chooses plain ended screen or read-only board with download; default read-only board) -> saved 30 days by default, reviewable and exportable.

## Server-authoritative rules

- Roles are enforced on the server. Drop edit messages from read-only connections; never rely on UI state.
- Private interviewer notes are sent only to interviewer connections. Never broadcast them.
- Validate and size-limit every board update (message size, element count, schema) before storing or relaying.
- Links are bearer secrets: generate with a CSPRNG, never log them, never put them in error messages.
- Session state transitions (start, end, role change, problem statement) are validated on the server.

## Out of scope for v1

User accounts or dashboard; built-in video, voice or chat; session replay; follow-me mode; hosted deployment and Docker; multiple boards/pages per session; mobile-optimized UI.

## Build order

1. Session API (create, start, end) plus link and role model.
2. WebSocket relay with server-side role enforcement.
3. React shell with embedded Excalidraw and live sync.
4. Lobby, display names, cursors, live edit/read-only toggle.
5. Timer, problem panel, private notes, component palette.
6. Save, review, export.

Build incrementally; keep each step testable. Do not implement later steps early.

## API contract

`openapi.yaml` is the API contract. Any change to a REST endpoint, request/response schema, or the WebSocket protocol description must update `openapi.yaml` in the same change. Validate that it parses after editing.

## Conventions

- Keep business logic in the backend; the frontend only renders server state and never decides permissions.
- Backend tests live in `backend/tests/`. Add tests for role enforcement and payload limits.
- Keep dependencies minimal; do not add libraries without need.
