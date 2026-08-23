import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const optionNames = new Set([
  "bundle-id",
  "date",
  "ipa",
  "min-ios",
  "output",
  "release-tag",
  "repository-slug",
  "repository-url",
  "version",
]);

function readOptions(argumentsList) {
  const options = new Map();
  for (let index = 0; index < argumentsList.length; index += 2) {
    const flag = argumentsList[index];
    const value = argumentsList[index + 1];
    if (!flag?.startsWith("--") || !value) throw new Error("Every SideStore option requires a value.");
    const name = flag.slice(2);
    if (!optionNames.has(name)) throw new Error(`Unknown SideStore option: ${flag}`);
    options.set(name, value.trim());
  }
  for (const name of optionNames) {
    if (!options.get(name)) throw new Error(`Missing required SideStore option: --${name}`);
  }
  return options;
}

const options = readOptions(process.argv.slice(2));
const ipaPath = options.get("ipa");
const outputPath = options.get("output");
const repositoryUrl = options.get("repository-url").replace(/\/$/, "");
const repositorySlug = options.get("repository-slug");
const releaseTag = options.get("release-tag");
const bundleIdentifier = options.get("bundle-id");
const ipaSize = (await stat(ipaPath)).size;

const source = {
  name: "Track II",
  identifier: `${bundleIdentifier}.source`,
  sourceURL: `${repositoryUrl}/releases/latest/download/altstore-source.json`,
  apps: [
    {
      name: "Track II",
      bundleIdentifier,
      developerName: "Track II Contributors",
      subtitle: "Private workout tracking and strength insights.",
      localizedDescription:
        "Plan workout splits, record sets, review calendar history, follow strength ranks, and use built-in rest and stopwatch timers. Track II supports private account sync, metric and imperial units, exports, notifications, and haptics.",
      iconURL: `https://raw.githubusercontent.com/${repositorySlug}/main/public/icon-512.png`,
      tintColor: "#22C55E",
      permissions: [
        {
          type: "network",
          usageDescription:
            "Used for account sign-in, private workout synchronization, update checks, and optional AI import.",
        },
      ],
      versions: [
        {
          version: options.get("version"),
          date: options.get("date"),
          downloadURL: `${repositoryUrl}/releases/download/${releaseTag}/Track-II-ios-unsigned.ipa`,
          size: ipaSize,
          minOSVersion: options.get("min-ios"),
          localizedDescription: "Initial SideStore and AltStore release of Track II.",
        },
      ],
    },
  ],
  news: [],
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(source, null, 2)}\n`, "utf8");
console.log(`SideStore source generated: ${outputPath}`);
