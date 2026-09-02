# Jury-readiness verification record

Verified September 2, 2026 through application commit `8c7d1d08dba26a74f4b225df1f582a78e1f51fae`.
This record is technical evidence, not an eligibility attestation or a Devpost submission.

## Result

The local product, WebMCP journey, deployed staging runtime, and public production
runtime are release-candidate quality. Cloudflare OAuth, Workers Paid/Containers,
Docker, isolated D1/R2 resources, custom Sandbox images, migrations, and signing-secret
attachments are verified. Production promotion is complete; no eligibility attestation
or Devpost submission is claimed.

| Surface | Evidence | Status |
|---|---|---|
| Repository | Fresh `npm ci`; MIT license; public origin readable; `npm audit --omit=dev` reports zero vulnerabilities | Pass |
| App | TypeScript passes; 11 test files and 66 tests pass | Pass |
| Bundle | Production build passes; initial JavaScript is 109.53 KB gzip against the 145 KB budget | Pass |
| Worker packaging | Default production and explicit `staging` Wrangler dry runs expose Assets, D1, R2, Durable Object, Container, and non-secret log-level bindings | Pass |
| Deterministic WebMCP | GoogleChromeLabs `webmcp-evals@0.0.4` live-browser smoke passes 3/3 calls on fresh pages | Pass |
| Gemini WebMCP | Gemini 3.5 Flash passes 21/21 expected steps across nine fresh-page executions; the JSON report records `backend: vercel`, `model: gemini-3.5-flash`, 0 failures, and 0 errors | Pass |
| Full lifecycle | Clean origin: bootstrap → skipped/no-context review → progressive 5-region authoring → validation → human approval → exact-revision publication → adaptive evidence → completion | Pass |
| Responsive UX | 362×783 browser run has no horizontal spill, full compact-nav accessible names, one-click section 01 → 03 navigation, and one-click scene 01 → 02 navigation | Pass |
| Browser runtime | Fixed local journey records only Vite debug and React development-info messages; no warning or error | Pass |
| Cloudflare authentication | `wrangler whoami` succeeds for the intended account; OAuth includes Workers, D1, Containers, and related write scopes | Pass |
| Workers Paid / Containers | `wrangler containers list` and image listing succeed; container application `ogram-learning-canvas-staging-learningsandbox-staging` is deployed | Pass |
| Container build runtime | Docker Server 28.3.3 responds; the pinned Sandbox image built, pushed, and rolled out | Pass |
| Staging Worker and secret | `ogram-learning-canvas-staging`, D1, R2, the custom container, and `GUEST_SIGNING_KEY` are provisioned; secret value was never printed or stored | Pass |
| Public staging URL | `https://ogram-learning-canvas-staging.ervaucher.workers.dev` serves Worker version `259d3f54-9db9-4377-bf1d-5984c4f9ea7e`; schema-v4 health and CSRF checks pass | Pass |
| Public production URL | `https://ogram-learning-canvas.ervaucher.workers.dev` serves Worker version `8c2a1d11-6710-4f40-8325-0d5cde414122`; production D1, R2, Container, secret, schema-v4 health, and CSRF checks pass | Pass |
| Deployed runtime and media | JavaScript, TypeScript, and Python each pass cold and warm fixture runs; verified PNG import, R2 readback, and lesson-reference validation pass | Pass |
| Deployed adversarial suite | All 13 origin/CSRF, isolation, filesystem, reset, injection, limit, concurrency, and quota checks pass | Pass |
| Staging browser runtime | Correct page identity and WebMCP tools, meaningful first screen, no overlay or browser log, and a successful quantitative-starter interaction | Pass |
| Remote branch | Application commit `8c7d1d08dba26a74f4b225df1f582a78e1f51fae` is pushed and merged into `staging`; PR #7 promotes `staging` to `main` | Pass |

## Material fixes in this candidate

- Removed the `scroll-snap-stop: always` trap that intercepted deliberate jumps at
  intermediate lesson pages, while retaining mandatory lesson-page snapping.
- Added stable accessible names to compact section and completion navigation.
- Added an explicit, isolated Cloudflare staging Worker and made every staging and
  production command select its target environment deliberately.
- Made the official WebMCP agent runner load the current `GOOGLE_AI` convention,
  default to Gemini 3.5 Flash through the package's implemented live-browser loop,
  and fail closed on provider/report errors.
- Documented reproducible Node, local Worker secret, staging, promotion, and eval setup.

## Upstream evaluation limitation

`webmcp-evals@0.0.4` exposes a native `gemini` backend, but its
`executeInBrowserEval()` currently throws `Method not implemented`. Live Gemini
browser evaluation therefore uses the same official package's Vercel-AI execution
loop with the Google provider and Gemini 3.5 Flash. The runner rejects the unsupported
native combination with an actionable message instead of producing nine false errors.

## Remaining release gates

1. The owner attests eligibility and rules acceptance.
2. Rehearse the sanitized full Codex + Ogram Learn production walkthrough, then record,
   caption, privacy-review, and publish the narrated demo under three minutes.
3. Repeat the in-app-browser, Workbench, and independent-inspector acceptance on the
   production origin and preserve the final evidence.

Intentionally not performed: `$start-hackathon`, hosted Nekuda Workbench AI evaluation,
Devpost form mutation, final submission, or repository visibility change.
