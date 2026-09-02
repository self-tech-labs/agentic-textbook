import {
  ContainerUnavailableError,
  getSandbox,
  type ExecResult,
  type Sandbox,
} from "@cloudflare/sandbox";
import { LESSON_LIMITS } from "../src/domain/lessonRegistry";
import {
  HttpError,
  enumString,
  json,
  readJsonObject,
  requiredString,
  sha256Hex,
  stringList,
} from "./http";
import { parseManifest, type TestManifest } from "./codeManifest";
import type { Env, GuestContext } from "./types";

const INACTIVITY_MS = 90 * 24 * 60 * 60 * 1000;
const RUN_WINDOW_MS = LESSON_LIMITS.runWindowMinutes * 60 * 1000;
const OUTPUT_MARKER = "__OGRAM_OUTPUTS__";
const WORKING_DIRECTORY = "/workspace/lesson-run";
const LEARNER_UID = 65_534;
const LEARNER_GID = 65_534;
const LEARNER_ENV = [
  "PATH=/usr/local/bin:/usr/bin:/bin",
  "LANG=C.UTF-8",
  "NO_COLOR=1",
  "PYTHONNOUSERSITE=1",
  `TMPDIR=${WORKING_DIRECTORY}/tmp`,
  `XDG_CACHE_HOME=${WORKING_DIRECTORY}/.cache`,
].join(" ");
const DROP_PRIVILEGES = [
  `setpriv --reuid=${LEARNER_UID}`,
  `--regid=${LEARNER_GID}`,
  "--clear-groups",
  "--no-new-privs",
  "--inh-caps=-all",
  "--ambient-caps=-all",
  "--bounding-set=-all",
].join(" ");
const RESET_COMMAND = [
  `pkill -KILL -u ${LEARNER_UID} >/dev/null 2>&1 || true`,
  `find /tmp /var/tmp /run/lock /dev/shm -mindepth 1 -user ${LEARNER_UID} -delete 2>/dev/null || true`,
  `rm -rf ${WORKING_DIRECTORY}`,
  `mkdir -p ${WORKING_DIRECTORY}/tmp ${WORKING_DIRECTORY}/.cache`,
  `chown -R ${LEARNER_UID}:${LEARNER_GID} ${WORKING_DIRECTORY}`,
].join("; ");
const CLEANUP_COMMAND = [
  `pkill -KILL -u ${LEARNER_UID} >/dev/null 2>&1 || true`,
  `find /tmp /var/tmp /run/lock /dev/shm -mindepth 1 -user ${LEARNER_UID} -delete 2>/dev/null || true`,
  `rm -rf ${WORKING_DIRECTORY}`,
].join("; ");

type Language = "javascript" | "typescript" | "python";

interface Exercise {
  exerciseId: string;
  language: Language;
  manifest: TestManifest;
}

interface ExerciseRow {
  exercise_id: string;
  language: Language;
  test_manifest: string;
  status: "ready" | "failed" | "expired";
  expires_at: number;
}

function fixtureManifest(
  exerciseId: string,
): Exercise | null {
  if (exerciseId === "fixture-js-sum-v1") {
    return {
      exerciseId,
      language: "javascript",
      manifest: {
        entrypoint: "sum",
        tests: [
          { name: "empty", args: [[]], expected: 0 },
          { name: "single", args: [[4]], expected: 4 },
          { name: "many", args: [[2, 3, 5]], expected: 10 },
        ],
      },
    };
  }
  if (exerciseId === "fixture-ts-display-name-v1") {
    return {
      exerciseId,
      language: "typescript",
      manifest: {
        entrypoint: "displayName",
        tests: [
          { name: "name", args: ["Ada"], expected: "Ada" },
          { name: "fallback", args: [null], expected: "Anonymous" },
        ],
      },
    };
  }
  if (exerciseId === "fixture-python-positives-v1") {
    return {
      exerciseId,
      language: "python",
      manifest: {
        entrypoint: "positives",
        tests: [
          { name: "mixed", args: [[-2, 0, 3, 1]], expected: [3, 1] },
          { name: "empty", args: [[]], expected: [] },
        ],
      },
    };
  }
  return null;
}

