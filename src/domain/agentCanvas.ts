import { LESSON_LIMITS } from "./lessonRegistry";

export type LearningSessionStage =
  | "ready"
  | "context_review"
  | "lesson_review"
  | "learning";

export type PedagogicalMode =
  | "conceptual"
  | "quantitative"
  | "code"
  | "scenario"
  | "mixed";

export type LessonSourcePolicy = "evergreen" | "current";

export type ContextClaimKind =
  | "stated_goal"
  | "prior_knowledge"
  | "current_project"
  | "preference"
  | "accessibility"
  | "business_constraint";

export type ContextDiscoveryScope =
  | "current_conversation"
  | "codex_history"
  | "project_history"
  | "ogram_profile"
  | "connected_sources";

export interface ContextSource {
  route:
    | "learner"
    | "conversation"
    | "codex_history"
    | "project_history"
    | "ogram"
    | "connected_mcp";
  providerId: string;
  providerLabel: string;
  resourceType: string;
}

export interface LearnerContextClaim {
  id: string;
  kind: ContextClaimKind;
  summary: string;
  source: ContextSource;
  confidence?: number;
  sensitivity: "low" | "personal" | "restricted";
  allowedPurposes: string[];
  evidenceRef: string;
  review: "pending" | "accepted" | "corrected" | "rejected";
  observedAt: string;
  correctedSummary?: string;
}

export interface ContextConsentAttestation {
  obtainedAt: string;
  scope: string;
  providerIds: string[];
  sourceScopes: ContextDiscoveryScope[];
}

export interface LessonContextSignalV1 {
  id: string;
  summary: string;
  kind: ContextClaimKind;
  confidence?: number;
  observedAt: string;
  sourceLabel: string;
}

export interface TopicRadarSignalV1 {
  id: string;
  topic: string;
  summary: string;
  officialUrl?: string;
  communitySources?: Array<{
    url: string;
    publishedAt: string;
    publisher?: string;
  }>;
  officialPublishedAt?: string;
  retrievedAt: string;
  availability?: string;
  learnerRelevance: number;
  officialRecency: number;
  communityCorroboration: number;
  score: number;
  authority: "official" | "community_exploration";
}

export interface LessonContextPackV1 {
  generatedAt: string;
  lookbackDays: number;
  inspectedTaskCount: number;
  signals: LessonContextSignalV1[];
  topicRadar?: TopicRadarSignalV1[];
}

export interface ResearchReference {
  id: string;
  title: string;
  url: string;
  publisher: string;
  publishedAt?: string;
  retrievedAt?: string;
  claim: string;
  sourceType?: "official" | "community" | "primary" | "secondary";
  availability?: string;
}

export interface LessonAssetRef {
  id: string;
  kind: "image" | "audio" | "video";
  url?: string;
  mimeType?: string;
  status: "pending" | "ready" | "failed" | "expired";
  caption: string;
  attribution: string;
  alt?: string;
  transcript?: string;
  captionsVtt?: string;
  byteLength?: number;
  contentHash?: string;
}

export type ExistingV3Content =
  | {
      type: "prose";
      heading?: string;
      text: string;
      emphasis?: string;
    }
  | {
      type: "key_points";
      items: string[];
    }
  | {
      type: "token_sequence";
      tokens: string[];
      caption: string;
      highlightedIndex?: number;
    }
  | {
      type: "attention_map";
      tokens: string[];
      focusIndex: number;
      weights: number[];
      explanation: string;
    }
  | {
      type: "transformer_stack";
      stages: Array<{ label: string; detail: string }>;
      caption: string;
    }
  | {
      type: "comparison";
      leftLabel: string;
      rightLabel: string;
      rows: Array<{ label: string; left: string; right: string }>;
    }
  | {
      type: "source_cards";
      summary: string;
      sources: ResearchReference[];
    }
  | {
      type: "sandbox_widget";
      widgetId: string;
      title: string;
      html: string;
      css: string;
      javascript: string;
      accessibleSummary: string;
      height: number;
    };

export interface FormulaBlock {
  type: "formula";
  latex: string;
  display?: boolean;
  accessibleLabel: string;
  explanation?: string;
}

export interface DiagramBlock {
  type: "diagram";
  syntax: "mermaid";
  source: string;
  title: string;
  description: string;
}

