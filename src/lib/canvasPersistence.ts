import type { LearningCanvasState } from "../domain/experience";
import { compileExperience } from "../domain/compiler";
import { experienceFixtures } from "../domain/fixtures";

const storageKey = "ogram-learning-canvas:v2";
const legacyBundledTitles = new Set([
  "The three doors",
  "Signal, decision, debris",
  "Make done visible",
]);

function refreshBundledLessonCopy(
  state: LearningCanvasState,
): LearningCanvasState {
  const active = state.activeExperience;
  if (!legacyBundledTitles.has(active.metadata.title)) return state;

  const fixture = experienceFixtures.find(
    (candidate) => candidate.experienceId === active.experienceId,
  );
  if (!fixture) return state;

  const refreshed = {
    ...structuredClone(fixture),
    draftRevision: active.draftRevision,
    contextSnapshotId: active.contextSnapshotId,
    learningBriefId: active.learningBriefId,
  };
  const approvedClaimIds = state.contextClaims
    .filter(
      (claim) => claim.review === "accepted" || claim.review === "corrected",
    )
    .map((claim) => claim.id);
  const validation = compileExperience(refreshed, approvedClaimIds);

  return {
    ...state,
    activeExperience: refreshed,
    publishedRevisions: state.publishedRevisions.map((published) =>
      published.experienceId === active.experienceId &&
      published.draftRevision === active.draftRevision &&
      legacyBundledTitles.has(published.metadata.title)
        ? structuredClone(refreshed)
        : published,
    ),
    design:
      state.design.status === "published" && state.design.draft === null
        ? { ...state.design, validation }
        : state.design,
  };
}

export function loadCanvasState(): LearningCanvasState | null {
  if (typeof window === "undefined") return null;
  try {
    const serialized = window.localStorage.getItem(storageKey);
    if (!serialized) return null;
    const parsed = JSON.parse(serialized) as Partial<LearningCanvasState>;
    if (parsed.version !== 2 || !Array.isArray(parsed.events)) return null;
    return refreshBundledLessonCopy(parsed as LearningCanvasState);
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