export async function registerCodeExercise(
  request: Request,
  env: Env,
  guest: GuestContext,
): Promise<Response> {
  const body = await readJsonObject(request, 45 * 1024);
  const language = enumString(
    body,
    "language",
    ["javascript", "typescript", "python"] as const,
  );
  const lessonId = requiredString(body, "lessonId", 3, 200);
  const testManifestSource = requiredString(
    body,
    "testManifest",
    4,
    LESSON_LIMITS.codeBytes,
    { trim: false },
  );
  const manifest = parseManifest(testManifestSource);
  const canonicalManifest = JSON.stringify(manifest);
  const visibleTests = stringList(body, "visibleTests", 20, 500);
  if (!visibleTests.length) {
    throw new HttpError(
      400,
      "visibleTests needs at least one learner-visible test description.",
      "invalid_visibleTests",
    );
  }
  const contentHash = await sha256Hex(language + "\n" + canonicalManifest);
  const exerciseId = "exercise-" + crypto.randomUUID();
  const now = Date.now();
  const expiresAt = now + INACTIVITY_MS;
  await env.DB.prepare(
    [
      "INSERT INTO code_exercises",
      " (exercise_id, guest_id, lesson_id, language, test_manifest,",
      " visible_tests, content_hash, status, created_at, last_active_at, expires_at)",
      " VALUES (?, ?, ?, ?, ?, ?, ?, 'ready', ?, ?, ?)",
    ].join(""),
  )
    .bind(
      exerciseId,
      guest.guestId,
      lessonId,
      language,
      canonicalManifest,
      JSON.stringify(visibleTests),
      contentHash,
      now,
      now,
      expiresAt,
    )
    .run();
  return json(
    {
      exerciseId,
      expiresAt: new Date(expiresAt).toISOString(),
    },
    { status: 201 },
  );
}

async function getExercise(
  env: Env,
  guest: GuestContext,
  exerciseId: string,
): Promise<Exercise> {
  const fixture = fixtureManifest(exerciseId);
  if (fixture) return fixture;
  const row = await env.DB.prepare(
    "SELECT exercise_id, language, test_manifest, status, expires_at FROM code_exercises WHERE exercise_id = ? AND guest_id = ?",
  )
    .bind(exerciseId, guest.guestId)
    .first<ExerciseRow>();
  if (!row || row.status !== "ready" || row.expires_at <= Date.now()) {
    throw new HttpError(
      404,
      "Code exercise is unresolved, failed, or expired.",
      "exercise_not_found",
    );
  }
  const now = Date.now();
  await env.DB.prepare(
    "UPDATE code_exercises SET last_active_at = ?, expires_at = ? WHERE exercise_id = ?",
  )
    .bind(now, now + INACTIVITY_MS, exerciseId)
    .run();
  return {
    exerciseId,
    language: row.language,
    manifest: parseManifest(row.test_manifest),
  };
}

function javascriptRunner(moduleName: string): string {
  return [
    "import { readFile } from 'node:fs/promises';",
    "const safeWrite = process.stdout.write.bind(process.stdout);",
    "async function run() {",
    "const config = JSON.parse(await readFile('./inputs.json', 'utf8'));",
    "const submitted = await import('./" + moduleName + "');",
    "const candidate = submitted[config.entrypoint];",
    "const outputs = [];",
    "if (typeof candidate !== 'function') {",
    "  outputs.push({ ok: false, error: 'Missing exported function' });",
    "} else {",
    "  for (const args of config.inputs) {",
    "    try {",
    "      const value = await candidate(...args);",
    "      outputs.push({ ok: true, value });",
    "    } catch (error) {",
    "      outputs.push({ ok: false, error: error instanceof Error ? error.message : String(error) });",
    "    }",
    "  }",
    "}",
    "safeWrite('" + OUTPUT_MARKER + "' + JSON.stringify(outputs) + '\\n');",
    "}",
    "run().catch((error) => {",
    "  safeWrite((error instanceof Error ? error.stack || error.message : String(error)) + '\\n');",
    "  process.exitCode = 1;",
    "});",
  ].join("\n");
}

