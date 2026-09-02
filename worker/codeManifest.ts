import { HttpError, requiredString } from "./http";

export interface TestCase {
  name: string;
  args: unknown[];
  expected: unknown;
}

export interface TestManifest {
  entrypoint: string;
  tests: TestCase[];
}

function isJsonValue(value: unknown, depth = 0): boolean {
  if (depth > 8) return false;
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return true;
  }
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) {
    return value.length <= 100 && value.every((item) => isJsonValue(item, depth + 1));
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    return (
      entries.length <= 100 &&
      entries.every(
        ([key, item]) => key.length <= 120 && isJsonValue(item, depth + 1),
      )
    );
  }
  return false;
}

export function parseManifest(source: string): TestManifest {
  let raw: unknown;
  try {
    raw = JSON.parse(source);
  } catch {
    throw new HttpError(
      400,
      "testManifest must be valid JSON.",
      "invalid_test_manifest",
    );
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new HttpError(400, "testManifest must be an object.", "invalid_test_manifest");
  }
  const object = raw as Record<string, unknown>;
  const entrypoint = requiredString(object, "entrypoint", 1, 100);
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(entrypoint)) {
    throw new HttpError(
      400,
      "testManifest entrypoint must be a simple exported function name.",
      "invalid_test_manifest",
    );
  }
  if (!Array.isArray(object.tests) || !object.tests.length || object.tests.length > 20) {
    throw new HttpError(
      400,
      "testManifest needs one to twenty tests.",
      "invalid_test_manifest",
    );
  }
  const tests = object.tests.map((value, index): TestCase => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new HttpError(
        400,
        "Test " + (index + 1) + " must be an object.",
        "invalid_test_manifest",
      );
    }
    const test = value as Record<string, unknown>;
    if (!Array.isArray(test.args) || !isJsonValue(test.args) || !isJsonValue(test.expected)) {
      throw new HttpError(
        400,
        "Test " + (index + 1) + " args and expected value must be bounded JSON.",
        "invalid_test_manifest",
      );
    }
    return {
      name: requiredString(test, "name", 1, 160),
      args: test.args,
      expected: test.expected,
    };
  });
  return { entrypoint, tests };
}
