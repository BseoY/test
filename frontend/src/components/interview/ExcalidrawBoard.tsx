// Thin wrapper around Excalidraw. Everything Excalidraw-specific lives here so the
// canvas library can be swapped later. Browser-only: load via React.lazy.
import { useEffect, useRef } from "react";
import {
  Excalidraw,
  convertToExcalidrawElements,
  exportToBlob,
  serializeAsJSON,
  CaptureUpdateAction,
} from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import type { BoardElement, Participant } from "@/services";
import type { BoardApi, ComponentKind } from "./board-types";
import { COMPONENTS } from "./board-types";

type ExApi = Parameters<NonNullable<React.ComponentProps<typeof Excalidraw>["excalidrawAPI"]>>[0];

export interface ExcalidrawBoardProps {
  elements: BoardElement[];
  canEdit: boolean;
  participants: Participant[];
  selfId?: string;
  onLocalChange: (changed: BoardElement[]) => void;
  onPointer: (pos: { x: number; y: number }) => void;
  onReady: (api: BoardApi) => void;
}

export default function ExcalidrawBoard(props: ExcalidrawBoardProps) {
  const apiRef = useRef<ExApi | null>(null);
  const versions = useRef(new Map<string, number>());
  const propsRef = useRef(props);
  propsRef.current = props;

  // Apply remote elements
  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;
    const local = new Map(api.getSceneElementsIncludingDeleted().map((e) => [e.id, e]));
    let changed = false;
    for (const el of props.elements) {
      const cur = local.get(el.id);
      if (!cur || el.version > cur.version) {
        local.set(el.id, el as never);
        changed = true;
      }
      versions.current.set(el.id, Math.max(el.version, versions.current.get(el.id) ?? 0));
    }
    if (changed) {
      api.updateScene({ elements: [...local.values()], captureUpdate: CaptureUpdateAction.NEVER });
    }
  }, [props.elements]);

  // Live cursors
  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;
    const collaborators = new Map();
    for (const p of props.participants) {
      if (p.id === props.selfId || !p.cursor) continue;
      collaborators.set(p.id, { username: p.name, pointer: { ...p.cursor, tool: "pointer" } });
    }
    api.updateScene({ collaborators, captureUpdate: CaptureUpdateAction.NEVER });
  }, [props.participants, props.selfId]);

  const lastPointer = useRef(0);

  return (
    <Excalidraw
      viewModeEnabled={!props.canEdit}
      isCollaborating
      initialData={{ elements: props.elements as never, appState: { viewBackgroundColor: "#fbfaf6" } }}
      excalidrawAPI={(api) => {
        apiRef.current = api;
        for (const e of props.elements) versions.current.set(e.id, e.version);
        props.onReady(makeApi(api));
      }}
      onChange={(elements) => {
        if (!propsRef.current.canEdit) return;
        const changed: BoardElement[] = [];
        for (const e of elements as unknown as BoardElement[]) {
          if ((versions.current.get(e.id) ?? -1) < e.version) {
            versions.current.set(e.id, e.version);
            changed.push(e);
          }
        }
        if (changed.length) propsRef.current.onLocalChange(changed);
      }}
      onPointerUpdate={({ pointer }) => {
        const t = Date.now();
        if (t - lastPointer.current < 80) return;
        lastPointer.current = t;
        propsRef.current.onPointer({ x: pointer.x, y: pointer.y });
      }}
    />
  );
}

function makeApi(api: ExApi): BoardApi {
  function center() {
    const s = api.getAppState();
    const x = -s.scrollX + s.width / 2 / s.zoom.value;
    const y = -s.scrollY + s.height / 2 / s.zoom.value;
    return { x: x + (Math.random() - 0.5) * 120, y: y + (Math.random() - 0.5) * 120 };
  }
  function add(skeleton: Parameters<typeof convertToExcalidrawElements>[0]) {
    const els = convertToExcalidrawElements(skeleton);
    api.updateScene({
      elements: [...api.getSceneElementsIncludingDeleted(), ...els],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
  }
  return {
    addComponent(kind: ComponentKind) {
      const c = COMPONENTS[kind];
      const { x, y } = center();
      add([
        {
          type: c.shape,
          x,
          y,
          width: 150,
          height: 80,
          backgroundColor: c.color,
          fillStyle: "solid",
          roundness: c.shape === "rectangle" ? { type: 3 } : null,
          label: { text: c.label, fontSize: 18 },
        },
      ] as never);
    },
    addArrow(label: string) {
      const { x, y } = center();
      add([{ type: "arrow", x, y, width: 200, height: 0, label: label ? { text: label, fontSize: 16 } : undefined }] as never);
    },
    async exportPng() {
      return exportToBlob({
        elements: api.getSceneElements(),
        appState: { ...api.getAppState(), exportBackground: true },
        files: api.getFiles(),
        mimeType: "image/png",
      });
    },
    exportJson() {
      return serializeAsJSON(api.getSceneElements(), api.getAppState(), api.getFiles(), "local");
    },
  };
}
