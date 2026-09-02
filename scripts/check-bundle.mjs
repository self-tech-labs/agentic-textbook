import { readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { gzipSync } from "node:zlib";

const distDirectory = new URL("../dist/", import.meta.url);
const html = readFileSync(new URL("index.html", distDirectory), "utf8");
const entryMatch = html.match(/<script[^>]+src="([^"]+\.js)"/);
if (!entryMatch) throw new Error("Could not locate the production entry script.");

const entryName = basename(entryMatch[1]);
const entry = readFileSync(new URL("assets/" + entryName, distDirectory));
const gzipBytes = gzipSync(entry).byteLength;
const budgetBytes = 145 * 1024;
if (gzipBytes >= budgetBytes) {
  throw new Error(
    `Initial JavaScript is ${(gzipBytes / 1024).toFixed(2)} KB gzip; budget is below 145 KB.`,
  );
}

const files = readdirSync(new URL("assets/", distDirectory));
for (const chunk of [
  "TrustedContentRenderer",
  "FormulaBlock",
  "MermaidDiagram",
  "CodeLab",
]) {
  if (!files.some((file) => file.startsWith(chunk + "-") && file.endsWith(".js"))) {
    throw new Error(`${chunk} must remain in a lazy production chunk.`);
  }
}

const preloadNames = Array.from(html.matchAll(/rel="modulepreload"[^>]+href="([^"]+)"/g))
  .map((match) => basename(match[1]));
if (
  preloadNames.some((name) =>
    ["TrustedContentRenderer", "FormulaBlock", "MermaidDiagram", "CodeLab"].some(
      (chunk) => name.startsWith(chunk + "-"),
    ),
  )
) {
  throw new Error("A heavy lesson engine was preloaded by the landing page.");
}

console.log(
  `Initial JavaScript: ${(gzipBytes / 1024).toFixed(2)} KB gzip (${join("dist/assets", entryName)}).`,
);
