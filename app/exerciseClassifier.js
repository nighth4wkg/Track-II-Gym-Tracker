import { compactSearchText, exerciseSearchScore } from "./exerciseSearch.js";
import { EXERCISE_PRIMARY_CATALOG } from "./exercisePrimaryCatalog.js";

const target = (group, weight = 1) => ({ group, weight });

/**
 * Canonical movement families used by Rank. This intentionally describes
 * broad Track regions rather than pretending to diagnose individual muscles.
 * The fuzzy matcher lets renamed, imported, and lightly misspelled exercises
 * inherit the closest movement family without requiring an exact string.
 */
const MOVEMENT_FAMILIES = [
  // Chest
  ["bench press", [target("chest"), target("shoulders", 0.35), target("arms", 0.3)]],
  ["incline bench press", [target("chest"), target("shoulders", 0.45), target("arms", 0.3)]],
  ["decline bench press", [target("chest"), target("arms", 0.3)]],
  ["chest press", [target("chest"), target("shoulders", 0.35), target("arms", 0.3)]],
  ["floor press", [target("chest"), target("arms", 0.35)]],
  ["push up", [target("chest"), target("shoulders", 0.3), target("arms", 0.35)]],
  ["chest fly", [target("chest")]],
  ["pec deck", [target("chest")]],
  ["cable crossover", [target("chest")]],
  ["chest dip", [target("chest"), target("arms", 0.65)]],
  ["spoto press", [target("chest"), target("arms", 0.3)]],
  ["larsen press", [target("chest"), target("arms", 0.3)]],

  // Back
  ["lat pulldown", [target("back"), target("arms", 0.3)]],
  ["straight arm pulldown", [target("back")]],
  ["lat prayer", [target("back")]],
  ["lat pullover", [target("back")]],
  ["keenan flap", [target("back")]],
  ["pull up", [target("back"), target("arms", 0.3)]],
  ["chin up", [target("back"), target("arms", 0.4)]],
  ["seated row", [target("back"), target("arms", 0.25)]],
  ["cable row", [target("back"), target("arms", 0.25)]],
  ["barbell row", [target("back"), target("arms", 0.25)]],
  ["dumbbell row", [target("back"), target("arms", 0.25)]],
  ["chest supported row", [target("back"), target("arms", 0.25)]],
  ["seal row", [target("back"), target("arms", 0.25)]],
  ["t bar row", [target("back"), target("arms", 0.25)]],
  ["meadows row", [target("back"), target("arms", 0.25)]],
  ["inverted row", [target("back"), target("arms", 0.25)]],
  ["rear delt fly", [target("back", 0.75), target("shoulders")]],
  ["reverse fly", [target("back", 0.75), target("shoulders")]],
  ["face pull", [target("back", 0.75), target("shoulders")]],
  ["kelso shrug", [target("back")]],
  ["shrug", [target("back")]],
  ["back extension", [target("back"), target("legs", 0.55)]],
  ["good morning", [target("legs"), target("back", 0.55)]],
  ["deadlift", [target("legs"), target("back", 0.6)]],
  ["romanian deadlift", [target("legs"), target("back", 0.45)]],

  // Shoulders
  ["shoulder press", [target("shoulders"), target("arms", 0.3)]],
  ["overhead press", [target("shoulders"), target("arms", 0.3)]],
  ["military press", [target("shoulders"), target("arms", 0.3)]],
  ["arnold press", [target("shoulders"), target("arms", 0.3)]],
  ["z press", [target("shoulders"), target("arms", 0.3)]],
  ["push press", [target("shoulders"), target("arms", 0.3), target("legs", 0.25)]],
  ["lateral raise", [target("shoulders")]],
  ["front raise", [target("shoulders")]],
  ["y raise", [target("shoulders")]],
  ["upright row", [target("shoulders"), target("back", 0.45)]],
  ["external shoulder rotation", [target("shoulders")]],
  ["internal shoulder rotation", [target("shoulders")]],
  ["cuban press", [target("shoulders")]],

  // Arms
  ["biceps curl", [target("arms")]],
  ["dumbbell curl", [target("arms")]],
  ["barbell curl", [target("arms")]],
  ["cable curl", [target("arms")]],
  ["preacher curl", [target("arms")]],
  ["recline curl", [target("arms")]],
  ["bayesian curl", [target("arms")]],
  ["hammer curl", [target("arms")]],
  ["spider curl", [target("arms")]],
  ["concentration curl", [target("arms")]],
  ["reverse curl", [target("arms")]],
  ["zottman curl", [target("arms")]],
  ["triceps pushdown", [target("arms")]],
  ["triceps extension", [target("arms")]],
  ["skull crusher", [target("arms")]],
  ["jm press", [target("arms"), target("chest", 0.3)]],
  ["bench dip", [target("arms"), target("chest", 0.4)]],
  ["triceps dip", [target("arms"), target("chest", 0.45)]],
  ["wrist curl", [target("arms")]],
  ["wrist extension", [target("arms")]],
  ["farmer carry", [target("arms", 0.7), target("core", 0.45)]],
  ["gripper", [target("arms")]],

  // Legs
  ["back squat", [target("legs")]],
  ["front squat", [target("legs")]],
  ["hack squat", [target("legs")]],
  ["belt squat", [target("legs")]],
  ["goblet squat", [target("legs")]],
  ["safety bar squat", [target("legs")]],
  ["split squat", [target("legs")]],
  ["bulgarian split squat", [target("legs")]],
  ["lunge", [target("legs")]],
  ["step up", [target("legs")]],
  ["leg press", [target("legs")]],
  ["leg extension", [target("legs")]],
  ["leg curl", [target("legs")]],
  ["nordic curl", [target("legs")]],
  ["hip thrust", [target("legs")]],
  ["glute bridge", [target("legs")]],
  ["glute kickback", [target("legs")]],
  ["hip abduction", [target("legs")]],
  ["hip adduction", [target("legs")]],
  ["calf raise", [target("legs")]],
  ["calf press", [target("legs")]],
  ["tibialis raise", [target("legs")]],
  ["wall sit", [target("legs")]],
  ["sissy squat", [target("legs")]],
  ["reverse nordic", [target("legs")]],

  // Core
  ["crunch", [target("core")]],
  ["cable crunch", [target("core")]],
  ["ab wheel rollout", [target("core")]],
  ["plank", [target("core")]],
  ["side plank", [target("core")]],
  ["sit up", [target("core")]],
  ["leg raise", [target("core")]],
  ["knee raise", [target("core")]],
  ["russian twist", [target("core")]],
  ["wood chop", [target("core")]],
  ["pallof press", [target("core")]],
  ["dead bug", [target("core")]],
  ["dragon flag", [target("core")]],
  ["hollow hold", [target("core")]],
  ["copenhagen plank", [target("core"), target("legs", 0.35)]],
];

