import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const npmCli = process.env.npm_execpath;
const npmCommand = npmCli ? process.execPath : "npm";

const checks = [
  ["Source tests", ["test"]],
  ["Typecheck", ["run", "typecheck"]],
  ["Lint", ["run", "lint"]],
  ["Maintainability budgets", ["run", "check:maintainability"]],
  ["Generated rank SVG", ["run", "validate:rank-map"]],
  ["Formatting", ["run", "format:check"]],
  ["Cloudflare Pages build", ["run", "build:pages"]],
  ["Cloudflare production headers", ["run", "verify:pages"]],
  ["Browser E2E", ["run", "test:e2e:built"]],
];

function validateBuiltOfflineShell() {
  const serviceWorkerPath = path.join(projectRoot, "work", "cloudflare-pages", "sw.js");
  const serviceWorker = readFileSync(serviceWorkerPath, "utf8");
  if (/__TRACK_(?:VERSION|BUILD_ID)__/.test(serviceWorker)) {
    throw new Error("The Pages service worker still contains an unreplaced release token.");
  }
  const hasVersionedCacheName = /TRACK_CACHE_NAME\s*=\s*`\$\{TRACK_CACHE_PREFIX\}[^`]+`/.test(serviceWorker);
  if (!hasVersionedCacheName || !/offline\.html/.test(serviceWorker)) {
    throw new Error("The Pages service worker is missing its versioned shell or offline fallback.");
  }
}

for (const [name, args] of checks) {
  console.log(`\n==> ${name}`);
  const result = spawnSync(npmCommand, npmCli ? [npmCli, ...args] : args, {
    cwd: projectRoot,
    env: process.env,
    shell: false,
    stdio: "inherit",
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
  if (name === "Cloudflare Pages build") validateBuiltOfflineShell();
}

console.log("\nRelease validation passed.");
