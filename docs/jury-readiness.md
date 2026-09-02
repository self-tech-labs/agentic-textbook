# Jury-readiness verification record

Verified September 2, 2026 from baseline `cd7cf98421140afea5092c330ab5686444994402`.
This record is technical evidence, not an eligibility attestation or a Devpost submission.

## Result

The local product and WebMCP journey are release-candidate quality. Public deployment
is blocked by expired Cloudflare CLI authentication and an unavailable local Docker
daemon, so no production URL or real Cloudflare Sandbox result is claimed.

| Surface | Evidence | Status |
|---|---|---|
| Repository | Fresh `npm ci`; MIT license; public origin readable; `npm audit --omit=dev` reports zero vulnerabilities | Pass |
| App | TypeScript passes; 11 test files and 64 tests pass | Pass |
| Bundle | Production build passes; initial JavaScript is 109.31 KB gzip against the 145 KB budget | Pass |
| Worker packaging | Default production and explicit `staging` Wrangler dry runs expose Assets, D1, R2, Durable Object, Container, and non-secret log-level bindings | Pass |
| Deterministic WebMCP | GoogleChromeLabs `webmcp-evals@0.0.4` live-browser smoke passes 3/3 calls on fresh pages | Pass |
| Gemini WebMCP | Gemini 3.5 Flash passes 21/21 expected steps across nine fresh-page executions; the JSON report records `backend: vercel`, `model: gemini-3.5-flash`, 0 failures, and 0 errors | Pass |
| Full lifecycle | Clean origin: bootstrap → skipped/no-context review → progressive 5-region authoring → validation → human approval → exact-revision publication → adaptive evidence → completion | Pass |
| Responsive UX | 362×783 browser run has no horizontal spill, full compact-nav accessible names, one-click section 01 → 03 navigation, and one-click scene 01 → 02 navigation | Pass |
| Browser runtime | Fixed local journey records only Vite debug and React development-info messages; no warning or error | Pass |
| Cloudflare account | `wrangler whoami` reports expired, non-refreshable OAuth in the non-interactive host | Blocked |
| Container runtime | Docker server did not answer; staging JS/TS/Python and adversarial Sandbox smoke cannot be rerun | Blocked |
| Public URL | Requires Cloudflare reauthentication, entitlement confirmation, staging bootstrap, migrations, secrets, and smoke tests | Blocked |

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

1. The owner reauthenticates Wrangler and confirms Workers Paid/Containers access.
2. Create the staging secret, run `npm run deploy:staging:bootstrap`, and record the URL.
3. Run health, session/CSRF, asset, three-language cold/warm, and adversarial smoke tests.
4. Repeat clean-host browser/WebMCP acceptance against staging, then promote explicitly.
5. Push this candidate commit to the public repository and record its SHA.
6. The owner attests eligibility and rules acceptance; record a public, narrated demo under three minutes.

Intentionally not performed: `$start-hackathon`, hosted Nekuda Workbench AI evaluation,
Devpost form mutation, final submission, or remote Git push.
