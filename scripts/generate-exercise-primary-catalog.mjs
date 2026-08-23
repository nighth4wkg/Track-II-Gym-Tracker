import { readFile, writeFile } from "node:fs/promises";

const REVIEW_PATH = new URL("../docs/exercise-muscle-target-review.md", import.meta.url);
const OUTPUT_PATH = new URL("../app/exercisePrimaryCatalog.js", import.meta.url);

function broadGroup(description, exerciseName) {
  const descriptionText = description.toLowerCase();
  const name = exerciseName.toLowerCase();

  // Order matters: rear delts and rotator-cuff work are shoulder exercises,
  // even though words such as "fly" can also occur in chest movements.
  if (/^(rear delt|rotator cuff|shoulder)/.test(descriptionText)) return "shoulders";
  if (descriptionText.startsWith("chest")) return "chest";
  if (/^(back|upper back|upper trapezius|spinal erector|neck )/.test(descriptionText)) return "back";
  if (/^(biceps|triceps|forearm|elbow flexor)/.test(descriptionText)) return "arms";
  if (/^(legs|glute|hamstring|calf|calves|quadriceps|hip |tibialis|posterior chain|cardio)/.test(descriptionText))
    return "legs";
  if (descriptionText.startsWith("core")) return "core";
  if (descriptionText.startsWith("upper body compound")) return "back";
  if (descriptionText.startsWith("full body")) return /carry|hang|grip/.test(name) ? "arms" : "legs";
  throw new Error(`No broad Track group for ${exerciseName}: ${description}`);
}

const review = await readFile(REVIEW_PATH, "utf8");
const entries = review
  .split(/\r?\n/)
  .filter((line) => line.startsWith("- ") && line.includes(" - "))
  .map((line) => {
    const [name, ...descriptionParts] = line.slice(2).split(" - ");
    const description = descriptionParts.join(" - ");
    return { name, group: broadGroup(description, name) };
  })
  .sort((left, right) => left.name.localeCompare(right.name));

if (entries.length !== new Set(entries.map((entry) => entry.name.toLowerCase())).size) {
  throw new Error("The reviewed exercise catalog contains duplicate names.");
}

const output = `// Generated from docs/exercise-muscle-target-review.md.\n// Run npm run generate:exercise-catalog after changing the reviewed list.\nexport const EXERCISE_PRIMARY_CATALOG = ${JSON.stringify(entries, null, 2)};\n`;
await writeFile(OUTPUT_PATH, output, "utf8");
console.log(`Generated ${entries.length} reviewed exercise classifications.`);
