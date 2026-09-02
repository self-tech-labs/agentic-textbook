# Sep 3 acceptance demo — flexible learning canvas

This is the release walkthrough for a fresh profile in Codex Desktop’s built-in browser. It leads with the personalized Codex lesson, then uses the compact fixture matrix to verify algebra, all three code languages, branching, and the transformer regression.

## Before recording

Use the deployed Worker URL, not the frontend-only Vite server. In a fresh profile confirm:

- `GET /api/health` reports schema 4 and all four services;
- JavaScript, TypeScript, and Python fixture submissions each execute in the no-network Sandbox;
- the console has no rich-renderer or WebMCP registration errors;
- the repository and live URL are public and require no login;
- the recording stays below three minutes and includes audio.

Do not use real customer context or expose private task titles. Synthetic recent-task summaries are sufficient to demonstrate the review boundary.

## 1. Start from a topic-neutral brief

Open the landing page. Point out that there is no transformer headline or fixed six-part path. The form asks for:

- topic/question and desired outcome;
- current level and available time;
- visual, quantitative, code, scenario, and reading preferences;
- accessibility notes;
- a visible, enabled-by-default recent-task personalization toggle.

Select **Build a better Codex workflow**, save the brief, and say in the adjacent conversation:

> Use the lesson brief I prepared on this page. Personalize only from recent task summaries I am allowed to use, show me every derived claim before authoring, and use official sources for current Codex behavior.

Codex first calls `learn_get_start_brief` and `learn_get_authoring_capabilities`, then `learn_begin_session` with the brief ID and declared host capabilities.

## 2. Review minimized context

Demonstrate at most two synthetic derived claims, each short enough to inspect in full—for example, that the learner repeats repository setup work and wants stronger verification habits. The context pack reports its 30-day lookback and inspected-summary count but contains no task ID, prompt, transcript, or code.

On the canvas:

1. accept one claim;
2. correct or reject the second;
3. show that Codex cannot mark either decision itself.

If task history is unavailable, say so and continue from the brief/current conversation. This is a supported fallback, not an error.

## 3. Compose and approve a current Codex lesson

Ask Codex to create a short foundation plus the one to three modules most relevant to the reviewed signals. It should use the stable desktop loop—choose a workspace, state an outcome with context, inspect results, test, and refine—and attach official source records for product behavior.

The progressive `learn_prepare_lesson` path can start a mixed-mode skeleton, fill individual regions, and finalize the graph. The review view exposes:

- blueprint, pedagogical mode, source policy, and duration;
- the exact revision/digest;
- source availability, platform/plan/preview notes, and retrieval dates;
- a concept-map preview of the authored graph.

Approve that exact revision, then let Codex call `learn_publish_lesson`. A changed, unapproved, or unresolved revision must fail.

## 4. Show rich blocks and one branch

In the published lesson, show the lazy Mermaid workflow diagram and a code example. Answer the scenario choice that selects a remediation route. The concept map should mark completed and current regions, lock future regions, and omit the unselected branch body.

Submit the remediation evidence. Explain that the answer and selected edge are now immutable; a structural rewrite would create a new draft requiring approval.

## 5. Run the vertical-slice fixture matrix

Use fresh local state between fixtures. This can be a short QA segment outside the final three-minute recording.

### Algebra

Choose **Algebra and functions**. Verify:

- slope renders through KaTeX as HTML+MathML;
- the lesson includes a Mermaid relationship diagram;
- an incorrect numeric answer follows the remediation edge;
- a correct answer follows the direct transfer edge;
- malformed formula/diagram test inputs retain readable fallback text.

### JavaScript, TypeScript, and Python

Choose **Debug JavaScript, TypeScript, or Python** and exercise each registered fixture. For every language:

1. inspect the escaped starter example;
2. edit in the lazily loaded CodeMirror lab;
3. run the server-side tests;
4. submit source plus hash/result/timestamp as local immutable evidence.

Verify one concurrent-run rejection, the rolling quota response, output truncation, and timeout behavior separately from the happy-path recording.

### Governed media

Register a small HTTPS raster image with caption, attribution, and alt text. Verify the R2-backed reference renders. Also verify rejection of HTTP, credentialed/private/local URLs, HTML/SVG, spoofed MIME, excess redirects, and over-budget assets. Audio additionally needs a transcript; video needs transcript and inline WEBVTT captions.

### Transformer regression

Open the deprecated `transformer_technical_beginner` fixture and complete its choice and reflection. Load a saved V3 session and confirm content, provenance, responses, undo history, and revisions survive while sequential `always` edges are added. The V3 storage record must remain present.

## What the demo proves

- One generic brief can initiate a lesson about an arbitrary topic.
- Registries, not topic-specific React flows, define available content, exercises, blueprints, and constraints.
- Current product education combines learner relevance with authoritative recency while labeling community exploration.
- Rich explanations degrade accessibly, heavy engines do not inflate the initial bundle, and executable code is isolated behind operational-only backend state.
- Context, structural publication, branch selection, and evidence all retain explicit learner authority.
