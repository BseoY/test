## 1. Backend project skeleton with one passing test
Goal: Create an empty FastAPI project with a passing pytest, independent of the frontend.
Description: In `backend/`, add a `requirements.txt` (fastapi, uvicorn, sqlalchemy, pytest, httpx), an `app/main.py` that creates a FastAPI app with a `GET /health` route returning `{"status": "ok"}`, and `tests/test_health.py` that checks it with the FastAPI test client. Running `pytest` from `backend/` must pass. Do not add any session or database code.

## 2. Database setup and Session model
Goal: Add SQLAlchemy with SQLite and a `Session` table that can be saved and loaded.
Description: In `backend/app/`, add a database module (engine, session factory, `Base`, a FastAPI dependency) pointing at a local SQLite file, configurable by an environment variable, plus a `Session` model. Columns: public id, optional title, status (`created`, `started`, `ended`), candidate role (`edit` or `read_only`), candidate end screen (`ended_screen` or `read_only_board`, nullable), problem statement, private notes, timer seconds, created/started/ended/expires timestamps, and hashed token columns for interviewer, candidate and observer. Add a pytest that uses an in-memory SQLite database to insert and read back a row.

## 3. Create session endpoint with three links
Goal: Implement `POST /api/sessions`, which needs no login and returns interviewer, candidate and observer links.
Description: Generate three tokens with a CSPRNG (for example `secrets.token_urlsafe(32)`), store only their hashes, and return `{sessionId, links: {interviewer, candidate, observer}}` with HTTP 201, where each link is a frontend URL carrying its raw token. The optional body accepts `title`, `timerSeconds` (60 to 14400) and `defaultCandidateRole`. New sessions start with status `created`, and expiry is set to 30 days from creation (configurable). Never log the raw tokens. Add tests for the response shape, validation errors (422) and that raw tokens are not stored.

## 4. Token authentication and role resolution
Goal: Add a reusable dependency that maps an `X-Session-Token` header to a role for one session, and implement `GET /api/sessions/{sessionId}`.
Description: Roles are `interviewer`, `candidate` and `observer`, derived only from which stored token hash matches (use constant-time comparison). A missing or wrong token returns 401 and an unknown session returns 404. The GET response returns the session fields plus `yourRole`, and includes private `notes` only when the caller is the interviewer. Add tests for each role, a bad token, and a token for a different session.

## 5. Start session endpoint
Goal: Implement `POST /api/sessions/{sessionId}/start`, which only the interviewer can call.
Description: Using the token-to-role dependency (roles are enforced on the server, never by the client), allow only the interviewer to move a session from `created` to `started` and record `startedAt`. Candidate and observer tokens get 403, and starting a session that is not `created` gets 409. Return the updated session. Add tests for success, 403 and 409.

## 6. End session endpoint with candidate end-screen choice
Goal: Implement `POST /api/sessions/{sessionId}/end` with the interviewer's choice of what the candidate sees afterwards.
Description: Only the interviewer may call it, and only when the session is `started` (otherwise 409). The optional body is `{candidateEndScreen}` with values `ended_screen` or `read_only_board`, defaulting to `read_only_board`. Store the choice, set status `ended`, record `endedAt`, and return the session. Add tests for both choices, the default, 403 for other roles and 409 for the wrong status.

## 7. Candidate edit/read-only toggle endpoint
Goal: Implement `PUT /api/sessions/{sessionId}/candidate-role` so the interviewer can switch the candidate between `edit` and `read_only` at any time.
Description: The body is `{role}` with values `edit` or `read_only`. Only the interviewer may call it, and it works in any status except `ended`. Persist the value on the session and return the session. Code the change as a small function that other parts of the backend can call or hook later, for example to notify live connections. Add tests for success, an invalid value (422) and 403 for other roles.

## 8. Problem statement endpoint
Goal: Implement `PUT /api/sessions/{sessionId}/problem` so the interviewer can post the problem shown to everyone.
Description: The body is `{problemStatement}`, a string of at most 10000 characters. Only the interviewer may call it. Oversized bodies get 413 or 422, and the stored text is returned by `GET /api/sessions/{sessionId}` for every role. Add tests for success, the length limit and 403 for candidate and observer.

## 9. Private notes storage and visibility
Goal: Store interviewer-private notes and guarantee that only the interviewer role can ever read them over REST.
Description: Add a small backend function to save notes (size-limited, for example 20000 characters) on the session, and make `GET /api/sessions/{sessionId}` return the `notes` field only for the interviewer token and omit it (or return null) for candidate and observer tokens. No other REST response may contain notes. Add tests proving candidate and observer responses never contain the notes text.

## 10. WebSocket endpoint with authentication and init message
Goal: Add `GET /ws/sessions/{sessionId}?token=...&name=...` that authenticates a connection and sends an initial state message.
Description: Resolve the role from the token the same way the REST API does and close with code 4401 for a bad token. Track connections per session in a connection manager that records role and display name (trim and length-limit the name). On connect, send an `init` JSON frame with session status, problem statement, candidate role, current board elements (empty for now) and the participant list. Include private notes only if the connection is the interviewer. Test with the FastAPI WebSocket test client for each role.

