const baseUrl = (process.env.LEARNING_WORKER_URL || "http://localhost:8787").replace(
  /\/$/,
  "",
);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function jsonBody(response) {
  return response.json().catch(() => null);
}

async function newSession() {
  const response = await fetch(baseUrl + "/api/session");
  const body = await jsonBody(response);
  assert(response.ok, "Guest session could not be created.");
  const setCookie = response.headers.get("set-cookie") || "";
  assert(/HttpOnly/i.test(setCookie), "Guest cookie is not HttpOnly.");
  assert(/SameSite=Strict/i.test(setCookie), "Guest cookie is not SameSite=Strict.");
  if (baseUrl.startsWith("https://")) {
    assert(/Secure/i.test(setCookie), "HTTPS guest cookie is not Secure.");
  }
  return {
    cookie: setCookie.split(";")[0],
    csrfToken: body?.csrfToken,
  };
}

async function runCode(session, source, options = {}) {
  const response = await fetch(baseUrl + "/api/code/run", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: options.origin || baseUrl,
      Cookie: session.cookie,
      "X-Learning-CSRF": options.csrfToken || session.csrfToken,
    },
    body: JSON.stringify({
      exerciseId: "fixture-js-sum-v1",
      language: "javascript",
      source,
    }),
  });
  return { response, body: await jsonBody(response) };
}

function expectPassed(result, label) {
  assert(result.response.ok, label + " returned HTTP " + result.response.status + ".");
  assert(
    result.body?.evidence?.status === "passed",
    label + " did not pass: " + JSON.stringify(result.body),
  );
}

const primary = await newSession();
const noCsrf = await fetch(baseUrl + "/api/code/run", {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: baseUrl },
  body: JSON.stringify({
    exerciseId: "fixture-js-sum-v1",
    language: "javascript",
    source: "export function sum(values) { return values.length; }",
  }),
});
assert(noCsrf.status === 401, "Mutation without a guest cookie was not rejected.");

const wrongOrigin = await runCode(
  primary,
  "export function sum(values) { return values.length; }",
  { origin: "https://attacker.example" },
);
assert(wrongOrigin.response.status === 403, "Cross-origin mutation was not rejected.");

const network = await runCode(
  primary,
  [
    "export async function sum(values) {",
    "  let connected = false;",
    "  try {",
    "    await fetch('https://example.com', { signal: AbortSignal.timeout(800) });",
    "    connected = true;",
    "  } catch {}",
    "  return connected ? -999999 : values.reduce((total, value) => total + value, 0);",
    "}",
  ].join("\n"),
);
expectPassed(network, "Network isolation probe");

const environment = await runCode(
  primary,
  [
    "export function sum(values) {",
    "  const forbidden = Object.keys(process.env).some((name) =>",
    "    /(GUEST|SIGN|SECRET|TOKEN|COOKIE|API_KEY|CLOUDFLARE)/i.test(name)",
    "  );",
    "  return forbidden ? -999999 : values.reduce((total, value) => total + value, 0);",
    "}",
  ].join("\n"),
);
expectPassed(environment, "Environment secret probe");

const packageInstall = await runCode(
  primary,
  [
    "import { execFileSync } from 'node:child_process';",
    "export function sum(values) {",
    "  let installed = false;",
    "  try {",
    "    execFileSync('npm', ['install', 'left-pad@1.3.0', '--ignore-scripts'], { stdio: 'ignore', timeout: 1200 });",
    "    installed = true;",
    "  } catch {}",
    "  return installed ? -999999 : values.reduce((total, value) => total + value, 0);",
    "}",
  ].join("\n"),
);
expectPassed(packageInstall, "Package installation probe");

const filesystem = await runCode(
  primary,
  [
    "import { writeFileSync } from 'node:fs';",
    "export function sum(values) {",
    "  let escaped = false;",
    "  try { writeFileSync('/workspace/escape-marker', 'blocked'); escaped = true; } catch {}",
    "  return escaped ? -999999 : values.reduce((total, value) => total + value, 0);",
    "}",
  ].join("\n"),
);
expectPassed(filesystem, "Workspace escape probe");

