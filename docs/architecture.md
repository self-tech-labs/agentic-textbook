# Architecture — learn.ogram v3

## Product boundary

The Codex Desktop conversation is the sole conversational surface. learn.ogram is the live page beside it: a top-level WebMCP owner, a governed learning state machine, and a semantic notebook renderer.

```mermaid
flowchart LR
  subgraph Host[Codex Desktop]
    Conversation[Codex conversation]
    Agent[Codex agent]
    Sources[Current chat + Codex/project history + optional MCP sources]
  end

  subgraph Page[learn.ogram top-level page]
    Tools[Staged WebMCP tools]
    Session[Session + consent state]
    Compiler[Lesson compiler + review gate]
    Regions[Stable semantic regions]
    Renderers[Trusted React + SVG renderers]
    Sandbox[No-origin widget iframe]
    Evidence[Immutable learner evidence]
  end

  Sources -->|consent-attested minimized claims| Agent
  Conversation <--> Agent
  Agent <--> Tools
  Tools --> Session --> Compiler --> Regions --> Renderers
  Tools --> Regions
  Tools --> Sandbox
  Evidence --> Regions
```

The page never receives raw connector content or credentials. The agent is responsible for external research and connector access, then passes only minimized learner claims or bounded citation records through page tools.

## State model

`AgentLearningCanvasState` is the persisted v3 projection:

```text
version + canvas revision
learning session (topic, stage, consent, personalization)
reviewable context claims
lesson draft, compiler result, approval, and publication revision
ordered stable canvas regions
focus + selected text
privacy-minimized event ledger
bounded idempotency receipts
```

The session stages are:

```mermaid
stateDiagram-v2
  [*] --> ready
  ready --> context_review: learn_begin_session
  context_review --> lesson_review: valid learn_prepare_lesson
  lesson_review --> learning: exact approval + learn_publish_lesson
  learning --> lesson_review: replacement lesson prepared
```

Only the v3 storage key is loaded. A reload restores session, claims, draft/publication status, regions, evidence, history, and the correct registration stage, but never restores an in-memory nonce. Codex must call `learn_begin_session` again to resume and unlock the tools.

## Dynamic WebMCP registration

All tools are registered imperatively by the top-level document. Generated iframes own no tools.

| State | Native tools registered |
|---|---|
| No active nonce / ready | `learn_begin_session` |
| Context review | bootstrap, session/context reads, context proposal, snapshot, lesson preparation |
| Lesson review | context-review set plus publication |
| Published learning | all eleven v3 tools |

Each registration group has its own `AbortController`. A stage transition aborts the prior group before registering the next one. The fallback registry exposes all definitions for test/replay environments while every handler independently enforces nonce and state gates.

## Context consent

Context has two distinct gates:

1. Before Codex consults the current chat, past tasks/conversations, saved-project history, Ogram, or a connector, the learner explicitly authorizes source scopes and provider IDs. `learn_propose_context` carries that attestation.
2. Retrieval stays in the Codex host. A short current chat does not collapse the discovery scope: when approved, Codex can use task-listing and task-reading capabilities to inspect relevant accessible history.
3. The page renders each minimized claim with route, provider, resource type, sensitivity, purpose, and opaque evidence reference. The learner makes one binary decision: **Use this** or **Don’t use**.

An agent cannot mark a claim approved. A claim cannot personalize a lesson until card-level review is complete. Choosing the generic path rejects any still-pending claims and records `personalization: skipped`.

## Authoring and publication

`learn_prepare_lesson` supports two authoring paths. The preferred path is progressive: `start` commits typed metadata and 4–12 stable region stubs, each `region` call fills one stub with trusted content, and `finalize` assembles and validates the exact document. The preparation preview therefore changes from skeleton rows into compact renders of the real components while Codex is still working. A `complete` phase remains for compatibility and the bundled transformer template.

This split is the transport layer that makes live rendering possible. A WebMCP handler normally receives complete tool arguments, so a renderer alone cannot expose tokens produced before the call begins. Smaller idempotent calls create observable commit points without accepting invalid partial JSON or generated code.

