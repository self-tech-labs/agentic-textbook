import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import process from "node:process";

const repositoryRoot = resolve(import.meta.dirname, "..");
const outputPath = join(repositoryRoot, "public", "third-party-licenses.txt");
const checkOnly = process.argv.includes("--check");

function packageLabel(packageRecord) {
  return `${packageRecord.name}@${packageRecord.version}`;
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function normalizeLicenseText(value) {
  return value
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

const productionPackages = JSON.parse(
  execFileSync("npm", ["query", ".prod", "--json"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  }),
)
  .filter((packageRecord) => resolve(packageRecord.path) !== repositoryRoot)
  .sort((left, right) =>
    compareText(packageLabel(left), packageLabel(right)),
  );

const packagesByNameAndVersion = new Map(
  productionPackages.map((packageRecord) => [
    packageLabel(packageRecord),
    packageRecord,
  ]),
);
const groupedTexts = new Map();
const fallbackNotes = new Map();

function distributedLicenseFiles(packageRecord) {
  return readdirSync(packageRecord.path)
    .filter((name) => /^(licen[cs]e|copying|notice)(\..*)?$/i.test(name))
    .sort(compareText)
    .map((name) => ({
      source: `${packageLabel(packageRecord)}/${name}`,
      text: normalizeLicenseText(readFileSync(join(packageRecord.path, name), "utf8")),
    }));
}

function readReadmeLicense(packageRecord) {
  const readmePath = join(packageRecord.path, "README.md");
  const readme = normalizeLicenseText(readFileSync(readmePath, "utf8"));
  const marker = "## License";
  const markerIndex = readme.lastIndexOf(marker);
  if (markerIndex < 0) {
    throw new Error(`${packageLabel(packageRecord)} has no README license section.`);
  }
  return {
    source: `${packageLabel(packageRecord)}/README.md#license`,
    text: normalizeLicenseText(readme.slice(markerIndex + marker.length)),
  };
}

function fallbackLicenseFiles(packageRecord) {
  if (packageRecord.name === "fastdom" || packageRecord.name === "strictdom") {
    fallbackNotes.set(
      packageLabel(packageRecord),
      "License text is distributed in the package README.",
    );
    return [readReadmeLicense(packageRecord)];
  }

  const parentName = packageRecord.name.startsWith("@esbuild/")
    ? "esbuild"
    : packageRecord.name.startsWith("@rolldown/binding-")
      ? "rolldown"
      : null;
  if (parentName) {
    const parent = packagesByNameAndVersion.get(
      `${parentName}@${packageRecord.version}`,
    );
    if (!parent) {
      throw new Error(
        `${packageLabel(packageRecord)} is missing its ${parentName} license fallback.`,
      );
    }
    fallbackNotes.set(
      packageLabel(packageRecord),
      `Platform package; license text supplied by ${packageLabel(parent)}.`,
    );
    return distributedLicenseFiles(parent).map((entry) => ({
      ...entry,
      source: `${entry.source} (platform-package fallback)`,
    }));
  }

  if (packageRecord.name === "@cloudflare/containers") {
    fallbackNotes.set(
      packageLabel(packageRecord),
      "Package declares MIT OR Apache-2.0; Apache-2.0 is selected for this notice corpus.",
    );
    return [
      {
        source: "public/licenses/Apache-2.0.txt (selected dual-license option)",
        text: normalizeLicenseText(
          readFileSync(
            join(repositoryRoot, "public", "licenses", "Apache-2.0.txt"),
            "utf8",
          ),
        ),
      },
    ];
  }

  throw new Error(
    `${packageLabel(packageRecord)} has no distributed license or notice file.`,
  );
}

for (const packageRecord of productionPackages) {
  const entries = distributedLicenseFiles(packageRecord);
  for (const entry of entries.length ? entries : fallbackLicenseFiles(packageRecord)) {
    const digest = createHash("sha256").update(entry.text).digest("hex");
    const group = groupedTexts.get(digest) ?? {
      digest,
      packages: new Set(),
      sources: new Set(),
      text: entry.text,
    };
    group.packages.add(packageLabel(packageRecord));
    group.sources.add(entry.source);
    groupedTexts.set(digest, group);
  }
}

const lines = [
  "learn.ogram complete third-party license corpus",
  "================================================",
  "",
  "Generated from the installed npm production dependency tree locked by",
  "package-lock.json. It covers the exact packages used for the audited release",
  "environment; regenerate it after dependency or release-environment changes.",
  "",
  `Packages: ${productionPackages.length}`,
  `Unique distributed license/notice texts: ${groupedTexts.size}`,
  "",
  "PACKAGE INVENTORY",
  "-----------------",
];

for (const packageRecord of productionPackages) {
  const label = packageLabel(packageRecord);
  const declaredLicense =
    packageRecord.license ||
    (packageRecord.name === "khroma"
      ? "MIT (distributed LICENSE; package metadata omits SPDX)"
      : "See distributed license text");
  const note = fallbackNotes.get(label);
  lines.push(`- ${label} — ${declaredLicense}${note ? ` — ${note}` : ""}`);
}

lines.push("", "LICENSE AND NOTICE TEXTS", "------------------------", "");

const sortedGroups = [...groupedTexts.values()].sort((left, right) => {
  const leftPackage = [...left.packages].sort(compareText)[0] || "";
  const rightPackage = [...right.packages].sort(compareText)[0] || "";
  return compareText(leftPackage, rightPackage) || compareText(left.digest, right.digest);
});

for (const [index, group] of sortedGroups.entries()) {
  lines.push(`TEXT ${index + 1}`, "Packages:");
  for (const label of [...group.packages].sort(compareText)) {
    lines.push(`- ${label}`);
  }
  lines.push("Packaged source(s):");
  for (const source of [...group.sources].sort(compareText)) {
    lines.push(`- ${source}`);
  }
  lines.push(
    `SHA-256: ${group.digest}`,
    "----- BEGIN LICENSE/NOTICE TEXT -----",
    group.text,
    "----- END LICENSE/NOTICE TEXT -----",
    "",
  );
}

const generated = `${lines.join("\n").trimEnd()}\n`;

if (checkOnly) {
  if (!existsSync(outputPath) || readFileSync(outputPath, "utf8") !== generated) {
    console.error(
      "public/third-party-licenses.txt is stale; run npm run licenses:generate.",
    );
    process.exit(1);
  }
  console.log(
    `Third-party license corpus is current (${productionPackages.length} packages).`,
  );
} else {
  writeFileSync(outputPath, generated);
  console.log(
    `Wrote public/third-party-licenses.txt for ${productionPackages.length} packages.`,
  );
}
