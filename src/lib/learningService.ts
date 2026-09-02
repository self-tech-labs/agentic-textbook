import type {
  CodeExecutionEvidence,
  CodeLabExerciseRef,
  LessonAssetRef,
} from "../domain/agentCanvas";

interface GuestSession {
  guestId: string;
  csrfToken: string;
  expiresAt: string;
}

export interface CodeRunResult {
  evidence: CodeExecutionEvidence;
  stdout: string;
  stderr: string;
  durationMs: number;
  sandboxState: "cold" | "warm";
}

export interface RegisteredCodeExercise {
  exerciseId: string;
  expiresAt: string;
}

let guestSessionPromise: Promise<GuestSession> | null = null;

async function parseResponse<ResponseType>(response: Response): Promise<ResponseType> {
  const body = (await response.json().catch(() => null)) as
    | (ResponseType & { error?: string })
    | null;
  if (!response.ok) {
    throw new Error(body?.error || "The learning service is unavailable.");
  }
  if (!body) throw new Error("The learning service returned an empty response.");
  return body;
}

export function getGuestSession(): Promise<GuestSession> {
  if (!guestSessionPromise) {
    guestSessionPromise = fetch("/api/session", {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    })
      .then((response) => parseResponse<GuestSession>(response))
      .catch((error) => {
        guestSessionPromise = null;
        throw error;
      });
  }
  return guestSessionPromise;
}

async function mutate<ResponseType>(
  path: string,
  body: Record<string, unknown>,
): Promise<ResponseType> {
  const session = await getGuestSession();
  const response = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Learning-CSRF": session.csrfToken,
    },
    body: JSON.stringify(body),
  });
  return parseResponse<ResponseType>(response);
}

export function registerAsset(input: {
  lessonId: string;
  url: string;
  kind: LessonAssetRef["kind"];
  caption: string;
  attribution: string;
  alt?: string;
  transcript?: string;
  captionsVtt?: string;
}) {
  return mutate<{ asset: LessonAssetRef }>("/api/assets/import", input);
}

export function registerCodeExercise(input: {
  lessonId: string;
  language: CodeLabExerciseRef["language"];
  testManifest: string;
  visibleTests: string[];
}) {
  return mutate<RegisteredCodeExercise>("/api/code-exercises", input);
}

export function runCodeExercise(input: {
  exerciseId: string;
  language: CodeLabExerciseRef["language"];
  source: string;
}) {
  return mutate<CodeRunResult>("/api/code/run", input);
}

export function validateLessonReferences(input: {
  assetIds: string[];
  exerciseIds: string[];
}) {
  return mutate<{ valid: boolean; issues: string[] }>(
    "/api/lesson-references/validate",
    input,
  );
}
