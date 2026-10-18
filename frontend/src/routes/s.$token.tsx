import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { getService, type SessionView } from "@/services";
import { useSession, useParticipant, useCountdown, formatClock } from "@/hooks/use-session";
import { Board } from "@/components/interview/Board";
import { COMPONENTS, type BoardApi, type ComponentKind } from "@/components/interview/board-types";
import { CopyLink } from "@/components/interview/CopyLink";

export const Route = createFileRoute("/s/$token")({
  head: () => ({
    meta: [
      { title: "Interview session — Whiteboard Interview" },
      { name: "description", content: "Live system-design interview whiteboard." },
      { property: "og:title", content: "Interview session — Whiteboard Interview" },
      { property: "og:description", content: "Live system-design interview whiteboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SessionPage,
});

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="blueprint-grid flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md rounded-lg border bg-card p-8 text-center shadow-sm">{children}</div>
    </main>
  );
}

function SessionPage() {
  const { token } = Route.useParams();
  const { view, error } = useSession(token);
  const { participant, ready, join } = useParticipant(token);

  if (error)
    return (
      <Centered>
        <h1 className="text-2xl font-bold">Link not available</h1>
        <p className="mt-2 text-muted-foreground">{error.message}</p>
        <Button asChild className="mt-6"><Link to="/">New session</Link></Button>
      </Centered>
    );
  if (!view || !ready) return <Centered><p className="font-mono text-sm">Connecting…</p></Centered>;

  if (!participant) return <JoinForm view={view} onJoin={join} />;

  if (view.role !== "interviewer" && view.status === "created")
    return (
      <Centered>
        <p className="font-mono text-xs uppercase tracking-widest text-primary">Lobby</p>
        <h1 className="mt-2 text-2xl font-bold">{view.title}</h1>
        <p className="mt-3 text-muted-foreground">Hi {participant.name}. Waiting for the interviewer to start…</p>
        <div className="mx-auto mt-6 h-1 w-24 animate-pulse rounded bg-primary" />
      </Centered>
    );

  if (view.role !== "interviewer" && view.status === "ended" && view.endMode === "plain")
    return (
      <Centered>
        <h1 className="text-2xl font-bold">Interview ended</h1>
        <p className="mt-2 text-muted-foreground">Thanks for your time, {participant.name}.</p>
      </Centered>
    );

  return <Workspace token={token} view={view} participant={participant} />;
}

function JoinForm({ view, onJoin }: { view: SessionView; onJoin: (n: string) => Promise<void> }) {
  const [name, setName] = useState("");
  return (
    <Centered>
      <p className="font-mono text-xs uppercase tracking-widest text-primary">Joining as {view.role}</p>
      <h1 className="mt-2 text-2xl font-bold">{view.title}</h1>
      <form
        className="mt-6 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void onJoin(name);
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your display name" required maxLength={40} />
        <Button type="submit" className="w-full">Join</Button>
      </form>
    </Centered>
  );
}

function Workspace({ token, view, participant }: { token: string; view: SessionView; participant: { id: string; name: string } }) {
  const svc = getService();
  const boardApi = useRef<BoardApi | null>(null);
  const isInt = view.role === "interviewer";
  const remaining = useCountdown(view.timer);

  async function download(kind: "png" | "json") {
    const api = boardApi.current;
    if (!api) return;
    const blob = kind === "png" ? await api.exportPng() : new Blob([api.exportJson()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${view.title.replace(/\W+/g, "-")}.${kind === "png" ? "png" : "excalidraw"}`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-4 border-b bg-ink px-4 py-2 text-ink-foreground">
        <Link to="/" className="font-mono text-xs uppercase tracking-widest text-primary">SDI</Link>
        <h1 className="truncate font-semibold">{view.title}</h1>
        <span className="rounded border border-ink-foreground/30 px-2 py-0.5 font-mono text-xs uppercase">{view.status}</span>
        <span className="rounded bg-primary px-2 py-0.5 font-mono text-xs uppercase text-primary-foreground">{view.role}</span>
        {!view.canEdit && <span className="font-mono text-xs opacity-70">read-only</span>}
        <div className="ml-auto flex items-center gap-3">
          <span className={`font-mono text-xl tabular-nums ${remaining === 0 && view.timer.startedAt ? "text-primary" : ""}`} aria-label="Timer">
            {formatClock(remaining)}
          </span>
          {isInt && view.status === "created" && (
            <Button size="sm" onClick={() => svc.startSession(token)}>Start session</Button>
          )}
          {isInt && view.status === "started" && (
            <Button size="sm" variant="destructive" onClick={() => svc.endSession(token)}>End</Button>
          )}
          {view.status === "ended" && (
            <>
              <Button size="sm" variant="secondary" onClick={() => download("png")}>PNG</Button>
              <Button size="sm" variant="secondary" onClick={() => download("json")}>JSON</Button>
            </>
          )}
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <aside className="w-72 shrink-0 space-y-5 overflow-y-auto border-r bg-card p-4">
          <ProblemPanel token={token} view={view} />
          {view.canEdit && <Palette api={boardApi} />}
          <People view={view} selfId={participant.id} />
          {isInt && <InterviewerTools token={token} view={view} />}
        </aside>
        <section className="relative min-w-0 flex-1">
          <Board
            elements={view.elements}
            canEdit={view.canEdit}
            participants={view.participants}
            selfId={participant.id}
            onLocalChange={(els) => void svc.updateElements(token, els)}
            onPointer={(pos) => void svc.updateCursor(token, participant.id, pos)}
            onReady={(api) => (boardApi.current = api)}
          />
        </section>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">{children}</h2>;
}

function ProblemPanel({ token, view }: { token: string; view: SessionView }) {
  const [draft, setDraft] = useState(view.problem);
  if (view.role !== "interviewer")
    return (
      <div>
        <SectionTitle>Problem</SectionTitle>
        <p className="whitespace-pre-wrap text-sm">{view.problem || <span className="text-muted-foreground">No problem posted yet.</span>}</p>
      </div>
    );
  return (
    <div>
      <SectionTitle>Problem (shared)</SectionTitle>
      <Textarea rows={5} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Design a URL shortener that…" />
      <Button size="sm" className="mt-2 w-full" variant="outline" disabled={draft === view.problem} onClick={() => getService().setProblem(token, draft)}>
        Post to everyone
      </Button>
    </div>
  );
}

function Palette({ api }: { api: React.RefObject<BoardApi | null> }) {
  const [label, setLabel] = useState("");
  return (
    <div>
      <SectionTitle>Components</SectionTitle>
      <div className="grid grid-cols-2 gap-1.5">
        {(Object.keys(COMPONENTS) as ComponentKind[]).map((k) => (
          <Button key={k} size="sm" variant="outline" className="justify-start text-xs" onClick={() => api.current?.addComponent(k)}>
            {COMPONENTS[k].label}
          </Button>
        ))}
      </div>
      <div className="mt-2 flex gap-1.5">
        <Input className="h-8 text-xs" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Arrow label" />
        <Button size="sm" variant="outline" onClick={() => { api.current?.addArrow(label); setLabel(""); }}>→</Button>
      </div>
    </div>
  );
}

function People({ view, selfId }: { view: SessionView; selfId: string }) {
  return (
    <div>
      <SectionTitle>In the room</SectionTitle>
      <ul className="space-y-1 text-sm">
        {view.participants.map((p) => (
          <li key={p.id} className="flex justify-between">
            <span>{p.name}{p.id === selfId && " (you)"}</span>
            <span className="font-mono text-xs text-muted-foreground">{p.role}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function InterviewerTools({ token, view }: { token: string; view: SessionView }) {
  const svc = getService();
  const [minutes, setMinutes] = useState(45);
  const [notes, setNotes] = useState(view.notes ?? "");
  useEffect(() => {
    const id = setTimeout(() => { if (notes !== (view.notes ?? "")) void svc.setNotes(token, notes); }, 500);
    return () => clearTimeout(id);
  }, [notes]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div>
        <SectionTitle>Candidate can edit</SectionTitle>
        <div className="flex items-center gap-2 text-sm">
          <Switch checked={view.candidateCanEdit} onCheckedChange={(v) => svc.setCandidateCanEdit(token, v)} aria-label="Candidate can edit" />
          {view.candidateCanEdit ? "Editing" : "Read-only"}
        </div>
      </div>
      <div>
        <SectionTitle>Timer</SectionTitle>
        <div className="flex gap-1.5">
          <Input type="number" min={1} max={240} className="h-8 w-20" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />
          <Button size="sm" variant="outline" disabled={view.status !== "started"} onClick={() => svc.startTimer(token, minutes * 60)}>Start</Button>
          <Button size="sm" variant="ghost" onClick={() => svc.stopTimer(token)}>Stop</Button>
        </div>
      </div>
      <div>
        <SectionTitle>Private notes</SectionTitle>
        <Textarea rows={6} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Only you can see these." />
      </div>
      {view.links && (
        <div className="space-y-3">
          <SectionTitle>Links</SectionTitle>
          <CopyLink label="Candidate" token={view.links.candidate} />
          <CopyLink label="Observer" token={view.links.observer} />
        </div>
      )}
    </>
  );
}
