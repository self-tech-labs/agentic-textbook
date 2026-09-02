import { HttpError } from "./http";
import type { Env, GuestContext } from "./types";

const COOKIE_NAME = "ogram_guest_v1";
const SESSION_LIFETIME_SECONDS = 90 * 24 * 60 * 60;

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function parseCookies(request: Request): Map<string, string> {
  const result = new Map<string, string>();
  const header = request.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    result.set(
      part.slice(0, separator).trim(),
      decodeURIComponent(part.slice(separator + 1).trim()),
    );
  }
  return result;
}

function signingSecret(request: Request, env: Env): string {
  if (env.GUEST_SIGNING_KEY && env.GUEST_SIGNING_KEY.length >= 32) {
    return env.GUEST_SIGNING_KEY;
  }
  const hostname = new URL(request.url).hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "ogram-local-development-signing-key-not-for-production";
  }
  throw new HttpError(
    503,
    "Guest sessions are not configured.",
    "guest_session_unavailable",
  );
}

async function sign(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  );
  return base64Url(new Uint8Array(signature));
}

function constantTimeEqual(left: string, right: string): boolean {
  const maximum = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < maximum; index += 1) {
    difference |=
      (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

async function parseSignedCookie(
  request: Request,
  env: Env,
): Promise<{ guestId: string; expiresAt: number } | null> {
  const cookie = parseCookies(request).get(COOKIE_NAME);
  if (!cookie) return null;
  const [version, guestId, expiresRaw, signature] = cookie.split(".");
  const expiresAt = Number(expiresRaw);
  if (
    version !== "v1" ||
    !guestId ||
    !/^[a-f0-9-]{20,80}$/i.test(guestId) ||
    !Number.isInteger(expiresAt) ||
    expiresAt <= Math.floor(Date.now() / 1000) ||
    !signature
  ) {
    return null;
  }
  const expected = await sign(
    version + "." + guestId + "." + expiresAt,
    signingSecret(request, env),
  );
  return constantTimeEqual(signature, expected) ? { guestId, expiresAt } : null;
}

async function csrfToken(
  request: Request,
  env: Env,
  guestId: string,
  expiresAt: number,
) {
  return sign(
    "csrf." + guestId + "." + expiresAt,
    signingSecret(request, env),
  );
}

async function upsertGuest(
  env: Env,
  guestId: string,
  expiresAtSeconds: number,
) {
  const now = Date.now();
  const statement = [
    "INSERT INTO guest_sessions",
    " (guest_id, created_at, last_active_at, expires_at, active_runs)",
    " VALUES (?, ?, ?, ?, 0)",
    " ON CONFLICT(guest_id) DO UPDATE SET",
    " last_active_at = excluded.last_active_at,",
    " expires_at = excluded.expires_at",
  ].join("");
  await env.DB.prepare(statement)
    .bind(guestId, now, now, expiresAtSeconds * 1000)
    .run();
}

export async function createOrResumeGuest(
  request: Request,
  env: Env,
): Promise<{ guest: GuestContext; cookie: string }> {
  const existing = await parseSignedCookie(request, env);
  const guestId = existing?.guestId ?? crypto.randomUUID();
  const expiresAt =
    existing?.expiresAt ??
    Math.floor(Date.now() / 1000) + SESSION_LIFETIME_SECONDS;
  const payload = "v1." + guestId + "." + expiresAt;
  const signature = await sign(payload, signingSecret(request, env));
  const cookieValue = payload + "." + signature;
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  const cookie =
    COOKIE_NAME +
    "=" +
    encodeURIComponent(cookieValue) +
    "; Path=/; Max-Age=" +
    SESSION_LIFETIME_SECONDS +
    "; HttpOnly; SameSite=Strict" +
    secure;
  await upsertGuest(env, guestId, expiresAt);
  return {
    guest: {
      guestId,
      expiresAt,
      csrfToken: await csrfToken(request, env, guestId, expiresAt),
    },
    cookie,
  };
}

export async function requireGuest(
  request: Request,
  env: Env,
): Promise<GuestContext> {
  const parsed = await parseSignedCookie(request, env);
  if (!parsed) {
    throw new HttpError(401, "Guest session is missing or expired.", "guest_required");
  }
  await upsertGuest(env, parsed.guestId, parsed.expiresAt);
  return {
    guestId: parsed.guestId,
    expiresAt: parsed.expiresAt,
    csrfToken: await csrfToken(
      request,
      env,
      parsed.guestId,
      parsed.expiresAt,
    ),
  };
}

export async function requireSameOriginMutation(
  request: Request,
  env: Env,
): Promise<GuestContext> {
  const expectedOrigin = new URL(request.url).origin;
  const origin = request.headers.get("origin");
  if (origin !== expectedOrigin) {
    throw new HttpError(403, "Mutation requests must be same-origin.", "origin_rejected");
  }
  const guest = await requireGuest(request, env);
  const supplied = request.headers.get("x-learning-csrf") || "";
  if (!constantTimeEqual(supplied, guest.csrfToken)) {
    throw new HttpError(403, "CSRF token is missing or invalid.", "csrf_rejected");
  }
  return guest;
}
