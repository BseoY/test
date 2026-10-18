import { createMockService } from "./mock";
import type { InterviewService } from "./types";

export * from "./types";

// Single entry point for all backend calls. Swap this for a FastAPI-backed
// implementation (REST + WebSocket) without touching UI code.
let instance: InterviewService | null = null;

export function getService(): InterviewService {
  if (!instance) instance = createMockService();
  return instance;
}

export function setService(service: InterviewService) {
  instance = service;
}
