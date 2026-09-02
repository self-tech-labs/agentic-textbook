import { LESSON_LIMITS } from "../src/domain/lessonRegistry";
import {
  HttpError,
  enumString,
  json,
  optionalString,
  readJsonObject,
  requiredString,
  sha256Hex,
} from "./http";
import type { Env, GuestContext } from "./types";

const INACTIVITY_MS = 90 * 24 * 60 * 60 * 1000;

interface AssetRow {
  asset_id: string;
  guest_id: string;
  object_key: string;
  kind: "image" | "audio" | "video";
  mime_type: string;
  byte_length: number;
  status: "pending" | "ready" | "failed" | "expired";
  caption: string;
  attribution: string;
  alt: string | null;
  transcript: string | null;
  captions_vtt: string | null;
  expires_at: number;
  content_hash: string;
}

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) {
    return false;
  }
  const values = parts.map(Number);
  if (values.some((value) => value < 0 || value > 255)) return true;
  const [first, second] = values as [number, number, number, number];
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 0) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    first >= 224
  );
}

export function validateRemoteUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new HttpError(400, "Asset URL is invalid.", "invalid_asset_url");
  }
  if (url.protocol !== "https:") {
    throw new HttpError(400, "Asset imports require HTTPS.", "https_required");
  }
  if (url.username || url.password) {
    throw new HttpError(400, "Asset URLs cannot contain credentials.", "credentials_rejected");
  }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (
    !hostname ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".lan") ||
    hostname.endsWith(".home") ||
    hostname.endsWith(".test") ||
    hostname.includes(":") ||
    isPrivateIpv4(hostname)
  ) {
    throw new HttpError(
      400,
      "Private, local, and literal IPv6 destinations are not allowed.",
      "private_destination",
    );
  }
  url.hash = "";
  return url;
}

async function fetchWithGovernedRedirects(initial: URL): Promise<Response> {
  let current = initial;
  let redirects = 0;
  while (true) {
    const response = await fetch(current.toString(), {
      method: "GET",
      redirect: "manual",
      headers: {
        Accept: "image/*,audio/*,video/*;q=0.9",
        "User-Agent": "ogram-learning-media-import/4",
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status >= 300 && response.status < 400) {
      if (redirects >= 3) {
        response.body?.cancel();
        throw new HttpError(400, "Asset import exceeded three redirects.", "redirect_limit");
      }
      const location = response.headers.get("location");
      response.body?.cancel();
      if (!location) {
        throw new HttpError(400, "Asset redirect omitted its destination.", "invalid_redirect");
      }
      current = validateRemoteUrl(new URL(location, current).toString());
      redirects += 1;
      continue;
    }
    if (!response.ok) {
      response.body?.cancel();
      throw new HttpError(
        422,
        "Asset origin returned HTTP " + response.status + ".",
        "asset_fetch_failed",
      );
    }
    return response;
  }
}

async function readBoundedBody(
  response: Response,
  maximumBytes: number,
): Promise<ArrayBuffer> {
  const declared = Number(response.headers.get("content-length") || "0");
  if (Number.isFinite(declared) && declared > maximumBytes) {
    response.body?.cancel();
    throw new HttpError(413, "Asset exceeds its size limit.", "asset_too_large");
  }
  if (!response.body) {
    throw new HttpError(422, "Asset response had no body.", "asset_empty");
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximumBytes) {
      await reader.cancel();
      throw new HttpError(413, "Asset exceeds its size limit.", "asset_too_large");
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body.buffer;
}

function startsWith(bytes: Uint8Array, signature: number[]) {
  return signature.every((value, index) => bytes[index] === value);
}

function ascii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

export function detectedMime(
  buffer: ArrayBuffer,
  requestedKind: "image" | "audio" | "video",
): string | null {
  const bytes = new Uint8Array(buffer);
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return requestedKind === "image" ? "image/png" : null;
  }
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return requestedKind === "image" ? "image/jpeg" : null;
  }
  if (ascii(bytes, 0, 6) === "GIF87a" || ascii(bytes, 0, 6) === "GIF89a") {
    return requestedKind === "image" ? "image/gif" : null;
  }
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    return requestedKind === "image" ? "image/webp" : null;
  }
  if (
    ascii(bytes, 0, 3) === "ID3" ||
    (bytes[0] === 0xff && ((bytes[1] || 0) & 0xe0) === 0xe0)
  ) {
    return requestedKind === "audio" ? "audio/mpeg" : null;
  }
  if (ascii(bytes, 0, 4) === "OggS") {
    return requestedKind === "audio" ? "audio/ogg" : null;
  }
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WAVE") {
    return requestedKind === "audio" ? "audio/wav" : null;
  }
  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) {
    return requestedKind === "video" ? "video/webm" : null;
  }
  if (ascii(bytes, 4, 4) === "ftyp") {
    return requestedKind === "audio"
      ? "audio/mp4"
      : requestedKind === "video"
        ? "video/mp4"
        : null;
  }
  return null;
}

