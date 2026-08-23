import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const componentRoot = path.join(projectRoot, "app");
const stylesRoot = path.join(componentRoot, "styles");
const componentLineLimit = 700;
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

if (oversizedComponents.length || importantCount > importantLimit) {
  for (const { file, lines } of oversizedComponents) {
    console.error(`${path.relative(projectRoot, file)} has ${lines} lines; limit is ${componentLineLimit}.`);
  }
  if (importantCount > importantLimit) {
    console.error(`CSS contains ${importantCount} !important declarations; limit is ${importantLimit}.`);
  }
  process.exit(1);
}

console.log(`Maintainability budgets passed (${importantCount}/${importantLimit} CSS overrides).`);
