import {
  ServiceError,
  type BoardElement,
  type CreateSessionInput,
  type InterviewService,
  type Role,
  type SessionView,
  type EndMode,
  type Participant,
  type SessionStatus,
  type TimerState,
} from "./types";

// In-browser stand-in for the FastAPI backend. It enforces the same rules the
// real server must: role checks, read-only drops, and private-notes filtering.

export const MAX_ELEMENTS = 5000;
export const MAX_PAYLOAD_BYTES = 2_000_000;
export const DEFAULT_RETENTION_DAYS = 30;

interface StoredSession {
  id: string;
  title: string;
  status: SessionStatus;
  endMode: EndMode;
  candidateCanEdit: boolean;
  problem: string;
  notes: string;
  timer: TimerState;
  elements: Record<string, BoardElement>;
  participants: Record<string, Participant>;
  tokens: Record<string, Role>;
  createdAt: number;
  expiresAt: number;
}

export interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export function memoryStore(): KeyValueStore {
  const m = new Map<string, string>();
  return { get: (k) => m.get(k) ?? null, set: (k, v) => void m.set(k, v), remove: (k) => void m.delete(k) };
}

function browserStore(): KeyValueStore {
  return {
    get: (k) => localStorage.getItem(k),
    set: (k, v) => localStorage.setItem(k, v),
    remove: (k) => localStorage.removeItem(k),
  };
}

export function randomToken(bytes = 24): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function remainingSeconds(t: TimerState, now = Date.now()): number {
  if (t.startedAt === null) return t.remainingSec;
  return Math.max(0, t.remainingSec - Math.floor((now - t.startedAt) / 1000));
}

/** Keep the higher-version copy of each element (Excalidraw versioning). */
export function mergeElements(current: Record<string, BoardElement>, incoming: BoardElement[]) {
  const next = { ...current };
  for (const el of incoming) {
    const prev = next[el.id];
    if (!prev || el.version > prev.version) next[el.id] = el;
  }
  return next;
}

export interface MockOptions {
  store?: KeyValueStore;
  now?: () => number;
  /** cross-tab notifications; disabled in tests */
  channel?: boolean;
}

