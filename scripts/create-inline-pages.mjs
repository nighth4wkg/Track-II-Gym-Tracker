import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const projectRoot = process.cwd();
const pagesDir = path.join(projectRoot, "work", "cloudflare-pages");
const outputDir = path.join(projectRoot, "work", "cloudflare-inline");

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

const indexPath = path.join(pagesDir, "index.html");
let index = await readFile(indexPath, "utf8");
const jsMatch = index.match(/<script type="module" crossorigin src="([^"]+)"><\/script>/);
const cssMatch = index.match(/<link rel="stylesheet" crossorigin href="([^"]+)">/);
if (!jsMatch || !cssMatch) throw new Error("Built Pages index is missing its JS or CSS entry");

const js = await readFile(path.join(pagesDir, jsMatch[1].replace(/^\.\//, "")), "utf8");
const css = await readFile(path.join(pagesDir, cssMatch[1].replace(/^\.\//, "")), "utf8");
const boot = await readFile(path.join(pagesDir, "track-boot.js"), "utf8").catch(() => "");
const inlineJs = js.replaceAll("</script", "<\\/script");
const hash = (value) => `'sha256-${createHash("sha256").update(value).digest("base64")}'`;

// Keep the direct-upload artifact self-contained. This avoids a Pages fallback
// response replacing missing nested assets with index.html before React starts.
index = index
  .replace(/<script src="\.\/track-boot\.js"><\/script>/, () => (boot ? `<script>${boot}</script>` : ""))
  // Use function replacers: the minified bundle contains dollar sequences
  // that String.replace would otherwise interpret as replacement tokens.
  .replace(jsMatch[0], () => `<script type="module">${inlineJs}</script>`)
  .replace(cssMatch[0], () => `<style>${css}</style>`);

await writeFile(path.join(outputDir, "index.html"), index, "utf8");

// Keep the small public files available for the favicon, manifest, and PWA shell.
for (const name of [
  "favicon.svg",
  "manifest.webmanifest",
  "sw.js",
  "track-icon.svg",
  "track-dumbbell.svg",
  "track-dumbbell-mark.svg",
  "track-geometric-dumbbell.svg",
  "apple-touch-icon.png",
  "icon-192.png",
  "icon-512.png",
  "notification-badge.png",
]) {
  await cp(path.join(pagesDir, name), path.join(outputDir, name));
}

const headers = await readFile(path.join(pagesDir, "_headers"), "utf8").catch(() => "");
if (headers) {
  const inlineHeaders = headers.replace(
    "script-src 'self'",
    `script-src 'self' ${boot ? `${hash(boot)} ` : ""}${hash(inlineJs)}`,
  );
  await writeFile(path.join(outputDir, "_headers"), inlineHeaders, "utf8");
}

console.log(`Created ${path.relative(projectRoot, outputDir)}`);
