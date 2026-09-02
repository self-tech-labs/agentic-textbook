# Cloudflare deployment and Sandbox smoke test

V4 deploys the Vite SPA and Worker routes as one Cloudflare Workers Static Assets application. The Wrangler configuration uses draft bindings so Cloudflare can provision D1 and R2 resources on first deployment; the custom Sandbox container still requires Workers Paid/Containers access.

## 1. Local verification

```bash
npm ci
npm run typecheck
npm run test:run
npm run build
npm run cf:dry-run
```

Create a local secret without committing it:

```bash
cp .dev.vars.example .dev.vars
openssl rand -hex 32
```

Paste that output as `GUEST_SIGNING_KEY` in `.dev.vars`, then initialize local D1 and start the full stack:

```bash
npm run db:migrate:local
npm run dev:worker
```

The frontend-only `npm run dev` intentionally cannot execute code or import media.

## 2. Account and production secret

Confirm the intended Cloudflare account and Containers entitlement:

```bash
npx wrangler whoami
docker info
```

For an existing staging Worker, create the signing secret through Wrangler's
encrypted secret prompt:

```bash
npx wrangler secret put GUEST_SIGNING_KEY --env staging
```

Never place the production value in `wrangler.jsonc`, `.dev.vars.example`, logs, or screenshots.

Wrangler cannot attach a secret to a Worker that has never been deployed. For a
brand-new `ogram-learning-canvas-staging` service, first run the one-time creation
deploy in the next section, then create the secret, then run the bootstrap script.

`SANDBOX_LOG_LEVEL` is pinned to `error` in `wrangler.jsonc`. Application request logs contain only endpoint label, status, latency, quota outcome, and cold/warm sandbox state; do not add request bodies, learner context, answers, or source code to logs.

## 3. First staging deployment

Only continue after Cloudflare authentication, Workers Paid/Containers access,
and the intended account are confirmed. The owner eligibility attestation remains
required before production promotion or submission, but it does not block an
isolated technical staging test.

```bash
npm run build
npx wrangler deploy --env staging
npx wrangler secret put GUEST_SIGNING_KEY --env staging
npm run deploy:staging:bootstrap
```

The first two commands create the named Worker and its draft resources so the secret
has a target. The bootstrap script then rebuilds, deploys, migrates D1, and deploys the
same candidate again. This extra first deployment is intentional for a previously
nonexistent Worker; subsequent environments that already exist start with
`wrangler secret put` and the bootstrap script.

The staging environment has the explicit Worker name `ogram-learning-canvas-staging`
and its own draft D1, R2, Durable Object, and Container bindings. The bootstrap
sequence builds, deploys once so those resources exist, applies the D1 migration
remotely, and deploys the same build again. Subsequent staging releases use:

```bash
npm run deploy:staging
```

Record the resulting public Worker URL. Only after the full smoke matrix passes,
create the production secret and bootstrap or update the default production
Worker explicitly:

```bash
npx wrangler secret put GUEST_SIGNING_KEY --env=""
npm run deploy:production:bootstrap
# Later releases: npm run deploy:production
```

## 4. HTTP checks

From a clean cookie jar:

1. `GET /api/health` returns `status: ok`, `schemaVersion: 4`, and `static-assets`, `d1`, `r2`, `sandbox`.
2. `GET /api/session` sets an HTTP-only, secure, same-site cookie and returns a CSRF token.
3. A mutation without `Origin`, cookie, or `X-Learning-CSRF` fails.
4. A same-origin mutation with all three succeeds.
5. A non-API route falls back to the SPA, while an unknown `/api/*` route remains a JSON 404.

## 5. Three-language Sandbox smoke test

Use the registered fixture exercise IDs from a fresh anonymous session:

| Language | Exercise ID | Passing export |
|---|---|---|
| JavaScript | `fixture-js-sum-v1` | `export function sum(values) { return values.reduce((a, b) => a + b, 0); }` |
| TypeScript | `fixture-ts-display-name-v1` | `export function displayName(value: string | null): string { return value ?? "Anonymous"; }` |
| Python | `fixture-python-positives-v1` | `def positives(values): return [value for value in values if value > 0]` |

With the Worker running, the reusable happy-path check performs all three submissions through the real guest-cookie and CSRF boundary:

```bash
npm run smoke:worker
```

Set `LEARNING_WORKER_URL` to run the same smoke check against staging. The check also imports and reads back a small PNG through R2; override its public HTTPS fixture with `LEARNING_MEDIA_URL` when required.

For each language verify a cold and warm response, exact test count, SHA-256 source hash, no persisted source in D1, and a reset working directory. Then separately verify:

