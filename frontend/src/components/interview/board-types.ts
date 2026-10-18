export type ComponentKind = "client" | "loadBalancer" | "service" | "cache" | "queue" | "database";

export const COMPONENTS: Record<ComponentKind, { label: string; shape: "rectangle" | "ellipse" | "diamond"; color: string }> = {
  client: { label: "Client", shape: "rectangle", color: "#e7f0ff" },
  loadBalancer: { label: "Load Balancer", shape: "diamond", color: "#fff1d6" },
  service: { label: "Service", shape: "rectangle", color: "#e8f7ee" },
  cache: { label: "Cache", shape: "rectangle", color: "#ffe4e1" },
  queue: { label: "Queue", shape: "rectangle", color: "#f3e8ff" },
  database: { label: "Database", shape: "ellipse", color: "#e0f4f8" },
};

export interface BoardApi {
  addComponent(kind: ComponentKind): void;
  addArrow(label: string): void;
  exportPng(): Promise<Blob>;
  exportJson(): string;
}
