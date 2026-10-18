// Contract for every backend call the app makes. The real FastAPI client and the
// mock both implement InterviewService; UI code only ever talks to this interface.

export type Role = "interviewer" | "candidate" | "observer";
export type SessionStatus = "created" | "started" | "ended";
export type EndMode = "plain" | "readonly_board";

/** Minimal shape of an Excalidraw element we rely on for merging. */
export interface BoardElement {
  id: string;
  version: number;
  isDeleted?: boolean;
  [key: string]: unknown;
}

export interface Participant {
  id: string;
  name: string;
  role: Role;
  cursor?: { x: number; y: number };
  lastSeen: number;
}

export interface TimerState {
  durationSec: number;
  /** epoch ms when running; null when stopped */
  startedAt: number | null;
  remainingSec: number;
}

export interface SessionLinks {
  interviewer: string;
  candidate: string;
  observer: string;
}

/** What a connection is allowed to see — filtered by role on the "server". */
export interface SessionView {
  sessionId: string;
  title: string;
  role: Role;
  status: SessionStatus;
  endMode: EndMode;
  candidateCanEdit: boolean;
  /** whether *this* connection may edit the board */
  canEdit: boolean;
  problem: string;
  timer: TimerState;
  elements: BoardElement[];
  participants: Participant[];
  expiresAt: number;
  /** only present for interviewer connections */
  notes?: string;
  links?: SessionLinks;
}

export interface CreateSessionInput {
  title: string;
  endMode?: EndMode;
  retentionDays?: number;
}

export interface InterviewService {
  createSession(input: CreateSessionInput): Promise<{ sessionId: string; links: SessionLinks }>;
  getSession(token: string): Promise<SessionView>;
  join(token: string, displayName: string): Promise<{ participantId: string }>;
  leave(token: string, participantId: string): Promise<void>;
  startSession(token: string): Promise<void>;
  endSession(token: string, mode?: EndMode): Promise<void>;
  setCandidateCanEdit(token: string, canEdit: boolean): Promise<void>;
  setProblem(token: string, problem: string): Promise<void>;
  setNotes(token: string, notes: string): Promise<void>;
  startTimer(token: string, durationSec: number): Promise<void>;
  stopTimer(token: string): Promise<void>;
  /** Returns accepted=false when the connection may not edit. */
  updateElements(token: string, elements: BoardElement[]): Promise<{ accepted: boolean }>;
  updateCursor(token: string, participantId: string, cursor: { x: number; y: number }): Promise<void>;
  subscribe(token: string, listener: (view: SessionView) => void): () => void;
}

export class ServiceError extends Error {
  constructor(
    public code: "not_found" | "forbidden" | "expired" | "invalid",
    message: string,
  ) {
    super(message);
  }
}