export interface CodeExampleBlock {
  type: "code_example";
  language: "javascript" | "typescript" | "python" | "json" | "text";
  code: string;
  caption: string;
  highlightedLines?: number[];
}

export interface MediaBlock {
  type: "media";
  asset: LessonAssetRef;
}

export type LessonContentV4 =
  | ExistingV3Content
  | FormulaBlock
  | DiagramBlock
  | CodeExampleBlock
  | MediaBlock;

export type RegionContent = LessonContentV4;

export interface ChoiceInteraction {
  type: "choice";
  prompt: string;
  options: Array<{
    id: string;
    label: string;
    correct: boolean;
    feedback: string;
  }>;
}

export interface ReflectionInteraction {
  type: "reflection";
  prompt: string;
  placeholder: string;
  minimumCharacters: number;
  feedback: string;
}

export interface NumericExercise {
  type: "numeric";
  prompt: string;
  correctAnswer: number;
  tolerance: number;
  unit?: string;
  placeholder?: string;
  correctFeedback: string;
  incorrectFeedback: string;
}

export interface CodeLabExerciseRef {
  type: "code_lab";
  exerciseId: string;
  prompt: string;
  language: "javascript" | "typescript" | "python";
  starterCode: string;
  visibleTests: string[];
  fallbackPrompt: string;
}

export type LessonExerciseV4 =
  | ChoiceInteraction
  | ReflectionInteraction
  | NumericExercise
  | CodeLabExerciseRef;

export type LearnerInteraction = LessonExerciseV4;

export interface CodeExecutionEvidence {
  status: "passed" | "failed" | "error";
  sourceHash: string;
  passedTests: number;
  totalTests: number;
  stdout?: string;
  stderr?: string;
}

export interface RegionResponse {
  value: string;
  correct?: boolean;
  submittedAt: string;
  execution?: CodeExecutionEvidence;
}

export interface RegionProvenance {
  actor: "ogram" | "agent";
  label: string;
  sourceRefs: string[];
  at: string;
}

export interface RegionHistoryEntry {
  undoToken: string;
  revision: number;
  status: CanvasRegionStatus;
  content: RegionContent[];
  provenance: RegionProvenance[];
  updatedAt?: string;
  updateRationale?: string;
}

export type CanvasRegionStatus =
  | "skeleton"
  | "ready"
  | "agent_working"
  | "updated";

export interface CanvasRegion {
  id: string;
  order: number;
  label: string;
  title: string;
  objective: string;
  kind: "orient" | "explain" | "model" | "practice" | "reflect";
  revision: number;
  status: CanvasRegionStatus;
  content: RegionContent[];
  interaction?: LearnerInteraction;
  response?: RegionResponse;
  provenance: RegionProvenance[];
  history: RegionHistoryEntry[];
  updatedAt?: string;
  updateRationale?: string;
}

export type LessonRegion = Omit<
  CanvasRegion,
  "revision" | "status" | "response" | "history" | "updatedAt" | "updateRationale"
>;

export interface LegacyLessonDocumentV3 {
  id: string;
  revision: number;
  topic: string;
  title: string;
  subtitle: string;
  audience: string;
  estimatedMinutes: number;
  objective: string;
  approvedClaimIds: string[];
  regions: LessonRegion[];
}

export type EdgeCondition =
  | { type: "always" }
  | { type: "answer_equals"; value: string }
  | { type: "response_correct"; value: boolean };

export interface LessonEdgeV4 {
  id: string;
  from: string;
  to: string;
  priority: number;
  condition: EdgeCondition;
  label?: string;
}

export interface LessonFlowV4 {
  entryRegionId: string;
  edges: LessonEdgeV4[];
}

export interface LessonDocumentV4 extends LegacyLessonDocumentV3 {
  schemaVersion: 4;
  blueprintId: string;
  pedagogicalMode: PedagogicalMode;
  sourcePolicy: LessonSourcePolicy;
  flow: LessonFlowV4;
  assetRefs: string[];
}

// Kept for one release so existing agent integrations can retain their import.
export type LessonDocumentV3 = LessonDocumentV4;

export interface LessonConstructionV4 {
  document: Omit<LessonDocumentV4, "regions">;
  regions: CanvasRegion[];
  startedAt: string;
}

