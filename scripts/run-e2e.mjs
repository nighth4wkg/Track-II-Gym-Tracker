import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startPagesServer, stopPagesServer } from "./serve-pages.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const playwrightCli = path.join(projectRoot, "node_modules", "@playwright", "test", "cli.js");

const managedServer = !process.env.E2E_BASE_URL;
if (managedServer) await startPagesServer();
let exitCode = 1;
try {
  exitCode = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [playwrightCli, "test"], {
      cwd: projectRoot,
      env: { ...process.env, PLAYWRIGHT_MANAGED_SERVER: "1" },
      shell: false,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
} finally {
  if (managedServer) await stopPagesServer();
}
process.exitCode = exitCode;