function pythonRunner(): string {
  return [
    "import importlib.util",
    "import json",
    "import sys",
    "safe_write = sys.__stdout__.write",
    "with open('inputs.json', 'r', encoding='utf-8') as handle:",
    "    config = json.load(handle)",
    "spec = importlib.util.spec_from_file_location('main', './main.py')",
    "if spec is None or spec.loader is None:",
    "    raise RuntimeError('Submitted module could not be loaded')",
    "submitted = importlib.util.module_from_spec(spec)",
    "spec.loader.exec_module(submitted)",
    "candidate = getattr(submitted, config['entrypoint'], None)",
    "outputs = []",
    "if not callable(candidate):",
    "    outputs.append({'ok': False, 'error': 'Missing exported function'})",
    "else:",
    "    for args in config['inputs']:",
    "        try:",
    "            outputs.append({'ok': True, 'value': candidate(*args)})",
    "        except Exception as error:",
    "            outputs.append({'ok': False, 'error': str(error)})",
    "safe_write('" + OUTPUT_MARKER + "' + json.dumps(outputs, separators=(',', ':')) + '\\n')",
  ].join("\n");
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalJson).join(",") + "]";
  }
  if (value && typeof value === "object") {
    return (
      "{" +
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => JSON.stringify(key) + ":" + canonicalJson(item))
        .join(",") +
      "}"
    );
  }
  return JSON.stringify(value);
}

