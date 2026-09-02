# WebMCP Challenge preflight

Implementation status updated: September 2, 2026. Rules last checked against Devpost on September 1, 2026. The [official Devpost rules](https://webmcp.devpost.com/rules) prevail over this checklist.

## Gate 0 status

- [x] Rules, deadline, judging criteria, and submission requirements rechecked against Devpost.
- [x] Local Worker package, pinned custom container, D1 migration, and cold/warm Sandbox path verified.
- [x] JavaScript, TypeScript, and Python pass their server-side fixture tests in fresh local containers.
- [x] Governed HTTPS media passes MIME/magic-byte validation, immutable R2 storage, authenticated readback, and publish-reference validation locally.
- [x] Local adversarial smoke passes for CSRF/origin, network and secret isolation, package installation, filesystem escape, reset, shell metacharacters, source/output/time limits, concurrency, and rolling quota.
- [x] TypeScript, 64 automated tests, production build, 109.31 KB initial-JavaScript budget, and both production and isolated-staging Cloudflare dry runs pass.
- [x] GoogleChromeLabs `webmcp-evals` deterministic smoke passes 3/3 cases in WebMCP-enabled Chrome.
- [x] Local nekuda Workbench tool discovery, read-only execution, saved unit test, and 100/100 audit pass.
- [ ] Submitting owner confirms personal/entity eligibility and acknowledges the official rules.
- [x] Cloudflare OAuth is authenticated to the intended account with the required Worker and Containers scopes.
- [x] Workers Paid/Containers account entitlement is enabled.
- [x] Docker responds to `docker version` and `docker info` for the container image build.
- [x] Staging Worker, D1 database, R2 bucket, custom container, and signing secret are provisioned.
- [x] The same three-language Sandbox smoke test passes against staging.
- [ ] Production/incognito run passes in ChatGPT’s in-app browser and a WebMCP-capable Chrome build.
- [x] Gemini 3.5 Flash agent-trajectory suite passes 21/21 expected tool steps across three fresh-page samples through GoogleChromeLabs `webmcp-evals`, including dynamic bootstrap-to-session tool rotation.

The owner eligibility item is a legal/personal attestation and must not be checked by
an agent. On September 2, the owner enabled Workers Paid and R2; the live Containers
API then succeeded, Docker Server 28.3.3 responded, and the isolated staging stack was
provisioned. `npm run deploy:staging:bootstrap` published the custom container, applied
`0001_v4_runtime.sql`, and deployed Worker version
`259d3f54-9db9-4377-bf1d-5984c4f9ea7e`. Health, cookie/CSRF, governed media, all three
language cold/warm paths, the adversarial suite, and an in-app-browser surface check
passed against the public staging origin. The owner then explicitly requested technical
promotion: production Worker version `8c2a1d11-6710-4f40-8325-0d5cde414122` was deployed
at `https://ogram-learning-canvas.ervaucher.workers.dev`, and health, cookie/CSRF,
governed media, all three language cold/warm paths, and the 13-check adversarial suite
passed there. The separate eligibility/rules attestation remains personal and unchecked.

Optional confidence checks, not Devpost requirements: replay the tool surface with a
second local inspector extension and preserve one production-origin trace. Do not
use a hosted Workbench AI evaluation for this release.

## Deadline

- Submission: **September 3, 2026 at 1:00 p.m. PDT**.
- Zurich equivalent: **September 3, 2026 at 10:00 p.m. CEST**.
- Registration and submission close at the same time.

Sources: [Devpost challenge](https://webmcp.devpost.com/), [official rules](https://webmcp.devpost.com/rules).

## Required submission assets

- Working live URL accessible in ChatGPT’s built-in browser or a compatible Chrome build.
- Clear judge instructions and credentials if authentication is required; this project intentionally uses anonymous guest sessions.
- Project description explaining why WebMCP is essential and what the learner and agent do together.
- Public YouTube demo shorter than three minutes, with audio.
- Public source repository containing the necessary code and assets.
- An open-source license visibly detected in the repository.
- English materials or complete English translations.
- Authorized use of third-party code, data, media, and trademarks.
- Free judge access through the end of judging.

## Judging

The four equally weighted criteria are:

1. WebMCP Leverage
2. Execution
3. Potential Impact
4. Creativity & Ambition

WebMCP Leverage is the first tie-break. The demonstration should therefore show the full shared transaction: saved brief → capability discovery → reviewed context → progressive draft → exact revision approval → publication → adaptive evidence.

## Technical checks

- Use top-level imperative `document.modelContext.registerTool()` registrations.
- Keep generated iframes free of tool registration.
- Preserve a complete human interface and narrow validated tool schemas.
- Treat tool definitions, tool arguments, and results as untrusted data.
- Ensure the deployed URL needs no local setup, connector, or account.
- Verify the initial JavaScript budget and lazy renderer chunks against the production manifest.
- Verify Worker static assets and `/api/*` on one origin so cookie and CSRF controls hold.
- Test a fresh anonymous browser, expiry behavior, quotas, and cold/warm Sandbox paths.

Current platform references: [Codex app workflow](https://learn.chatgpt.com/docs/app), [OpenAI What’s New](https://learn.chatgpt.com/docs/whats-new), [Cloudflare Sandbox](https://developers.cloudflare.com/sandbox/), and [WebMCP explainer](https://github.com/webmachinelearning/webmcp).

## Project-specific compliance

- Switzerland is listed as an OpenAI API-supported country, but the submitting representative must independently satisfy every official eligibility condition.
- Pre-existing code is allowed, but only challenge-period work is judged; preserve dated commits that demonstrate meaningful new WebMCP work during the eligible period.
- Use synthetic task signals and public, non-sensitive sources in the demo.
- Do not expose customer data, credentials, raw prompts, private code, or proprietary desktop internals.
- Keep the submitted repository/deployment stable after the deadline through judging; continue later development in a separate branch or fork.