export function createMockService(opts: MockOptions = {}): InterviewService {
  const store = opts.store ?? (typeof window !== "undefined" ? browserStore() : memoryStore());
  const now = opts.now ?? Date.now;
  const listeners = new Map<string, Set<(v: SessionView) => void>>();
  const bc =
    opts.channel !== false && typeof BroadcastChannel !== "undefined"
      ? new BroadcastChannel("sdi-mock")
      : null;

  const tokenKey = (t: string) => `sdi:token:${t}`;
  const sessionKey = (id: string) => `sdi:session:${id}`;

  function load(token: string): { s: StoredSession; role: Role } {
    if (typeof token !== "string" || token.length < 32) throw new ServiceError("not_found", "Invalid link");
    const id = store.get(tokenKey(token));
    const raw = id ? store.get(sessionKey(id)) : null;
    if (!id || !raw) throw new ServiceError("not_found", "Session not found");
    const s = JSON.parse(raw) as StoredSession;
    if (s.expiresAt < now()) throw new ServiceError("expired", "This session has expired");
    const role = s.tokens[token];
    if (!role) throw new ServiceError("not_found", "Session not found");
    return { s, role };
  }

  function save(s: StoredSession) {
    store.set(sessionKey(s.id), JSON.stringify(s));
    notify(s.id);
    bc?.postMessage(s.id);
  }

  function notify(sessionId: string) {
    const raw = store.get(sessionKey(sessionId));
    if (!raw) return;
    const s = JSON.parse(raw) as StoredSession;
    for (const [token, set] of listeners) {
      const role = s.tokens[token];
      if (role) set.forEach((l) => l(view(s, role)));
    }
  }
  bc?.addEventListener("message", (e) => notify(String(e.data)));

  function canEdit(s: StoredSession, role: Role) {
    if (s.status !== "started") return false;
    if (role === "interviewer") return true;
    if (role === "candidate") return s.candidateCanEdit;
    return false;
  }

  function view(s: StoredSession, role: Role): SessionView {
    const v: SessionView = {
      sessionId: s.id,
      title: s.title,
      role,
      status: s.status,
      endMode: s.endMode,
      candidateCanEdit: s.candidateCanEdit,
      canEdit: canEdit(s, role),
      problem: s.problem,
      timer: { ...s.timer, remainingSec: remainingSeconds(s.timer, now()), startedAt: s.timer.startedAt },
      elements: Object.values(s.elements),
      participants: Object.values(s.participants),
      expiresAt: s.expiresAt,
    };
    // Candidates told "plain ended" see no board at all.
    if (s.status === "ended" && s.endMode === "plain" && role !== "interviewer") v.elements = [];
    if (role === "interviewer") {
      v.notes = s.notes;
      const links = Object.fromEntries(Object.entries(s.tokens).map(([t, r]) => [r, t]));
      v.links = links as unknown as NonNullable<SessionView["links"]>;
    }
    return v;
  }

  function requireInterviewer(token: string) {
    const { s, role } = load(token);
    if (role !== "interviewer") throw new ServiceError("forbidden", "Interviewer only");
    return s;
  }

  return {
    async createSession(input: CreateSessionInput) {
      const title = input.title.trim().slice(0, 120);
      if (!title) throw new ServiceError("invalid", "Title is required");
      const id = randomToken(8);
      const links = { interviewer: randomToken(), candidate: randomToken(), observer: randomToken() };
      const days = input.retentionDays ?? DEFAULT_RETENTION_DAYS;
      const s: StoredSession = {
        id,
        title,
        status: "created",
        endMode: input.endMode ?? "readonly_board",
        candidateCanEdit: true,
        problem: "",
        notes: "",
        timer: { durationSec: 45 * 60, startedAt: null, remainingSec: 45 * 60 },
        elements: {},
        participants: {},
        tokens: { [links.interviewer]: "interviewer", [links.candidate]: "candidate", [links.observer]: "observer" },
        createdAt: now(),
        expiresAt: now() + days * 86_400_000,
      };
      for (const t of Object.values(links)) store.set(tokenKey(t), id);
      save(s);
      return { sessionId: id, links };
    },

    async getSession(token) {
      const { s, role } = load(token);
      return view(s, role);
    },

    async join(token, displayName) {
      const name = displayName.trim().slice(0, 40);
      if (!name) throw new ServiceError("invalid", "Display name is required");
      const { s, role } = load(token);
      const id = randomToken(6);
      s.participants[id] = { id, name, role, lastSeen: now() };
      save(s);
      return { participantId: id };
    },

    async leave(token, participantId) {
      const { s } = load(token);
      delete s.participants[participantId];
      save(s);
    },

    async startSession(token) {
      const s = requireInterviewer(token);
      if (s.status === "created") s.status = "started";
      save(s);
    },

    async endSession(token, mode) {
      const s = requireInterviewer(token);
      s.status = "ended";
      if (mode) s.endMode = mode;
      s.timer = { ...s.timer, remainingSec: remainingSeconds(s.timer, now()), startedAt: null };
      save(s);
    },

    async setCandidateCanEdit(token, value) {
      const s = requireInterviewer(token);
      s.candidateCanEdit = value;
      save(s);
    },

    async setProblem(token, problem) {
      const s = requireInterviewer(token);
      s.problem = problem.slice(0, 10_000);
      save(s);
    },

    async setNotes(token, notes) {
      const s = requireInterviewer(token);
      s.notes = notes.slice(0, 50_000);
      save(s);
    },

    async startTimer(token, durationSec) {
      const s = requireInterviewer(token);
      if (s.status !== "started") throw new ServiceError("invalid", "Session not started");
      const d = Math.max(1, Math.min(4 * 3600, Math.floor(durationSec)));
      s.timer = { durationSec: d, remainingSec: d, startedAt: now() };
      save(s);
    },

    async stopTimer(token) {
      const s = requireInterviewer(token);
      s.timer = { ...s.timer, remainingSec: remainingSeconds(s.timer, now()), startedAt: null };
      save(s);
    },

    async updateElements(token, elements) {
      const { s, role } = load(token);
      if (!canEdit(s, role)) return { accepted: false }; // silently drop, like the relay
      if (!Array.isArray(elements) || elements.length > MAX_ELEMENTS) return { accepted: false };
      if (JSON.stringify(elements).length > MAX_PAYLOAD_BYTES) return { accepted: false };
      if (!elements.every((e) => e && typeof e.id === "string" && typeof e.version === "number"))
        return { accepted: false };
      const merged = mergeElements(s.elements, elements);
      if (Object.keys(merged).length > MAX_ELEMENTS) return { accepted: false };
      s.elements = merged;
      save(s);
      return { accepted: true };
    },

    async updateCursor(token, participantId, cursor) {
      const { s } = load(token);
      const p = s.participants[participantId];
      if (!p) return;
      p.cursor = cursor;
      p.lastSeen = now();
      save(s);
    },

    subscribe(token, listener) {
      if (!listeners.has(token)) listeners.set(token, new Set());
      listeners.get(token)!.add(listener);
      return () => {
        listeners.get(token)?.delete(listener);
      };
    },
  };
}