const writesLocalState = await runCode(
  primary,
  [
    "import { writeFileSync } from 'node:fs';",
    "writeFileSync('./leftover.txt', 'remove me');",
    "export function sum(values) { return values.reduce((total, value) => total + value, 0); }",
  ].join("\n"),
);
expectPassed(writesLocalState, "Working-directory write probe");
const resetLocalState = await runCode(
  primary,
  [
    "import { existsSync } from 'node:fs';",
    "const stale = existsSync('./leftover.txt');",
    "export function sum(values) {",
    "  return stale ? -999999 : values.reduce((total, value) => total + value, 0);",
    "}",
  ].join("\n"),
);
expectPassed(resetLocalState, "Working-directory reset probe");

const shellText = await runCode(
  primary,
  [
    "export function sum(values) { return values.reduce((total, value) => total + value, 0); }",
    "// '; touch /workspace/lesson-shell-injected; #",
  ].join("\n"),
);
expectPassed(shellText, "Shell metacharacter probe");
const shellMarker = await runCode(
  primary,
  [
    "import { existsSync } from 'node:fs';",
    "export function sum(values) {",
    "  return existsSync('/workspace/lesson-shell-injected')",
    "    ? -999999",
    "    : values.reduce((total, value) => total + value, 0);",
    "}",
  ].join("\n"),
);
expectPassed(shellMarker, "Shell injection marker probe");

const outputFlood = await runCode(
  primary,
  [
    "console.log('x'.repeat(70000));",
    "export function sum(values) { return values.reduce((total, value) => total + value, 0); }",
  ].join("\n"),
);
assert(outputFlood.response.ok, "Output flood returned an unexpected HTTP error.");
assert(
  outputFlood.body?.evidence?.status === "error" &&
    /Output stopped at the 64 KB limit/.test(outputFlood.body?.stdout || ""),
  "Output flooding was not stopped at 64 KB.",
);

const oversized = await runCode(primary, "é".repeat(20_000));
assert(oversized.response.status === 413, "A source larger than 32 KB was not rejected.");

const timeoutSession = await newSession();
const loopingPromise = runCode(
  timeoutSession,
  "export function sum() { while (true) {} }",
);
await new Promise((resolve) => setTimeout(resolve, 200));
const concurrent = await runCode(
  timeoutSession,
  "export function sum(values) { return values.reduce((total, value) => total + value, 0); }",
);
assert(concurrent.response.status === 429, "A concurrent guest run was not rejected.");
assert(
  concurrent.response.headers.get("x-quota-outcome") === "concurrent_rejected",
  "Concurrent rejection did not report its quota outcome.",
);
const looping = await loopingPromise;
assert(looping.response.ok, "Infinite-loop probe returned an HTTP transport error.");
assert(looping.body?.evidence?.status === "error", "Infinite loop was not terminated.");
assert(looping.body?.durationMs <= 7_000, "Infinite-loop timeout exceeded seven seconds.");

const quotaSession = await newSession();
const passingSource =
  "export function sum(values) { return values.reduce((total, value) => total + value, 0); }";
for (let index = 0; index < 20; index += 1) {
  const run = await runCode(quotaSession, passingSource);
  expectPassed(run, `Quota run ${index + 1}`);
}
const overQuota = await runCode(quotaSession, passingSource);
assert(overQuota.response.status === 429, "The twenty-first rolling-window run was accepted.");
assert(
  overQuota.response.headers.get("x-quota-outcome") === "rate_rejected",
  "Rate rejection did not report its quota outcome.",
);

console.log(
  JSON.stringify(
    {
      endpoint: baseUrl,
      checks: [
        "signed-cookie-and-csrf",
        "same-origin",
        "network-disabled",
        "environment-allowlist",
        "package-install-blocked",
        "unprivileged-filesystem",
        "working-directory-reset",
        "shell-metacharacters-inert",
        "output-limit",
        "source-limit",
        "execution-timeout",
        "single-concurrent-run",
        "rolling-run-quota",
      ],
      status: "passed",
    },
    null,
    2,
  ),
);
