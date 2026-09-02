export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "request_failed",
    public headers: HeadersInit = {},
  ) {
    super(message);
  }
}

export function json(
  value: unknown,
  init: ResponseInit = {},
): Response {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  return new Response(JSON.stringify(value), { ...init, headers });
}

export async function readJsonObject(
  request: Request,
  maximumBytes = 40 * 1024,
): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type")?.split(";")[0]?.trim();
  if (contentType !== "application/json") {
    throw new HttpError(415, "Content-Type must be application/json.", "invalid_content_type");
  }
  const declared = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(declared) && declared > maximumBytes) {
    throw new HttpError(413, "Request body is too large.", "body_too_large");
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maximumBytes) {
    throw new HttpError(413, "Request body is too large.", "body_too_large");
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.", "invalid_json");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "Request body must be a JSON object.", "invalid_body");
  }
  return value as Record<string, unknown>;
}

export function requiredString(
  object: Record<string, unknown>,
  key: string,
  minimum: number,
  maximum: number,
  options: { trim?: boolean } = {},
): string {
  const value = object[key];
  if (typeof value !== "string") {
    throw new HttpError(400, key + " must be a string.", "invalid_" + key);
  }
  const normalized = options.trim === false ? value : value.trim();
  if (normalized.length < minimum || normalized.length > maximum) {
    throw new HttpError(
      400,
      key + " must contain " + minimum + "–" + maximum + " characters.",
      "invalid_" + key,
    );
  }
  return normalized;
}

export function optionalString(
  object: Record<string, unknown>,
  key: string,
  maximum: number,
): string | undefined {
  if (object[key] === undefined) return undefined;
  return requiredString(object, key, 1, maximum);
}

export function stringList(
  object: Record<string, unknown>,
  key: string,
  maximumItems: number,
  maximumLength: number,
): string[] {
  const value = object[key];
  if (!Array.isArray(value) || value.length > maximumItems) {
    throw new HttpError(
      400,
      key + " must be an array with at most " + maximumItems + " items.",
      "invalid_" + key,
    );
  }
  return value.map((item, index) => {
    if (typeof item !== "string" || !item.trim() || item.length > maximumLength) {
      throw new HttpError(
        400,
        key + "[" + index + "] is invalid.",
        "invalid_" + key,
      );
    }
    return item.trim();
  });
}

export function enumString<Value extends string>(
  object: Record<string, unknown>,
  key: string,
  allowed: readonly Value[],
): Value {
  const value = object[key];
  if (typeof value !== "string" || !allowed.includes(value as Value)) {
    throw new HttpError(
      400,
      key + " must be one of: " + allowed.join(", ") + ".",
      "invalid_" + key,
    );
  }
  return value as Value;
}

export async function sha256Hex(value: string | ArrayBuffer): Promise<string> {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function withStaticSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Frame-Options", "DENY");
  headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  );
  headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "base-uri 'none'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
      "img-src 'self' data:",
      "media-src 'self'",
      "connect-src 'self'",
      "frame-src 'self' blob:",
      "worker-src 'self' blob:",
    ].join("; "),
  );
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
