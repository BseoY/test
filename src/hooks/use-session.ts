import { useEffect, useState } from "react";
import { getService, ServiceError, type SessionView } from "@/services";

export function useSession(token: string) {
  const [view, setView] = useState<SessionView | null>(null);
  const [error, setError] = useState<ServiceError | Error | null>(null);

  useEffect(() => {
    const svc = getService();
    let alive = true;
    svc.getSession(token).then((v) => alive && setView(v), (e) => alive && setError(e));
    const unsub = svc.subscribe(token, (v) => alive && setView(v));
    return () => {
      alive = false;
      unsub();
    };
  }, [token]);

  return { view, error };
}

/** Display-name identity, kept per browser tab. */
export function useParticipant(token: string) {
  const key = `sdi:participant:${token}`;
  const [participant, setParticipant] = useState<{ id: string; name: string } | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem(key);
    if (raw) setParticipant(JSON.parse(raw));
    setReady(true);
  }, [key]);

  async function join(name: string) {
    const { participantId } = await getService().join(token, name);
    const p = { id: participantId, name: name.trim() };
    sessionStorage.setItem(key, JSON.stringify(p));
    setParticipant(p);
  }

  return { participant, ready, join };
}

export function useCountdown(timer: SessionView["timer"] | undefined) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!timer?.startedAt) return;
    const id = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, [timer?.startedAt]);
  if (!timer) return 0;
  if (timer.startedAt === null) return timer.remainingSec;
  // remainingSec is relative to the moment the view was produced; use durationSec + startedAt for accuracy
  return Math.max(0, timer.durationSec - Math.floor((Date.now() - timer.startedAt) / 1000));
}

export function formatClock(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