export type LessonConstructionV3 = LessonConstructionV4;

export interface LessonDiagnostic {
  path: string;
  severity: "error" | "warning";
  explanation: string;
}

export interface LessonValidation {
  valid: boolean;
  digest: string;
  diagnostics: LessonDiagnostic[];
}

export interface AgentCanvasEvent {
  id: string;
  sequence: number;
  type:
    | "agent.session.started"
    | "context.claim.proposed"
    | "context.claim.reviewed"
    | "context.personalization.skipped"
    | "lesson.construction.started"
    | "lesson.construction.region_shaped"
    | "lesson.draft.prepared"
    | "lesson.draft.approved"
    | "lesson.published"
    | "canvas.region.focused"
    | "canvas.region.patched"
    | "canvas.widget.injected"
    | "canvas.research.attached"
    | "canvas.region.reverted"
    | "learner.response.submitted";
  actor: "agent" | "learner" | "ogram";
  at: string;
  summary: string;
  payload?: Record<string, unknown>;
}

export interface LearningSessionV4 {
  id: string | null;
  briefId: string | null;
  blueprintId: string | null;
  topic: string | null;
  goal: string | null;
  stage: LearningSessionStage;
  startedAt: string | null;
  contextConsent: ContextConsentAttestation | null;
  personalization: "undecided" | "reviewing" | "approved" | "skipped";
  hostCapabilities: string[];
}

export type LearningSessionV3 = LearningSessionV4;

export interface CommandReceiptV3 {
  key: string;
  result: Record<string, unknown>;
}

export interface AgentLearningCanvasState {
  version: 4;
  revision: number;
  session: LearningSessionV4;
  contextClaims: LearnerContextClaim[];
  topicRadar: TopicRadarSignalV1[];
  lesson: {
    status: "skeleton" | "awaiting_review" | "approved" | "published";
    draft: LessonDocumentV4 | null;
    construction: LessonConstructionV4 | null;
    validation: LessonValidation | null;
    approvedDraftRevision: number | null;
    publishedRevision: number | null;
  };
  regions: CanvasRegion[];
  focus: {
    regionId: string | null;
    selectedText: string | null;
  };
  events: AgentCanvasEvent[];
  commandReceipts: CommandReceiptV3[];
  migratedFrom?: 3;
}

export type TrustedPatchContent = Exclude<RegionContent, { type: "sandbox_widget" }>;

export interface ResolvedLessonPath {
  visibleRegionIds: string[];
  lockedRegionIds: string[];
  hiddenRegionIds: string[];
  selectedEdgeIds: string[];
  currentRegionId: string | null;
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0).toString(16).padStart(8, "0");
}

function diagnostic(
  diagnostics: LessonDiagnostic[],
  path: string,
  explanation: string,
  severity: LessonDiagnostic["severity"] = "error",
) {
  diagnostics.push({ path, severity, explanation });
}

function sortedOutgoing(document: LessonDocumentV4, regionId: string) {
  return document.flow.edges
    .filter((edge) => edge.from === regionId)
    .sort((left, right) => left.priority - right.priority);
}

function conditionKey(condition: EdgeCondition) {
  if (condition.type === "always") return "always";
  return condition.type + ":" + String(condition.value);
}

