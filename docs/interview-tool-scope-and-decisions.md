# System-Design Interview Tool: Scope and Decision Log

A web app where an interviewer creates a session, shares a link, and runs a system-design interview on a shared real-time diagram.

## 1. Decisions and options considered

| Topic | Options considered | Decision |
|---|---|---|
| Joining | No name; display name; sign-in; link with preset role | Link plus display name, no accounts. Each link has a default role. |
| Read-only use | Problem-reading phase, interviewer walkthrough, time-boxed rounds, observers, post-interview review | Needed. The server enforces it. |
| Role changes | Live toggle; fixed at link creation; both | Both: a default role per link plus a live edit/read-only toggle by the interviewer. |
| Canvas | Basic shapes; component palette; mix; embed a library | Embed Excalidraw behind a thin wrapper (swappable later), with a system-design component palette. |
| Embed vs custom | Embed; build custom; embed with wrapper | Embed with a wrapper. Excalidraw is MIT licensed. Sync and permissions live on our own server. |
| Persistence | Ephemeral; limited-time saved; permanent dashboard; replay | Saved for a limited time (default 30 days), with review and export (PNG, JSON). Replay later. |
| Interview tools | Timer, problem panel, private notes, video/voice, chat, palette | Timer, problem panel, private interviewer notes, and palette. Video, voice and chat use the team's existing call tool. |
| Session creation | No-login two links; login; no-login now and login later | No login. Three links (interviewer, candidate, observer). Candidate waits in a lobby until the interviewer clicks "Start session". |
| Session end | Ended screen; read-only board; interviewer chooses | Interviewer chooses between a plain ended screen and a read-only board with download (default read-only board). |
| Stack | TypeScript end to end; FastAPI with React; managed realtime; Next.js | FastAPI (Python) back end with React and Vite front end. Python is the owner's stronger language. |
| Sync | Simple relay; CRDT (Yjs) | Simple relay using Excalidraw element versioning. A 1:1 interview rarely has conflicting edits. |
| Deployment | Local; single small deployment; company-grade | Local only for v1. |
| Participants | Two only; plus observers; any number | One interviewer, one candidate, any number of read-only observers via a third link. |
| Presence | Changes only; live named cursors; follow-me mode | Live named cursors in v1. Follow-me mode later. |
| Non-goals | Accounts, video/voice/chat, replay, follow-me, hosted deploy and Docker, multi-page boards, mobile UI | All out of v1. |

## 2. v1 scope

### Roles and links
- Creating a session needs no login and produces three links: interviewer, candidate, and observer.
- Whoever holds the interviewer link is the interviewer. Links are long and unguessable.
- Candidates enter a display name and wait in a lobby until the interviewer clicks "Start session".
- Each link has a default role. The interviewer can switch the candidate between edit and read-only at any time.
- One interviewer, one candidate, and any number of read-only observers.

### Canvas
- Excalidraw embedded behind a thin wrapper component.
- System-design component palette (database, cache, queue, load balancer, client, service) plus labeled arrows.
- Live cursors with display names.

### Interview tools
- Countdown timer visible to everyone.
- Shared problem-statement panel posted by the interviewer.
- Private interviewer notes, never sent to candidate or observer connections.

### Session lifecycle
1. Created: the interviewer holds the link and the candidate sees the lobby.
2. Started: the candidate enters and the timer is available.
3. Ended: the interviewer chooses between a plain "ended" screen and a read-only board with download for the candidate.
4. Saved for a limited time (default 30 days). The interviewer can reopen the link to review the board and export PNG or JSON.

## 3. Architecture
- Front end: React and Vite, with Excalidraw.
- Back end: FastAPI (Python) with REST endpoints for session management and a WebSocket endpoint for live sync.
- Sync: a simple relay. The server holds board state and broadcasts element updates, using Excalidraw element versioning to merge.
- Storage: SQLite for v1 (SQLAlchemy, so Postgres is possible later).
- Server authority: roles are enforced on the server. Edit messages from read-only connections are dropped, and private notes are only sent to interviewer connections.
- Deployment: local only for v1.

## 4. Out of scope for v1
- User accounts and an interviewer dashboard
- Built-in video, voice or chat
- Session replay
- Follow-me mode
- Hosted deployment and Docker
- Multiple boards or pages per session
- Mobile-optimized UI

## 5. Later options
- Replay timeline
- Follow-me mode
- Interviewer login and dashboard
- Hosted deployment

## 6. Suggested build order
1. Session API (create, start, end) plus link and role model.
2. WebSocket relay with server-side role enforcement.
3. React shell with embedded Excalidraw and live sync.
4. Lobby, display names, cursors, and the live edit/read-only toggle.
5. Timer, problem panel, private notes, and component palette.
6. Save, review, and export.

## 7. Risks to watch
- Interviewer link is a bearer secret: make it long and random, and never log it.
- Read-only must be enforced on the server, not only in the UI.
- Private notes must never be broadcast to non-interviewer connections.
- Validate and size-limit incoming board updates to prevent abuse.
- Excalidraw's collaboration backend is not included, so the relay and reconnect handling are our responsibility.
