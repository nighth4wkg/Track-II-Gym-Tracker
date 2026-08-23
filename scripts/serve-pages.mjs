import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const pagesRoot = path.resolve(scriptDirectory, "..", "work", "cloudflare-pages");
const host = process.env.PLAYWRIGHT_HOST ?? "127.0.0.1";
const port = Number(process.env.PLAYWRIGHT_PORT ?? 3000);
const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
]);

if (!existsSync(path.join(pagesRoot, "index.html"))) {
  throw new Error("Cloudflare Pages output is missing. Run npm run build:pages first.");
}

const server = createServer((request, response) => {
  const requestPath = decodeURIComponent(new URL(request.url ?? "/", `http://${host}`).pathname);
  const candidate = path.resolve(pagesRoot, `.${requestPath}`);
  const insidePagesRoot = candidate === pagesRoot || candidate.startsWith(`${pagesRoot}${path.sep}`);
  const filePath =
    insidePagesRoot && existsSync(candidate) && statSync(candidate).isFile()
      ? candidate
      : path.join(pagesRoot, "index.html");
  response.writeHead(200, {
    "Cache-Control": "no-store",
    "Content-Type": contentTypes.get(path.extname(filePath)) ?? "application/octet-stream",
  });
  if (request.method === "HEAD") response.end();
  else createReadStream(filePath).pipe(response);
});

export function stopPagesServer() {
  server.closeAllConnections();
  return new Promise((resolve) => server.close(resolve));
}

export function startPagesServer() {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      console.log(`Pages test server listening on http://${host}:${port}`);
      resolve();
    });
  });
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const closeStandaloneServer = () => void stopPagesServer().finally(() => process.exit(0));
  process.once("SIGINT", closeStandaloneServer);
  process.once("SIGTERM", closeStandaloneServer);
  await startPagesServer();
}