function maximumForKind(kind: "image" | "audio" | "video") {
  if (kind === "image") return LESSON_LIMITS.imageBytes;
  if (kind === "audio") return LESSON_LIMITS.audioBytes;
  return LESSON_LIMITS.videoBytes;
}

export function validateDeclaredMime(response: Response, kind: string) {
  const mime = (response.headers.get("content-type") || "")
    .split(";")[0]!
    .trim()
    .toLowerCase();
  if (
    !mime.startsWith(kind + "/") ||
    mime === "text/html" ||
    mime === "image/svg+xml"
  ) {
    response.body?.cancel();
    throw new HttpError(415, "Asset MIME type is not allowed.", "mime_rejected");
  }
}

export function requireRightsAttestation(body: Record<string, unknown>): string {
  if (body.rightsConfirmed !== true) {
    throw new HttpError(
      400,
      "Asset import requires confirmation that copying and display are authorized.",
      "asset_rights_required",
    );
  }
  return requiredString(body, "rightsBasis", 3, 800);
}

export async function importAsset(
  request: Request,
  env: Env,
  guest: GuestContext,
): Promise<Response> {
  const body = await readJsonObject(request, 30 * 1024);
  const kind = enumString(body, "kind", ["image", "audio", "video"] as const);
  const lessonId = requiredString(body, "lessonId", 3, 200);
  const caption = requiredString(body, "caption", 3, 800);
  const attribution = requiredString(body, "attribution", 2, 800);
  const rightsBasis = requireRightsAttestation(body);
  const alt = optionalString(body, "alt", 1200);
  const transcript = optionalString(body, "transcript", 20_000);
  const captionsSource = optionalString(body, "captionsVtt", 4_000);
  if (kind === "image" && !alt) {
    throw new HttpError(400, "Images require alt text.", "alt_required");
  }
  if ((kind === "audio" || kind === "video") && !transcript) {
    throw new HttpError(400, "Audio and video require a transcript.", "transcript_required");
  }
  if (
    kind === "video" &&
    (!captionsSource || !captionsSource.trimStart().startsWith("WEBVTT"))
  ) {
    throw new HttpError(400, "Video requires inline WEBVTT captions.", "captions_required");
  }

  const quota = await env.DB.prepare(
    [
      "SELECT COUNT(*) AS asset_count,",
      " COALESCE(SUM(byte_length), 0) AS total_bytes",
      " FROM assets",
      " WHERE guest_id = ? AND lesson_id = ? AND status IN ('pending', 'ready')",
    ].join(""),
  )
    .bind(guest.guestId, lessonId)
    .first<{ asset_count: number; total_bytes: number }>();
  if ((quota?.asset_count ?? 0) >= LESSON_LIMITS.maximumAssets) {
    throw new HttpError(429, "This lesson already has eight assets.", "asset_quota");
  }

  const sourceUrl = validateRemoteUrl(requiredString(body, "url", 10, 2_000));
  const response = await fetchWithGovernedRedirects(sourceUrl);
  validateDeclaredMime(response, kind);
  const content = await readBoundedBody(response, maximumForKind(kind));
  if (
    (quota?.total_bytes ?? 0) + content.byteLength >
    LESSON_LIMITS.maximumAssetBytes
  ) {
    throw new HttpError(429, "This lesson exceeds its 80 MB asset budget.", "asset_quota");
  }
  const mimeType = detectedMime(content, kind);
  if (!mimeType) {
    throw new HttpError(
      415,
      "Asset bytes do not match a supported media format.",
      "magic_bytes_rejected",
    );
  }

  const contentHash = await sha256Hex(content);
  const objectKey = "sha256/" + contentHash;
  await env.LESSON_MEDIA.put(objectKey, content, {
    httpMetadata: { contentType: mimeType },
    customMetadata: { sha256: contentHash, kind },
  });

  const assetId = "asset-" + crypto.randomUUID();
  const now = Date.now();
  const expiresAt = now + INACTIVITY_MS;
  await env.DB.prepare(
    [
      "INSERT INTO assets",
      " (asset_id, guest_id, lesson_id, content_hash, object_key, kind,",
      " mime_type, byte_length, status, caption, attribution, alt, transcript,",
      " captions_vtt, created_at, last_active_at, expires_at)",
      " VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ready', ?, ?, ?, ?, ?, ?, ?, ?)",
    ].join(""),
  )
    .bind(
      assetId,
      guest.guestId,
      lessonId,
      contentHash,
      objectKey,
      kind,
      mimeType,
      content.byteLength,
      caption,
      attribution,
      alt ?? null,
      transcript ?? null,
      captionsSource ?? null,
      now,
      now,
      expiresAt,
    )
    .run();

  return json(
    {
      asset: {
        id: assetId,
        kind,
        url: "/media/" + encodeURIComponent(assetId),
        mimeType,
        status: "ready",
        caption,
        attribution,
        rightsBasis,
        ...(alt ? { alt } : {}),
        ...(transcript ? { transcript } : {}),
        ...(captionsSource
          ? { captionsVtt: "/media/" + encodeURIComponent(assetId) + "/captions" }
          : {}),
        byteLength: content.byteLength,
        contentHash,
      },
      expiresAt: new Date(expiresAt).toISOString(),
    },
    { status: 201, headers: { "X-Quota-Outcome": "asset_accepted" } },
  );
}