## 11. WebSocket board update relay with role enforcement
Goal: Relay `board_update` messages between connections, dropping them when the sender is not allowed to edit.
Description: A connection may edit only if it is the interviewer, or the candidate while the session is `started` and the candidate role is `edit`; observers and a read-only candidate are dropped (ignored, not relayed or stored). Valid updates carry changed Excalidraw elements; the server merges them into in-memory board state by element id, keeping the element with the higher `version` (tie-break on `versionNonce`), then broadcasts them to all other connections. Add tests for each role and for an edit after the candidate is set to read-only.

## 12. WebSocket cursor relay and session event broadcasts
Goal: Relay cursor positions and push session changes to live connections.
Description: Add a `cursor` message (x, y) relayed to all other connections with the sender's display name and role; every role may send cursors. Also broadcast `session_event` frames when the session is started, ended, when the candidate role changes, and when the problem statement changes, by calling a shared broadcast function from the REST handlers. After a role change the server must apply the new permission to that candidate's next board update. Add tests for cursor relay and for a role-change event reaching the candidate.

## 13. WebSocket private notes messages
Goal: Let the interviewer edit notes over the WebSocket while guaranteeing they are never sent to other connections.
Description: Accept a `notes_update` frame only from interviewer connections and persist it (same size limit as the stored notes field); ignore it from candidate and observer connections. Never relay notes to any connection other than interviewer connections, including in `init` and `session_event` frames. Add tests that a connected candidate and observer receive no frame containing the notes text when the interviewer updates them.

## 14. Validation and size limits for board updates
Goal: Reject malformed or oversized WebSocket frames and REST bodies.
Description: In the backend, define limits in one config module: maximum WebSocket frame size in bytes, maximum elements per `board_update`, maximum total elements per board, maximum size of a single element, maximum display name length, and message rate per connection. Validate each frame against a schema (known `type`, required fields, element fields such as `id`, `version`, `versionNonce`), drop or close with a clear code on violation, and never crash the relay on bad input. Add tests for oversized frames, invalid JSON, unknown message types and too many elements.

## 15. Board persistence and 30-day expiry
Goal: Save board state to SQLite and expire old sessions.
Description: Store the board elements as JSON linked to the session, written when the last connection leaves, periodically while connected, and on session end, and loaded into memory on the next connection. Sessions expire 30 days after creation (configurable): expired sessions return 404 from every REST and WebSocket endpoint, and a cleanup function deletes expired rows and their boards, runnable on app startup and from a test. Add tests for reloading a saved board and for expiry using an injected clock or timestamp.

## 16. Board export endpoint
Goal: Implement `GET /api/sessions/{sessionId}/export` returning the board as Excalidraw JSON.
Description: Return `{type: "excalidraw", version, source, elements, appState}` read from the saved board. The interviewer may always export; the candidate may export only when the session is `ended` with `candidateEndScreen` equal to `read_only_board`; observers get 403. Missing or bad tokens get 401 and expired or unknown sessions get 404. Add tests for each role and each end-screen choice.

## 17. OpenAPI contract check
Goal: Add a test that keeps `openapi.yaml` and the FastAPI routes in sync.
Description: `openapi.yaml` is the REST API contract and must be updated with any API change. Write a pytest in `backend/tests/` that validates the YAML against the OpenAPI 3 spec (using `openapi-spec-validator`) and checks that every path and method in the file exists in the FastAPI app, and that every `/api/` route in the app is documented in the file. Fix any differences found by correcting the YAML or the route, and note the check in `backend/README.md`.

## 18. Frontend project with one passing test
Goal: Create an empty Vite + React + TypeScript project with a passing test, independent of the backend.
Description: In `frontend/`, scaffold Vite with React and TypeScript, add Vitest and React Testing Library, and render a minimal `App` component with a placeholder heading. Add one test that renders `App` and finds the heading, and make `npm test` pass. Do not install Excalidraw or call any API yet.

## 19. Typed API client
Goal: Write a small typed client for the REST API in the frontend.
Description: In `frontend/src/api/`, add TypeScript types matching the schemas in `openapi.yaml` (session, links, roles, candidate role, end screen, board export, error) and functions for create, get, start, end, set candidate role, set problem and export. Every call except create sends the session token in the `X-Session-Token` header, and the base URL comes from a Vite environment variable defaulting to `http://localhost:8000`. Test it with a mocked `fetch`, including the header and error handling.

## 20. Excalidraw wrapper component
Goal: Embed Excalidraw behind a thin wrapper so it can be swapped later.
Description: Install `@excalidraw/excalidraw` and create `frontend/src/components/Board/` with a `Board` component whose props are only app-level: `elements`, `readOnly`, `onElementsChange`, and `onPointerMove`. Nothing outside this folder may import Excalidraw directly. When `readOnly` is true, set Excalidraw's view mode so the UI blocks editing (the server remains the authority). Add a test that renders the wrapper with a mocked Excalidraw module and checks the props are passed through.

