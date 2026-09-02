# WebMCP Challenge preflight

Implementation status updated: September 2, 2026. Rules last checked against Devpost on September 1, 2026. The [official Devpost rules](https://webmcp.devpost.com/rules) prevail over this checklist.

## Gate 0 status

- [x] Rules, deadline, judging criteria, and submission requirements rechecked against Devpost.
- [x] Local Worker package, pinned custom container, D1 migration, and cold/warm Sandbox path verified.
- [x] JavaScript, TypeScript, and Python pass their server-side fixture tests in fresh local containers.
- [x] Governed HTTPS media passes MIME/magic-byte validation, immutable R2 storage, authenticated readback, and publish-reference validation locally.
- [x] Local adversarial smoke passes for CSRF/origin, network and secret isolation, package installation, filesystem escape, reset, shell metacharacters, source/output/time limits, concurrency, and rolling quota.
- [x] TypeScript, 59 automated tests, production build, 106.54 KB initial-JavaScript budget, and Cloudflare dry run pass.
- [ ] Submitting owner confirms personal/entity eligibility and acknowledges the official rules.
- [ ] Cloudflare account is authenticated and Workers Paid/Containers access is confirmed.
- [ ] Staging Worker, D1 database, R2 bucket, custom container, and signing secret are provisioned.
- [ ] The same three-language Sandbox smoke test passes against staging.
- [ ] Production/incognito run passes in ChatGPT’s in-app browser and a WebMCP-capable Chrome build.

The owner eligibility item is a legal/personal attestation and must not be checked by an agent. The current local Cloudflare OAuth token is expired, and Workers Paid/Containers entitlement has not been confirmed. Production deployment remains blocked until every Gate 0 item is checked.

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
