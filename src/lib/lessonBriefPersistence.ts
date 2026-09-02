import {
  createLessonBrief,
  type LessonBriefV1,
} from "../domain/lessonCatalog";

export const lessonBriefStorageKey = "learn-ogram-brief:v1";

function isLessonBrief(value: unknown): value is LessonBriefV1 {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<LessonBriefV1>;
  return (
    candidate.schemaVersion === 1 &&
    typeof candidate.id === "string" &&
    typeof candidate.topic === "string" &&
    typeof candidate.desiredOutcome === "string" &&
    typeof candidate.personalizeFromRecentTasks === "boolean" &&
    Array.isArray(candidate.preferredModes)
  );
}

export function loadLessonBrief(): LessonBriefV1 {
  if (typeof window === "undefined") return createLessonBrief();
  try {
    const serialized = window.localStorage.getItem(lessonBriefStorageKey);
    if (!serialized) return createLessonBrief();
    const parsed = JSON.parse(serialized);
    return isLessonBrief(parsed) ? parsed : createLessonBrief();
  } catch {
    return createLessonBrief();
  }
}

export function saveLessonBrief(brief: LessonBriefV1): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      lessonBriefStorageKey,
      JSON.stringify({ ...brief, updatedAt: new Date().toISOString() }),
    );
  } catch {
    // Brief authoring remains usable if storage is unavailable.
  }
}

export function clearLessonBrief(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(lessonBriefStorageKey);
}
