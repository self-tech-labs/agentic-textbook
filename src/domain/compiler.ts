import type {
  CompileResult,
  CompilerDiagnostic,
  ExperiencePatchOperation,
  LearningEdge,
  LearningExperienceDocument,
  LearningNode,
} from "./experience";
import {
  getPrimitiveDefinition,
  isPrimitiveId,
  primitiveRegistry,
} from "./primitiveRegistry";

const ACTIVE_PRIMITIVES = new Set([
  "diagnose.prediction",
  "practice.choice",
  "practice.sort",
  "consolidate.reflection",
  "transfer.commitment",
]);

const EVIDENCE_ROLES = new Set(["practice", "retrieve", "assess", "transfer"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function diagnostic(
  ruleId: string,
  severity: CompilerDiagnostic["severity"],
  path: string,
  explanation: string,
  suggestedRepair: string,
  researchReferences: string[] = [],
): CompilerDiagnostic {
  return {
    ruleId,
    ruleVersion: "1",
    severity,
    path,
    explanation,
    suggestedRepair,
    researchReferences,
  };
}

function stableHash(value: unknown): string {
  const input = JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `lx-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function experienceDigest(document: LearningExperienceDocument): string {
  return stableHash(document);
}

export function asExperienceDocument(value: unknown): LearningExperienceDocument {
  if (!isRecord(value)) throw new Error("document must be an object.");
  if (value.specVersion !== "1.0") {
    throw new Error("document.specVersion must be 1.0.");
  }
  if (value.registryVersion !== "ogram.learning.v1") {
    throw new Error("document.registryVersion must be ogram.learning.v1.");
  }
  if (value.pedagogyPolicyVersion !== "2026.1") {
    throw new Error("document.pedagogyPolicyVersion must be 2026.1.");
  }
  if (typeof value.experienceId !== "string" || value.experienceId.length < 4) {
    throw new Error("document.experienceId must be a stable string id.");
  }
  if (!Number.isInteger(value.draftRevision) || Number(value.draftRevision) < 1) {
    throw new Error("document.draftRevision must be a positive integer.");
  }
  if (!isRecord(value.metadata)) throw new Error("document.metadata is required.");
  if (!Array.isArray(value.objectives)) throw new Error("document.objectives must be an array.");
  if (!Array.isArray(value.nodes)) throw new Error("document.nodes must be an array.");
  if (!Array.isArray(value.edges)) throw new Error("document.edges must be an array.");
  if (!isRecord(value.completion)) throw new Error("document.completion is required.");
  if (!isRecord(value.adaptation)) throw new Error("document.adaptation is required.");
  if (!Array.isArray(value.assets)) throw new Error("document.assets must be an array.");
  if (!Array.isArray(value.provenance)) throw new Error("document.provenance must be an array.");
  return structuredClone(value) as unknown as LearningExperienceDocument;
}

function unsafePayload(document: LearningExperienceDocument): boolean {
  const serialized = JSON.stringify(document).toLowerCase();
  return [
    "<script",
    "javascript:",
    "onerror=",
    "onclick=",
    "eval(",
    "document.cookie",
    "dangerouslysetinnerhtml",
  ].some((token) => serialized.includes(token));
}

function reachableNodeIds(
  entryNodeId: string,
  edges: LearningEdge[],
): Set<string> {
  const outgoing = new Map<string, string[]>();
  for (const edge of edges) {
    const targets = outgoing.get(edge.from) ?? [];
    targets.push(edge.to);
    outgoing.set(edge.from, targets);
  }
  const reachable = new Set<string>();
  const queue = [entryNodeId];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || reachable.has(current)) continue;
    reachable.add(current);
    for (const next of outgoing.get(current) ?? []) queue.push(next);
  }
  return reachable;
}

function graphHasCycle(nodes: LearningNode[], edges: LearningEdge[]): boolean {
  const outgoing = new Map<string, string[]>();
  for (const edge of edges) {
    const list = outgoing.get(edge.from) ?? [];
    list.push(edge.to);
    outgoing.set(edge.from, list);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (nodeId: string): boolean => {
    if (visiting.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;
    visiting.add(nodeId);
    for (const next of outgoing.get(nodeId) ?? []) {
      if (visit(next)) return true;
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
    return false;
  };

  return nodes.some((node) => visit(node.id));
}

function choiceDiagnostics(node: LearningNode): CompilerDiagnostic[] {
  if (
    node.primitiveId !== "practice.choice" &&
    node.primitiveId !== "diagnose.prediction"
  ) {
    return [];
  }
  const diagnostics: CompilerDiagnostic[] = [];
  if (node.props.options.length < 2) {
    diagnostics.push(
      diagnostic(
        "interaction.choice.minimum-options",
        "error",
        `nodes.${node.id}.props.options`,
        "A choice interaction needs at least two meaningful alternatives.",
        "Add a plausible alternative and explain its consequence.",
      ),
    );
  }
  if (!node.props.options.some((option) => option.correct)) {
    diagnostics.push(
      diagnostic(
        "interaction.choice.correct-answer",
        "error",
        `nodes.${node.id}.props.options`,
        "The runtime cannot evaluate this attempt because no option is marked correct.",
        "Mark at least one option correct or use an open reflection primitive.",
      ),
    );
  }
  for (const option of node.props.options) {
    if (option.feedback.trim().length < 8) {
      diagnostics.push(
        diagnostic(
          "pedagogy.explanatory-feedback",
          "error",
          `nodes.${node.id}.props.options.${option.id}.feedback`,
          "Every option needs corrective or reinforcing feedback; a right/wrong flag is not enough.",
          "Explain why the option works or what principle the learner should reconsider.",
          ["Explanatory feedback"],
        ),
      );
    }
  }
  return diagnostics;
}

function assetDiagnostics(
  document: LearningExperienceDocument,
): CompilerDiagnostic[] {
  const diagnostics: CompilerDiagnostic[] = [];
  const assetIds = new Set<string>();
  document.assets.forEach((asset, index) => {
    const path = `assets.${index}`;
    if (assetIds.has(asset.id)) {
      diagnostics.push(
        diagnostic(
          "schema.unique-asset-id",
          "error",
          `${path}.id`,
          `Asset id “${asset.id}” is duplicated.`,
          "Give each asset a unique id.",
        ),
      );
    }
    assetIds.add(asset.id);
    if (!asset.uri.startsWith("https://") && !asset.uri.startsWith("ogram-asset://")) {
      diagnostics.push(
        diagnostic(
          "security.asset-uri",
          "error",
          `${path}.uri`,
          "Assets must use HTTPS or an Ogram asset handle.",
          "Register the generated media with the asset broker and use the returned handle.",
        ),
      );
    }
    if (asset.alt.trim().length < 3) {
      diagnostics.push(
        diagnostic(
          "accessibility.asset-alternative",
          "error",
          `${path}.alt`,
          "Media needs a useful text alternative.",
          "Describe the learning-relevant information in the asset.",
        ),
      );
    }
    if ((asset.kind === "audio" || asset.kind === "video") && !asset.transcript?.trim()) {
      diagnostics.push(
        diagnostic(
          "accessibility.time-media-transcript",
          "error",
          `${path}.transcript`,
          "Audio and video require a transcript in the trusted canvas.",
          "Attach a reviewed transcript before validation.",
        ),
      );
    }
  });
  for (const node of document.nodes) {
    if (node.primitiveId === "media.explainer" && !assetIds.has(node.props.assetId)) {
      diagnostics.push(
        diagnostic(
          "capability.asset-reference",
          "error",
          `nodes.${node.id}.props.assetId`,
          `The media node references unknown asset “${node.props.assetId}”.`,
          "Register the asset first or reference an existing asset id.",
        ),
      );
    }
  }
  return diagnostics;
}

export function compileExperience(
  document: LearningExperienceDocument,
  approvedClaimIds: string[],
  now = new Date(),
): CompileResult {
  const diagnostics: CompilerDiagnostic[] = [];
  const digest = experienceDigest(document);
  const objectiveIds = new Set<string>();
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();

  if (document.specVersion !== "1.0") {
    diagnostics.push(
      diagnostic("schema.spec-version", "error", "specVersion", "Unsupported experience spec.", "Use specVersion 1.0."),
    );
  }
  if (document.registryVersion !== "ogram.learning.v1") {
    diagnostics.push(
      diagnostic("schema.registry-version", "error", "registryVersion", "Unsupported primitive registry.", "Use ogram.learning.v1."),
    );
  }
  if (document.pedagogyPolicyVersion !== "2026.1") {
    diagnostics.push(
      diagnostic("schema.policy-version", "error", "pedagogyPolicyVersion", "Unsupported pedagogy policy.", "Compile against policy 2026.1."),
    );
  }
  if (document.objectives.length < 1 || document.objectives.length > 3) {
    diagnostics.push(
      diagnostic(
        "pedagogy.objective-budget",
        "error",
        "objectives",
        "An experience must focus on one to three observable objectives.",
        "Narrow or split the experience so each objective can receive meaningful practice.",
      ),
    );
  }
  document.objectives.forEach((objective, index) => {
    if (objectiveIds.has(objective.id)) {
      diagnostics.push(
        diagnostic("schema.unique-objective-id", "error", `objectives.${index}.id`, `Objective id “${objective.id}” is duplicated.`, "Use a unique objective id."),
      );
    }
    objectiveIds.add(objective.id);
    if (objective.statement.trim().length < 12 || objective.successCriteria.length < 1) {
      diagnostics.push(
        diagnostic(
          "pedagogy.observable-objective",
          "error",
          `objectives.${index}`,
          "Every objective needs an observable statement and at least one success criterion.",
          "Describe what the learner will do and how successful performance will be recognized.",
          ["Constructive alignment"],
        ),
      );
    }
  });

  if (document.nodes.length < 3 || document.nodes.length > 30) {
    diagnostics.push(
      diagnostic("runtime.node-budget", "error", "nodes", "An experience must contain 3–30 bounded nodes.", "Split large experiences or add the missing active-learning stages."),
    );
  }

  document.nodes.forEach((node, index) => {
    const path = `nodes.${index}`;
    if (nodeIds.has(node.id)) {
      diagnostics.push(
        diagnostic("schema.unique-node-id", "error", `${path}.id`, `Node id “${node.id}” is duplicated.`, "Use a unique node id."),
      );
    }
    nodeIds.add(node.id);
    if (!isPrimitiveId(node.primitiveId)) {
      diagnostics.push(
        diagnostic("capability.primitive", "error", `${path}.primitiveId`, `Primitive “${String(node.primitiveId)}” is not in the registry.`, "Choose a primitive returned by ogram_get_canvas_contract."),
      );
      return;
    }
    const definition = getPrimitiveDefinition(node.primitiveId);
    if (node.primitiveVersion !== definition.version) {
      diagnostics.push(
        diagnostic("capability.primitive-version", "error", `${path}.primitiveVersion`, `Unsupported ${node.primitiveId} version.`, `Use primitive version ${definition.version}.`),
      );
    }
    if (!definition.supportedRoles.includes(node.learningRole)) {
      diagnostics.push(
        diagnostic("pedagogy.learning-role", "error", `${path}.learningRole`, `${node.primitiveId} cannot serve the ${node.learningRole} role.`, `Choose one of: ${definition.supportedRoles.join(", ")}.`),
      );
    }
    for (const objectiveId of node.objectiveIds) {
      if (!objectiveIds.has(objectiveId)) {
        diagnostics.push(
          diagnostic("schema.objective-reference", "error", `${path}.objectiveIds`, `Node references unknown objective “${objectiveId}”.`, "Reference a declared objective."),
        );
      }
    }
    diagnostics.push(...choiceDiagnostics(node));
    if (node.primitiveId === "practice.sort") {
      const bucketIds = new Set(node.props.buckets.map((bucket) => bucket.id));
      if (bucketIds.size < 2 || node.props.items.length < 2) {
        diagnostics.push(
          diagnostic("interaction.sort-shape", "error", `${path}.props`, "A sort needs at least two buckets and two items.", "Add contrasting categories and examples."),
        );
      }
      if (node.props.items.some((item) => !bucketIds.has(item.correctBucketId))) {
        diagnostics.push(
          diagnostic("interaction.sort-answer", "error", `${path}.props.items`, "A sort item points to an unknown correct bucket.", "Use one of the declared bucket ids."),
        );
      }
      if (node.props.feedback.trim().length < 8) {
        diagnostics.push(
          diagnostic("pedagogy.explanatory-feedback", "error", `${path}.props.feedback`, "A scored sort needs explanatory feedback.", "Explain the classification rule after the attempt."),
        );
      }
    }
  });

  if (!nodeIds.has(document.entryNodeId)) {
    diagnostics.push(
      diagnostic("runtime.entry-node", "error", "entryNodeId", "The entry node does not exist.", "Point entryNodeId to a declared node."),
    );
  }

  document.edges.forEach((edge, index) => {
    const path = `edges.${index}`;
    if (edgeIds.has(edge.id)) {
      diagnostics.push(
        diagnostic("schema.unique-edge-id", "error", `${path}.id`, `Edge id “${edge.id}” is duplicated.`, "Use a unique edge id."),
      );
    }
    edgeIds.add(edge.id);
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      diagnostics.push(
        diagnostic("runtime.edge-reference", "error", path, `Edge “${edge.id}” has a missing endpoint.`, "Connect only declared nodes."),
      );
    }
    if (edge.condition.op !== "always" && edge.condition.nodeId !== edge.from) {
      diagnostics.push(
        diagnostic("runtime.condition-scope", "error", `${path}.condition`, "A branch may only evaluate the response produced by its source node.", "Set condition.nodeId to the edge's from node."),
      );
    }
  });

  const reachable = reachableNodeIds(document.entryNodeId, document.edges);
  for (const node of document.nodes) {
    if (!reachable.has(node.id)) {
      diagnostics.push(
        diagnostic("runtime.reachability", "error", `nodes.${node.id}`, `Node “${node.id}” cannot be reached from the entry.`, "Connect it to the graph or remove it."),
      );
    }
  }
  if (graphHasCycle(document.nodes, document.edges)) {
    diagnostics.push(
      diagnostic("runtime.bounded-flow", "error", "edges", "The v1 canvas rejects graph cycles because retries must be explicitly bounded.", "Use a separate retry node with a forward edge."),
    );
  }

  const exitNodes = document.nodes.filter(
    (node) => !document.edges.some((edge) => edge.from === node.id),
  );
  if (exitNodes.length < 1) {
    diagnostics.push(
      diagnostic("runtime.valid-exit", "error", "edges", "The experience has no terminating exit.", "Add a reachable terminal transfer node."),
    );
  }

  const activeNodes = document.nodes.filter((node) =>
    ACTIVE_PRIMITIVES.has(node.primitiveId),
  );
  if (activeNodes.length < 1) {
    diagnostics.push(
      diagnostic(
        "pedagogy.active-generation",
        "error",
        "nodes",
        "Passive viewing cannot be the only learning mechanism.",
        "Add a prediction, retrieval, practice, reflection, or transfer action.",
        ["Retrieval practice", "Generative learning"],
      ),
    );
  }

  for (const objectiveId of objectiveIds) {
    const evidence = document.nodes.some(
      (node) =>
        node.objectiveIds.includes(objectiveId) &&
        ACTIVE_PRIMITIVES.has(node.primitiveId) &&
        EVIDENCE_ROLES.has(node.learningRole),
    );
    if (!evidence) {
      diagnostics.push(
        diagnostic(
          "pedagogy.objective-evidence",
          "error",
          `objectives.${objectiveId}`,
          `Objective “${objectiveId}” has no unassisted evidence opportunity.`,
          "Link it to a practice, retrieval, assessment, reflection, or transfer node.",
          ["Constructive alignment"],
        ),
      );
    }
  }

  for (const requiredId of document.completion.requiredNodeIds) {
    const requiredNode = document.nodes.find((node) => node.id === requiredId);
    if (!requiredNode || !ACTIVE_PRIMITIVES.has(requiredNode.primitiveId)) {
      diagnostics.push(
        diagnostic("pedagogy.completion-evidence", "error", "completion.requiredNodeIds", `Required completion node “${requiredId}” is missing or passive.`, "Require a learner-generated response node."),
      );
    }
  }
  if (document.completion.minimumUnassistedAttempts < 1) {
    diagnostics.push(
      diagnostic("pedagogy.unassisted-attempt", "error", "completion.minimumUnassistedAttempts", "Completion must require at least one unassisted attempt.", "Set minimumUnassistedAttempts to one or more."),
    );
  }
  if (
    document.completion.requireTransfer &&
    !document.nodes.some((node) => node.primitiveId === "transfer.commitment")
  ) {
    diagnostics.push(
      diagnostic("pedagogy.transfer", "error", "completion.requireTransfer", "Transfer is required but no transfer primitive exists.", "Add a transfer.commitment node with a real cue and proof."),
    );
  }

  const approved = new Set(approvedClaimIds);
  for (const reference of document.provenance) {
    if (reference.lane === "personalization" && !approved.has(reference.sourceRef)) {
      diagnostics.push(
        diagnostic("privacy.approved-context", "error", `provenance.${reference.id}`, `Personalization references unapproved context claim “${reference.sourceRef}”.`, "Ask the learner to approve the claim or remove the reference."),
      );
    }
  }

  if (unsafePayload(document)) {
    diagnostics.push(
      diagnostic("security.no-executable-content", "error", "document", "The document contains executable HTML, JavaScript, or an unsafe URL token.", "Use trusted primitives and plain text only."),
    );
  }
  diagnostics.push(...assetDiagnostics(document));

  if (!document.nodes.some((node) => node.primitiveId === "diagnose.prediction")) {
    diagnostics.push(
      diagnostic("pedagogy.activate-prior-knowledge", "warning", "nodes", "The experience does not elicit a prediction or prior-knowledge response before instruction.", "Consider adding a diagnostic unless the learner has already demonstrated this knowledge.", ["Pretesting effect"]),
    );
  }
  if (!document.nodes.some((node) => node.primitiveId === "consolidate.reflection")) {
    diagnostics.push(
      diagnostic("pedagogy.self-explanation", "recommendation", "nodes", "The experience has no self-explanation moment.", "Consider asking the learner to articulate the rule in their own words.", ["Self-explanation effect"]),
    );
  }
  if (document.metadata.estimatedMinutes > 45) {
    diagnostics.push(
      diagnostic("experience.duration-budget", "warning", "metadata.estimatedMinutes", "The estimated duration exceeds the canvas's focused-session budget.", "Split this into a journey of smaller experiences."),
    );
  }
  const complexity = document.nodes.reduce((sum, node) => {
    if (!isPrimitiveId(node.primitiveId)) return sum;
    return sum + primitiveRegistry[node.primitiveId].complexityCost;
  }, 0);
  if (complexity > document.metadata.estimatedMinutes * 2.5) {
    diagnostics.push(
      diagnostic("experience.complexity-budget", "warning", "nodes", "Interaction complexity may be disproportionate to the promised duration.", "Remove a mechanism or increase the honest time estimate."),
    );
  }

  const valid = !diagnostics.some((item) => item.severity === "error");
  return {
    valid,
    digest,
    diagnostics,
    program: valid
      ? {
          digest,
          compiledAt: now.toISOString(),
          document: structuredClone(document),
        }
      : undefined,
  };
}

function replaceById<T extends { id: string }>(items: T[], item: T): T[] {
  const index = items.findIndex((candidate) => candidate.id === item.id);
  if (index < 0) return [...items, item];
  return items.map((candidate, candidateIndex) =>
    candidateIndex === index ? item : candidate,
  );
}

export function applyExperiencePatches(
  source: LearningExperienceDocument,
  operations: ExperiencePatchOperation[],
): LearningExperienceDocument {
  let document = structuredClone(source);
  for (const operation of operations) {
    if (!isRecord(operation) || typeof operation.op !== "string") {
      throw new Error("Each patch operation must be an object with an op.");
    }
    switch (operation.op) {
      case "replace_metadata":
        if (!isRecord(operation.metadata)) throw new Error("replace_metadata requires metadata.");
        document.metadata = structuredClone(operation.metadata) as LearningExperienceDocument["metadata"];
        break;
      case "upsert_node":
        if (!isRecord(operation.node) || typeof operation.node.id !== "string") {
          throw new Error("upsert_node requires a node with an id.");
        }
        document.nodes = replaceById(document.nodes, structuredClone(operation.node) as unknown as LearningNode);
        break;
      case "remove_node":
        if (typeof operation.nodeId !== "string") throw new Error("remove_node requires nodeId.");
        document.nodes = document.nodes.filter((node) => node.id !== operation.nodeId);
        document.edges = document.edges.filter(
          (edge) => edge.from !== operation.nodeId && edge.to !== operation.nodeId,
        );
        break;
      case "upsert_edge":
        if (!isRecord(operation.edge) || typeof operation.edge.id !== "string") {
          throw new Error("upsert_edge requires an edge with an id.");
        }
        document.edges = replaceById(document.edges, structuredClone(operation.edge) as unknown as LearningEdge);
        break;
      case "remove_edge":
        if (typeof operation.edgeId !== "string") throw new Error("remove_edge requires edgeId.");
        document.edges = document.edges.filter((edge) => edge.id !== operation.edgeId);
        break;
      case "set_completion":
        if (!isRecord(operation.completion)) throw new Error("set_completion requires completion.");
        document.completion = structuredClone(operation.completion) as LearningExperienceDocument["completion"];
        break;
      default: {
        const unsupported = operation as { op: string };
        throw new Error(`Unsupported patch operation: ${unsupported.op}.`);
      }
    }
  }
  return document;
}