function validateContent(
  content: RegionContent,
  path: string,
  declaredAssets: Set<string>,
  diagnostics: LessonDiagnostic[],
) {
  if (content.type === "formula") {
    if (!content.accessibleLabel.trim()) {
      diagnostic(diagnostics, path + ".accessibleLabel", "A formula needs an accessible explanation.");
    }
    if (new TextEncoder().encode(content.latex).byteLength > LESSON_LIMITS.formulaBytes) {
      diagnostic(diagnostics, path + ".latex", "Formula input cannot exceed 4 KB.");
    }
  }

  if (content.type === "diagram") {
    if (!content.title.trim() || !content.description.trim()) {
      diagnostic(diagnostics, path, "A diagram needs both a title and a description.");
    }
    if (new TextEncoder().encode(content.source).byteLength > LESSON_LIMITS.diagramBytes) {
      diagnostic(diagnostics, path + ".source", "Mermaid source cannot exceed 16 KB.");
    }
    if (/(click\s|href\s*=|<a\b|javascript:)/i.test(content.source)) {
      diagnostic(diagnostics, path + ".source", "Diagram links and HTML are not allowed.");
    }
  }

  if (
    content.type === "code_example" &&
    new TextEncoder().encode(content.code).byteLength > LESSON_LIMITS.codeBytes
  ) {
    diagnostic(diagnostics, path + ".code", "Code examples cannot exceed 32 KB.");
  }

  if (content.type === "media") {
    const asset = content.asset;
    if (!declaredAssets.has(asset.id)) {
      diagnostic(diagnostics, path + ".asset.id", "Media must be declared in assetRefs.");
    }
    if (asset.status !== "ready") {
      diagnostic(diagnostics, path + ".asset.status", "Media must be ready before the lesson is published.");
    }
    if (!asset.caption.trim() || !asset.attribution.trim()) {
      diagnostic(diagnostics, path + ".asset", "Media needs a caption and attribution.");
    }
    if (asset.kind === "image" && !asset.alt?.trim()) {
      diagnostic(diagnostics, path + ".asset.alt", "Images require alternative text.");
    }
    if ((asset.kind === "audio" || asset.kind === "video") && !asset.transcript?.trim()) {
      diagnostic(diagnostics, path + ".asset.transcript", "Audio and video require a transcript.");
    }
    if (asset.kind === "video" && !asset.captionsVtt?.trim()) {
      diagnostic(diagnostics, path + ".asset.captionsVtt", "Video requires VTT captions.");
    }
  }
}

function validateInteraction(
  interaction: LearnerInteraction,
  path: string,
  diagnostics: LessonDiagnostic[],
) {
  if (interaction.type === "choice") {
    if (interaction.options.length < 2 || !interaction.options.some((option) => option.correct)) {
      diagnostic(diagnostics, path, "A choice exercise needs at least two options and a correct answer.");
    }
  }
  if (interaction.type === "reflection" && interaction.minimumCharacters < 1) {
    diagnostic(diagnostics, path + ".minimumCharacters", "A reflection needs a positive minimum length.");
  }
  if (interaction.type === "numeric") {
    if (!Number.isFinite(interaction.correctAnswer) || !Number.isFinite(interaction.tolerance)) {
      diagnostic(diagnostics, path, "Numeric answers and tolerances must be finite.");
    }
    if (interaction.tolerance < 0) {
      diagnostic(diagnostics, path + ".tolerance", "Numeric tolerance cannot be negative.");
    }
  }
  if (interaction.type === "code_lab") {
    if (!interaction.exerciseId.trim()) {
      diagnostic(diagnostics, path + ".exerciseId", "A code lab needs a registered exercise id.");
    }
    if (
      new TextEncoder().encode(interaction.starterCode).byteLength >
      LESSON_LIMITS.codeBytes
    ) {
      diagnostic(diagnostics, path + ".starterCode", "Code lab source cannot exceed 32 KB.");
    }
  }
}

