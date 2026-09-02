import { describe, expect, it, vi } from "vitest";
import {
  detectedMime,
  validateDeclaredMime,
  validateRemoteUrl,
} from "./assets";
import { parseManifest } from "./codeManifest";
import {
  createOrResumeGuest,
  requireSameOriginMutation,
} from "./security";
import type { Env } from "./types";

function databaseStub() {
  const statement = {
    bind: vi.fn(() => statement),
    run: vi.fn(async () => ({ success: true })),
  };
  return {
    prepare: vi.fn(() => statement),
  } as unknown as D1Database;
}

function envStub(): Env {
  return {
    DB: databaseStub(),
    GUEST_SIGNING_KEY: "a-production-length-test-signing-key-123456789",
  } as Env;
}

describe("V4 Worker security boundaries", () => {
  it.each([
    "http://example.com/image.png",
    "https://user:secret@example.com/image.png",
    "https://localhost/image.png",
    "https://service.internal/image.png",
    "https://127.0.0.1/image.png",
    "https://10.1.2.3/image.png",
    "https://169.254.169.254/latest/meta-data",
    "https://[::1]/image.png",
  ])("rejects unsafe media destination %s", (url) => {
    expect(() => validateRemoteUrl(url)).toThrow();
  });

  it("accepts a public HTTPS URL while stripping its fragment", () => {
    expect(validateRemoteUrl("https://cdn.example.com/asset.png#fragment").toString()).toBe(
      "https://cdn.example.com/asset.png",
    );
  });

  it("requires declared media type and verified magic bytes", () => {
    const png = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]).buffer;
    expect(detectedMime(png, "image")).toBe("image/png");
    expect(detectedMime(png, "video")).toBeNull();
    expect(() =>
      validateDeclaredMime(
        new Response("<html>not media</html>", {
          headers: { "Content-Type": "text/html" },
        }),
        "image",
      ),
    ).toThrow(/mime type is not allowed/i);
    expect(() =>
      validateDeclaredMime(
        new Response("<svg/>", {
          headers: { "Content-Type": "image/svg+xml" },
        }),
        "image",
      ),
    ).toThrow(/mime type is not allowed/i);
  });

  it("accepts only bounded JSON test manifests with a simple entrypoint", () => {
    expect(
      parseManifest(
        JSON.stringify({
          entrypoint: "sum",
          tests: [{ name: "empty", args: [[]], expected: 0 }],
        }),
      ),
    ).toMatchObject({ entrypoint: "sum", tests: [{ expected: 0 }] });
    expect(() => parseManifest("export default () => true")).toThrow(/valid json/i);
    expect(() =>
      parseManifest(
        JSON.stringify({
          entrypoint: "sum(); process.exit()",
          tests: [{ name: "injection", args: [], expected: true }],
        }),
      ),
    ).toThrow(/simple exported function name/i);
    expect(() =>
      parseManifest(
        JSON.stringify({
          entrypoint: "sum",
          tests: Array.from({ length: 21 }, (_, index) => ({
            name: String(index),
            args: [],
            expected: 0,
          })),
        }),
      ),
    ).toThrow(/one to twenty tests/i);
  });

  it("issues a signed HttpOnly strict guest cookie and enforces origin plus CSRF", async () => {
    const env = envStub();
    const initial = new Request("https://lesson.example/api/session");
    const session = await createOrResumeGuest(initial, env);
    expect(session.cookie).toMatch(/HttpOnly; SameSite=Strict; Secure/);
    const cookie = session.cookie.split(";")[0]!;

    await expect(
      requireSameOriginMutation(
        new Request("https://lesson.example/api/code/run", {
          method: "POST",
          headers: {
            cookie,
            origin: "https://lesson.example",
            "x-learning-csrf": session.guest.csrfToken,
          },
        }),
        env,
      ),
    ).resolves.toMatchObject({ guestId: session.guest.guestId });

    await expect(
      requireSameOriginMutation(
        new Request("https://lesson.example/api/code/run", {
          method: "POST",
          headers: {
            cookie,
            origin: "https://attacker.example",
            "x-learning-csrf": session.guest.csrfToken,
          },
        }),
        env,
      ),
    ).rejects.toThrow(/same-origin/i);

    await expect(
      requireSameOriginMutation(
        new Request("https://lesson.example/api/code/run", {
          method: "POST",
          headers: {
            cookie,
            origin: "https://lesson.example",
            "x-learning-csrf": "wrong-token",
          },
        }),
        env,
      ),
    ).rejects.toThrow(/csrf/i);
  });
});
