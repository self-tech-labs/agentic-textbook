# Hackathon share URLs

Verified September 2, 2026. These are the canonical links to use in the hackathon
packet once the access notes below are resolved.

## Primary links

- Live project: https://ogram-learning-canvas.ervaucher.workers.dev
- Source repository: https://github.com/self-tech-labs/agentic-textbook
- Release PR to `main`: https://github.com/self-tech-labs/agentic-textbook/pull/7

The live project and source repository are public and need no account or local setup.

## Release provenance

- Production Worker version: `8c2a1d11-6710-4f40-8325-0d5cde414122`
- Application commit deployed: `8c7d1d08dba26a74f4b225df1f582a78e1f51fae`
- Production verification: `2026-09-02T19:40:15Z`
- Staging fallback: https://ogram-learning-canvas-staging.ervaucher.workers.dev

Production passed schema-v4 health, signed-cookie and CSRF enforcement, governed R2
media import/readback, JavaScript/TypeScript/Python cold-and-warm Sandbox runs, and all
13 adversarial isolation, reset, injection, limit, concurrency, and quota checks.

## Before sharing

- Merge PR #7 so the default `main` branch matches the deployed application.
- Make the repository public or arrange judge access.
- Replace any staging links in draft copy with the production URL above.
- Add the final public demo-video URL when rendering and privacy review are complete.
