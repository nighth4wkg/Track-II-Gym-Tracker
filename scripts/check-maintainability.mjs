import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const appRoot = path.join(projectRoot, "app");
const stylesRoot = path.join(appRoot, "styles");
const budgets = {
  components: 400,
  hooks: 700,
  api: 500,
  utilities: 850,
  cssBytes: 320_000,
  repeatedSelectors: 500,
  importantDeclarations: 150,
};

function filesUnder(directory, extensions) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return filesUnder(target, extensions);
    return entry.isFile() && extensions.some((extension) => target.endsWith(extension)) ? [target] : [];
  });
}

function lineCount(file) {
  return readFileSync(file, "utf8").split(/\r?\n/).length;
}

function oversized(root, extensions, limit) {
  return filesUnder(root, extensions)
    .map((file) => ({ file, lines: lineCount(file) }))
    .filter(({ lines }) => lines > limit);
}

const sourceBudgets = [
  ["components", path.join(appRoot, "components"), [".tsx", ".ts"], budgets.components],
  ["hooks", path.join(appRoot, "hooks"), [".ts", ".tsx"], budgets.hooks],
  ["api", path.join(appRoot, "data"), [".ts", ".tsx"], budgets.api],
  ["utilities", appRoot, [".ts", ".tsx"], budgets.utilities],
];
const oversizedSources = sourceBudgets.flatMap(([name, root, extensions, limit]) =>
  oversized(root, extensions, limit).map((item) => ({ ...item, name, limit })),
);

const cssFiles = filesUnder(stylesRoot, [".css"]);
const cssSources = cssFiles.map((file) => ({ file, source: readFileSync(file, "utf8") }));
const cssBytes = Buffer.byteLength(cssSources.map(({ source }) => source).join("\n"), "utf8");
const importantCount = cssSources.reduce((count, { source }) => count + (source.match(/!important/g) ?? []).length, 0);

const keyframeOwners = new Map();
for (const { file, source } of cssSources) {
  for (const match of source.matchAll(/@keyframes\s+([\w-]+)/g)) {
    const owners = keyframeOwners.get(match[1]) ?? [];
    owners.push(path.relative(projectRoot, file));
    keyframeOwners.set(match[1], owners);
  }
}
const allCss = cssSources.map(({ source }) => source).join("\n");
const duplicateKeyframes = [...keyframeOwners].filter(([, owners]) => owners.length > 1);
const unusedKeyframes = [...keyframeOwners].filter(([name]) => {
  return [...allCss.matchAll(new RegExp(`\\b${name}\\b`, "g"))].length < 2;
});

function selectorCandidates(source) {
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, "");
  return [...withoutComments.matchAll(/(?:^|})\s*([^{}]+)\{/g)]
    .flatMap((match) => match[1].split(","))
    .map((selector) => selector.replace(/\s+/g, " ").trim())
    .filter((selector) => selector && !selector.startsWith("@"));
}

const selectorOwners = new Map();
for (const { file, source } of cssSources) {
  for (const selector of selectorCandidates(source)) {
    const owners = selectorOwners.get(selector) ?? [];
    owners.push(path.relative(projectRoot, file));
    selectorOwners.set(selector, owners);
  }
}
const repeatedSelectors = [...selectorOwners].filter(([, owners]) => owners.length > 1);

if (
  oversizedSources.length ||
  cssBytes > budgets.cssBytes ||
  importantCount > budgets.importantDeclarations ||
  repeatedSelectors.length > budgets.repeatedSelectors ||
  duplicateKeyframes.length ||
  unusedKeyframes.length
) {
  for (const { file, lines, name, limit } of oversizedSources) {
    console.error(`${path.relative(projectRoot, file)} has ${lines} lines in the ${name} budget; limit is ${limit}.`);
  }
  if (cssBytes > budgets.cssBytes) console.error(`CSS is ${cssBytes} bytes; limit is ${budgets.cssBytes}.`);
  if (importantCount > budgets.importantDeclarations) {
    console.error(`CSS contains ${importantCount} !important declarations; limit is ${budgets.importantDeclarations}.`);
  }
  if (repeatedSelectors.length > budgets.repeatedSelectors) {
    console.error(`CSS repeats ${repeatedSelectors.length} selectors; limit is ${budgets.repeatedSelectors}.`);
  }
  for (const [name, owners] of duplicateKeyframes) {
    console.error(`CSS keyframe ${name} is declared more than once: ${owners.join(", ")}.`);
  }
  for (const [name, owners] of unusedKeyframes) {
    console.error(`CSS keyframe ${name} is unused: ${owners.join(", ")}.`);
  }
  process.exit(1);
}

console.log(
  `Maintainability budgets passed (components ${budgets.components}, hooks ${budgets.hooks}, API ${budgets.api}, utilities ${budgets.utilities}; CSS ${cssBytes}/${budgets.cssBytes} bytes, ${repeatedSelectors.length}/${budgets.repeatedSelectors} repeated selectors, ${importantCount}/${budgets.importantDeclarations} overrides).`,
);
