import type { LearningState } from "../domain/types";

const storageKey = "ogram-practice-desk:v2";

export function loadLearningState(): LearningState | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(storageKey);
    if (!value) return null;
    const parsed = JSON.parse(value) as Partial<LearningState>;
    return parsed.version === 2 ? (parsed as LearningState) : null;
  } catch {
    return null;
  }
}

export function saveLearningState(state: LearningState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // The live experience remains usable if storage is unavailable.
  }
}

export function clearLearningState(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(storageKey);
}
