const exerciseSearchAliases = {
  bb: "barbell",
  bw: "bodyweight",
  db: "dumbbell",
  kb: "kettlebell",
  ohp: "overheadpress",
  rdl: "romaniandeadlift",
};

export function compactSearchText(value) {
  return value.normalize("NFKD").toLowerCase().replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "")
    .replace(/dumbells?/g, "dumbbell")
    .replace(/barbels?/g, "barbell")
    .replace(/kettlebel(l?)/g, "kettlebell");
}

function exerciseSearchTokens(value) {
  return value.normalize("NFKD").toLowerCase().replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .map(compactSearchText)
    .filter(Boolean)
    .map((token) => exerciseSearchAliases[token] ?? token);
}

function editDistance(left, right) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
}

function letterSkeleton(value) {
  if (value.length <= 2) return value;
  return `${value[0]}${value.slice(1).replace(/[aeiou]/g, "")}`;
}

function orderedSequenceScore(query, candidate) {
  if (query.length < 4 || query.length > candidate.length) return Number.POSITIVE_INFINITY;

  let queryIndex = 0;
  let firstMatch = -1;
  let lastMatch = -1;
  let longestGap = 0;
  for (let candidateIndex = 0; candidateIndex < candidate.length && queryIndex < query.length; candidateIndex += 1) {
    if (candidate[candidateIndex] !== query[queryIndex]) continue;
    if (firstMatch < 0) firstMatch = candidateIndex;
    if (lastMatch >= 0) longestGap = Math.max(longestGap, candidateIndex - lastMatch - 1);
    lastMatch = candidateIndex;
    queryIndex += 1;
  }

  if (queryIndex !== query.length) return Number.POSITIVE_INFINITY;
  const coverage = query.length / candidate.length;
  if (coverage < 0.55 || firstMatch > 2 || longestGap > 3) return Number.POSITIVE_INFINITY;
  return (1 - coverage) + firstMatch / 10 + longestGap / 20;
}

function exerciseTokenScore(queryToken, candidateToken) {
  if (candidateToken === queryToken) return 0;
  if (candidateToken.startsWith(queryToken)) return 1;
  if (candidateToken.includes(queryToken)) return 2;
  if (queryToken.length < 4) return Number.POSITIVE_INFINITY;
  const tolerance = queryToken.length >= 8 ? 2 : 1;
  if (editDistance(candidateToken, queryToken) <= tolerance) return 3;

  const querySkeleton = letterSkeleton(queryToken);
  const candidateSkeleton = letterSkeleton(candidateToken);
  const skeletonTolerance = querySkeleton.length >= 7 ? 2 : 1;
  if (querySkeleton.length >= 4 && editDistance(candidateSkeleton, querySkeleton) <= skeletonTolerance) return 3.4;

  const sequenceScore = orderedSequenceScore(queryToken, candidateToken);
  return Number.isFinite(sequenceScore) ? 3.6 + sequenceScore : Number.POSITIVE_INFINITY;
}

export function exerciseSearchScore(name, input) {
  const rawQuery = input.trim().toLowerCase();
  const queryTokens = exerciseSearchTokens(input);
  if (!rawQuery || queryTokens.length === 0) return Number.POSITIVE_INFINITY;

  const rawName = name.toLowerCase();
  const candidateTokens = exerciseSearchTokens(name);
  const compactName = compactSearchText(name);
  const compactQuery = queryTokens.join("");

  if (rawName.startsWith(rawQuery)) return 0;
  if (compactName.startsWith(compactQuery)) return 1;

  const tokenScores = queryTokens.map((queryToken) => Math.min(
    ...candidateTokens.map((candidateToken) => exerciseTokenScore(queryToken, candidateToken)),
  ));
  if (tokenScores.every(Number.isFinite)) return 2 + tokenScores.reduce((sum, score) => sum + score, 0) / 10;
  if (compactName.includes(compactQuery)) return 3;

  const tolerance = compactQuery.length >= 9 ? 2 : compactQuery.length >= 5 ? 1 : 0;
  if (tolerance > 0 && editDistance(compactName, compactQuery) <= tolerance) return 4;

  const compactSkeleton = letterSkeleton(compactName);
  const querySkeleton = letterSkeleton(compactQuery);
  const skeletonTolerance = querySkeleton.length >= 7 ? 2 : 1;
  if (querySkeleton.length >= 4 && editDistance(compactSkeleton, querySkeleton) <= skeletonTolerance) return 4.3;

  const sequenceScore = orderedSequenceScore(compactQuery, compactName);
  return Number.isFinite(sequenceScore) ? 4.5 + sequenceScore : Number.POSITIVE_INFINITY;
}