const EQUIPMENT_WORDS = /\b(?:barbell|dumbbell|cable|machine|smith|resistance|banded|band|kettlebell|plate|bodyweight|body weight|assisted|weighted|ez bar|single arm|single leg|one arm|one handed|unilateral|bilateral|standing|seated|lying|frontal|sagittal|plane)\b/g;
const STYLE_WORDS = /\b(?:dead stop|lengthened partial|long length partial|partial|paused|pause|tempo|alternating|supported|cuffed|cuff|close grip|wide grip|neutral grip|pronated grip|supinated grip)\b/g;
const CACHE_LIMIT = 1200;
const classificationCache = new Map();

function normalizeForMatching(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\bcalves\b/g, "calf")
    .replace(/\btricep\b/g, "triceps")
    .replace(/\bbicep\b/g, "biceps")
    .replace(/\bpulldowns\b/g, "pulldown")
    .replace(/\bpush ups\b/g, "push up")
    .replace(/\bpull ups\b/g, "pull up")
    .replace(/\bchin ups\b/g, "chin up")
    .replace(/\brows\b/g, "row")
    .replace(/\bcurls\b/g, "curl")
    .replace(/\braises\b/g, "raise")
    .replace(/\bextensions\b/g, "extension")
    .replace(/\blunges\b/g, "lunge")
    .replace(/\bkicks\b/g, "kick")
    .replace(/\bpumps\b/g, "pump")
    .replace(/\bslams\b/g, "slam")
    .replace(/\bropes\b/g, "rope")
    .replace(/\bflyes\b/g, "fly")
    .replace(/\bclimbers\b/g, "climber")
    .replace(EQUIPMENT_WORDS, " ")
    .replace(STYLE_WORDS, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeCatalogKey(value) {
  return compactSearchText(String(value ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\bcalves\b/g, "calf")
    .replace(/\btricep\b/g, "triceps")
    .replace(/\bbicep\b/g, "biceps")
    .replace(/\bflyes\b/g, "fly")
    .replace(/\bcurls\b/g, "curl")
    .replace(/\braises\b/g, "raise")
    .replace(/\bextensions\b/g, "extension"));
}

const REVIEWED_EXERCISES = EXERCISE_PRIMARY_CATALOG.map((entry) => ({
  ...entry,
  key: normalizeCatalogKey(entry.name),
}));
const REVIEWED_EXERCISE_BY_KEY = new Map(REVIEWED_EXERCISES.map((entry) => [entry.key, entry]));

function reviewedMovement(entry, score = 0) {
  return {
    canonical: entry.name,
    targets: [target(entry.group)],
    confidence: confidenceFromScore(score),
    score,
    source: score === 0 ? "reviewed" : "reviewed-fuzzy",
  };
}

function findReviewedMovement(name) {
  const key = normalizeCatalogKey(name);
  if (!key) return null;
  const exact = REVIEWED_EXERCISE_BY_KEY.get(key);
  if (exact) return reviewedMovement(exact);

  let best = null;
  for (const entry of REVIEWED_EXERCISES) {
    const score = exerciseSearchScore(entry.name, String(name ?? ""));
    if (!Number.isFinite(score)) continue;
    if (!best || score < best.score || (score === best.score && entry.name.length < best.entry.name.length)) {
      best = { entry, score };
    }
  }
  return best && best.score <= 4.6 ? reviewedMovement(best.entry, best.score) : null;
}

const UNILATERAL_PHRASES = [
  "unilateral",
  "single arm",
  "single leg",
  "single hand",
  "one arm",
  "one leg",
  "one hand",
  "1 arm",
  "1 leg",
  "1 hand",
];

/**
 * Detect one-sided movements without requiring perfect spelling. Exact phrase
 * checks handle normal names, while short token windows catch imported names
 * such as "unilatral curl" or "singel arm pulldown". Bilateral is explicitly
 * excluded so it can never be mistaken for unilateral.
 */
export function detectUnilateralExercise(name) {
  const raw = String(name ?? "").normalize("NFKD").toLowerCase().replace(/[\u0300-\u036f]/g, "");
  if (/\bbilateral\b/.test(raw)) return false;
  const normalized = raw.replace(/[^a-z0-9]+/g, " ").trim();
  if (!normalized) return false;
  const compact = compactSearchText(normalized);
  if (UNILATERAL_PHRASES.some((phrase) => compact.includes(compactSearchText(phrase)))) return true;

  const tokens = normalized.split(/\s+/).filter(Boolean);
  const candidates = new Set(tokens);
  for (let index = 0; index < tokens.length - 1; index += 1) candidates.add(`${tokens[index]} ${tokens[index + 1]}`);
  return UNILATERAL_PHRASES.some((phrase) => {
    const phraseTokens = phrase.split(" ").length;
    for (const candidate of candidates) {
      if (candidate.split(" ").length !== phraseTokens) continue;
      if (exerciseSearchScore(phrase, candidate) <= (phraseTokens === 1 ? 3.5 : 2.75)) return true;
    }
    return false;
  });
}

function confidenceFromScore(score) {
  if (score <= 0) return 1;
  if (score <= 1) return 0.97;
  if (score <= 2.4) return 0.91;
  if (score <= 3.9) return 0.82;
  if (score <= 5.5) return 0.72;
  return 0;
}

function includesMovement(value, pattern) {
  return pattern.test(` ${value} `);
}

/**
 * Explicit wording supplied by the user must beat fuzzy catalog matches.
 * These guards intentionally run before the reviewed-catalog lookup: a name
 * such as "Sagittal Shoulder Press (Upper Chest)" is otherwise close enough
 * to a normal shoulder press for the fuzzy matcher to erase "Upper Chest".
 */
function priorityMovementMatch(name) {
  const movement = normalizeForMatching(name);
  if (!movement) return null;
  const rawMovementKey = normalizeCatalogKey(name);

  // Equipment is part of the movement identity for strength ranking. Without
  // this guard, custom names such as "Machine Curl (Dead Stop, Unilateral)"
  // can be fuzzy-matched to Dumbbell Curl and inherit an invalid free-weight
  // benchmark.
  if (
    rawMovementKey.includes("machine")
    && includesMovement(movement, /\bjm press\b/)
  ) {
    return { canonical: "machine jm press", targets: [target("arms"), target("chest", 0.3)], confidence: 0.99, score: 0.1, source: "equipment-priority" };
  }

  if (
    rawMovementKey.includes("machine")
    && includesMovement(movement, /\b(?:curl|biceps curl)\b/)
    && !includesMovement(movement, /\b(?:leg curl|hamstring curl)\b/)
  ) {
    return { canonical: "machine curl", targets: [target("arms")], confidence: 0.99, score: 0.1, source: "equipment-priority" };
  }

  if (includesMovement(movement, /\b(?:rear delt|rear delts|reverse fly|reverse pec deck|face pull|pull apart)\b/)) {
    return { canonical: movement, targets: [target("shoulders"), target("back", 0.75)], confidence: 0.99, score: 0.1, source: "semantic-priority" };
  }

  if (
    rawMovementKey.includes("upperchest")
    && includesMovement(movement, /\b(?:press|fly|raise)\b/)
  ) {
    return { canonical: movement, targets: [target("chest"), target("shoulders", 0.55), target("arms", 0.3)], confidence: 0.99, score: 0.1, source: "semantic-priority" };
  }

  return null;
}

function semanticMovementMatch(name) {
  const movement = normalizeForMatching(name);
  if (!movement) return null;

  // Collision guards must run before broad words such as "fly", "curl",
  // "extension", "press", or "chest". They keep the primary target stable
  // for renamed/imported exercises that do not exactly match the catalog.
  if (includesMovement(movement, /\b(?:shoulder press|overhead press|military press|arnold press|z press|push press|landmine press|behind the neck press)\b/)) {
    return { canonical: movement, targets: [target("shoulders"), target("arms", 0.3)], confidence: 0.97, score: 0.2, source: "semantic-priority" };
  }
  if (includesMovement(movement, /\b(?:leg curl|leg extension|nordic curl|reverse nordic)\b/)) {
    return { canonical: movement, targets: [target("legs")], confidence: 0.97, score: 0.2, source: "semantic-priority" };
  }
  if (includesMovement(movement, /\b(?:back extension|hyperextension)\b/)) {
    return { canonical: movement, targets: [target("back"), target("legs", 0.55)], confidence: 0.97, score: 0.2, source: "semantic-priority" };
  }

  const targets = new Map();
  const add = (group, weight = 1) => targets.set(group, Math.max(targets.get(group) ?? 0, weight));

  // Explosive full-body movements need to be recognized before their smaller
  // words (for example, "press") are considered independently.
  if (includesMovement(movement, /\b(?:clean|snatch|jerk|muscle up|burpee|devils press|ground to overhead|ball slam|battle rope|complex|swing|turkish get up)\b/)) {
    add("legs"); add("back", 0.75); add("shoulders", 0.65); add("arms", 0.35); add("core", 0.45);
  }

  if (includesMovement(movement, /\b(?:chest|pec|bench press|board press|pin press|floor press|push up|push ups|dip|fly|crossover|spoto press|larsen press)\b/)) {
    add("chest");
    if (includesMovement(movement, /\b(?:press|push up|dip)\b/)) { add("shoulders", 0.35); add("arms", 0.35); }
  }

  if (includesMovement(movement, /\b(?:lat|pulldown|pull down|pull up|chin up|row|rowing|pullover|prayer|keenan flap|rear delt|reverse fly|face pull|pull apart|shrug|back extension|hyperextension|superman|scap pull|block pull|rack pull|high pull)\b/)) {
    add("back");
    if (includesMovement(movement, /\b(?:pulldown|pull down|pull up|chin up|row)\b/)) add("arms", 0.3);
  }

  if (includesMovement(movement, /\b(?:shoulder|delt|rotator cuff|external rotation|internal rotation|overhead press|military press|arnold press|landmine press|meadows press|behind the neck press|lateral raise|front raise|front hold|lu raise|y raise|upright row|monkey row|cuban press|handstand push up|halo|neck bridge)\b/)) {
    add("shoulders");
    if (includesMovement(movement, /\b(?:press|push up)\b/)) add("arms", 0.3);
  }

  if (includesMovement(movement, /\b(?:curl|biceps|triceps|pushdown|push down|skull crusher|tate press|jm press|wrist|forearm|gripper|bar hang|farmer|farmers|carry|wrist roller)\b/)) {
    add("arms");
  }

  if (includesMovement(movement, /\b(?:squat|lunge|deadlift|leg press|leg extension|leg curl|hamstring|nordic|hip|glute|calf|heel|tibialis|step up|stepup|wall sit|sissy|poliquin|cossack|sled|jump|cycling|bike|running|walking|elliptical|side kick|clamshell|clamshells|fire hydrant|fire hydrants|frog pump|donkey kick|lateral bound|lateral walk|pull through|death march|prisoner get up)\b/)) {
    add("legs");
    if (includesMovement(movement, /\b(?:deadlift|good morning|back extension|hyperextension)\b/)) add("back", 0.5);
  }

  if (includesMovement(movement, /\b(?:ab |abs |crunch|plank|sit up|rollout|roll out|leg raise|knee raise|russian twist|wood chop|pallof|dead bug|dragon flag|hollow|windshield wiper|side bend|core twist|toe touch|mountain climber|jackknife|windmill|landmine rotation)\b/)) {
    add("core");
  }

  if (!targets.size) return null;
  return {
    canonical: movement,
    targets: [...targets].map(([group, weight]) => target(group, weight)),
    confidence: 0.94,
    score: 0.5,
    source: "semantic",
  };
}

function findClosestMovement(name) {
  const normalized = normalizeForMatching(name);
  if (!normalized) return null;

  const priority = priorityMovementMatch(name);
  if (priority) return priority;

  // The reviewed catalog is the source of truth for every exercise shipped
  // with Track. This prevents generic word collisions from changing a known
  // exercise's primary muscle group.
  const reviewed = findReviewedMovement(name);
  if (reviewed) return reviewed;

  // Prefer the curated movement family before broader semantic keywords.
  // Without this pass, names such as "Leg Curl" also match the generic
  // arm keyword "curl" and can be credited to the wrong primary region.
  const compactNormalized = compactSearchText(normalized);
  const exactFamily = MOVEMENT_FAMILIES.find(([canonical]) => (
    compactSearchText(normalizeForMatching(canonical)) === compactNormalized
  ));
  if (exactFamily) {
    return {
      canonical: exactFamily[0],
      targets: exactFamily[1],
      confidence: 1,
      score: 0,
      source: "exact",
    };
  }

  const semantic = semanticMovementMatch(name);
  if (semantic) return semantic;

  let best = null;
  const inputTokens = normalized.split(/\s+/).filter(Boolean);
  for (const [canonical, targets] of MOVEMENT_FAMILIES) {
    const normalizedCanonical = normalizeForMatching(canonical);
    const canonicalTokenCount = normalizedCanonical.split(/\s+/).filter(Boolean).length;
    const candidates = new Set([normalized]);
    // Imported and user-renamed exercises often contain extra descriptors.
    // Compare the known movement against nearby token windows as well as the
    // full name, so "my latpulldwn imported" can still match lat pulldown.
    for (let windowSize = Math.max(1, canonicalTokenCount - 1); windowSize <= Math.min(inputTokens.length, canonicalTokenCount + 1); windowSize += 1) {
      for (let start = 0; start + windowSize <= inputTokens.length; start += 1) {
        candidates.add(inputTokens.slice(start, start + windowSize).join(" "));
      }
    }
    let score = Number.POSITIVE_INFINITY;
    for (const candidate of candidates) {
      const exactCompact = compactSearchText(candidate) === compactSearchText(normalizedCanonical);
      const candidateScore = exactCompact ? 0 : exerciseSearchScore(normalizedCanonical, candidate);
      if (candidateScore < score) score = candidateScore;
    }
    if (!Number.isFinite(score)) continue;
    if (!best || score < best.score) best = { canonical, targets, score };
  }

  if (!best || best.score > 5.5) return null;
  return { ...best, confidence: confidenceFromScore(best.score), source: best.score === 0 ? "exact" : "fuzzy" };
}

/**
 * Cached exercise detection. A name is scanned once per app session. Editing
 * the name produces a different normalized cache key and triggers one new scan.
 */
export function detectExerciseTargets(name) {
  const key = compactSearchText(String(name ?? ""));
  if (!key) return { targets: [], matchedName: "", confidence: 0, source: "unmatched", unilateral: false };
  const cached = classificationCache.get(key);
  if (cached) return cached;

  const match = findClosestMovement(name);
  const unilateral = detectUnilateralExercise(name);
  const result = match
    ? { targets: match.targets.map((item) => ({ ...item })), matchedName: match.canonical, confidence: match.confidence, source: match.source ?? (match.score === 0 ? "exact" : "fuzzy"), unilateral }
    : { targets: [], matchedName: "", confidence: 0, source: "unmatched", unilateral };

  if (classificationCache.size >= CACHE_LIMIT) classificationCache.clear();
  classificationCache.set(key, result);
  return result;
}

export function clearExerciseDetectionCache() {
  classificationCache.clear();
}

export function exerciseDetectionCacheSize() {
  return classificationCache.size;
}