## 21. Join pages, display name and lobby
Goal: Build the entry flow where a person opens a link, enters a display name, and candidates wait in a lobby.
Description: Links look like `/s/<sessionId>#<token>` or similar (pick one and document it in `frontend/README.md`); read the token from the URL and keep it in memory or session storage. Show a display-name form, then call `GET /api/sessions/{sessionId}` with the token. If the status is `created` and the role is `candidate`, show a lobby message until the status becomes `started` (poll until live updates exist); interviewers and observers go straight to the session view. Add tests for the name form, the lobby state, and an invalid token error screen.

## 22. WebSocket client hook and live board sync
Goal: Connect the frontend to `/ws/sessions/{sessionId}` and keep the board synced.
Description: Add a `useSessionSocket` hook in `frontend/src/` that opens the WebSocket with the token and display name, handles the `init`, `board_update`, `cursor` and `session_event` frames, and exposes a send function. Send only changed elements (by `version`) from the board wrapper's change callback, merge incoming elements by id keeping the higher `version`, and reconnect with backoff, re-requesting `init` on reconnect. Test the hook with a mock WebSocket for init, merge and reconnect.

## 23. Live named cursors
Goal: Show other participants' cursors with their display names on the board.
Description: Send throttled pointer positions (for example every 50 ms) from the board wrapper's pointer callback as `cursor` frames, and render remote cursors with display names and a color per participant using Excalidraw's collaborators support inside the wrapper. Remove a cursor when its participant leaves or goes idle. Test that incoming cursor frames produce the expected collaborator map and that sending is throttled.

## 24. Interviewer controls
Goal: Give the interviewer buttons to start the session, end it, and toggle the candidate between edit and read-only.
Description: Show a control bar only when `yourRole` is `interviewer`. "Start session" calls `POST /api/sessions/{sessionId}/start`; "End session" opens a dialog to choose a plain ended screen or a read-only board with download (default read-only board) and calls `POST /api/sessions/{sessionId}/end`; the edit/read-only toggle calls `PUT /api/sessions/{sessionId}/candidate-role`. Show errors from the API. Add tests with a mocked API client for each button and for the control bar being hidden for other roles.

## 25. Countdown timer
Goal: Show a countdown timer that everyone sees.
Description: Compute remaining time from the session's `timerSeconds` and `startedAt` (using the server timestamps so all clients agree, with a small correction for clock skew if possible), display it as mm:ss, and show a clear "time is up" state at zero without ending the session. Show nothing when no timer is configured or the session has not started. Add tests with fake timers for counting down, the zero state, and the hidden states.

## 26. Problem statement panel
Goal: Show the shared problem statement and let the interviewer edit it.
Description: Add a collapsible panel visible to every role that displays the problem statement from the session state and updates when a `session_event` for a problem change arrives. For the interviewer, add an edit mode with a textarea (10000 character limit) that saves through `PUT /api/sessions/{sessionId}/problem`. Candidates and observers get read-only text with no edit control. Add tests for display, editing, and the hidden edit control for non-interviewers.

## 27. Private notes panel
Goal: Give the interviewer a private notes panel that other roles never see.
Description: Render the panel only when the role is `interviewer`; do not even mount it, or request notes, for candidates and observers. Load notes from the `init` frame (or `GET /api/sessions/{sessionId}`), and send debounced `notes_update` frames over the WebSocket as the interviewer types, with a saved/saving indicator and the same size limit as the backend. Add tests for the interviewer view, the absence of the panel for other roles, and the debounce.

## 28. System-design component palette
Goal: Add a palette of system-design components that can be placed on the board.
Description: In the board feature area, add a palette with database, cache, queue, load balancer, client and service. Clicking or dragging an item inserts a labeled Excalidraw element (shape plus text) onto the board through the wrapper's API, and arrows with labels remain available through Excalidraw's own arrow tool. Hide or disable the palette when the board is read-only. Add tests that each item creates the expected element definition and that the palette is disabled in read-only mode.

## 29. Ended screens
Goal: Show the right screen to each role when the session ends.
Description: When a `session_event` reports `ended` (or the page loads with an ended session), show the candidate either a plain "session ended" screen or, if the session's `candidateEndScreen` is `read_only_board`, the read-only board with a download button that uses the export endpoint. Observers see the ended state with the read-only board; the interviewer sees the board with the review tools. Add tests for each role and each end-screen choice with mocked session state.

## 30. Review and export screens
Goal: Let the interviewer reopen a saved session link to review the board and export it as PNG or JSON.
Description: When an interviewer opens their link for an `ended` session (within the 30-day retention window), load the saved board from `GET /api/sessions/{sessionId}/export` and show it read-only with the problem statement and private notes. Add "Export JSON" (download the export response) and "Export PNG" (generated client-side from the board through the wrapper) buttons, and show a friendly "session expired" screen on a 404. Add tests for the JSON download, the PNG export call and the expired state.