function validateFlow(
  document: LessonDocumentV4,
  regionIds: Set<string>,
  diagnostics: LessonDiagnostic[],
) {
  const flow = document.flow;
  if (!regionIds.has(flow.entryRegionId)) {
    diagnostic(diagnostics, "flow.entryRegionId", "The entry region must exist.");
    return;
  }

  const edgeIds = new Set<string>();
  flow.edges.forEach((edge, index) => {
    if (edgeIds.has(edge.id)) {
      diagnostic(diagnostics, "flow.edges[" + index + "].id", "Edge ids must be unique.");
    }
    edgeIds.add(edge.id);
    if (!regionIds.has(edge.from) || !regionIds.has(edge.to)) {
      diagnostic(diagnostics, "flow.edges[" + index + "]", "Every edge must connect existing regions.");
    }
  });

  for (const regionId of regionIds) {
    const outgoing = sortedOutgoing(document, regionId);
    const sourceRegion = document.regions.find((region) => region.id === regionId);
    if (outgoing.length > LESSON_LIMITS.maximumOutgoingEdges) {
      diagnostic(diagnostics, "flow.edges", "A region may have at most three outgoing edges.");
    }
    const priorities = new Set(outgoing.map((edge) => edge.priority));
    if (priorities.size !== outgoing.length) {
      diagnostic(diagnostics, "flow.edges", "Outgoing edge priorities must be unique.");
    }
    const conditions = new Set<string>();
    for (const edge of outgoing) {
      const key = conditionKey(edge.condition);
      if (conditions.has(key)) {
        diagnostic(diagnostics, "flow.edges", "A region cannot repeat the same branch condition.");
      }
      conditions.add(key);
    }
    const conditional = outgoing.filter(
      (edge) => edge.condition.type !== "always",
    );
    if (!conditional.length && outgoing.length > 1) {
      diagnostic(
        diagnostics,
        "flow.edges",
        "A non-conditional region may have only one unconditional edge.",
      );
    }
    if (conditional.length) {
      const fallbacks = outgoing.filter((edge) => edge.condition.type === "always");
      if (fallbacks.length !== 1 || outgoing[outgoing.length - 1]?.condition.type !== "always") {
        diagnostic(
          diagnostics,
          "flow.edges",
          "Conditional branches need one unconditional fallback with the last priority.",
        );
      }
      if (!sourceRegion?.interaction) {
        diagnostic(
          diagnostics,
          "flow.edges",
          "Conditional branches must start from a region with learner evidence.",
        );
      }
      if (new Set(conditional.map((edge) => edge.condition.type)).size > 1) {
        diagnostic(
          diagnostics,
          "flow.edges",
          "A decision cannot mix answer and correctness conditions because both may match.",
        );
      }
      if (
        conditional.some((edge) => edge.condition.type === "response_correct") &&
        sourceRegion?.interaction?.type === "reflection"
      ) {
        diagnostic(
          diagnostics,
          "flow.edges",
          "Reflection evidence has no correctness result for a response_correct branch.",
        );
      }
    }
  }

  const reachable = new Set<string>();
  const visiting = new Set<string>();
  let cycleReported = false;
  let decisionDepthReported = false;
  let evidenceReported = false;

  const walk = (regionId: string, decisions: number, hasEvidence: boolean) => {
    if (!regionIds.has(regionId)) return;
    reachable.add(regionId);
    if (visiting.has(regionId)) {
      if (!cycleReported) {
        diagnostic(diagnostics, "flow", "Lesson flow must be acyclic.");
        cycleReported = true;
      }
      return;
    }

    const region = document.regions.find((candidate) => candidate.id === regionId);
    const nextHasEvidence = hasEvidence || Boolean(region?.interaction);
    const outgoing = sortedOutgoing(document, regionId);
    const nextDecisions = decisions + (outgoing.length > 1 ? 1 : 0);
    if (
      nextDecisions > LESSON_LIMITS.maximumConditionalDecisions &&
      !decisionDepthReported
    ) {
      diagnostic(diagnostics, "flow", "A lesson path may contain at most four conditional decisions.");
      decisionDepthReported = true;
    }
    if (!outgoing.length && !nextHasEvidence && !evidenceReported) {
      diagnostic(diagnostics, "flow", "Every terminal lesson path must contain learner evidence.");
      evidenceReported = true;
    }

    visiting.add(regionId);
    for (const edge of outgoing) {
      walk(edge.to, nextDecisions, nextHasEvidence);
    }
    visiting.delete(regionId);
  };

  walk(flow.entryRegionId, 0, false);

  for (const regionId of regionIds) {
    if (!reachable.has(regionId)) {
      diagnostic(diagnostics, "flow", "Every lesson region must be reachable from the entry.");
      break;
    }
  }
}

