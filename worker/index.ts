import {
  ContainerProxy,
  Sandbox,
  proxyToSandbox,
} from "@cloudflare/sandbox";
import { expireInactiveAssets, importAsset, serveAsset } from "./assets";
import {
  expireInactiveExercises,
  registerCodeExercise,
  runCode,
  validateReferences,
} from "./code";
import {
  HttpError,
  json,
  withStaticSecurityHeaders,
} from "./http";
import {
  createOrResumeGuest,
  requireGuest,
  requireSameOriginMutation,
} from "./security";
import type { Env, RequestMetadata } from "./types";

export { ContainerProxy };

export class LearningSandbox extends Sandbox {
  enableInternet = false;
}

function endpointLabel(pathname: string): string {
  if (pathname.startsWith("/media/")) return "/media/:asset";
  if (pathname === "/api/code/run") return pathname;
  if (pathname === "/api/code-exercises") return pathname;
  if (pathname === "/api/assets/import") return pathname;
  if (pathname === "/api/lesson-references/validate") return pathname;
  if (pathname === "/api/session") return pathname;
  if (pathname === "/api/health") return pathname;
  if (pathname.startsWith("/api/")) return "/api/not-found";
  return "static";
}

function logRequest(metadata: RequestMetadata) {
  console.log(
    JSON.stringify({
      endpoint: metadata.endpoint,
      status: metadata.status,
      latencyMs: metadata.latencyMs,
      quotaOutcome: metadata.quotaOutcome,
      sandboxState: metadata.sandboxState,
    }),
  );
}

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (pathname === "/api/health" && request.method === "GET") {
    await env.DB.prepare("SELECT 1 AS ok").first();
    return json({
      status: "ok",
      schemaVersion: 4,
      services: ["static-assets", "d1", "r2", "sandbox"],
    });
  }

  if (pathname === "/api/session" && request.method === "GET") {
    const { guest, cookie } = await createOrResumeGuest(request, env);
    return json(
      {
        guestId: guest.guestId,
        csrfToken: guest.csrfToken,
        expiresAt: new Date(guest.expiresAt * 1000).toISOString(),
      },
      { headers: { "Set-Cookie": cookie } },
    );
  }

  if (pathname.startsWith("/media/") && request.method === "GET") {
    const guest = await requireGuest(request, env);
    return serveAsset(request, env, guest);
  }

  if (request.method === "POST") {
    const guest = await requireSameOriginMutation(request, env);
    if (pathname === "/api/assets/import") {
      return importAsset(request, env, guest);
    }
    if (pathname === "/api/code-exercises") {
      return registerCodeExercise(request, env, guest);
    }
    if (pathname === "/api/code/run") {
      return runCode(request, env, guest);
    }
    if (pathname === "/api/lesson-references/validate") {
      return validateReferences(request, env, guest);
    }
  }

  if (pathname.startsWith("/api/") || pathname.startsWith("/media/")) {
    throw new HttpError(404, "Endpoint not found.", "not_found");
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    throw new HttpError(405, "Method not allowed.", "method_not_allowed");
  }
  return withStaticSecurityHeaders(await env.ASSETS.fetch(request));
}

async function handle(request: Request, env: Env): Promise<Response> {
  const startedAt = performance.now();
  const endpoint = endpointLabel(new URL(request.url).pathname);
  let response: Response;
  try {
    const proxyResponse = await proxyToSandbox(request, env);
    response = proxyResponse ?? (await route(request, env));
  } catch (error) {
    if (error instanceof HttpError) {
      response = json(
        { error: error.message, code: error.code },
        { status: error.status, headers: error.headers },
      );
    } else {
      response = json(
        { error: "The learning service could not complete the request.", code: "internal_error" },
        { status: 500 },
      );
    }
  }
  logRequest({
    endpoint,
    status: response.status,
    latencyMs: Math.round(performance.now() - startedAt),
    quotaOutcome: response.headers.get("x-quota-outcome") || "not_applicable",
    sandboxState: response.headers.get("x-sandbox-state") || "not_applicable",
  });
  return response;
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handle(request, env);
  },
  async scheduled(
    _controller: ScheduledController,
    env: Env,
    context: ExecutionContext,
  ): Promise<void> {
    context.waitUntil(
      Promise.all([
        expireInactiveAssets(env),
        expireInactiveExercises(env),
      ]).then(() => undefined),
    );
  },
};
