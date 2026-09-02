import type { Sandbox } from "@cloudflare/sandbox";

export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  LESSON_MEDIA: R2Bucket;
  Sandbox: DurableObjectNamespace<Sandbox>;
  GUEST_SIGNING_KEY?: string;
}

export interface GuestContext {
  guestId: string;
  expiresAt: number;
  csrfToken: string;
}

export interface RequestMetadata {
  endpoint: string;
  status: number;
  latencyMs: number;
  quotaOutcome: string;
  sandboxState: string;
}
