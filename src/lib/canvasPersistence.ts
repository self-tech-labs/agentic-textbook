import type { AgentLearningCanvasState } from "../domain/agentCanvas";

const storageKey = "learn-ogram-canvas:v3";

export function loadCanvasState(): AgentLearningCanvasState | null {
  if (typeof window === "undefined") return null;
  try {
    const serialized = window.localStorage.getItem(storageKey);
    if (!serialized) return null;
    const parsed = JSON.parse(serialized) as Partial<AgentLearningCanvasState>;
    if (
      parsed.version !== 3 ||
      !parsed.session ||
      !parsed.lesson ||
      !Array.isArray(parsed.regions) ||
      !Array.isArray(parsed.events)
    ) {
      return null;
    }
    return {
      ...(parsed as AgentLearningCanvasState),
      focus: {
        regionId: parsed.focus?.regionId ?? null,
        selectedText: null,
      },
    };
  } catch {
    return null;
  }
}

export function saveCanvasState(state: AgentLearningCanvasState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // The canvas remains usable when storage is unavailable.
  }
}

export function clearCanvasState(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(storageKey);
}