export function validateLessonDocument(
  document: LessonDocumentV4,
  acceptedClaimIds: string[],
): LessonValidation {
  const diagnostics: LessonDiagnostic[] = [];
  const ids = new Set<string>();

  if (document.schemaVersion !== 4) {
    diagnostic(diagnostics, "schemaVersion", "The lesson must use schema version 4.");
  }
  if (!document.blueprintId.trim()) {
    diagnostic(diagnostics, "blueprintId", "The lesson needs a blueprint id.");
  }
  if (document.title.trim().length < 6) {
    diagnostic(diagnostics, "title", "The lesson title must contain at least six characters.");
  }
  if (document.objective.trim().length < 20) {
    diagnostic(diagnostics, "objective", "The lesson needs one observable learning objective.");
  }
  if (
    document.regions.length < LESSON_LIMITS.minimumRegions ||
    document.regions.length > LESSON_LIMITS.maximumRegions
  ) {
    diagnostic(diagnostics, "regions", "A lesson must contain three to twenty regions.");
  }

  const declaredAssets = new Set(document.assetRefs);
  document.regions.forEach((region, index) => {
    if (ids.has(region.id)) {
      diagnostic(diagnostics, "regions[" + index + "].id", "Region ids must be unique.");
    }
    ids.add(region.id);
    if (!region.content.length) {
      diagnostic(
        diagnostics,
        "regions[" + index + "].content",
        "Each region needs at least one accessible content block.",
      );
    }
    region.content.forEach((content, contentIndex) => {
      validateContent(
        content,
        "regions[" + index + "].content[" + contentIndex + "]",
        declaredAssets,
        diagnostics,
      );
    });
    if (region.interaction) {
      validateInteraction(region.interaction, "regions[" + index + "].interaction", diagnostics);
    }
  });

  if (!document.regions.some((region) => Boolean(region.interaction))) {
    diagnostic(diagnostics, "regions", "The lesson must include learner-owned practice or reflection.");
  }

  for (const claimId of document.approvedClaimIds) {
    if (!acceptedClaimIds.includes(claimId)) {
      diagnostic(
        diagnostics,
        "approvedClaimIds",
        "Personalization claim " + claimId + " has not been approved by the learner.",
      );
    }
  }

  if (document.sourcePolicy === "current") {
    const sourceCards = document.regions.flatMap((region) =>
      region.content.flatMap((content) =>
        content.type === "source_cards" ? content.sources : [],
      ),
    );
    const officialReferences = sourceCards.filter(
      (source) => source.sourceType === "official",
    );
    const hasOfficialReference = officialReferences.length > 0;
    if (!hasOfficialReference) {
      diagnostic(
        diagnostics,
        "sourcePolicy",
        "Current lessons need at least one official source reference.",
      );
    }
    officialReferences.forEach((source, index) => {
      if (!source.retrievedAt || !Number.isFinite(Date.parse(source.retrievedAt))) {
        diagnostic(
          diagnostics,
          `sourcePolicy.officialReferences[${index}].retrievedAt`,
          "Current official references need a visible retrieval date.",
        );
      }
    });

    if (document.blueprintId === "codex_current_personalized_v1") {
      const officialHosts = new Set([
        "learn.chatgpt.com",
        "developers.openai.com",
        "platform.openai.com",
        "help.openai.com",
        "openai.com",
      ]);
      const isOfficialCodexUrl = (value: string) => {
        try {
          const url = new URL(value);
          return url.protocol === "https:" && officialHosts.has(url.hostname);
        } catch {
          return false;
        }
      };
      officialReferences.forEach((source, index) => {
        if (!isOfficialCodexUrl(source.url)) {
          diagnostic(
            diagnostics,
            `sourcePolicy.officialReferences[${index}].url`,
            "Current Codex product claims require an official OpenAI reference.",
          );
        }
        if (!source.availability?.trim()) {
          diagnostic(
            diagnostics,
            `sourcePolicy.officialReferences[${index}].availability`,
            "Current Codex references must state plan, platform, region, or preview availability.",
          );
        }
      });
      sourceCards
        .filter((source) => source.sourceType === "community")
        .forEach((source, index) => {
          const disclosure = [source.title, source.claim, source.availability]
            .filter(Boolean)
            .join(" ");
          if (!/exploration/i.test(disclosure)) {
            diagnostic(
              diagnostics,
              `sourcePolicy.communityReferences[${index}]`,
              "Community-only Codex claims must be visibly labeled as exploration.",
            );
          }
        });
      document.regions.forEach((region, index) => {
        const officialAnchor = region.provenance.some((entry) =>
          entry.sourceRefs.some(isOfficialCodexUrl),
        );
        if (!officialAnchor) {
          diagnostic(
            diagnostics,
            `regions[${index}].provenance`,
            "Every current Codex region needs official OpenAI provenance.",
          );
        }
      });
    }
  }

  validateFlow(document, ids, diagnostics);

  if (document.estimatedMinutes > 30) {
    diagnostic(
      diagnostics,
      "estimatedMinutes",
      "Consider splitting sessions longer than thirty minutes.",
      "warning",
    );
  }

  return {
    valid: diagnostics.every((item) => item.severity !== "error"),
    digest: "lesson-" + stableHash(JSON.stringify(document)),
    diagnostics,
  };
}

