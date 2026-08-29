import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const svgPath = path.join(projectRoot, "app", "assets", "rank-muscle-map.svg");
const svg = await readFile(svgPath, "utf8");

const requiredIds = [
  "chest_l",
  "chest_r",
  "deltoid_front_l",
  "deltoid_front_r",
  "deltoid_rear_l",
  "deltoid_rear_r",
  "biceps_l",
  "biceps_r",
  "triceps_l",
  "triceps_r",
  "forearm_l",
  "forearm_r",
  "abs_upper",
  "abs_lower",
  "obliques_l",
  "obliques_r",
  "lats_l",
  "lats_r",
  "traps_upper",
  "traps_mid",
  "traps_lower",
  "rhomboids",
  "quad_l",
  "quad_r",
  "hamstring_l",
  "hamstring_r",
  "calf_l",
  "calf_r",
  "glute_l",
  "glute_r",
  "erector_spinae",
];

function assert(condition, message) {
  if (!condition) throw new Error(`Rank SVG validation failed: ${message}`);
}

assert(/^\s*<svg\b[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/.test(svg), "missing SVG root");
assert(/viewBox="0 0 900 600"/.test(svg), "unexpected viewBox");
assert(/<g\s+id="front-view"(?=\s|>)/.test(svg), "missing front-view group");
assert(/<g\s+id="back-view"(?=\s|>)/.test(svg), "missing back-view group");
assert(!/(?:href|xlink:href)=['"](?:https?:|\/\/|data:)/i.test(svg), "external image reference found");
assert(!/<(?:script|foreignObject)\b/i.test(svg), "unsafe embedded element found");

const ids = [...svg.matchAll(/\bid="([^"\s]+)"/g)].map((match) => match[1]);
const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
assert(!duplicateIds.length, `duplicate ids: ${duplicateIds.join(", ")}`);

for (const id of requiredIds) {
  assert(ids.includes(id), `missing required path id ${id}`);
  const pathPattern = new RegExp(`<path\\b[^>]*\\bid="${id}"(?=\\s|>)[^>]*>`);
  const pathMarkup = svg.match(pathPattern)?.[0] ?? "";
  assert(pathMarkup, `${id} is not a path`);
  assert(/\bd="[^"]+"/.test(pathMarkup), `${id} has no path data`);
  assert(/data-muscle-group="[^"]+"/.test(pathMarkup), `${id} has no muscle-group metadata`);
  assert(/data-view="(?:front|back)"/.test(pathMarkup), `${id} has no front/back metadata`);
}

console.log(`Validated rank muscle map: ${requiredIds.length} required interactive paths, ${ids.length} total ids.`);
