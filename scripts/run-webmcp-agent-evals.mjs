import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvFile } from "node:process";

const envFile = resolve(".env");
if (existsSync(envFile)) loadEnvFile(envFile);

if (!process.env.GOOGLE_AI && process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
  process.env.GOOGLE_AI = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
}

const userArguments = process.argv.slice(2);
const inlineBackend = userArguments.find((argument) =>
  argument.startsWith("--backend="),
);
const backendOptionIndex = userArguments.findIndex(
  (argument) => argument === "--backend" || argument === "-b",
);
const inlineModel = userArguments.find((argument) =>
  argument.startsWith("--model="),
);
const modelOptionIndex = userArguments.findIndex(
  (argument) => argument === "--model" || argument === "-m",
);
const selectedBackend =
  inlineBackend?.slice("--backend=".length) ??
  (backendOptionIndex >= 0 ? userArguments[backendOptionIndex + 1] : undefined) ??
  "vercel";
const selectedModel =
  inlineModel?.slice("--model=".length) ??
  (modelOptionIndex >= 0 ? userArguments[modelOptionIndex + 1] : undefined) ??
  "gemini-3.5-flash";
const usesGoogleModel =
  selectedBackend === "gemini" ||
  (selectedBackend === "vercel" &&
    !/^(?:openai|anthropic|ollama):/u.test(selectedModel));

if (selectedBackend === "gemini") {
  console.error(
    "webmcp-evals@0.0.4 does not implement live browser execution for its native gemini backend. Omit --backend to run the Gemini model through its supported Vercel-AI browser loop.",
  );
  process.exit(1);
}

if (
  usesGoogleModel &&
  !process.env.GOOGLE_AI &&
  !process.env.GEMINI_API_KEY &&
  !process.env.GOOGLE_GENERATIVE_AI_API_KEY
) {
  console.error(
    "Gemini WebMCP evals require GOOGLE_AI (or GEMINI_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY) in the environment or ignored .env file.",
  );
  process.exit(1);
}

const outputDirectory = resolve(".evals");
const reportsBefore = new Set(
  existsSync(outputDirectory)
    ? readdirSync(outputDirectory).filter((name) => name.endsWith(".json"))
    : [],
);

const executable = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(
  executable,
  [
    "--yes",
    "webmcp-evals@0.0.4",
    "--chrome-channel",
    "chrome",
    ...(backendOptionIndex >= 0 || inlineBackend
      ? []
      : ["--backend", "vercel"]),
    ...(modelOptionIndex >= 0 || inlineModel
      ? []
      : ["--model", "gemini-3.5-flash"]),
    ...userArguments,
    "browser",
    "-u",
    process.env.WEBMCP_EVAL_URL ?? "http://127.0.0.1:5173",
    "-e",
    process.env.WEBMCP_EVAL_FILE ?? "evals/webmcp-agent-journeys.json",
    "--reporter",
    "console",
    "json",
  ],
  { env: process.env, stdio: "inherit" },
);

if (result.error) {
  console.error(`Unable to start webmcp-evals: ${result.error.message}`);
  process.exit(1);
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

const newReports = existsSync(outputDirectory)
  ? readdirSync(outputDirectory)
      .filter((name) => name.endsWith(".json") && !reportsBefore.has(name))
      .sort()
  : [];
const reportName = newReports.at(-1);

if (!reportName) {
  console.error("webmcp-evals did not produce a new JSON report.");
  process.exit(1);
}

const report = JSON.parse(
  readFileSync(resolve(outputDirectory, reportName), "utf8"),
);
const summary = report?.results;

if (
  !summary ||
  summary.errorCount > 0 ||
  summary.failCount > 0 ||
  summary.passCount === 0
) {
  console.error(
    `Agent eval failed: ${summary?.passCount ?? 0} passed, ${summary?.failCount ?? 0} failed, ${summary?.errorCount ?? 0} errors.`,
  );
  process.exit(1);
}

console.log(
  `Agent eval passed: ${summary.passCount} expected steps across ${summary.testCount} test cases.`,
);
