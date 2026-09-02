# WebMCP resource-led Devpost preparation audit

Prepared September 2, 2026 from the five resources in [Idan Levin's preparation post](https://x.com/0xidanlevin/status/2094784117107839001). This is a technical and narrative readiness artifact, not an official Devpost submission draft.

## Submission thesis

**learn.ogram turns a conversation with an agent into a learner-owned, inspectable lesson canvas.** The agent can discover a saved learning brief, propose minimized context, author a validated multimodal lesson, and adapt individual regions. The learner reviews personal claims, approves the exact structural revision before publication, and owns immutable answers and branch evidence.

WebMCP is essential because it gives the conversational agent a typed, stage-aware interface to the same state the learner sees. This is not a hidden API wrapper or a tool for every button: the page remains fully usable by a human, tools express learning outcomes, and the highest-authority decisions stay in the visible interface.

## Outcome-first judge journey

1. **Answer:** the agent reads the learner's saved brief and the canvas's supported authoring capabilities.
2. **Action:** it begins or resumes a lesson session, with no recent-task context unless the learner requested it.
3. **Sensitive context:** the agent may propose a bounded set of derived learner claims, but only the learner can accept, correct, or reject them.
4. **Action:** it builds a 3–20-region lesson from registered content, exercise, and source contracts; validation rejects broken graphs and unsupported blocks.
5. **Sensitive action:** only the learner can approve the exact lesson revision; publication fails for a changed, unresolved, or unapproved draft.
6. **Shared progress:** the agent reads the semantic canvas before making a scoped, reversible region edit. Learner answers and selected evidence branches remain immutable.

The shortest strong demo is: **saved brief → capability discovery → reviewed context → progressive draft → exact-revision approval → publication → adaptive evidence**.

## Evidence produced in this preparation pass

- Added GoogleChromeLabs `webmcp-evals` smoke and agent-trajectory suites under `evals/`.
- Ran the deterministic suite in real headless Chrome with WebMCP enabled: **3/3 cases passed** for brief discovery, capability discovery, and session bootstrap.
- Added current-spec `untrustedContentHint` annotations to learner-authored and externally sourced tool results while retaining `readOnlyHint` on reads.
- Added regression coverage for the annotation boundary, bootstrap-field descriptions, native stage-tool rotation, and fail-closed registration errors; the full suite now passes **64 tests**.
- Verified TypeScript, the production build, the **109.28 KB gzip** initial-JavaScript budget, and Cloudflare packaging.
- Corrected the recording script so it distinguishes details visible in the lesson-review UI from metadata visible in the tool trace.
- Used nekuda Workbench against the live local page: it discovered the expected three bootstrap tools, ran `learn_get_start_brief`, recognized its result as untrusted, and passed a saved unit test in 2 ms.
- Raised the Workbench audit from **72/100** (seven missing field-description warnings) to **100/100** with zero failures and zero warnings.
- Ran the Gemini agent suite three times from fresh pages: **21/21 expected tool steps passed** across nine case executions, including the bootstrap-to-session transition.

The first live Gemini run revealed that two authored trajectories assumed mid-session state even though `webmcp-evals` opens a fresh page for every case. It also exposed a genuine integration race: a stage-changing tool could return before React finished rotating the native tool set. An app-scoped barrier now waits for the exact next stage and rejects the originating tool call on registration failure or timeout. The agent suite tests only reachable fresh-page journeys. The runner loads the ignored local `.env` and treats provider, trajectory, and report errors as failures rather than false green results.

## The five tweeted resources

| Resource | How it was used | Result for this project |
|---|---|---|
| [nekuda WebMCP Workbench](https://chromewebstore.google.com/detail/nekuda-webmcp-workbench/amochnnbmnkjjlblolhpddkokhnalkjp) | Inspected all three staged tools, executed the read-only brief tool, saved and passed a unit test, and used the audit to drive a schema fix. | Local audit is 100/100 with no findings. Repeat the same pass on the deployed URL and preserve the production audit plus one clean agent trace. |
| [GoogleChromeLabs WebMCP Evals](https://github.com/GoogleChromeLabs/webmcp-tools/tree/main/webmcp-evals) | Installed transiently through `npx`, added repeatable suites, and exercised the live local registrations in WebMCP-enabled Chrome. | Deterministic smoke is green (3/3); Gemini agent trajectories are green across three samples (21/21 expected steps). |
| [WebMCP.com directory and API](https://webmcp.com/) | Queried the directory API for learning, education, lesson, and canvas implementations and compared tool mixes. | Education is underrepresented. The closest patterns—Paperie, Pixelplace, PracticeHub, and Formswrite—reinforce the value of a shared canvas while leaving room for learner authority, staged disclosure, and evidence-aware adaptation as differentiators. |
| [Building User Journeys with WebMCP](https://webmcp.com/blog/building-user-journeys-with-webmcp) | Reframed the demonstration around an outcome-first co-browsing journey and separated Answer, Action, and Sensitive Action authority. | The judge story now follows one coherent transaction instead of enumerating 15 tools. Approval remains a visible human action. |
| [WebMCP.com resource hub](https://webmcp.com/resources) | Reviewed all 19 linked resources and mapped each one to design, security, compatibility, evaluation, deployment, or feedback work below. | Produced the complete ledger below so no nested resource is silently skipped. |

## Complete resource-hub ledger

| # | Resource | Applied preparation decision |
|---:|---|---|
| 1 | [WebMCP Draft Specification](https://webmachinelearning.github.io/webmcp/) | Checked the current imperative registration shape, lifecycle cleanup, annotations, and experimental-status language. The project registers through `document.modelContext.registerTool()` and aborts registrations on cleanup. |
| 2 | [Official WebMCP repository](https://github.com/webmachinelearning/webmcp) | Used the explainer and reference history as the canonical implementation cross-check; the submission should call WebMCP experimental rather than a completed W3C standard. |
| 3 | [Awesome WebMCP](https://github.com/webmachinelearning/awesome-webmcp) | Used the curated ecosystem index for a gap scan and to avoid presenting ordinary browser automation as novel WebMCP behavior. |
| 4 | [Chrome for Developers: WebMCP](https://developer.chrome.com/docs/ai/webmcp) | Checked the browser-facing API model and progressive-enhancement requirement. The human notebook still works when native WebMCP is unavailable. |
| 5 | [Build WebMCP Tools](https://developer.chrome.com/docs/ai/webmcp/build-tools) | Applied goal-first tool design, role-played starting states, recoverable errors, and evaluation of tool choice, arguments, and page-state changes. This directly shaped the two eval files. |
| 6 | [WebMCP Origin Trial](https://developer.chrome.com/blog/ai-webmcp-origin-trial) | Added a deployment compatibility check: test the production origin in a supported Chrome build and document any flag or trial-token requirement rather than assuming universal availability. |
| 7 | [WebMCP Tool Security](https://developer.chrome.com/docs/ai/webmcp/secure-tools) | Added `untrustedContentHint` regression coverage and audited recommended character budgets. One long tool name and several large capability/snapshot outputs remain optimization targets, not hidden claims of compliance. |
| 8 | [Agent Security Considerations](https://developer.chrome.com/docs/agents/security) | Checked prompt-injection boundaries, origin restriction, token/output limits, confirmations, and adversarial paths. External research, user content, and imported assets are marked untrusted; sensitive decisions stay with the learner. |
| 9 | [Angular WebMCP](https://angular.dev/ai/webmcp) | Used the framework integration as a portability comparison. The React implementation intentionally keeps registration in a small adapter and does not add Angular solely for submission optics. |
| 10 | [nekuda WebMCP Workbench](https://chromewebstore.google.com/detail/nekuda-webmcp-workbench/amochnnbmnkjjlblolhpddkokhnalkjp) | Completed local discovery, read-only execution, a saved unit test, and a 100/100 audit. Production replay remains part of the deployed-origin acceptance pass. |
| 11 | [Model Context Tool Inspector](https://chromewebstore.google.com/detail/model-context-tool-inspec/gbpdfapgefenggkahomfgkhfehlcenpd) | Added an independent inspector cross-check to the final browser checklist. It is optional redundancy after Workbench, and installation is likewise a user-controlled browser action. |
| 12 | [Cloudflare Browser Run + WebMCP](https://developers.cloudflare.com/browser-run/features/webmcp/) | Aligned production evaluation with the existing Cloudflare Worker architecture and identified a future headless WebMCP smoke path. Execution awaits Cloudflare authentication, entitlement, and a deployed origin. |
| 13 | [GoogleChromeLabs/webmcp-tools](https://github.com/GoogleChromeLabs/webmcp-tools) | Used the official examples and `webmcp-evals` package as the executable test harness. The deterministic suite passed in Chrome. |
| 14 | [WebMCP and the Agentic Web — BlinkOn 21](https://www.youtube.com/watch?v=M1cME470ugM) | Reviewed the available transcript. Its comparison with screenshot/DOM automation, composable common-task tools, and explicit human-in-the-loop model sharpened the pitch around page-provided capabilities and shared state. |
| 15 | [Don't Let AI Agents Push Your Buttons](https://www.youtube.com/watch?v=p1l8nkQAoUw) | Captions were unavailable, so only the publisher's description and visible page metadata were used. Its emphasis on author-defined capabilities and faster, more reliable agent experiences supports narrow outcome tools instead of button-by-button automation. |
| 16 | [Agents on the Web and in the Browser](https://www.youtube.com/watch?v=6Po39iD6Pfs) | Captions were unavailable, so the publisher description and visible chapter metadata were used. The in-browser MCP and authorization framing supports describing this as co-browsing on the same inspectable learning surface. |
| 17 | [Chrome AI Early Preview Program](https://goo.gle/chrome-ai-dev-preview-join) | Treated as an access and compatibility route, not as evidence of enrollment. The submission checklist records supported-browser verification explicitly. |
| 18 | [Chrome AI Dev Preview Discuss](https://groups.google.com/a/chromium.org/g/chrome-ai-dev-preview-discuss) | Added as the primary escalation channel for browser/API ambiguity discovered during the final production pass; community answers are not treated as normative specification. |
| 19 | [r/webmcp](https://www.reddit.com/r/webmcp/) | Used as a post-deploy feedback and discoverability channel, while keeping technical claims grounded in the specification and official documentation. |

## Directory comparison and positioning

The queried directory currently shows hundreds of WebMCP sites but few education-specific implementations. Comparable shared-surface projects expose a small mix of read and action tools. learn.ogram exposes 15 total tools but only the three bootstrap tools initially; the available surface expands with session stage.

That staged disclosure is important to the pitch. The number **15** is less persuasive than the authority model:

- read the brief and capabilities before acting;
- disclose only tools valid for the current stage;
- require nonces, revisions, and idempotency keys for mutations;
- require visible learner approval for context and publication;
- keep answers and branch evidence outside agent mutation authority.

## Honest submission boundaries

- There is no `.devpost-hackathon-state.json`, reviewed rules state, or official Devpost draft in this checkout. Run the guided hackathon start and rules-review steps before drafting submission copy.
- The current V4 work is on `deep-UX-improvement`, while the public repository's default branch still points at an older prototype. Merge or change the default branch before sharing the source URL with judges.
- No production URL or public sub-three-minute demo video is recorded yet.
- Cloudflare production work still needs owner eligibility/rules acknowledgment, authenticated Workers Paid/Containers access, staging resources, and a staging security/runtime smoke pass.
- Run the Workbench audit and independent inspector on the production URL in a supported Chrome profile; capture the tool list, one successful end-to-end trace, one rejected unsafe/stale action, and a clean audit result.
- Preserve the three-run Gemini report and rerun the agent suite against the production origin; review any real trajectory failures rather than tuning only for pass rate.
- The tool name `learn_get_authoring_capabilities` exceeds the resource guide's 30-character recommendation, and large capability/session/snapshot results should be measured for pagination or summarization before release.
- The app does not call an OpenAI model API directly. Submission copy should truthfully say that Codex or another WebMCP-capable host invokes page tools; it should not claim an embedded OpenAI SDK integration.

## Final evidence package to capture

1. Production URL in a fresh, supported browser profile with no login.
2. Workbench tool inventory, audit output, and replayable happy-path trace.
3. Google deterministic and agent-trajectory eval reports.
4. Three screenshots: topic-neutral brief, learner approval boundary, published adaptive lesson/evidence.
5. A public, narrated video under three minutes following the corrected demo script.
6. Public repository on the V4 branch/default branch with MIT license visible.
