import type {
  EdgeCondition,
  LearnerResponse,
  LearningExperienceDocument,
  LearningNode,
  LearningRuntimeState,
} from "./experience";

export function isResponseNode(node: LearningNode): boolean {
  return (
    node.primitiveId === "diagnose.prediction" ||
    node.primitiveId === "practice.choice" ||
    node.primitiveId === "practice.sort" ||
    node.primitiveId === "consolidate.reflection" ||
    node.primitiveId === "transfer.commitment"
  );
}

export function createRuntimeState(
  document: LearningExperienceDocument,
  now = new Date(),
): LearningRuntimeState {
  return {
    experienceId: document.experienceId,
    experienceRevision: document.draftRevision,
    status: "active",
    currentNodeId: document.entryNodeId,
    visitedNodeIds: [document.entryNodeId],
    responses: {},
    startedAt: now.toISOString(),
  };
}

function recordCorrectness(node: LearningNode, value: unknown): boolean | undefined {
  if (
    node.primitiveId === "diagnose.prediction" ||
    node.primitiveId === "practice.choice"
  ) {
    return node.props.options.some(
      (option) => option.id === value && option.correct,
    );
  }
  if (node.primitiveId === "practice.sort") {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const assignments = value as Record<string, unknown>;
    return node.props.items.every(
      (item) => assignments[item.id] === item.correctBucketId,
    );
  }
  return undefined;
}

function responseLength(value: unknown): number {
  return typeof value === "string" ? value.trim().length : 0;
}

export function submitRuntimeResponse(
  document: LearningExperienceDocument,
  runtime: LearningRuntimeState,
  nodeId: string,
  value: unknown,
  confidence: number | undefined,
  now = new Date(),
): { runtime: LearningRuntimeState; response: LearnerResponse } {
  if (runtime.status !== "active" || runtime.currentNodeId !== nodeId) {
    throw new Error("Only the visible active node can receive a learner response.");
  }
  const node = document.nodes.find((candidate) => candidate.id === nodeId);
  if (!node || !isResponseNode(node)) {
    throw new Error("The visible node does not accept a learner response.");
  }
  if (
    (node.primitiveId === "diagnose.prediction" ||
      node.primitiveId === "practice.choice") &&
    !node.props.options.some((option) => option.id === value)
  ) {
    throw new Error("Choose one of the options exposed by this node.");
  }
  if (node.primitiveId === "practice.sort") {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("Every sort item needs a bucket assignment.");
    }
    const assignments = value as Record<string, unknown>;
    if (
      node.props.items.some(
        (item) => typeof assignments[item.id] !== "string",
      )
    ) {
      throw new Error("Every sort item needs a bucket assignment.");
    }
  }
  if (
    node.primitiveId === "consolidate.reflection" &&
    responseLength(value) < node.props.minimumCharacters
  ) {
    throw new Error(
      `Use at least ${node.props.minimumCharacters} characters so the reflection contains a complete thought.`,
    );
  }
  if (
    node.primitiveId === "transfer.commitment" &&
    responseLength(value) < node.props.minimumCharacters
  ) {
    throw new Error(
      `Make the commitment concrete in at least ${node.props.minimumCharacters} characters.`,
    );
  }
  if (
    confidence !== undefined &&
    (!Number.isFinite(confidence) || confidence < 0 || confidence > 1)
  ) {
    throw new Error("confidence must be between 0 and 1.");
  }

  const response: LearnerResponse = {
    nodeId,
    value: structuredClone(value),
    correct: recordCorrectness(node, value),
    confidence,
    assisted: false,
    submittedAt: now.toISOString(),
  };

  return {
    response,
    runtime: {
      ...runtime,
      responses: { ...runtime.responses, [nodeId]: response },
    },
  };
}

function conditionMatches(
  condition: EdgeCondition,
  responses: Record<string, LearnerResponse>,
): boolean {
  if (condition.op === "always") return true;
  const response = responses[condition.nodeId];
  if (!response) return false;
  if (condition.op === "answer_equals") return response.value === condition.value;
  return response.correct === condition.value;
}

export function completionSatisfied(
  document: LearningExperienceDocument,
  runtime: LearningRuntimeState,
): boolean {
  const responses = Object.values(runtime.responses);
  if (
    document.completion.requiredNodeIds.some(
      (nodeId) => !runtime.responses[nodeId],
    )
  ) {
    return false;
  }
  if (
    document.completion.minimumUnassistedAttempts >
    responses.filter((response) => !response.assisted).length
  ) {
    return false;
  }
  if (
    document.completion.requireTransfer &&
    !document.nodes.some(
      (node) =>
        node.primitiveId === "transfer.commitment" &&
        Boolean(runtime.responses[node.id]),
    )
  ) {
    return false;
  }
  return true;
}

export function advanceRuntime(
  document: LearningExperienceDocument,
  runtime: LearningRuntimeState,
  now = new Date(),
): LearningRuntimeState {
  if (runtime.status !== "active" || !runtime.currentNodeId) {
    throw new Error("This learning run is not active.");
  }
  const currentNode = document.nodes.find(
    (node) => node.id === runtime.currentNodeId,
  );
  if (!currentNode) throw new Error("The current node is missing from the experience.");
  if (isResponseNode(currentNode) && !runtime.responses[currentNode.id]) {
    throw new Error("Respond to the visible learning prompt before continuing.");
  }

  const outgoing = document.edges.filter(
    (edge) => edge.from === currentNode.id,
  );
  const conditional = outgoing.find(
    (edge) =>
      edge.condition.op !== "always" &&
      conditionMatches(edge.condition, runtime.responses),
  );
  const fallback = outgoing.find((edge) => edge.condition.op === "always");
  const nextEdge = conditional ?? fallback;

  if (!nextEdge) {
    if (!completionSatisfied(document, runtime)) {
      throw new Error(
        "The graph ended before the required learner evidence was collected.",
      );
    }
    return {
      ...runtime,
      status: "completed",
      currentNodeId: null,
      completedAt: now.toISOString(),
    };
  }

  return {
    ...runtime,
    currentNodeId: nextEdge.to,
    visitedNodeIds: runtime.visitedNodeIds.includes(nextEdge.to)
      ? runtime.visitedNodeIds
      : [...runtime.visitedNodeIds, nextEdge.to],
  };
}

export function runtimeProgress(
  document: LearningExperienceDocument,
  runtime: LearningRuntimeState,
): { completed: number; total: number; percent: number } {
  const completed = runtime.visitedNodeIds.length - (runtime.currentNodeId ? 1 : 0);
  const total = Math.max(document.nodes.length, 1);
  return {
    completed,
    total,
    percent: Math.min(100, Math.round((completed / total) * 100)),
  };
}
