import { lazy, Suspense, useEffect, useState } from "react";
import type { ExcalidrawBoardProps } from "./ExcalidrawBoard";

const ExcalidrawBoard = lazy(() => import("./ExcalidrawBoard"));

/** Client-only boundary around the canvas library. */
export function Board(props: ExcalidrawBoardProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const fallback = <div className="flex h-full items-center justify-center font-mono text-sm text-muted-foreground">Loading board…</div>;
  if (!mounted) return fallback;
  return (
    <Suspense fallback={fallback}>
      <ExcalidrawBoard {...props} />
    </Suspense>
  );
}
