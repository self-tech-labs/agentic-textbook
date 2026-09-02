const baseUrl = (process.env.LEARNING_WORKER_URL || "http://localhost:8787").replace(
  /\/$/,
  "",
);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function readJson(response) {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      response.status + " " + (body?.error || "Worker request failed"),
    );
  }
  return body;
}

const healthResponse = await fetch(baseUrl + "/api/health");
const health = await readJson(healthResponse);
assert(health.schemaVersion === 4, "Worker health did not report schema V4.");

async function newSession() {
  const response = await fetch(baseUrl + "/api/session");
  const session = await readJson(response);
  const setCookie = response.headers.get("set-cookie") || "";
  const cookie = setCookie.split(";")[0];
  assert(cookie.includes("ogram_guest_v1="), "Guest cookie was not issued.");
  assert(typeof session.csrfToken === "string", "CSRF token was not issued.");
  return {
    cookie,
    headers: {
      "Content-Type": "application/json",
      Origin: baseUrl,
      Cookie: cookie,
      "X-Learning-CSRF": session.csrfToken,
    },
  };
}

async function runFixture(session, language, exerciseId, source, expectedState) {
  const response = await fetch(baseUrl + "/api/code/run", {
    method: "POST",
    headers: session.headers,
    body: JSON.stringify({ exerciseId, language, source }),
  });
  const result = await readJson(response);
  assert(
    result.evidence?.status === "passed",
    language +
      " fixture did not pass its server-side tests: " +
      (result.stdout || result.stderr || result.evidence?.status || "unknown"),
  );
  assert(
    typeof result.evidence.sourceHash === "string" &&
      result.evidence.sourceHash.length === 64,
    language + " fixture did not return a SHA-256 source hash.",
  );
  assert(
    result.sandboxState === expectedState,
    language +
      " fixture reported " +
      result.sandboxState +
      " instead of the expected " +
      expectedState +
      " state.",
  );
  return {
    language,
    phase: expectedState,
    status: result.evidence.status,
    tests: result.evidence.passedTests + "/" + result.evidence.totalTests,
    durationMs: result.durationMs,
    sandboxState: result.sandboxState,
  };
}

const fixtures = [
  {
    language: "javascript",
    exerciseId: "fixture-js-sum-v1",
    source:
      "export function sum(values) { return values.reduce((total, value) => total + value, 0); }",
  },
  {
    language: "typescript",
    exerciseId: "fixture-ts-display-name-v1",
    source:
      "export function displayName(value: string | null): string { return value ?? \"Anonymous\"; }",
  },
  {
    language: "python",
    exerciseId: "fixture-python-positives-v1",
    source:
      "def positives(values):\n    return [value for value in values if value > 0]\n",
  },
];

const results = [];
let mediaSession;
for (const fixture of fixtures) {
  const session = await newSession();
  mediaSession ||= session;
  results.push(
    await runFixture(
      session,
      fixture.language,
      fixture.exerciseId,
      fixture.source,
      "cold",
    ),
  );
  results.push(
    await runFixture(
      session,
      fixture.language,
      fixture.exerciseId,
      fixture.source,
      "warm",
    ),
  );
}

const mediaSource =
  process.env.LEARNING_MEDIA_URL || "https://httpbin.org/image/png";
const mediaResponse = await fetch(baseUrl + "/api/assets/import", {
  method: "POST",
  headers: mediaSession.headers,
  body: JSON.stringify({
    lessonId: "worker-smoke-media-v4",
    url: mediaSource,
    kind: "image",
    caption: "A governed image imported during the Worker smoke test.",
    attribution: "postmanlabs/httpbin contributors",
    rightsConfirmed: true,
    rightsBasis:
      "ISC-licensed httpbin pig_icon.png test fixture from postmanlabs/httpbin",
    alt: "A small multicoloured PNG used to verify the governed media path.",
  }),
});
const media = await readJson(mediaResponse);
assert(media.asset?.status === "ready", "Governed media did not become ready.");
assert(media.asset?.mimeType === "image/png", "Governed media MIME was not verified.");
assert(
  media.asset?.rightsBasis?.startsWith("ISC-licensed httpbin"),
  "Governed media did not preserve its recorded rights basis.",
);
assert(
  typeof media.asset?.contentHash === "string" &&
    media.asset.contentHash.length === 64,
  "Governed media did not return a content hash.",
);
const servedMediaResponse = await fetch(baseUrl + media.asset.url, {
  headers: { Cookie: mediaSession.cookie },
});
assert(servedMediaResponse.ok, "Governed media could not be read back from R2.");
const servedMedia = new Uint8Array(await servedMediaResponse.arrayBuffer());
assert(
  servedMedia[0] === 0x89 &&
    servedMedia[1] === 0x50 &&
    servedMedia[2] === 0x4e &&
    servedMedia[3] === 0x47,
  "Served media did not preserve its verified PNG bytes.",
);
const referencesResponse = await fetch(
  baseUrl + "/api/lesson-references/validate",
  {
    method: "POST",
    headers: mediaSession.headers,
    body: JSON.stringify({
      assetIds: [media.asset.id],
      exerciseIds: [
        "fixture-js-sum-v1",
        "fixture-ts-display-name-v1",
        "fixture-python-positives-v1",
      ],
    }),
  },
);
const references = await readJson(referencesResponse);
assert(references.valid === true, "Ready lesson references did not validate.");

console.log(
  JSON.stringify(
    {
      endpoint: baseUrl,
      health: health.status,
      services: health.services,
      results,
      media: {
        status: media.asset.status,
        mimeType: media.asset.mimeType,
        byteLength: media.asset.byteLength,
        referenceValidation: references.valid,
      },
    },
    null,
    2,
  ),
);
