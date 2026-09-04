# Devpost submission draft — The Agentic Textbook

Prepared for **The WebMCP Challenge** on September 3, 2026. This is a local review copy; it has not been submitted.

## Core listing

- **Title:** The Agentic Textbook
- **Tagline:** Learn anything, with the help of your favorite agent
- **One-line summary:** A shared WebMCP canvas where the agent a learner already trusts turns an approved learning goal and context into a structured, adaptive lesson.
- **Live app:** https://ogram-learning-canvas.ervaucher.workers.dev
- **Source:** https://github.com/self-tech-labs/agentic-textbook
- **Demo:** https://youtu.be/gQleuBjeSms — 2:35 with narration; currently private and ready to be made public immediately before submission.

## Submission story

### Inspiration

Training for fast-moving technology is often outdated before it goes live. We see this while onboarding people to frontier AI tools—especially Codex. Capabilities change almost daily, while learners still need a clear place to understand what changed, why it matters, and how to use it well.

We wanted a learning surface that could keep up: not another static academy, but a place where each learner can create the exact training they need, when they need it.

### What it does

The Agentic Textbook turns the AI agent a learner already uses into a live teaching partner. Together, the learner and agent create explanations, visuals, exercises, code labs, and adaptive learning paths inside a shared WebMCP canvas.

The product deliberately separates two kinds of authority:

- **The agent brings intelligence and approved context.** It can use the learner's goals, prior knowledge, interests, and questions to generate or adapt material.
- **The textbook brings pedagogy and control.** It provides lesson structure, sequencing, remediation paths, learning-science-informed components, validation, and visible learner approvals.

This is a BYOA model: Bring Your Own Agent. The learner keeps the agent they already trust, while WebMCP makes the browser a shared workspace. Ask for another explanation. Add a formula or diagram. Generate an exercise. Slow down, go deeper, or approach the concept from another angle. The agent can revise one focused region without rebuilding the lesson.

### Why WebMCP is essential

WebMCP is the interaction model, not a wrapper around a hidden API. The page exposes typed, outcome-level capabilities to the same agent and human sharing the visible canvas. Tools appear only when they are valid for the current lesson stage: the agent reads a saved brief, proposes minimized context for review, authors a validated lesson, publishes only an exact learner-approved revision, and later adapts individual regions without gaining authority over learner evidence.

The page still works for a human without native WebMCP. WebMCP adds structured collaboration on top of that usable interface instead of replacing it with button-by-button automation.

### How we built it

The frontend is React, TypeScript, and Vite. A small WebMCP adapter exposes a staged set of 15 tools, beginning with only three bootstrap tools. A topic-neutral `LessonDocumentV4` schema composes registered prose, KaTeX formulas, Mermaid diagrams, code, governed media, and exercises into a validated 3–20-region acyclic lesson graph.

Learner context, answers, publication history, and evidence remain local-first. Mutating calls require a session nonce, idempotency key, and current revision. The Cloudflare service layer uses Workers, D1 for minimized operational metadata, R2 for immutable media, Durable Objects, and an isolated Sandbox container for JavaScript, TypeScript, and Python code exercises.

### How we used AI and Codex

OpenAI Codex was our primary AI collaborator for product ideation, architecture, implementation, debugging, security review, testing, documentation, and the final narrated demo. It helped us iterate from the WebMCP interaction thesis to a production implementation, while we kept the product decisions, privacy boundaries, and learner authority explicit.

We also used Gemini 3.5 Flash through GoogleChromeLabs' `webmcp-evals` browser loop to test agent tool selection and multi-step journeys. Across three fresh-page samples, the verified agent suite completed all 21 expected tool steps.

### Challenges

The hardest part was making a genuinely new interaction model legible to a coding agent. Agents are excellent inside familiar patterns; when the idea was underspecified, they naturally pulled it back toward conventional chat or automation. We had to make the human/agent division of labour precise before the implementation became coherent.

Personalization created a second tension: context is valuable, but privacy is non-negotiable. We designed a consent-scoped lane where learners review minimized context signals before those signals can shape a lesson.

### Accomplishments

