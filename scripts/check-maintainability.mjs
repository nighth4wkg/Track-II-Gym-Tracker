import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const componentRoot = path.join(projectRoot, "app");
const stylesRoot = path.join(componentRoot, "styles");
const componentLineLimit = 400;
const importantLimit = 150;

function filesUnder(directory, extension) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return filesUnder(target, extension);
    return entry.isFile() && target.endsWith(extension) ? [target] : [];
  });
}

const oversizedComponents = filesUnder(componentRoot, ".tsx")
  .map((file) => ({ file, lines: readFileSync(file, "utf8").split(/\r?\n/).length }))
  .filter(({ lines }) => lines > componentLineLimit);
const importantCount = filesUnder(stylesRoot, ".css").reduce((count, file) => {
  return count + (readFileSync(file, "utf8").match(/!important/g) ?? []).length;
}, 0);
const keyframeOwners = new Map();
const cssSources = [];
for (const file of filesUnder(stylesRoot, ".css")) {
  const source = readFileSync(file, "utf8");
  cssSources.push(source);
  for (const match of source.matchAll(/@keyframes\s+([\w-]+)/g)) {
    const owners = keyframeOwners.get(match[1]) ?? [];
    owners.push(path.relative(projectRoot, file));
    keyframeOwners.set(match[1], owners);
  }
}
const duplicateKeyframes = [...keyframeOwners].filter(([, owners]) => owners.length > 1);
const allCss = cssSources.join("\n");
const unusedKeyframes = [...keyframeOwners].filter(([name]) => {
  return [...allCss.matchAll(new RegExp(`\\b${name}\\b`, "g"))].length < 2;
});

if (
  oversizedComponents.length ||
  importantCount > importantLimit ||
  duplicateKeyframes.length ||
  unusedKeyframes.length
) {
  for (const { file, lines } of oversizedComponents) {
    console.error(`${path.relative(projectRoot, file)} has ${lines} lines; limit is ${componentLineLimit}.`);
  }
  if (importantCount > importantLimit) {
    console.error(`CSS contains ${importantCount} !important declarations; limit is ${importantLimit}.`);
  }
  for (const [name, owners] of duplicateKeyframes) {
    console.error(`CSS keyframe ${name} is declared more than once: ${owners.join(", ")}.`);
  }
  for (const [name, owners] of unusedKeyframes) {
    console.error(`CSS keyframe ${name} is unused: ${owners.join(", ")}.`);
  }
  process.exit(1);
}

console.log(`Maintainability budgets passed (${importantCount}/${importantLimit} CSS overrides).`);
