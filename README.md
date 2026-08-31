# learn.ogram v3 — Agent-native Learning Canvas

learn.ogram is a WebMCP prototype for co-constructing an e-learning experience with Codex. The Codex conversation is the only conversational surface. The website is the shared, addressable notebook beside it: Codex can read its semantic state, propose learner context, prepare a lesson, and reshape one focused region while the learner keeps control of consent, publication, and answers.

The polished demonstration teaches a technical beginner **how transformers work**, from tokens and embeddings through self-attention, transformer blocks, and next-token prediction.

## Run locally

```bash
npm install
npm run dev
```

Open the Vite URL in Codex Desktop’s built-in browser. The page is designed for the right-hand pane with the Codex conversation on the left.

Start from the conversation:

> Teach me how transformers work. Start by calling `learn_begin_session` on this page, relay its short guide, and ask before using any personal context.

The first site-tool call returns a five-step user guide and an in-memory session nonce. On a fresh page, it is the only native WebMCP tool registered.

## The learning loop

1. Codex calls `learn_begin_session`; the page becomes a progressive transformers skeleton.
2. The learner chooses whether Codex may consult conversation or connected-source context.
3. Codex sends only privacy-minimized claims to the page. The learner accepts, corrects, or rejects every claim.
4. Codex compiles a lesson draft. The learner approves the exact revision on the canvas before Codex can publish it.
5. The learner works through a continuous notebook and asks questions in the adjacent Codex conversation.
6. Codex reads focus, selected text, viewport, interactions, and region revisions, then patches a trusted renderer, adds a sandboxed interaction, or attaches sourced research.
7. Agent-owned changes are scoped, attributed, concurrency-safe, and undoable. Learner responses remain immutable.

There is no embedded assistant, **Ask Codex** button, pinned-question flow, or assistance rail.

## Public WebMCP tools

| Stage | Tool | Purpose |
|---|---|---|
| Bootstrap | `learn_begin_session` | Required first call; starts or resumes the handshake, creates the skeleton, and returns the guide and nonce. |
| Context | `learn_get_context` | Reads minimized claims, provenance, consent coverage, and learner review status. |
| Context | `learn_propose_context` | Proposes consent-attested claims from conversation, Ogram, or a connected MCP source. |
| Session | `learn_get_session` | Reads stage, lesson status, progress, revisions, recent events, and next valid actions. |
| Authoring | `learn_prepare_lesson` | Compiles a region-based lesson draft; includes the bundled transformer blueprint. |
| Authoring | `learn_publish_lesson` | Publishes only the exact compiled revision approved by the learner. |
| Canvas | `learn_get_canvas_snapshot` | Reads stable regions, focus, selected text, viewport, evidence, revisions, and renderer capabilities. |
| Canvas | `learn_patch_region` | Replaces, appends, annotates, or marks one region with trusted content specifications. |
| Canvas | `learn_inject_widget` | Appends bounded HTML/CSS/JS inside a no-origin, no-network sandbox. |
| Research | `learn_attach_research` | Adds a bounded synthesis and canonical citation cards to a target region. |
| Canvas | `learn_revert_region` | Restores an agent-owned prior region version with an undo token. |

All non-bootstrap calls require the nonce. Every write also carries an idempotency key and the current canvas or region revision. A stale write reports the latest revision instead of overwriting newer work.

Native tool registration rotates by stage with abortable lifecycles. The test/replay fallback registry at `window.__OGRAM_WEBMCP_TOOLS__` contains all eleven tools but enforces the same nonce and state gates.

## Safety and learner authority

- External connectors stay agent-side. The page receives neither connector credentials nor raw messages, files, or calendar entries.
- Connector or conversation context needs an explicit consent attestation before proposal and separate card-level approval before personalization.
- Structural lesson changes need compiler approval and learner approval of the exact digest/revision.
- Region tools cannot edit interactions, learner responses, completed evidence, consent receipts, or publication history.
- Trusted React/SVG renderers cover prose, key points, tokens, attention maps, transformer stacks, comparisons, and source cards.
- Generated widgets run in an iframe with `sandbox="allow-scripts"`, a network-blocking CSP, size budgets, a two-second ready timeout, validated messages, reset/stop controls, and a text alternative.
- The v3 persistence adapter reads only `learn-ogram-canvas:v3`. It deliberately ignores the old v2 cache key without deleting it.

## Useful commands

```bash
npm run typecheck
npm run test:run
npm run build
```

The automated suite covers bootstrap-only registration, nonce and consent gates, exact publication approval, generic context skipping, focus and semantic snapshots, scoped/idempotent/stale-safe patches, learner evidence immutability, undo, research provenance, widget budgets, persistence boundaries, and the end-to-end transformer path.

## Project map

```text
src/domain/agentCanvas.ts          v3 session, context, lesson, region, event, and validation model
src/domain/transformerFixture.ts   polished technical-beginner transformer notebook
src/hooks/useLearningCanvas.ts     state machine, consent gates, revisions, receipts, and undo
src/lib/webmcp.ts                  eleven staged site tools and fallback registry
src/components/LearningNotebook.tsx
                                    context review, lesson review, concept map, regions, and evidence
src/components/SandboxedWidget.tsx no-origin widget runtime and accessibility fallback
src/lib/canvasPersistence.ts       isolated v3 local cache
docs/architecture.md               implementation and trust-boundary details
docs/demo-script.md                uninterrupted acceptance-demo walkthrough
contracts/learning-event.schema.json
                                    v3 privacy-minimized event contract
```

The earlier graph compiler and primitive runtime remain as internal research code and tests; the old multi-call authoring surface is no longer public. `learn_prepare_lesson` is the single authoring entry point and the v2 task-boundary lesson cannot enter the new UI.

## Current prototype boundaries

A website cannot send an unsolicited message into the Codex conversation, so `learn_begin_session` returns copy that Codex should relay. The page cannot force Codex Desktop’s split layout. Connected sources are optional; learner-provided or conversation-approved context is the fallback. External research also remains agent-side and enters the page only as a bounded synthesis plus citation records.
