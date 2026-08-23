import { spawnSync } from "node:child_process";
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
  ["Formatting", ["run", "format:check"]],
  ["Cloudflare Pages build", ["run", "build:pages"]],
  ["Browser E2E", ["run", "test:e2e:built"]],
];

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
}

console.log("\nRelease validation passed.");