The transport shape mirrors [json-render’s SpecStream model](https://json-render.dev/docs/streaming): stable IDs receive bounded commits and the UI updates after each one. At the rendering boundary, `TrustedContentRenderer.tsx` converts each typed `RegionContent[]` payload into json-render’s flat `root + elements` spec, validates it against the `ogram.learning.v1` catalog, and renders it through the `@json-render/react` registry. The shaping preview and published notebook call that same renderer with different presentation modes; there is no second hand-written content switch. Region-sized WebMCP commits remain the observable transport because a tool handler receives complete arguments rather than an in-flight token stream.

The v3 validator checks:

- an observable objective and meaningful title;
- four to twelve unique, non-empty stable regions;
- at least one learner-owned interaction;
- personalization claims against the accepted claim set;
- a focused prototype duration warning;
- preservation of any published region that already contains learner evidence.

The learner approves the exact compiled revision. `learn_publish_lesson` requires that exact revision, the latest canvas revision, a nonce, and an idempotency key. Publishing preserves existing learner responses on matching regions and rejects structural drafts that would remove or alter completed interactions.

## Semantic canvas regions

Each `CanvasRegion` has a stable ID, order, label, objective, kind, monotonic revision, status, trusted content, optional learner interaction/response, provenance, and bounded undo history.

The semantic snapshot includes:

- canvas and region revisions;
- region purpose, content, status, attribution, and response-completion state;
- the focused region and selected text;
- visible region IDs plus current viewport dimensions and scroll position;
- the trusted renderer registry and widget budgets.

`learn_patch_region` can replace, append, annotate, or set an activity status. Its input has no learner-response or interaction field, so it cannot cross the ownership boundary. A content write creates a prior-state snapshot and an undo token. A background-research `agent_working` transition is coalesced with the completed result so undo restores the usable pre-research region rather than a stranded working state.

If an `agent_working` region receives no completion within ninety seconds, local housekeeping returns it to `ready`, records a timeout event, and preserves its prior content. The rest of the notebook remains usable throughout.

## Trusted json-render catalog

V3 ships an explicit `@json-render/react` catalog and native, responsive registry implementations for:

- editorial prose and emphasized explanations;
- concise key-point grids;
- token sequences;
- accessible SVG attention weights;
- transformer-block stacks;
- comparisons;
- research synthesis and source cards.

Token sequences, attention sources, and transformer-stack stages expose keyboard-accessible inspection states. Static explanatory text remains static; visual models invite manipulation when it adds information rather than motion alone.

The transformer fixture uses six stable regions: goal, tokens/embeddings, self-attention, transformer block, next-token practice, and teach-back. The choice and reflection controls create immutable learner evidence.

## Canvas-only visual output and sandboxed widgets

The WebMCP contract names the learning canvas as the only visual-output destination. Codex should not invoke a host visualization surface or first produce an inline conversation widget and then copy it into the lesson. Trusted declarative content is preferred; when bespoke interaction materially helps, `learn_inject_widget` authors it directly inside the focused region.

`learn_inject_widget` accepts a body-fragment HTML payload, CSS, JavaScript, title, accessible summary, and initial height. The page rejects document shells and duplicate top-level titles, then enforces 12 KB HTML, 12 KB CSS, 24 KB JavaScript, and a 180–720 px height. The canvas supplies the visible title, Reset/Stop controls, fallback, and text alternative. A sandbox-side `ResizeObserver` requests a bounded parent height so the iframe does not become a nested reading scroller.

The iframe is created with:

```html
<iframe sandbox="allow-scripts" ... />
```

Its `srcdoc` CSP sets `default-src 'none'`, allows inline styles/scripts required by the payload, allows only data images, and blocks connections, media, fonts, objects, nested frames, form actions, and base URLs. Omitting `allow-same-origin`, forms, top navigation, popups, downloads, and modals prevents access to the parent origin and browser capabilities.

The wrapper validates `postMessage` by source window, channel, widget ID, event type, and numeric resize bounds. A two-second ready timeout removes the iframe and retains the previous region content with an accessible text fallback. External reset/stop controls and an Escape message return keyboard control to the parent.

This is a rendering sandbox, not a source of WebMCP tools or network access.

## Events and idempotency

The local ledger records session start, context proposal/review/skip, lesson preparation/approval/publication, region patch, widget injection, research attachment, reversion, and learner evidence submission. Payloads use IDs, counts, revisions, digests, and bounded summaries rather than raw connector content or long learner answers.

Every agent write checks its idempotency receipt before its expected revision. An exact retry therefore returns its original result even after the state advances. A new command with a stale canvas or region revision fails and tells the agent which read tool to call before retrying.

## Responsive and accessibility contract

The desktop layout assumes a right-hand Codex browser pane: a narrow sticky concept map, generous notebook measure, and a subtle left-edge agent bridge. At narrower widths, the map becomes a horizontal region index and all two-column review layouts stack. Anchor offsets reserve both sticky layers, the compact map uses one continuous connector line, progressive previews fit rather than clipping their last card, and comparison tables become stacked cards instead of creating a horizontal reading trap.

The next major iteration is the slot-based sticky lesson deck specified in `docs/sticky-section-ux-plan.md`. It deliberately separates document-flow slots (focus, anchoring, and reachable tall content) from sticky visual panels (the constrained object the learner sees).

Landmarks, semantic headings, native controls, focus-visible styling, text alternatives, SVG titles, live regions, keyboard Escape handling, and reduced-motion rules are part of the shipped implementation.

## Prototype boundaries

- A site cannot force an unsolicited Codex message; the bootstrap tool returns the guide Codex should relay.
- A site cannot read Codex task history. The host agent performs consented discovery and sends minimized claims through the page tool.
- The page cannot control Codex Desktop’s split layout.
- The in-browser persistence adapter is a local prototype cache, not a multi-tenant canonical store.
- The sandbox constrains capabilities but cannot guarantee interruption of all pathological CPU-heavy JavaScript; production should add stronger process/time isolation.
- Rich future renderers can enter behind the trusted registry and dynamic imports without widening the core tool surface.