export async function serveAsset(
  request: Request,
  env: Env,
  guest: GuestContext,
): Promise<Response> {
  const path = new URL(request.url).pathname.split("/").filter(Boolean);
  const assetId = decodeURIComponent(path[1] || "");
  const row = await env.DB.prepare(
    "SELECT * FROM assets WHERE asset_id = ? AND guest_id = ?",
  )
    .bind(assetId, guest.guestId)
    .first<AssetRow>();
  if (!row || row.status !== "ready" || row.expires_at <= Date.now()) {
    throw new HttpError(404, "Media asset was not found or has expired.", "asset_not_found");
  }
  const now = Date.now();
  await env.DB.prepare(
    "UPDATE assets SET last_active_at = ?, expires_at = ? WHERE asset_id = ?",
  )
    .bind(now, now + INACTIVITY_MS, assetId)
    .run();

  if (path[2] === "captions") {
    if (!row.captions_vtt) {
      throw new HttpError(404, "Captions were not found.", "captions_not_found");
    }
    return new Response(row.captions_vtt, {
      headers: {
        "Content-Type": "text/vtt; charset=utf-8",
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  const object = await env.LESSON_MEDIA.get(row.object_key);
  if (!object) {
    await env.DB.prepare("UPDATE assets SET status = 'failed' WHERE asset_id = ?")
      .bind(assetId)
      .run();
    throw new HttpError(404, "Media bytes are unavailable.", "asset_missing");
  }
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Content-Type", row.mime_type);
  headers.set("Content-Length", String(row.byte_length));
  headers.set("Cache-Control", "private, max-age=3600, immutable");
  headers.set("ETag", object.httpEtag);
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(object.body, { headers });
}

export async function expireInactiveAssets(env: Env): Promise<void> {
  const expired = await env.DB.prepare(
    "SELECT asset_id, object_key FROM assets WHERE status = 'ready' AND expires_at <= ? LIMIT 100",
  )
    .bind(Date.now())
    .all<{ asset_id: string; object_key: string }>();
  for (const row of expired.results) {
    await env.DB.prepare("UPDATE assets SET status = 'expired' WHERE asset_id = ?")
      .bind(row.asset_id)
      .run();
    const activeReference = await env.DB.prepare(
      "SELECT asset_id FROM assets WHERE object_key = ? AND status = 'ready' LIMIT 1",
    )
      .bind(row.object_key)
      .first();
    if (!activeReference) await env.LESSON_MEDIA.delete(row.object_key);
  }
}
