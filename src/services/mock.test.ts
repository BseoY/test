import { describe, expect, it } from "vitest";
import { createMockService, memoryStore, mergeElements } from "./mock";

function setup(now = () => 1_000_000) {
  return createMockService({ store: memoryStore(), channel: false, now });
}

async function started() {
  const svc = setup();
  const { links } = await svc.createSession({ title: "Design Twitter" });
  await svc.startSession(links.interviewer);
  return { svc, links };
}

const el = (id: string, version: number) => ({ id, version });

describe("mock interview service", () => {
  it("creates three distinct, long links with their default roles", async () => {
    const svc = setup();
    const { links } = await svc.createSession({ title: "X" });
    const all = [links.interviewer, links.candidate, links.observer];
    expect(new Set(all).size).toBe(3);
    all.forEach((t) => expect(t.length).toBeGreaterThanOrEqual(48));
    expect((await svc.getSession(links.interviewer)).role).toBe("interviewer");
    expect((await svc.getSession(links.candidate)).role).toBe("candidate");
    expect((await svc.getSession(links.observer)).role).toBe("observer");
  });

  it("keeps sessions for 30 days by default, then expires them", async () => {
    let t = 0;
    const svc = setup(() => t);
    const { links } = await svc.createSession({ title: "X" });
    t = 30 * 86_400_000 - 1;
    await expect(svc.getSession(links.candidate)).resolves.toBeTruthy();
    t = 30 * 86_400_000 + 1;
    await expect(svc.getSession(links.candidate)).rejects.toMatchObject({ code: "expired" });
  });

  it("defaults to showing a read-only board when the session ends", async () => {
    const svc = setup();
    const { links } = await svc.createSession({ title: "X" });
    expect((await svc.getSession(links.interviewer)).endMode).toBe("readonly_board");
  });

  it("candidate cannot edit until the interviewer starts the session", async () => {
    const svc = setup();
    const { links } = await svc.createSession({ title: "X" });
    expect((await svc.updateElements(links.candidate, [el("a", 1)])).accepted).toBe(false);
    await svc.startSession(links.interviewer);
    expect((await svc.updateElements(links.candidate, [el("a", 1)])).accepted).toBe(true);
  });

  it("only the interviewer can start the session", async () => {
    const svc = setup();
    const { links } = await svc.createSession({ title: "X" });
    await expect(svc.startSession(links.candidate)).rejects.toMatchObject({ code: "forbidden" });
  });

  it("drops edits from observers", async () => {
    const { svc, links } = await started();
    expect((await svc.updateElements(links.observer, [el("a", 1)])).accepted).toBe(false);
    expect((await svc.getSession(links.interviewer)).elements).toHaveLength(0);
  });

  it("drops candidate edits when switched to read-only", async () => {
    const { svc, links } = await started();
    await svc.setCandidateCanEdit(links.interviewer, false);
    expect((await svc.updateElements(links.candidate, [el("a", 1)])).accepted).toBe(false);
    await svc.setCandidateCanEdit(links.interviewer, true);
    expect((await svc.updateElements(links.candidate, [el("a", 1)])).accepted).toBe(true);
  });

  it("candidate cannot toggle their own edit rights", async () => {
    const { svc, links } = await started();
    await expect(svc.setCandidateCanEdit(links.candidate, true)).rejects.toMatchObject({ code: "forbidden" });
  });

  it("never exposes private notes or links to candidate or observer", async () => {
    const { svc, links } = await started();
    await svc.setNotes(links.interviewer, "weak on caching");
    expect((await svc.getSession(links.interviewer)).notes).toBe("weak on caching");
    for (const t of [links.candidate, links.observer]) {
      const v = await svc.getSession(t);
      expect(v.notes).toBeUndefined();
      expect(v.links).toBeUndefined();
      expect(JSON.stringify(v)).not.toContain("weak on caching");
    }
  });

  it("subscribers for candidates never receive notes", async () => {
    const { svc, links } = await started();
    const seen: string[] = [];
    svc.subscribe(links.candidate, (v) => seen.push(JSON.stringify(v)));
    await svc.setNotes(links.interviewer, "secret-note");
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.join()).not.toContain("secret-note");
  });

  it("rejects oversized board updates", async () => {
    const { svc, links } = await started();
    const many = Array.from({ length: 5001 }, (_, i) => el(String(i), 1));
    expect((await svc.updateElements(links.interviewer, many)).accepted).toBe(false);
  });

  it("merges by element version, keeping the newer copy", () => {
    const merged = mergeElements({ a: { id: "a", version: 3, v: "new" } }, [
      { id: "a", version: 2, v: "old" },
      { id: "b", version: 1 },
    ]);
    expect(merged["a"]?.["v"]).toBe("new");
    expect(Object.keys(merged)).toEqual(["a", "b"]);
  });

  it("plain end hides the board from candidates but not the interviewer", async () => {
    const { svc, links } = await started();
    await svc.updateElements(links.interviewer, [el("a", 1)]);
    await svc.endSession(links.interviewer, "plain");
    expect((await svc.getSession(links.candidate)).elements).toHaveLength(0);
    expect((await svc.getSession(links.interviewer)).elements).toHaveLength(1);
    expect((await svc.getSession(links.interviewer)).canEdit).toBe(false);
  });

  it("timer counts down from the set duration", async () => {
    let t = 0;
    const svc = setup(() => t);
    const { links } = await svc.createSession({ title: "X" });
    await svc.startSession(links.interviewer);
    await svc.startTimer(links.interviewer, 600);
    t = 90_000;
    expect((await svc.getSession(links.candidate)).timer.remainingSec).toBe(510);
  });

  it("rejects unknown links", async () => {
    const svc = setup();
    await expect(svc.getSession("x".repeat(48))).rejects.toMatchObject({ code: "not_found" });
  });
});