function parseOutputs(output: string): Array<{ ok: boolean; value?: unknown }> | null {
  const markerIndex = output.lastIndexOf(OUTPUT_MARKER);
  if (markerIndex < 0) return null;
  const serialized = output.slice(markerIndex + OUTPUT_MARKER.length).split("\n")[0];
  try {
    const parsed = JSON.parse(serialized || "");
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function withContainerRetry<Result>(
  operation: () => Promise<Result>,
): Promise<Result> {
  try {
    return await operation();
  } catch (error) {
    if (!(error instanceof ContainerUnavailableError)) throw error;
    await new Promise((resolve) => setTimeout(resolve, error.retryAfterMs ?? 500));
    return operation();
  }
}

async function executeInSandbox(
  sandbox: Sandbox,
  language: Language,
  source: string,
  manifest: TestManifest,
): Promise<ExecResult> {
  await sandbox.exec(RESET_COMMAND, { timeout: 2_000 });
  const inputs = {
    entrypoint: manifest.entrypoint,
    inputs: manifest.tests.map((test) => test.args),
  };
  await sandbox.writeFile(
    WORKING_DIRECTORY + "/inputs.json",
    JSON.stringify(inputs),
  );

  let command: string;
  if (language === "javascript") {
    await sandbox.writeFile(WORKING_DIRECTORY + "/main.mjs", source);
    await sandbox.writeFile(
      WORKING_DIRECTORY + "/runner.mjs",
      javascriptRunner("main.mjs"),
    );
    command =
      `bash -lc 'set -o pipefail; timeout --signal=KILL 5s env -i ${LEARNER_ENV} ${DROP_PRIVILEGES} node runner.mjs 2>&1 | head -c 65537'`;
  } else if (language === "typescript") {
    await sandbox.writeFile(WORKING_DIRECTORY + "/main.ts", source);
    await sandbox.writeFile(
      WORKING_DIRECTORY + "/runner.ts",
      javascriptRunner("main.ts"),
    );
    command =
      `bash -lc 'set -o pipefail; timeout --signal=KILL 5s env -i ${LEARNER_ENV} ${DROP_PRIVILEGES} tsx runner.ts 2>&1 | head -c 65537'`;
  } else {
    await sandbox.writeFile(WORKING_DIRECTORY + "/main.py", source);
    await sandbox.writeFile(
      WORKING_DIRECTORY + "/runner.py",
      pythonRunner(),
    );
    command =
      `bash -lc 'set -o pipefail; timeout --signal=KILL 5s env -i ${LEARNER_ENV} ${DROP_PRIVILEGES} python3 -I -S -B runner.py 2>&1 | head -c 65537'`;
  }
  return sandbox.exec(command, {
    cwd: WORKING_DIRECTORY,
    timeout: 6_000,
  });
}

async function acquireRunSlot(
  env: Env,
  guestId: string,
): Promise<{ runId: string; recentRuns: number }> {
  const lock = await env.DB.prepare(
    "UPDATE guest_sessions SET active_runs = 1 WHERE guest_id = ? AND active_runs = 0",
  )
    .bind(guestId)
    .run();
  if ((lock.meta.changes ?? 0) !== 1) {
    throw new HttpError(
      429,
      "Only one code run may execute at a time.",
      "concurrent_run",
      { "Retry-After": "2", "X-Quota-Outcome": "concurrent_rejected" },
    );
  }
  const cutoff = Date.now() - RUN_WINDOW_MS;
  await env.DB.prepare("DELETE FROM code_run_events WHERE started_at < ?")
    .bind(cutoff - RUN_WINDOW_MS)
    .run();
  const row = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM code_run_events WHERE guest_id = ? AND started_at >= ?",
  )
    .bind(guestId, cutoff)
    .first<{ count: number }>();
  const recentRuns = row?.count ?? 0;
  if (recentRuns >= LESSON_LIMITS.runsPerWindow) {
    await releaseRunSlot(env, guestId);
    throw new HttpError(
      429,
      "Code-run quota reached. Try again after the rolling ten-minute window.",
      "run_quota",
      { "Retry-After": "30", "X-Quota-Outcome": "rate_rejected" },
    );
  }
  return { runId: "run-" + crypto.randomUUID(), recentRuns };
}

async function releaseRunSlot(env: Env, guestId: string) {
  await env.DB.prepare(
    "UPDATE guest_sessions SET active_runs = 0 WHERE guest_id = ?",
  )
    .bind(guestId)
    .run();
}

export async function runCode(
  request: Request,
  env: Env,
  guest: GuestContext,
): Promise<Response> {
  const body = await readJsonObject(request, LESSON_LIMITS.codeBytes + 8_192);
  const exerciseId = requiredString(body, "exerciseId", 3, 200);
  const language = enumString(
    body,
    "language",
    ["javascript", "typescript", "python"] as const,
  );
  const source = requiredString(
    body,
    "source",
    1,
    LESSON_LIMITS.codeBytes,
    { trim: false },
  );
  if (new TextEncoder().encode(source).byteLength > LESSON_LIMITS.codeBytes) {
    throw new HttpError(413, "Source cannot exceed 32 KB.", "source_too_large");
  }
  const exercise = await getExercise(env, guest, exerciseId);
  if (exercise.language !== language) {
    throw new HttpError(
      400,
      "Exercise language does not match the submitted language.",
      "language_mismatch",
    );
  }

  const slot = await acquireRunSlot(env, guest.guestId);
  const startedAt = Date.now();
  let sandbox: Sandbox | null = null;
  let outcome = "error";
  try {
    const sandboxIdHash = await sha256Hex(guest.guestId + ":" + exerciseId);
    const sandboxId = "lesson-" + sandboxIdHash.slice(0, 40);
    const activity = await env.DB.prepare(
      "SELECT last_used_at FROM sandbox_activity WHERE sandbox_id = ?",
    )
      .bind(sandboxId)
      .first<{ last_used_at: number }>();
    const sandboxState =
      activity && startedAt - activity.last_used_at < 10 * 60 * 1000
        ? ("warm" as const)
        : ("cold" as const);
    await env.DB.prepare(
      "INSERT INTO code_run_events (run_id, guest_id, exercise_id, started_at, outcome, cold_state) VALUES (?, ?, ?, ?, 'started', ?)",
    )
      .bind(slot.runId, guest.guestId, exerciseId, startedAt, sandboxState)
      .run();

    sandbox = getSandbox(env.Sandbox, sandboxId, {
      sleepAfter: "10m",
      enableDefaultSession: false,
      labels: { workload: "lesson-code", sandboxId },
    });
    const execution = await withContainerRetry(() =>
      executeInSandbox(sandbox!, language, source, exercise.manifest),
    );
    const combined = (execution.stdout || "") + (execution.stderr || "");
    const outputExceeded =
      new TextEncoder().encode(combined).byteLength > LESSON_LIMITS.codeOutputBytes;
    const outputs = outputExceeded ? null : parseOutputs(combined);
    let passedTests = 0;
    if (outputs) {
      passedTests = exercise.manifest.tests.reduce((total, test, index) => {
        const output = outputs[index];
        return total +
          (output?.ok && canonicalJson(output.value) === canonicalJson(test.expected)
            ? 1
            : 0);
      }, 0);
    }
    const totalTests = exercise.manifest.tests.length;
    const status =
      outputs && passedTests === totalTests && execution.success
        ? ("passed" as const)
        : outputs
          ? ("failed" as const)
          : ("error" as const);
    outcome = status;
    const sourceHash = await sha256Hex(source);
    const visibleOutput = combined
      .split("\n")
      .filter((line) => !line.startsWith(OUTPUT_MARKER))
      .join("\n")
      .slice(0, LESSON_LIMITS.codeOutputBytes);
    const durationMs = Date.now() - startedAt;
    await env.DB.prepare(
      "INSERT INTO sandbox_activity (sandbox_id, last_used_at) VALUES (?, ?) ON CONFLICT(sandbox_id) DO UPDATE SET last_used_at = excluded.last_used_at",
    )
      .bind(sandboxId, Date.now())
      .run();
    return json(
      {
        evidence: {
          status,
          sourceHash,
          passedTests,
          totalTests,
        },
        stdout: outputExceeded
          ? visibleOutput + "\nOutput stopped at the 64 KB limit."
          : visibleOutput,
        stderr: "",
        durationMs,
        sandboxState,
      },
      {
        headers: {
          "X-Quota-Outcome": "run_accepted",
          "X-Sandbox-State": sandboxState,
        },
      },
    );
  } finally {
    await env.DB.prepare(
      "UPDATE code_run_events SET outcome = ? WHERE run_id = ?",
    )
      .bind(outcome, slot.runId)
      .run()
      .catch(() => undefined);
    await releaseRunSlot(env, guest.guestId).catch(() => undefined);
    if (sandbox) {
      await sandbox
        .exec(CLEANUP_COMMAND, { timeout: 2_000 })
        .catch(() => undefined);
    }
  }
}

export async function validateReferences(
  request: Request,
  env: Env,
  guest: GuestContext,
): Promise<Response> {
  const body = await readJsonObject(request, 12 * 1024);
  const assetIds = stringList(body, "assetIds", LESSON_LIMITS.maximumAssets, 200);
  const exerciseIds = stringList(body, "exerciseIds", 20, 200);
  const issues: string[] = [];
  for (const assetId of assetIds) {
    const asset = await env.DB.prepare(
      "SELECT status, expires_at FROM assets WHERE asset_id = ? AND guest_id = ?",
    )
      .bind(assetId, guest.guestId)
      .first<{ status: string; expires_at: number }>();
    if (!asset || asset.status !== "ready" || asset.expires_at <= Date.now()) {
      issues.push("asset " + assetId + " is unavailable");
    }
  }
  for (const exerciseId of exerciseIds) {
    if (fixtureManifest(exerciseId)) continue;
    const exercise = await env.DB.prepare(
      "SELECT status, expires_at FROM code_exercises WHERE exercise_id = ? AND guest_id = ?",
    )
      .bind(exerciseId, guest.guestId)
      .first<{ status: string; expires_at: number }>();
    if (
      !exercise ||
      exercise.status !== "ready" ||
      exercise.expires_at <= Date.now()
    ) {
      issues.push("exercise " + exerciseId + " is unavailable");
    }
  }
  return json({ valid: issues.length === 0, issues });
}

export async function expireInactiveExercises(env: Env): Promise<void> {
  await env.DB.prepare(
    "UPDATE code_exercises SET status = 'expired' WHERE status = 'ready' AND expires_at <= ?",
  )
    .bind(Date.now())
    .run();
}