- A simple learner experience backed by structured lesson generation, contextual adaptation, interactive exercises, targeted revisions, and learner-controlled publishing.
- A staged 15-tool WebMCP surface with revision checks, idempotency, and visible human approval for high-authority decisions.
- A 100/100 Nekuda WebMCP Workbench audit with no failures or warnings.
- Three deterministic browser checks and 21/21 expected Gemini agent-journey steps across nine fresh-page executions.
- Sixty-six application tests, a 109.53 KB gzip initial bundle, production deployment, and 13 passing deployed adversarial isolation checks.

### What we learned

WebMCP is not simply MCP inside a browser. It makes the browser a live, inspectable workspace where humans and agents can read, act, create, and revise together. The strongest result came from a clear division of labour: the agent brings context and generative ability; the application brings pedagogical constraints, trust boundaries, and learner control.

### What's next

We want learning experiences that move as fast as the technology they teach. For organizations, that means bringing curricula, terminology, policies, and role-specific knowledge into the same consent-scoped experience. For learners, it means making the agent-to-canvas loop fast enough that a requested change feels immediate.

## Judge testing path

1. Open the live app in Google Chrome 149+ with experimental WebMCP enabled.
2. Choose a starter or prepare a custom lesson brief, then save it.
3. Ask a compatible agent: “Use the lesson brief I prepared on this page.”
4. Inspect the staged tool discovery and review any minimized context claims in the visible UI.
5. Let the agent prepare the lesson, approve the exact revision in the UI, and publish it.
6. Ask the agent to adapt one region, then complete an exercise and inspect the learner-owned evidence path.

The core frontend experience remains available without WebMCP. Agent collaboration requires a compatible WebMCP-enabled browser/host.

## Uploaded media

- Five project images are already present in the Devpost project gallery.
- The final 2:35 narrated demo is uploaded to YouTube and will be switched from private to public at final confirmation.
- Suggested demo title: **The Agentic Textbook — WebMCP Demo**
- Suggested YouTube description:

  > The Agentic Textbook turns a learner's goal and explicitly approved context into an interactive, adaptive lesson inside Codex through WebMCP.
  >
  > The learner stays in control of personal context, the exact lesson plan, publication, and reusable evidence.
  >
  > Live project: https://ogram-learning-canvas.ervaucher.workers.dev
  >
  > Built for The WebMCP Challenge.

## Official submission answers

| Field ID | Field | Answer |
|---:|---|---|
| 28249 | Submitter Type | Organization |
| 28250 | Country | Switzerland |
| 28251 | Organization name | Parsing Sàrl |
| 28252 | App Status | New |
| 28253 | Existing-app updates | Blank — optional and not applicable |
| 28254 | Live app URL | https://ogram-learning-canvas.ervaucher.workers.dev |
| 28255 | Testing instructions | Blank — optional; judge path is documented above |
| 28256 | Public repository URL | https://github.com/self-tech-labs/agentic-textbook |
| 28257 | Agents tested | Google Chrome 149+ with experimental WebMCP enabled; the nekuda WebMCP Workbench; and Gemini 3.5 Flash through GoogleChromeLabs' webmcp-evals browser loop. |
| 28258 | AI tools used | OpenAI Codex was our primary AI collaborator for product ideation, architecture, implementation, debugging, security review, testing, and documentation. We also used Gemini 3.5 Flash through GoogleChromeLabs' webmcp-evals to test agent tool selection and multi-step WebMCP journeys. |
| 28259 | How much did you learn? | Moderate |
| 28260 | Would AI skill benefit your career? | Yes |

## Final readiness notes

- The live app is public and requires no account.
- The GitHub repository is public and contains an MIT license.
- The final video is under the three-minute limit, contains clear audio, and only needs its YouTube visibility changed to public.
- The Devpost project already contains its tagline, story, technology list, live link, and five images. Its demo-video field is the only known empty project-detail field.
- Submission remains a draft until the owner explicitly confirms the public YouTube change, Devpost update, and final submission.

## Known limitations

- Native WebMCP remains experimental and requires a compatible Chrome/agent setup.
- The current code lab accepts one source file and no third-party packages.
- Vega-Lite, multi-select, ordering, matching, cloze, uploads, and multi-file projects are planned rather than registered in the current lesson schema.
- The product establishes an organization-context extension point; it does not yet include a complete enterprise administration layer.
