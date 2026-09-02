# learn.ogram v4 — Flexible, personalized learning canvas

learn.ogram turns the page beside a Codex conversation into a governed lesson canvas. A learner prepares a topic-neutral brief; Codex can then author a 3–20-region lesson using registered prose, formulas, Mermaid diagrams, code, governed media, and exercises. Subject matter and pedagogy are data in a validated `LessonDocumentV4`, not React routes.

The learner still owns the important decisions: context claims are reviewed before use, the exact structural revision is approved before publication, and submitted evidence and its selected branch are immutable.

## What V4 demonstrates

- A generic landing brief with topic, outcome, level, time, learning modes, accessibility notes, and visible recent-task personalization control.
- Registry-driven starters for a current personalized Codex workflow, algebra and functions, and JavaScript/TypeScript/Python debugging.
- A deprecated transformer starter retained as a migration and renderer regression fixture.
- Five pedagogical modes: `conceptual`, `quantitative`, `code`, `scenario`, and `mixed`.
- KaTeX formulas with HTML+MathML, strict Mermaid diagrams, escaped code examples, and governed native media with textual fallbacks.
- Single-choice, reflection, tolerance-aware numeric, and executable code-lab exercises.
- A validated acyclic lesson graph with remediation branches and an evidence-bearing terminal path.
- A local-first V3-to-V4 migration that validates before writing V4 and retains the V3 record for rollback.
- A Cloudflare Worker that serves the Vite app and `/api/*`, using D1 for operational metadata, R2 for immutable media, and an isolated Sandbox container for code.

V4.1 blocks—Vega-Lite, multi-select, ordering, matching, cloze, uploads, and multi-file projects—are intentionally not registered yet.

## Run locally

Install dependencies and run the frontend-only experience:

```bash
npm ci
npm run dev
```

The algebra and current-Codex fixtures work in this mode. Code execution and governed media import need the Worker runtime:

```bash
cp .dev.vars.example .dev.vars
# Replace the placeholder with a local random secret of at least 32 characters.
npm run db:migrate:local
npm run dev:worker
```

With the Worker running, verify the three language runtimes and the adversarial isolation matrix:

```bash
npm run smoke:worker
npm run smoke:security
```

Open the Wrangler URL in a fresh browser profile or Codex Desktop’s built-in browser. The page is designed to sit in the right-hand pane beside the Codex conversation.

## Start any lesson

Fill the brief on the landing page, or choose one of its registry-driven starters, and save it. Then tell Codex:

> Use the lesson brief I prepared on this page.

When personalization is enabled, Codex may inspect up to ten accessible recent task summaries from the previous 30 days. It sends at most eight short derived signals to the page; task IDs, raw prompts, transcripts, and code do not enter the lesson service. Every claim still requires learner review. If history is unavailable, the brief and current conversation remain sufficient.

For current Codex lessons, product behavior must be supported by an official source. Recent community material may affect prioritization but can only enter as a labeled exploration idea.

## WebMCP tools

The initial page exposes the first three tools; registration expands with the session stage. Every mutating post-bootstrap call requires the session nonce, an idempotency key, and the relevant current revision.

| Stage | Tool | Purpose |
|---|---|---|
| Brief | `learn_get_start_brief` | Read the saved brief, starter, and personalization request before a session exists. |
| Brief | `learn_get_authoring_capabilities` | Read schema version, registries, blueprints, limits, and source rules. |
| Bootstrap | `learn_begin_session` | Start or resume from a brief, optional minimized context pack, and host capabilities. |
| Context | `learn_get_context` | Read consent coverage and reviewable minimized claims. |
| Context | `learn_propose_context` | Propose consent-attested learner claims for accept/correct/reject review. |
| Session | `learn_get_session` | Read stage, revisions, validation, path, progress, and next actions. |
| Authoring | `learn_prepare_lesson` | Start, shape, finalize, or submit a V4 lesson for any topic and blueprint. |
| Assets | `learn_register_asset` | Import governed HTTPS media and return an immutable R2-backed reference. |
| Code | `learn_register_code_exercise` | Store a server-side test manifest and return an immutable exercise ID. |
| Authoring | `learn_publish_lesson` | Publish only the approved revision after reference validation. |
| Canvas | `learn_get_canvas_snapshot` | Read semantic regions, selected path, focus, evidence, and capabilities. |
| Canvas | `learn_patch_region` | Make a scoped, attributed, revision-safe content update. |
| Canvas | `learn_inject_widget` | Add a bounded no-origin widget for legacy bespoke interactions. |
| Research | `learn_attach_research` | Attach bounded synthesis and canonical citation records. |
| Canvas | `learn_revert_region` | Restore an agent-owned prior region revision. |

