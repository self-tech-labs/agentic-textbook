import type { LearningState } from "../domain/types";

const storageKey = "ogram-learning-ledger:v3";
const legacyStorageKey = "ogram-practice-desk:v2";

export function loadLearningState(): unknown {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(storageKey);
    if (!value) return null;
    return JSON.parse(value) as unknown;
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
  window.localStorage.removeItem(legacyStorageKey);
}
