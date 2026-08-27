import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { bodyBack } from "../node_modules/react-muscle-highlighter/dist/esm/assets/bodyBack.js";
import { bodyFront } from "../node_modules/react-muscle-highlighter/dist/esm/assets/bodyFront.js";

const outputPath = fileURLToPath(new URL("../app/assets/rank-muscle-map.svg", import.meta.url));

const labels = {
  arms: "Arms",
  back: "Back",
  chest: "Chest",
  core: "Core",
  legs: "Legs",
  shoulders: "Shoulders",
};

const neutralParts = new Set(["ankles", "feet", "hands", "knees"]);

const featurelessHeads = {
  front: [
    {
      id: "front_neutral_neck",
      d: "M344 218C347 242 341 264 326 284C338 299 351 307 364 311C377 307 390 299 402 284C387 264 381 242 384 218C373 226 355 226 344 218Z",
    },
    {
      id: "front_neutral_head",
      d: "M364 106C337 106 321 125 321 157C321 191 337 217 364 225C391 217 407 191 407 157C407 125 391 106 364 106Z",
    },
  ],
  back: [
    {
      id: "back_neutral_neck",
      d: "M1064 218C1067 242 1061 264 1046 284C1058 299 1071 307 1084 311C1097 307 1110 299 1122 284C1107 264 1101 242 1104 218C1093 226 1075 226 1064 218Z",
    },
    {
      id: "back_neutral_head",
      d: "M1084 106C1057 106 1041 125 1041 157C1041 191 1057 217 1084 225C1111 217 1127 191 1127 157C1127 125 1111 106 1084 106Z",
    },
  ],
};

function sideSuffix(side) {
  return side === "left" ? "l" : side === "right" ? "r" : "center";
}

function frontMeta(slug, side, index) {
  const suffix = sideSuffix(side);
  const first = index === 0;
  switch (slug) {
    case "chest":
      return { group: "chest", id: `chest_${suffix}` };
    case "deltoids":
      return { group: "shoulders", id: `deltoid_front_${suffix}` };
    case "biceps":
      return { group: "arms", id: `biceps_${suffix}` };
    case "triceps":
      return { group: "arms", id: `triceps_front_${suffix}${first ? "" : `_${index + 1}`}` };
    case "forearm":
      return { group: "arms", id: `forearm_${suffix}${first ? "" : `_${index + 1}`}` };
    case "abs": {
      const region = index === 3 ? "lower" : "upper";
      const primary = side === "left" && (index === 0 || index === 3);
      return { group: "core", id: primary ? `abs_${region}` : `abs_${region}_${suffix}_${index + 1}` };
    }
    case "obliques":
      return { group: "core", id: `obliques_${suffix}${first ? "" : `_${index + 1}`}` };
    case "trapezius":
      return { group: "back", id: `trapezius_front_${suffix}` };
    case "adductors":
      return { group: "legs", id: `adductor_front_${suffix}_${index + 1}` };
    case "quadriceps":
      return { group: "legs", id: `quad_${suffix}${first ? "" : `_${index + 1}`}` };
    case "tibialis":
      return { group: "legs", id: `tibialis_${suffix}${first ? "" : `_${index + 1}`}` };
    case "calves":
      return { group: "legs", id: `calf_${suffix}${first ? "" : `_${index + 1}`}` };
    default:
      return null;
  }
}

function backMeta(slug, side, index) {
  const suffix = sideSuffix(side);
  const first = index === 0;
  switch (slug) {
    case "deltoids":
      return { group: "shoulders", id: `deltoid_rear_${suffix}` };
    case "triceps":
      return { group: "arms", id: `triceps_${suffix}${first ? "" : `_${index + 1}`}` };
    case "forearm":
      return { group: "arms", id: `forearm_back_${suffix}${first ? "" : `_${index + 1}`}` };
    case "trapezius":
      return { group: "back", id: side === "left" ? "traps_upper" : "traps_mid" };
    case "upper-back":
      if (index === 1) return { group: "back", id: `lats_${suffix}` };
      if (side === "left" && index === 0) return { group: "back", id: "rhomboids" };
      if (side === "left" && index === 2) return { group: "back", id: "traps_lower" };
      return { group: "back", id: `upper_back_${suffix}_${index + 1}` };
    case "lower-back":
      return {
        group: "back",
        id: side === "left" && first ? "erector_spinae" : `lower_back_${suffix}_${index + 1}`,
      };
    case "gluteal":
      return { group: "legs", id: `glute_${suffix}${first ? "" : `_${index + 1}`}` };
    case "hamstring":
      return { group: "legs", id: `hamstring_${suffix}${first ? "" : `_${index + 1}`}` };
    case "calves":
      return { group: "legs", id: `calf_back_${suffix}${first ? "" : `_${index + 1}`}` };
    case "adductors":
      return { group: "legs", id: `adductor_back_${suffix}${first ? "" : `_${index + 1}`}` };
    default:
      return null;
  }
}

function titleCase(value) {
  return value.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function pathMarkup({ d, id, className, fill, group, view, label }) {
  const interaction = group
    ? ` data-muscle-group="${group}" data-view="${view}" tabindex="0" role="button" aria-pressed="false" aria-label="${label}"`
    : ' aria-hidden="true"';
  return `    <path id="${id}" class="${className}" fill="${fill}"${interaction} d="${d}"/>`;
}

function renderView(parts, view, transform, metaForPart) {
  const paths = featurelessHeads[view].map(({ d, id }) =>
    pathMarkup({ d, fill: "#27272a", id, className: "rank-map-base" }),
  );
  for (const part of parts) {
    if (part.slug === "hair" || part.slug === "head" || part.slug === "neck") continue;
    for (const [side, segments] of Object.entries(part.path)) {
      segments.forEach((d, index) => {
        const meta = metaForPart(part.slug, side, index);
        if (meta) {
          paths.push(
            pathMarkup({
              d,
              fill: "#e8e8e8",
              group: meta.group,
              id: meta.id,
              label: `${labels[meta.group]} · ${titleCase(part.slug)} · ${titleCase(side)}`,
              className: "rank-muscle-path",
              view,
            }),
          );
          return;
        }
        if (!neutralParts.has(part.slug)) return;
        paths.push(
          pathMarkup({
            d,
            fill: "#27272a",
            id: `${view}_neutral_${part.slug}_${side}_${index + 1}`,
            className: "rank-map-base",
          }),
        );
      });
    }
  }
  return `  <g id="${view}-view" transform="${transform}" stroke="#444" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">\n${paths.join("\n")}\n  </g>`;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600" role="img" aria-label="Front and back body muscle map" class="rank-body-map">
  <!-- Anatomy paths adapted from react-muscle-highlighter 1.2.0 (MIT). See THIRD_PARTY_NOTICES.md. -->
${renderView(bodyFront, "front", "translate(70 -35) scale(.43)", frontMeta)}
${renderView(bodyBack, "back", "translate(220 -35) scale(.43)", backMeta)}
</svg>
`;

await writeFile(outputPath, svg, "utf8");
console.log(`Generated ${outputPath}`);