The test/replay registry is available at `window.__OGRAM_WEBMCP_TOOLS__` and enforces the same gates as native registration.

## Trust boundaries

- Learner state—answers, source code, recent-task summaries, prompts, publication history, and context review—stays in local storage.
- D1 stores signed guest-session metadata, quotas, asset metadata, code-test manifests, and rate-limit events only.
- Media import is HTTPS-only, follows at most three governed redirects, rejects local/private destinations, HTML, SVG, MIME spoofing, and oversized bytes, then stores content-addressed objects in R2.
- Code labs accept one source file, no packages, no network, no secrets, a reset working directory, a five-second process timeout, and 64 KB output. One run per guest may execute concurrently; the rolling quota is 20 runs per ten minutes.
- Guest requests use a signed HTTP-only same-site cookie, same-origin mutations, and a CSRF token.
- Operational logs contain endpoint, status, latency, quota outcome, and cold/warm sandbox state—never request bodies or learning content.
- Invalid formula, diagram, or media blocks fall back to accessible text without breaking the lesson.

## Verification

```bash
npm run typecheck
npm run test:run
npm run build
npm run cf:dry-run
```

With `npm run dev` already running on `127.0.0.1:5173`, exercise the live
WebMCP registrations in Chrome with Google's experimental eval CLI:

```bash
npm run eval:webmcp:smoke
```

The agent-journey suite in `evals/webmcp-agent-journeys.json` also checks tool
selection, fresh-page starting states, and the bootstrap-to-session tool
rotation. Run three samples before release with
`npm run eval:webmcp:agent -- --runs 3`. The default runner needs
`GOOGLE_AI` (the legacy `GEMINI_API_KEY` and
`GOOGLE_GENERATIVE_AI_API_KEY` names remain accepted) and runs Gemini 3.5 Flash
through the official CLI's implemented Vercel-AI browser loop. The package's
native `gemini` backend currently implements static-schema evals but not live
browser evals. Alternatively, select another backend/model
supported by `webmcp-evals` with arguments such as
`npm run eval:webmcp:agent -- --backend ollama --model <model>`. The wrapper
loads an ignored local `.env` when present and fails the command when the CLI
report contains failed or errored trajectories.

`npm run build` also fails if initial JavaScript exceeds 145 KB gzip. KaTeX, Mermaid, CodeMirror, and language support are visibility-triggered chunks and are excluded from the initial bundle.

## Project map

```text
src/domain/agentCanvas.ts          V4 contracts, graph validation, path selection, V3 migration
src/domain/lessonRegistry.ts       shared blocks, exercises, blueprints, limits, and source policy
src/domain/lessonCatalog.ts        LessonBriefV1, generic mode skeletons, and landing starters
src/domain/v4Fixtures.ts           Codex, algebra/remediation, and three-language code fixtures
src/domain/transformerFixture.ts   deprecated transformer regression fixture
src/hooks/useLearningCanvas.ts     consent, revision, branch, evidence, and persistence state machine
src/lib/webmcp.ts                  staged 15-tool WebMCP surface
src/lib/learningService.ts         same-origin Worker API client
src/components/rich/               lazy formula, diagram, media, and code-lab renderers
worker/                            guest security, R2 import, D1 metadata, Sandbox code runner
migrations/0001_v4_runtime.sql     operational D1 schema
contracts/                         transport-facing JSON Schemas
docs/architecture.md               runtime and trust-boundary design
docs/demo-script.md                Sep 3 vertical-slice walkthrough
docs/deployment.md                 Cloudflare setup and release checks
docs/jury-readiness.md             latest verified matrix, evidence, and blockers
docs/video-production-readiness.md full-surface capture and reusable demo methodology
```

## Deployment status

The implementation can be packaged and dry-run without claiming challenge eligibility. Workers Paid/Containers, the isolated staging resources, and the deployed JavaScript, TypeScript, Python, media, and adversarial smoke matrix were verified on September 2, 2026. Production publication remains gated on the submitting owner confirming the official rules/eligibility and choosing an explicit production promotion. See [docs/challenge-preflight.md](docs/challenge-preflight.md) and [docs/deployment.md](docs/deployment.md).
