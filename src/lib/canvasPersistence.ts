import type { LearningCanvasState } from "../domain/experience";

const storageKey = "ogram-learning-canvas:v2";

export function loadCanvasState(): LearningCanvasState | null {
  if (typeof window === "undefined") return null;
  try {
    const serialized = window.localStorage.getItem(storageKey);
    if (!serialized) return null;
    const parsed = JSON.parse(serialized) as Partial<LearningCanvasState>;
    if (parsed.version !== 2 || !Array.isArray(parsed.events)) return null;
    return parsed as LearningCanvasState;
  } catch {
    return null;
  }
}

export function saveCanvasState(state: LearningCanvasState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // The runtime remains usable when private browsing or storage limits block persistence.
  }
}

export function clearCanvasState(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(storageKey);
}
