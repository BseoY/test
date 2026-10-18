# System-Design Interview Tool: v1 Scope

## Purpose
Interviewers create a session, share a link, and run a system-design interview on a shared real-time diagram.

## Roles and links
- Creating a session needs no login and produces three links: interviewer, candidate, and observer.
- Whoever holds the interviewer link is the interviewer. Links are long and unguessable.
- Candidates enter a display name and wait in a lobby until the interviewer clicks "Start session".
- Each link has a default role. The interviewer can switch the candidate between edit and read-only at any time.
- One interviewer, one candidate, and any number of read-only observers.

## Canvas
- Excalidraw embedded behind a thin wrapper component so it can be swapped later.
- System-design component palette (database, cache, queue, load balancer, client, service) plus labeled arrows.
- Live cursors with display names.

## Interview tools
- Countdown timer visible to everyone.
- Shared problem-statement panel posted by the interviewer.
- Private interviewer notes, never sent to candidate or observer connections.

## Session lifecycle
1. Created: the interviewer holds the link and the candidate sees the lobby.
2. Started: the candidate enters and the timer is available.
3. Ended: the interviewer chooses between a plain "ended" screen and a read-only board with download for the candidate.
4. Saved for a limited time (default 30 days). The interviewer can reopen the link to review the board and export PNG or JSON.

## Architecture
- Front end: React and Vite, with Excalidraw.
- Back end: FastAPI (Python) with REST endpoints for session management and a WebSocket endpoint for live sync.
- Sync: a simple relay. The server holds board state and broadcasts element updates, using Excalidraw element versioning to merge.
- Storage: SQLite for v1 (SQLAlchemy, so Postgres is possible later).
- Server authority: roles are enforced on the server. Edit messages from read-only connections are dropped, and private notes are only sent to interviewer connections.
- Deployment: local only for v1.

## Out of scope for v1
- User accounts and an interviewer dashboard
- Built-in video, voice or chat
- Session replay
- Follow-me mode
- Hosted deployment and Docker
- Multiple boards or pages per session
- Mobile-optimized UI

## Later options
- Replay timeline
- Follow-me mode
- Interviewer login and dashboard
- Hosted deployment

## Suggested build order
1. Session API (create, start, end) plus link and role model.
2. WebSocket relay with server-side role enforcement.
3. React shell with embedded Excalidraw and live sync.
4. Lobby, display names, cursors, and the live edit/read-only toggle.
5. Timer, problem panel, private notes, and component palette.
6. Save, review, and export.
