import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getService, type EndMode, type SessionLinks } from "@/services";
import { CopyLink } from "@/components/interview/CopyLink";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Whiteboard Interview — new session" },
      { name: "description", content: "Create a system-design interview with interviewer, candidate and observer links." },
      { property: "og:title", content: "Whiteboard Interview — new session" },
      { property: "og:description", content: "Create a system-design interview with interviewer, candidate and observer links." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  const [title, setTitle] = useState("");
  const [endMode, setEndMode] = useState<EndMode>("readonly_board");
  const [links, setLinks] = useState<SessionLinks | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await getService().createSession({ title, endMode });
      setLinks(res.links);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="blueprint-grid min-h-screen px-6 py-16">
      <div className="mx-auto max-w-2xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">System design / v1</p>
        <h1 className="mt-3 text-5xl font-bold tracking-tight">Whiteboard Interview</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          One link for you, one for the candidate, one for observers. No accounts.
        </p>

        {!links ? (
          <form onSubmit={create} className="mt-10 space-y-5 rounded-lg border bg-card p-6 shadow-sm">
            <label className="block">
              <span className="font-mono text-xs uppercase text-muted-foreground">Interview title</span>
              <Input
                className="mt-2"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Design a URL shortener"
                required
              />
            </label>
            <fieldset>
              <legend className="font-mono text-xs uppercase text-muted-foreground">When it ends, the candidate sees</legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(
                  [
                    ["readonly_board", "Read-only board + download"],
                    ["plain", "A plain “ended” screen"],
                  ] as const
                ).map(([v, label]) => (
                  <label
                    key={v}
                    className={`cursor-pointer rounded-md border p-3 text-sm ${endMode === v ? "border-primary bg-accent" : ""}`}
                  >
                    <input type="radio" className="sr-only" checked={endMode === v} onChange={() => setEndMode(v)} />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" size="lg" disabled={busy} className="w-full">
              Create session
            </Button>
          </form>
        ) : (
          <div className="mt-10 space-y-4 rounded-lg border bg-card p-6 shadow-sm">
            <p className="text-sm text-muted-foreground">
              Keep the interviewer link private — anyone holding it is the interviewer. Saved for 30 days.
            </p>
            <CopyLink label="Interviewer (you)" token={links.interviewer} open />
            <CopyLink label="Candidate" token={links.candidate} />
            <CopyLink label="Observer (read-only)" token={links.observer} />
          </div>
        )}
      </div>
    </main>
  );
}
