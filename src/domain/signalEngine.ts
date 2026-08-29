import type { PracticeSignal, SignalId, SignalLevel } from "./types";

export interface SanitizedSignalObservation {
  id: SignalId;
  level: SignalLevel;
  confidence: number;
  occurrences: number;
  sampleSize: number;
}

interface SignalTaxonomyEntry {
  label: string;
  pattern: string;
  recommendation: string;
}

export const signalTaxonomy: Record<SignalId, SignalTaxonomyEntry> = {
  thread_hygiene: {
    label: "Thread hygiene",
    pattern: "the goal changed while work continued in the same task",
    recommendation:
      "Practise choosing between continue, fork, and fresh when the deliverable changes.",
  },
  workspace_hygiene: {
    label: "Workspace hygiene",
    pattern: "file-producing work began without a dedicated project boundary",
    recommendation:
      "Choose a named project folder before asking Codex to create or change files.",
  },
  effort_fit: {
    label: "Reasoning fit",
    pattern: "the reasoning depth did not match the task’s ambiguity or verification cost",
    recommendation:
      "Name ambiguity and verification cost, then choose the lightest reliable reasoning gear.",
  },
  task_shaping: {
    label: "Task shaping",
    pattern: "the request began without an explicit outcome, boundary, or verification check",
    recommendation:
      "State the outcome, constraints, and definition of done before the work begins.",
  },
};

function integerInRange(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 1 || value > 8) {
    throw new Error(`${field} must be an integer from 1 to 8.`);
  }
  return value;
}

export function compilePracticeSignals(
  observations: readonly SanitizedSignalObservation[],
): PracticeSignal[] {
  if (observations.length < 1 || observations.length > 4) {
    throw new Error("A practice review must contain 1–4 observations.");
  }

  const seen = new Set<SignalId>();
  return observations.map((observation) => {
    if (seen.has(observation.id)) {
      throw new Error(`Duplicate practice signal: ${observation.id}.`);
    }
    seen.add(observation.id);

    if (
      !Number.isFinite(observation.confidence) ||
      observation.confidence < 0 ||
      observation.confidence > 1
    ) {
      throw new Error("confidence must be between 0 and 1.");
    }

    const occurrences = integerInRange(
      observation.occurrences,
      "occurrences",
    );
    const sampleSize = integerInRange(observation.sampleSize, "sampleSize");
    if (occurrences > sampleSize) {
      throw new Error("occurrences cannot be greater than sampleSize.");
    }

    const taxonomy = signalTaxonomy[observation.id];
    return {
      id: observation.id,
      label: taxonomy.label,
      level: observation.level,
      confidence: observation.confidence,
      evidence: `In ${occurrences} of ${sampleSize} authorized recent task${sampleSize === 1 ? "" : "s"}, ${taxonomy.pattern}.`,
      recommendation: taxonomy.recommendation,
      sourceTaskCount: sampleSize,
    };
  });
}