export function createLinearLessonFlow(
  regions: Array<Pick<LessonRegion, "id" | "order">>,
): LessonFlowV4 {
  const ordered = [...regions].sort((left, right) => left.order - right.order);
  return {
    entryRegionId: ordered[0]?.id ?? "",
    edges: ordered.slice(0, -1).map((region, index) => {
      const next = ordered[index + 1]!;
      return {
        id: "edge-" + region.id + "-" + next.id,
        from: region.id,
        to: next.id,
        priority: 0,
        condition: { type: "always" as const },
      };
    }),
  };
}

export function upgradeLessonDocumentV3(
  document: LegacyLessonDocumentV3,
  defaults: Partial<
    Pick<
      LessonDocumentV4,
      "blueprintId" | "pedagogicalMode" | "sourcePolicy" | "assetRefs"
    >
  > = {},
): LessonDocumentV4 {
  return {
    ...document,
    schemaVersion: 4,
    blueprintId: defaults.blueprintId ?? "legacy_v3",
    pedagogicalMode: defaults.pedagogicalMode ?? "conceptual",
    sourcePolicy: defaults.sourcePolicy ?? "evergreen",
    flow: createLinearLessonFlow(document.regions),
    assetRefs: defaults.assetRefs ?? [],
  };
}

export function conditionMatches(
  condition: EdgeCondition,
  response: RegionResponse | undefined,
) {
  if (condition.type === "always") return true;
  if (!response) return false;
  if (condition.type === "answer_equals") return response.value === condition.value;
  return response.correct === condition.value;
}

export function resolveLessonPath(
  document: LessonDocumentV4,
  regions: CanvasRegion[],
): ResolvedLessonPath {
  const responses = new Map(regions.map((region) => [region.id, region.response]));
  const visibleRegionIds: string[] = [];
  const selectedEdgeIds: string[] = [];
  const seen = new Set<string>();
  let currentId: string | undefined = document.flow.entryRegionId;

  while (currentId && !seen.has(currentId)) {
    seen.add(currentId);
    visibleRegionIds.push(currentId);
    const outgoing = sortedOutgoing(document, currentId);
    if (!outgoing.length) break;

    const hasConditionalBranch = outgoing.some((edge) => edge.condition.type !== "always");
    const response = responses.get(currentId);
    if (hasConditionalBranch && !response) break;

    const selected = outgoing.find((edge) => conditionMatches(edge.condition, response));
    if (!selected) break;
    selectedEdgeIds.push(selected.id);
    currentId = selected.to;
  }

  const allRegionIds = document.regions.map((region) => region.id);
  const visibleSet = new Set(visibleRegionIds);
  const potentialSet = new Set<string>();
  const visitPotential = (regionId: string) => {
    if (potentialSet.has(regionId)) return;
    potentialSet.add(regionId);
    const outgoing = sortedOutgoing(document, regionId);
    if (!outgoing.length) return;
    const conditional = outgoing.some((edge) => edge.condition.type !== "always");
    const response = responses.get(regionId);
    if (conditional && response) {
      const selected = outgoing.find((edge) =>
        conditionMatches(edge.condition, response),
      );
      if (selected) visitPotential(selected.to);
      return;
    }
    outgoing.forEach((edge) => visitPotential(edge.to));
  };
  if (document.flow.entryRegionId) visitPotential(document.flow.entryRegionId);
  const currentRegionId =
    visibleRegionIds.find((regionId) => {
      const region = regions.find((candidate) => candidate.id === regionId);
      return Boolean(region?.interaction && !region.response);
    }) ??
    visibleRegionIds[visibleRegionIds.length - 1] ??
    null;

  return {
    visibleRegionIds,
    lockedRegionIds: allRegionIds.filter(
      (regionId) => potentialSet.has(regionId) && !visibleSet.has(regionId),
    ),
    hiddenRegionIds: allRegionIds.filter((regionId) => !potentialSet.has(regionId)),
    selectedEdgeIds,
    currentRegionId,
  };
}
