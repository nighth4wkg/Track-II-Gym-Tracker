import { TRACK_VERSION } from "./trackConfig";
import type { JsonValue } from "./trackTypes";
import { isStringValue, safeStorageGet, safeStorageSet } from "./trackUtils";

const CATALOG_CACHE_KEY = `track-exercise-catalog:${TRACK_VERSION}`;
const MAX_CACHED_EXERCISES = 10_000;

export function readCachedExerciseNames() {
  const raw = safeStorageGet(CATALOG_CACHE_KEY);
  if (!raw) return [];
  try {
    const parsed: JsonValue = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length > MAX_CACHED_EXERCISES) return [];
    return parsed.filter(isStringValue).filter((value) => value.trim().length > 0);
  } catch {
    return [];
  }
}

export function writeCachedExerciseNames(names: readonly string[]) {
  const normalized = names.filter((name) => name.trim().length > 0).slice(0, MAX_CACHED_EXERCISES);
  safeStorageSet(CATALOG_CACHE_KEY, JSON.stringify(normalized));
}
