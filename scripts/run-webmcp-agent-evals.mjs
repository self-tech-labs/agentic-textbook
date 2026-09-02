import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvFile } from "node:process";

const envFile = resolve(".env");
if (existsSync(envFile)) loadEnvFile(envFile);

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
    ...process.argv.slice(2),
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
