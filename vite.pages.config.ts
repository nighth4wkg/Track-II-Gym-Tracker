import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import type { OutputBundle } from "rolldown";

const buildId = new Date().toISOString();
// SAFETY: package.json is a checked-in object; only its optional version field is read.
const packageJson = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as {
  version?: string;
};
const releaseVersion = (process.env.NEXT_PUBLIC_TRACK_VERSION ?? packageJson.version ?? "0.0.0").replace(/^v/i, "");
const replaceBuildTokens = (value: string) =>
  value.replaceAll("__TRACK_BUILD_ID__", buildId).replaceAll("__TRACK_VERSION__", releaseVersion);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // GitHub Actions supplies these as process environment variables while
  // local beta builds commonly use an .env file. Support both explicitly.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
  const trackWebOrigin = process.env.NEXT_PUBLIC_TRACK_WEB_ORIGIN ?? env.NEXT_PUBLIC_TRACK_WEB_ORIGIN ?? "";
  const trackReleasesUrl = process.env.NEXT_PUBLIC_TRACK_RELEASES_URL ?? env.NEXT_PUBLIC_TRACK_RELEASES_URL ?? "";
  const trackIssuesUrl = process.env.NEXT_PUBLIC_TRACK_ISSUES_URL ?? env.NEXT_PUBLIC_TRACK_ISSUES_URL ?? "";
  const trackMetricsUrl = process.env.NEXT_PUBLIC_TRACK_METRICS_URL ?? env.NEXT_PUBLIC_TRACK_METRICS_URL ?? "";

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY for the Pages build.");
  }

  return {
    root: "cloudflare",
    publicDir: "../public",
    plugins: [
      react(),
      {
        name: "track-build-id",
        transformIndexHtml: (html: string) => replaceBuildTokens(html),
        generateBundle(_options, bundle: OutputBundle) {
          this.emitFile({
            type: "asset",
            fileName: "track-release.json",
            source: `${JSON.stringify({ version: releaseVersion, buildId }, null, 2)}\n`,
          });
          for (const output of Object.values(bundle)) {
            if (output.type === "chunk") {
              output.code = replaceBuildTokens(output.code);
              continue;
            }
            const source =
              output.source instanceof Uint8Array ? new TextDecoder().decode(output.source) : output.source;
            output.source = replaceBuildTokens(source);
          }
        },
      },
    ],
    define: {
      "process.env.NEXT_PUBLIC_SUPABASE_URL": JSON.stringify(supabaseUrl),
      "process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(supabasePublishableKey),
      "process.env.NEXT_PUBLIC_TRACK_WEB_ORIGIN": JSON.stringify(trackWebOrigin),
      "process.env.NEXT_PUBLIC_TRACK_RELEASES_URL": JSON.stringify(trackReleasesUrl),
      "process.env.NEXT_PUBLIC_TRACK_ISSUES_URL": JSON.stringify(trackIssuesUrl),
      "process.env.NEXT_PUBLIC_TRACK_METRICS_URL": JSON.stringify(trackMetricsUrl),
    },
    build: {
      outDir: "../work/cloudflare-pages",
      assetsDir: "assets",
      emptyOutDir: true,
      // Keep third-party runtime code in a browser-cacheable chunk. The
      // application entry remains smaller and avoids Vite's 500 KB warning
      // without changing runtime behavior or lazy route boundaries.
      rolldownOptions: {
        output: {
          codeSplitting: {
            minSize: 20_000,
            groups: [{ name: "vendor", test: /[\\/]node_modules[\\/]/ }],
          },
        },
      },
    },
  };
});