- an infinite loop is stopped;
- network access fails;
- environment secrets are absent;
- package installation and host filesystem access fail;
- output is stopped at 64 KB;
- a second concurrent run and the 21st rolling-window run are rejected.

The reusable adversarial check covers those boundaries through the same HTTP API:

```bash
npm run smoke:security
```

Do not mark the smoke-test gate complete from unit tests or a Wrangler dry run; it requires the deployed custom container.

The happy-path and adversarial scripts intentionally use five isolated
guest/exercise sandboxes in total. With `max_instances: 10` and `sleepAfter: 10m`, run
at most two full matrices back-to-back or wait for the ten-minute leases to expire
before repeating them; otherwise a third matrix can wait for container capacity.

## 6. Browser acceptance

Use a new profile in both supported hosts. Complete the personalized Codex path, algebra remediation path, one code lab per language, governed media, and migrated transformer session. Confirm keyboard navigation, MathML, diagram descriptions, transcripts/captions, failed-rich-content fallbacks, immutable evidence, and hidden unselected branches.

After acceptance, record the deployment URL, commit SHA, UTC verification time, browser versions, Sandbox cold/warm timings, and tester initials in the release notes or submission record.

## Verified staging release — September 2, 2026

- Origin: `https://ogram-learning-canvas-staging.ervaucher.workers.dev`
- Worker version: `259d3f54-9db9-4377-bf1d-5984c4f9ea7e`
- Verification completed: `2026-09-02T18:58:18Z`
- D1: `ogram-learning-canvas-staging-db`
- R2: `ogram-learning-canvas-staging-lesson-media`
- Container application: `ogram-learning-canvas-staging-learningsandbox-staging`
- Secret: `GUEST_SIGNING_KEY` confirmed by name only; its value was never printed or stored

`npm run deploy:staging:bootstrap` built and published the image, applied
`0001_v4_runtime.sql`, and completed the final deploy. The live smoke evidence was:

| Check | Result |
|---|---|
| Health | `status: ok`, schema v4, Assets/D1/R2/Sandbox present |
| Cookie + CSRF | `HttpOnly`, `Secure`, `SameSite=Strict`; missing-token mutation rejected with 403 |
| JavaScript | 3/3 tests; cold 2953 ms, warm 362 ms |
| TypeScript | 2/2 tests; cold 13630 ms, warm 1094 ms |
| Python | 2/2 tests; cold 3518 ms, warm 353 ms |
| Governed media | 8090-byte PNG verified, stored in R2, read back, and accepted as a lesson reference |
| Adversarial | All 13 checks passed, including isolation, reset, limits, concurrency, and rolling quota |
| In-app browser | Correct identity/tools/content, no error overlay or browser logs, and the quantitative starter updated the brief |

## Verified production release — September 2, 2026

- Origin: `https://ogram-learning-canvas.ervaucher.workers.dev`
- Worker version: `8c2a1d11-6710-4f40-8325-0d5cde414122`
- Verification completed: `2026-09-02T19:40:15Z`
- Source application commit: `8c7d1d08dba26a74f4b225df1f582a78e1f51fae`
- Promotion PR: `https://github.com/self-tech-labs/ogram-learning-webmcp/pull/7`
- D1: `ogram-learning-canvas-db`
- R2: `ogram-learning-canvas-lesson-media`
- Container application: `ogram-learning-canvas-learningsandbox`
- Secret: `GUEST_SIGNING_KEY` confirmed by name only; its value was never printed or stored

`npm run deploy:production:bootstrap` rebuilt the release candidate, deployed the
Worker and custom image, applied `0001_v4_runtime.sql`, and completed the final deploy.
The production smoke evidence was:

| Check | Result |
|---|---|
| Health | `status: ok`; Assets, D1, R2, and Sandbox present |
| Cookie + CSRF | Signed-cookie and same-origin protections passed |
| JavaScript | 3/3 tests; cold 2468 ms, warm 281 ms |
| TypeScript | 2/2 tests; cold 3219 ms, warm 959 ms |
| Python | 2/2 tests; cold 3980 ms, warm 288 ms |
| Governed media | 8090-byte PNG verified, stored in R2, read back, and accepted as a lesson reference |
| Adversarial | All 13 checks passed, including isolation, reset, limits, concurrency, and rolling quota |

## Rollback

Cloudflare deployment rollback restores the application version. V4 local migration retains `learn-ogram-canvas:v3`, so the browser-side state can also fall back without deleting learner data. R2 objects are immutable and content-addressed; D1 records are operational metadata only. Do not delete production resources during a rollback unless their exact scope and retention impact have been reviewed.
