import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { exerciseSearchScore } from "../app/exerciseSearch.js";
import {
  clearExerciseDetectionCache,
  detectExerciseTargets,
  exerciseDetectionCacheSize,
} from "../app/exerciseClassifier.js";
import { EXERCISE_PRIMARY_CATALOG } from "../app/exercisePrimaryCatalog.js";

const root = new URL("../", import.meta.url);

const read = (relativePath) => readFile(new URL(relativePath, root), "utf8");

const withSourceVariants = (source) => {
  const collapsed = source.replace(/\s+/g, " ").trim();
  const compactMemberAccess = collapsed.replace(/\s*\.\s*/g, ".");
  return `${source}\n${collapsed}\n${compactMemberAccess}`;
};

const readSourceBundle = async (paths) => withSourceVariants((await Promise.all(paths.map(read))).join("\n"));

const readPageSource = async () =>
  readSourceBundle([
    "app/page.tsx",
    "app/TrackApp.tsx",
    "app/TrackAppCore.tsx",
    "app/components/TrackAppShell.tsx",
    "app/components/TrackAppView.tsx",
    "app/trackViewSelectors.ts",
    "app/hooks/useTrackAppLifecycle.ts",
    "app/hooks/useTrackAppRuntimeLifecycle.ts",
    "app/hooks/useTrackBootstrapLifecycle.ts",
    "app/hooks/useTrackCloudLifecycle.ts",
    "app/hooks/useTrackIdentityLifecycle.ts",
    "app/hooks/useTrackPreferencesLifecycle.ts",
    "app/hooks/useTrackTimerLifecycle.ts",
    "app/hooks/useTrackUiLifecycle.ts",
    "app/hooks/useTrackAppInteractions.ts",
    "app/hooks/useTrackAppRuntime.ts",
    "app/hooks/useTrackAppLocalState.ts",
    "app/hooks/useTrackAppWorkoutActions.ts",
    "app/hooks/useTrackExportActions.ts",
    "app/hooks/useWorkoutFinishAction.ts",
    "app/hooks/useWorkoutImportActions.ts",
  ]);

const readCssSource = async () => {
  const source = (
    await Promise.all(
      [
        "app/globals.css",
        "app/styles/base.css",
        "app/styles/components.css",
        "app/styles/pages.css",
        "app/styles/responsive.css",
        "app/styles/polish.css",
      ].map(read),
    )
  ).join("\n");
  const collapsed = source.replace(/\s+/g, " ").trim();
  const canonicalSelectors = collapsed
    .replace(/\s*\{\s*/g, " { ")
    .replace(/\s*\}\s*/g, " } ")
    .replace(/\s*:\s*/g, ":")
    .replace(/\s*;\s*/g, "; ")
    .replace(/([ (,:])0\.(?=\d)/g, "$1.")
    .trim();
  const canonical = canonicalSelectors
    .replace(/\s*,\s*/g, ",")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .trim();
  const canonicalFunctions = (() => {
    let depth = 0;
    let result = "";
    for (let index = 0; index < canonicalSelectors.length; index += 1) {
      const character = canonicalSelectors[index];
      if (character === "(") depth += 1;
      if (character === ")") depth = Math.max(0, depth - 1);
      if (character === "," && depth > 0) {
        result += character;
        while (/\s/.test(canonicalSelectors[index + 1] ?? "")) index += 1;
        continue;
      }
      result += character;
    }
    return result.replace(/\(\s+/g, "(").replace(/\s+\)/g, ")").trim();
  })();
  return `${source}\n${collapsed}\n${canonicalSelectors}\n${canonical}\n${canonicalFunctions}`;
};

const readRankSource = async () =>
  readSourceBundle(["app/rankData.ts", "app/rankModels.ts", "app/rankBenchmarks.ts", "app/rankScoring.ts"]);

const readAppSource = async () => {
  const paths = [
    "app/page.tsx",
    "app/TrackApp.tsx",
    "app/TrackAppCore.tsx",
    "app/components/TrackAppShell.tsx",
    "app/components/TrackAppView.tsx",
    "app/hooks/useTrackAppLifecycle.ts",
    "app/components/BottomTabBar.tsx",
    "app/components/SettingsNavigation.tsx",
    "app/components/SettingsViewContent.tsx",
    "app/components/SettingsAiImportView.tsx",
    "app/components/SettingsStandardViews.tsx",
    "app/components/SettingsSpecialViews.tsx",
    "app/components/createSettingsContextValue.ts",
    "app/components/createWorkoutEditorContextValue.ts",
    "app/components/ScrollShortcuts.tsx",
    "app/trackConstants.ts",
    "app/trackConfig.ts",
    "app/trackTypes.ts",
    "app/trackUtils.ts",
    "app/trackViewSelectors.ts",
    "app/data/trackApi.ts",
    "app/hooks/useBottomTabNavigation.ts",
    "app/hooks/useTrackCloudSync.ts",
    "app/hooks/useTrackRealtimeSync.ts",
    "app/hooks/useTrackAccountActions.ts",
    "app/hooks/useTrackLocalSnapshot.ts",
    "app/hooks/useWorkoutDateSync.ts",
    "app/hooks/useTimerActions.ts",
    "app/hooks/useSidebarGestures.ts",
    "app/hooks/useSplitReorderGesture.ts",
    "app/components/AccountPromptModals.tsx",
    "app/components/WorkspaceContent.tsx",
    "app/hooks/useTrackBootstrapLifecycle.ts",
    "app/hooks/useTrackCloudLifecycle.ts",
    "app/hooks/useTrackIdentityLifecycle.ts",
    "app/hooks/useTrackPreferencesLifecycle.ts",
    "app/hooks/useTrackTimerLifecycle.ts",
    "app/hooks/useTrackUiLifecycle.ts",
    "app/hooks/useTrackAppInteractions.ts",
    "app/hooks/useTrackAppRuntime.ts",
    "app/hooks/useTrackAppLocalState.ts",
    "app/hooks/useTrackAppRuntimeLifecycle.ts",
    "app/hooks/useTrackAppWorkoutActions.ts",
    "app/hooks/useTrackExportActions.ts",
    "app/hooks/useWorkoutFinishAction.ts",
    "app/hooks/useWorkoutImportActions.ts",
  ];
  return readSourceBundle(paths);
};

test("Track source exposes the shared app and current release", async () => {
  const [page, api, syncHook, layout, packageJson, trackConfig, pagesEntry] = await Promise.all([
    readPageSource(),
    read("app/data/trackApi.ts"),
    read("app/hooks/useTrackCloudSync.ts"),
    read("app/layout.tsx"),
    read("package.json"),
    read("app/trackConfig.ts"),
    read("cloudflare/index.html"),
  ]);

  assert.match(page, /export default function Home\(\)/);
  assert.match(trackConfig, /export const TRACK_VERSION = "__TRACK_VERSION__"/);
  assert.match(packageJson, /"version": "1\.0\.5"/);
  assert.match(await read("vite.pages.config.ts"), /output\.code = replaceBuildTokens\(output\.code\)/);
  assert.match(api, /save_track_state/);
  assert.match(syncHook, /useTrackLocalSnapshot/);
  assert.match(api, /workout_sessions/);
  assert.match(api, /workout_set_logs/);
  assert.match(layout, /title: "Track II"/);
  assert.doesNotMatch(layout, /Lifting session tracker/);
  assert.match(pagesEntry, /<title>Track II<\/title>/);
  assert.doesNotMatch(pagesEntry, /Lifting session tracker/);
  assert.match(layout, /apple-touch-icon\.png/);
  assert.match(packageJson, /"name": "track-lifting"/);
  assert.match(packageJson, /"build:pages"/);
});

test("calendar deletes converge quickly and loading states use skeletons", async () => {
  const [page, calendar, skeleton, sharedSkeletons, css, syncHook, dateSync, workspaceContent] = await Promise.all([
    readPageSource(),
    readSourceBundle(["app/components/CalendarScreen.tsx", "app/components/CalendarDetailModal.tsx"]),
    read("app/components/TimerScreenSkeleton.tsx"),
    read("app/components/LoadingSkeletons.tsx"),
    readCssSource(),
    read("app/hooks/useTrackCloudSync.ts"),
    read("app/hooks/useWorkoutDateSync.ts"),
    read("app/components/WorkspaceContent.tsx"),
  ]);
  const syncSource = `${page}\n${syncHook}\n${dateSync}\n${workspaceContent}`;

  assert.match(syncSource, /workout-delete-pending/);
  assert.match(syncSource, /workout-deleted/);
  assert.match(syncSource, /workout-restored/);
  assert.match(dateSync, /const tombstones = useRef/);
  assert.match(dateSync, /workoutDateReadRevision/);
  assert.match(syncSource, /removeWorkoutDate\(dateKey, true\)/);
  assert.match(calendar, /<CalendarDetailSkeleton \/>/);
  assert.match(workspaceContent, /<RankScreenSkeleton \/>/);
  assert.match(workspaceContent, /<WorkoutScreenSkeleton \/>/);
  assert.match(workspaceContent, /fallback=\{<TimerScreenSkeleton \/>\}/);
  assert.doesNotMatch(page, /Loading Timer…/);
  assert.match(skeleton, /aria-label="Loading timer"/);
  assert.match(sharedSkeletons, /export function AppLoadingSkeleton/);
  assert.match(sharedSkeletons, /export function CalendarDetailSkeleton/);
  assert.match(sharedSkeletons, /export function AdminDirectorySkeleton/);
  assert.match(css, /\.loading-skeleton-block/);
  assert.match(css, /\.workout-screen-skeleton/);
  assert.match(css, /\.calendar-detail-skeleton/);
});

test("web release packaging uses unique names and preserves a rollback archive", async () => {
  const [packageJson, packagingScript, readme, gitignore] = await Promise.all([
    read("package.json"),
    read("scripts/package-pages-release.ps1"),
    read("README.md"),
    read(".gitignore"),
  ]);

  assert.match(packageJson, /"package:pages:release"/);
  assert.match(packagingScript, /Track-II-web-v\$version-build-\$BuildStamp\.zip/);
  assert.match(packagingScript, /Track-II-web-v\$version-rollback-\$BuildStamp\.zip/);
  assert.match(packagingScript, /Refusing to overwrite an existing release artifact/);
  assert.match(readme, /previous\s+verified web build/);
  assert.match(gitignore, /\/release-artifacts\//);
});

test("exercise search supports short equipment aliases, partial words, and typos", async () => {
  const [page, search] = await Promise.all([readPageSource(), read("app/exerciseSearch.js")]);

  assert.match(search, /db: "dumbbell"/);
  assert.match(search, /bb: "barbell"/);
  assert.match(search, /orderedSequenceScore/);
  assert.match(search, /letterSkeleton/);
  assert.match(page, /buildExerciseSuggestions/);
  assert.match(page, /exerciseSearchScore\(name, query\)/);

  assert.ok(Number.isFinite(exerciseSearchScore("Lat Pulldown", "ltpldwn")));
  assert.ok(Number.isFinite(exerciseSearchScore("Lat Pulldown", "latpullodwn")));
  assert.ok(Number.isFinite(exerciseSearchScore("Dumbbell Bench Press", "db bench")));
  assert.ok(Number.isFinite(exerciseSearchScore("Barbell Curl", "bb curl")));
  assert.equal(exerciseSearchScore("Chest Fly", "ltpldwn"), Number.POSITIVE_INFINITY);
  assert.ok(exerciseSearchScore("Lat Pulldown", "lat pull") < exerciseSearchScore("Lat Pulldown", "ltpldwn"));
});

test("exercise search suggestions fill the composer and use an add affordance", async () => {
  const [workout, css] = await Promise.all([read("app/components/WorkoutPage.tsx"), readCssSource()]);

  assert.match(workout, /className="suggestions" role="listbox"/);
  assert.match(workout, /className="suggestion-icon" aria-hidden="true">\s*\+\s*</);
  assert.doesNotMatch(workout, /↗/);
  assert.match(
    css,
    /\.suggestions \{[\s\S]*?z-index:\s*140;[\s\S]*?top:\s*calc\(100%\s*\+\s*8px\);[\s\S]*?right:\s*0;[\s\S]*?left:\s*0;[\s\S]*?width:\s*auto;/,
  );
  assert.match(css, /\.suggestions \{[\s\S]*?box-shadow:\s*0 24px 52px rgba\(0,\s*0,\s*0,?\.?34\)/);
});

test("beta UX surfaces expose concise summaries and useful empty states", async () => {
  const [workout, calendar, rank, base, css] = await Promise.all([
    read("app/components/WorkoutPage.tsx"),
    Promise.all([read("app/components/CalendarScreen.tsx"), read("app/components/CalendarMonthOverview.tsx")]).then(
      (sources) => sources.join("\n"),
    ),
    read("app/components/RankScreen.tsx"),
    read("app/styles/base.css"),
    readCssSource(),
  ]);

  assert.doesNotMatch(workout, /workout-session-summary|workout-progress-track|role="progressbar"/);
  assert.match(workout, /quickPickExercises/);
  assert.match(workout, /className="empty-action ui-button ui-button-secondary"/);
  assert.match(await read("app/trackConstants.ts"), /POPULAR_QUICK_PICK_EXERCISES/);
  assert.match(calendar, /className="calendar-insight-strip"/);
  assert.match(calendar, /className="calendar-empty-note ui-empty"/);
  assert.match(rank, /className="rank-insight-strip"/);
  assert.match(rank, /className="rank-empty-note"/);
  assert.match(base, /var\(--font-geist-sans\),[\s\S]*?-apple-system,[\s\S]*?BlinkMacSystemFont/);
  assert.match(base, /-webkit-font-smoothing: antialiased/);
  assert.match(css, /\.calendar-insight-card,[\s\S]*?\.rank-insight-card/);
});

test("Dashboard exposes timeframe inspection, progression, volume guidance, and stable settings overlays", async () => {
  const [dashboard, activityGraph, workspace, settings, standardSettings, aiSettings, sync, css] = await Promise.all([
    read("app/components/DashboardScreen.tsx"),
    read("app/components/DashboardActivityGraph.tsx"),
    read("app/components/WorkspaceContent.tsx"),
    read("app/components/SettingsViewContent.tsx"),
    read("app/components/SettingsStandardViews.tsx"),
    read("app/components/SettingsAiImportView.tsx"),
    read("app/components/SettingsProgressSync.tsx"),
    readCssSource(),
  ]);

  assert.match(
    workspace,
    /lazy\(async \(\) => \(\{ default: \(await import\("\.\/DashboardScreen"\)\)\.DashboardScreen \}\)\)/,
  );
  assert.match(dashboard, /Last week/);
  assert.match(dashboard, /Last month/);
  assert.match(dashboard, /Year to date/);
  assert.match(dashboard, /All time/);
  assert.match(dashboard, /useState<DashboardTimeframe>\("week"\)/);
  assert.match(activityGraph, /Hold and slide across the graph/);
  assert.match(activityGraph, /preserveAspectRatio="none"/);
  assert.match(activityGraph, /<rect/);
  assert.match(activityGraph, /dashboard-activity-bar-track/);
  assert.match(activityGraph, /REFERENCE_COUNT = 4/);
  assert.match(activityGraph, /gridTemplateColumns/);
  assert.match(activityGraph, /H\$\{VIEWBOX_WIDTH - HORIZONTAL_INSET\}/);
  assert.doesNotMatch(activityGraph, /<polyline/);
  assert.match(activityGraph, /top: `\$\{\(geometry\.yFor\(activePoint\.count\) \/ VIEWBOX_HEIGHT\) \* 100\}%`/);
  assert.match(dashboard, /titleCase\(item\.group\)/);
  assert.match(dashboard, /Recent PRs &amp; lifts/);
  assert.match(dashboard, /Weekly sets by muscle/);
  assert.match(dashboard, /last 7 days/);
  assert.match(dashboard, /all-time-volume/);
  assert.match(dashboard, /Volume load/);
  assert.match(dashboard, /average per workout/);
  assert.match(dashboard, /total across all workouts/);
  assert.match(dashboard, /dashboard-volume-delta/);
  assert.match(dashboard, /formatVolumeDelta/);
  assert.match(dashboard, /activityWorkoutCount === 1 \? "workout" : "workouts"/);
  assert.match(settings, /SettingsStandardViews/);
  assert.match(standardSettings, /case "appearance"/);
  assert.match(standardSettings, /case "account"/);
  assert.match(aiSettings, /const updateSet/);
  assert.match(sync, /createPortal/);
  assert.match(css, /--track-layer-critical:\s*3200/);
  assert.match(css, /\.progress-sync-backdrop \{[\s\S]*?z-index:\s*var\(--track-layer-critical\)/);
  assert.match(css, /\.dashboard-screen,[\s\S]*?padding:\s*0/);
  assert.match(css, /\.dashboard-stat-grid article \{[\s\S]*?height: 128px;[\s\S]*?padding: 16px/);
  assert.match(css, /\.dashboard-stat-grid strong\.baseline \{[\s\S]*?font-size: 22px/);
  assert.match(css, /\.content:has\(\.dashboard-screen\) \{[\s\S]*?padding-bottom: calc\(112px/);
  assert.match(css, /\.dashboard-progress-feed > div > i \{[\s\S]*?background:\s*var\(--track-accent-success\)/);
});

test("release notes stay external and the web app has no Changelog tab", async () => {
  const [page, config, notes] = await Promise.all([
    readPageSource(),
    read("app/trackConfig.ts"),
    read("release-notes/v1.0.md"),
  ]);

  assert.doesNotMatch(page, /changelog|trackChangelog/i);
  assert.doesNotMatch(config, /changelog|trackChangelog/i);
  assert.match(notes, /distributed database-backed limiter/i);
  assert.match(notes, /native/i);
});

test("release metadata keeps web and native package versions aligned", async () => {
  const [trackConfig, packageJson, packageLock, notes] = await Promise.all([
    read("app/trackConfig.ts"),
    read("package.json"),
    read("package-lock.json"),
    read("release-notes/v1.0.md"),
  ]);

  assert.match(trackConfig, /export const TRACK_VERSION = "__TRACK_VERSION__"/);
  assert.match(packageJson, /"version": "1\.0\.5"/);
  assert.match(packageLock, /"version": "1\.0\.5"/);
  assert.match(notes, /Track II v1\.0/);
  assert.match(notes, /distributed database-backed limiter/);
  assert.match(packageJson, /"@capacitor\/core": "\^8/);
  assert.match(packageJson, /"@capacitor\/haptics": "\^8/);
  assert.match(packageJson, /"@capacitor\/local-notifications": "\^8/);
  assert.match(packageJson, /"package:pages:release"/);
});

test("Rank is wired to current task data and has responsive styles", async () => {
  const [page, workspaceContent, navigationState, rank, rankScreen, rankBodyMap, css] = await Promise.all([
    readPageSource(),
    read("app/components/WorkspaceContent.tsx"),
    read("app/hooks/useNavigationState.ts"),
    readRankSource(),
    read("app/components/RankScreen.tsx"),
    read("app/components/RankBodyMap.tsx"),
    readCssSource(),
  ]);

  assert.match(
    workspaceContent,
    /const RankScreen = lazy\(async \(\) => \(\{ default: \(await import\("\.\/RankScreen"\)\)\.RankScreen \}\)\);/,
  );
  assert.match(navigationState, /const \[showRank, setShowRank\]/);
  assert.match(workspaceContent, /<RankScreen\s+tasks=\{rankTasks\}/);
  assert.doesNotMatch(page, /function BottomTabIcon/);
  assert.match(rank, /MUSCLE_GROUPS/);
  assert.match(rank, /classifyExercise/);
  assert.match(rank, /intermediate/);
  assert.match(rank, /elite/);
  assert.match(rank, /detectExerciseTargets/);
  assert.match(rank, /matchedExercises/);
  assert.match(rank, /weightedRows\[0\]\.score \* 0\.65 \+ weightedRows\[1\]\.score \* 0\.35/);
  assert.match(rank, /FREE_WEIGHT_UNILATERAL_MULTIPLIER = 1\.2/);
  assert.match(rank, /detectEquipmentType/);
  assert.match(rank, /equipmentAdjustedBenchmark/);
  assert.match(rank, /bodyWeightKg/);
  assert.match(rank, /recentDays/);
  assert.match(rankScreen, /TRACK_LIMITS\.rankHistoryDays/);
  assert.match(rank, /benchmark/);
  assert.match(rank, /confidence/);
  assert.doesNotMatch(rank, /rows\.slice\(0, 3\)/);
  assert.match(rankScreen, /selectedSummary\.matchedExercises\.map/);
  assert.match(rankScreen, /rank-correction-controls/);
  assert.match(
    css,
    /@media \(min-width:701px\)[\s\S]*?\.rank-selected-name \{ display:contents; \}[\s\S]*?white-space:normal/,
  );
  assert.match(
    css,
    /\.rank-selected-exercise \{ grid-template-columns:minmax\(0,1fr\) max-content; grid-template-rows:auto auto; grid-template-areas:"name set" "controls controls";/,
  );
  assert.match(rankScreen, /match\.bestSet/);
  assert.match(rankScreen, /Equipment/);
  assert.match(rankScreen, /EQUIPMENT_TYPES\.map/);
  assert.match(rankScreen, /summary\.progress/);
  assert.match(rankScreen, /aria-label="Front and back strength maps"/);
  assert.match(rankScreen, /<RankBodyMap\s+side="front"/);
  assert.match(rankScreen, /<RankBodyMap\s+side="back"/);
  assert.match(rankBodyMap, /Biceps and brachialis/);
  assert.match(rankBodyMap, /Triceps/);
  assert.match(rankBodyMap, /Obliques and serratus/);
  assert.match(rankBodyMap, /Calves/);
  assert.match(rankBodyMap, /rank-anatomy-separators/);
  assert.doesNotMatch(rankBodyMap, /rank-anatomy-midline|rank-anatomy-detail/);
  assert.doesNotMatch(rankScreen, /rank-map-toggle/);
  assert.doesNotMatch(rankScreen, /YOUR CURRENT PROFILE/);
  assert.doesNotMatch(rankScreen, /% of exercise standard/);
  assert.doesNotMatch(rankScreen, /Machine load kept/);
  assert.doesNotMatch(rankScreen, /Unilateral load normalized/);
  assert.doesNotMatch(rankScreen, /Detected as/);
  assert.doesNotMatch(rankScreen, /benchmarkLabel/);
  assert.match(css, /\.rank-screen/);
  assert.match(css, /\.rank-body-map/);
  assert.match(css, /\.rank-neutral-parts/);
  assert.match(css, /\.rank-selected-exercise/);
  assert.match(css, /@media \(max-width:700px\)/);
});

test("Track uses one identical logo tile in navigation and About", async () => {
  const [page, css] = await Promise.all([readAppSource(), readCssSource()]);

  assert.match(page, /brand-mark about-brand-mark/);
  assert.doesNotMatch(page, /className="about-mark"/);
  assert.match(css, /\.brand-mark \{[^}]*width:30px;[^}]*height:30px;/);
  assert.match(css, /\.about-brand-mark \{[^}]*width:56px;[^}]*height:56px;[^}]*margin-bottom:22px;/);
  assert.match(css, /\.about-brand-mark \.dumbbell-icon \{[^}]*width:38px;[^}]*height:25px;/);
});

test("desktop Workout Split starts on the sidebar brand rhythm", async () => {
  const css = await readCssSource();

  assert.match(css, /@media \(min-width:1201px\) \{[\s\S]*?\.content:has\(\.workout-page\) \{ padding-top:28px; \}/);
});

test("mobile sidebar closes after rotation and keeps landscape readable", async () => {
  const [page, css] = await Promise.all([readPageSource(), readCssSource()]);

  assert.match(page, /mobileOrientationRef/);
  assert.match(page, /orientationchange/);
  assert.match(page, /matchMedia\("\(orientation: landscape\)"\)/);
  assert.match(css, /@media \(max-width:1200px\) and \(orientation:landscape\)/);
  assert.match(css, /--landscape-drawer-width:min\(62vw,280px\)/);
  assert.match(
    css,
    /@supports \(-webkit-touch-callout: none\)[\s\S]*?padding-top:max\(18px,env\(safe-area-inset-top\)\) !important;/,
  );
});

test("landscape keeps the workout visible beside an open mobile sidebar", async () => {
  const [page, css] = await Promise.all([readPageSource(), readCssSource()]);

  assert.match(page, /mobileSidebarOpen \? " mobile-sidebar-visible"/);
  assert.match(
    css,
    /\.app-shell\.mobile-sidebar-visible \.workspace \{ width:calc\(100% - var\(--landscape-drawer-width\)\); margin-left:var\(--landscape-drawer-width\); \}/,
  );
  assert.match(css, /\.app-shell\.mobile-sidebar-visible \.mobile-sidebar-backdrop \{ display:none; \}/);
});

test("mobile navigation exposes the sidebar and narrow timer controls", async () => {
  const [page, css] = await Promise.all([readPageSource(), readCssSource()]);

  assert.match(page, /onOpenMobileSidebar/);
  assert.match(page, /aria-label="Open sidebar"/);
  assert.match(page, /setMobileSidebarOpen\(true\)/);
  assert.ok(css.includes(".mobile-header-leading { display:flex;"));
  assert.ok(css.includes(".mobile-menu-button { display:grid;"));
  assert.match(css, /@media \(max-width:\s*380px\)[\s\S]*?\.timer-rest-presets \{[\s\S]*?display:\s*grid/);
  assert.ok(css.includes("html { scrollbar-gutter:stable; } body { scrollbar-gutter:auto; }"));
  assert.ok(css.includes("padding-bottom:calc(120px + var(--track-safe-bottom));"));
});

test("landscape sidebar reserves space for split navigation", async () => {
  const css = await readCssSource();

  assert.match(css, /\.sidebar \.new-button \{ height:32px; min-height:32px; flex:0 0 auto; \}/);
  assert.match(css, /\.sidebar \.timer-nav \{ height:30px; min-height:30px; margin-top:2px; flex:0 0 auto; \}/);
  assert.match(css, /\.sidebar \.recents-label \{ margin:8px 12px 4px; flex:0 0 auto; \}/);
  assert.match(css, /\.sidebar \.recents \{ min-height:34px; flex:1 1 auto; \}/);
  assert.match(css, /\.sidebar \.recent \{ height:34px; min-height:34px; flex:0 0 auto; \}/);
});

test("mobile page tabs stay fixed and hold-slide to a target page", async () => {
  const [page, tabBar, bottomTabSource, css] = await Promise.all([
    readAppSource(),
    read("app/components/BottomTabBar.tsx"),
    read("app/hooks/useBottomTabNavigation.ts"),
    readCssSource(),
  ]);

  assert.match(tabBar, /type BottomTabId = "dashboard" \| "workout" \| "timer" \| "calendar" \| "rank"/);
  assert.match(
    tabBar,
    /DEFAULT_BOTTOM_TABS: BottomTabId\[\] = \["dashboard", "workout", "calendar", "rank", "timer"\]/,
  );
  assert.match(tabBar, /data-bottom-tab-id=\{id\}/);
  assert.match(tabBar, /data-indicator-index=\{indicatorIndex\}/);
  assert.match(bottomTabSource, /function beginHold/);
  assert.match(bottomTabSource, /BOTTOM_TAB_HOLD_MS/);
  assert.match(bottomTabSource, /const getNearestTab\s*=\s*useCallback/);
  assert.match(bottomTabSource, /const updateDragTarget\s*=\s*useCallback/);
  assert.match(page, /BOTTOM_TAB_SWITCH_HYSTERESIS/);
  assert.match(bottomTabSource, /pointerMoveRef/);
  assert.match(bottomTabSource, /indicatorFrame/);
  assert.match(bottomTabSource, /requestAnimationFrame/);
  assert.match(bottomTabSource, /indicator\.style\.transition = "none"/);
  assert.match(bottomTabSource, /currentIndicator\.style\.transform = `translate3d/);
  assert.match(bottomTabSource, /indicator\.style\.removeProperty\("transform"\)/);
  assert.match(bottomTabSource, /window\.addEventListener\("pointermove"/);
  assert.doesNotMatch(page, /function reorderBottomTabsAtPoint|setBottomTabs/);
  assert.doesNotMatch(bottomTabSource, /setPointerCapture|releasePointerCapture/);
  assert.doesNotMatch(
    page,
    /function updateBottomTabDragPreview|bottom-tab-drag-ghost|bottomTabDragPoint|moveBottomTabHold|finishBottomTabHold|dragging-bottom-tab-active/,
  );
  assert.match(tabBar, /bottom-tab-active-indicator/);
  assert.match(bottomTabSource, /indicatorPosition/);
  assert.match(bottomTabSource, /distance \* 0\.32/);
  assert.match(bottomTabSource, /Math\.abs\(targetLeft - nextLeft\) >= 0\.5/);
  assert.match(bottomTabSource, /const pressedId = dragId\.current/);
  assert.match(bottomTabSource, /else if \(pressedId\)/);
  assert.match(page, /target\?\.closest\("button, a, input, textarea, select, \[role='button'\], \.bottom-tab-bar"\)/);
  assert.match(page, /useSidebarGestures/);
  assert.match(page, /useSplitReorderGesture/);
  assert.match(page, /DESKTOP_SIDEBAR_SWIPE_DISTANCE/);
  assert.match(page, /DESKTOP_SIDEBAR_SWIPE_DIRECTION_RATIO/);
  assert.match(page, /beginDesktopSidebarSwipe/);
  assert.match(page, /mobilePointerSwipeStart/);
  assert.match(page, /beginMobilePointerSwipe/);
  assert.match(page, /MOBILE_SIDEBAR_SWIPE_DISTANCE_AWAY_FROM_EDGE/);
  assert.match(page, /cancelDesktopSidebarSwipe/);
  assert.match(page, /const shouldClose = !start\.sidebarCollapsed && dx < 0/);
  assert.match(page, /setSidebarCollapsed\(shouldOpen \? false : true\)/);
  assert.match(page, /desktopSwipeMoveRef/);
  assert.match(page, /safeStorageSet\("ironlog-sidebar", shouldOpen \? "open" : "collapsed"\)/);
  assert.match(page, /onPointerDownCapture:\s*beginDesktopSidebarSwipe/);
  assert.match(page, /createPortal\(\s*<BottomTabBar[\s\S]*document\.body\)/);
  assert.doesNotMatch(page, /!mobileSidebarOpen\s*&&\s*globalThis\.document\s*&&\s*createPortal/);
  assert.match(css, /bottom-tab-bounce/);
  assert.match(tabBar, /hold and slide to choose a page/);
  assert.match(tabBar, /BottomTabIcon id=\{id\} active=\{highlightedTab === id\}/);
  assert.match(bottomTabSource, /onNavigate\(targetId\)/);
  assert.match(page, /navigateBottomTab\(id\)/);
  assert.match(css, /\.bottom-tab-bar \{[^}]*display:none;/);
  assert.match(css, /\.bottom-tab \{[^}]*touch-action:none/);
  assert.match(css, /\.bottom-tab \{[^}]*-webkit-tap-highlight-color:transparent/);
  assert.match(
    css,
    /\.bottom-tab-active-indicator \{[^}]*position:absolute[^}]*pointer-events:none[^}]*will-change:transform[^}]*transform:translate3d/,
  );
  assert.match(css, /\.bottom-tab-icon svg\.is-filled \{[^}]*fill:none[^}]*stroke-width:2\.05/);
  assert.match(css, /\.bottom-tab-track \{[^}]*height:64px[^}]*align-items:stretch/);
  assert.match(css, /\.bottom-tab \{[^}]*height:100%[^}]*min-height:0[^}]*touch-action:none/);
  assert.match(css, /\.bottom-tab-icon-wrap > \.timer-running-indicator \{[^}]*position:absolute/);
  assert.match(css, /\.bottom-tab\.bottom-tab-drop-target \{[^}]*color:var\(--control-ink\)/);
  assert.match(
    css,
    /@media \(max-width:1200px\)[\s\S]*\.bottom-tab-bar \{[^}]*position:fixed[^}]*left:50vw[^}]*right:auto[^}]*bottom:[^}]*margin:0 !important[^}]*border-radius:22px[^}]*transform:translateX\(-50%\)/,
  );
  assert.match(
    css,
    /--track-safe-bottom:min\(48px,max\(env\(safe-area-inset-bottom,0px\),var\(--track-viewport-bottom-inset,0px\)\)\)/,
  );
  assert.match(
    css,
    /\.bottom-tab-bar \{[^}]*bottom:calc\(var\(--track-bottom-tab-edge\) \+ var\(--track-safe-bottom\)\) !important[^}]*inset-block-end:calc\(var\(--track-bottom-tab-edge\) \+ var\(--track-safe-bottom\)\) !important[^}]*margin:0 !important/,
  );
  assert.match(css, /\.bottom-tab-track \{[^}]*width:100%;[^}]*height:58px;/);
  assert.match(css, /background:color-mix\(in srgb,var\(--surface\) 70%,transparent\)/);
  assert.match(tabBar, /sidebarCollapsed/);
  assert.match(tabBar, /mobileSidebarOpen/);
  assert.match(tabBar, /aria-hidden=\{hidden \|\| mobileSidebarOpen\}/);
  assert.match(
    css,
    /@media \(min-width:1201px\)[\s\S]*\.bottom-tab-bar \{[^}]*position:fixed[^}]*left:calc\(var\(--track-sidebar-width\)[^}]*right:auto[^}]*bottom:var\(--track-bottom-tab-edge\) !important[^}]*display:flex[^}]*margin:0 !important[^}]*border-radius:22px[^}]*transform:translateX\(-50%\)/,
  );
  assert.match(css, /\.bottom-tab-bar\.is-sidebar-collapsed \{[^}]*left:50vw/);
  assert.match(css, /bottom-tab-sidebar-dismiss/);
  assert.match(css, /bottom-tab-sidebar-return/);
  assert.match(css, /\.bottom-tab-bar \{[\s\S]*?left 0\.42s var\(--track-ease-spring\)/);
  assert.doesNotMatch(page, /timer-nav|rank-nav-icon/);
  assert.doesNotMatch(css, /bottom-tab-drag-ghost|bottom-tab-dragging/);
  assert.doesNotMatch(css, /dragging-bottom-tab-active/);
});

test("private sync and announcements are server-scoped", async () => {
  const [page, syncMigration, announcementsMigration, announcementFunction, config] = await Promise.all([
    readAppSource(),
    read("supabase/migrations/20260827_private_sync_channels.sql"),
    read("supabase/migrations/20260826_track_announcements.sql"),
    read("supabase/functions/admin-announcement/index.ts"),
    read("supabase/config.toml"),
  ]);

  assert.match(page, /supabase\.channel\(`track-sync-\$\{user\.id\}`, \{ config: \{ private: true \} \}\)/);
  assert.match(page, /broadcastSyncEvent\("workout-updated"/);
  assert.match(page, /const SYNC_REFRESH_DEBOUNCE_MS = 180/);
  assert.match(page, /let refreshInFlight: Promise<void> \| null = null/);
  assert.match(page, /let refreshQueued = false/);
  assert.match(page, /const runRefresh = async \(knownRevision: number \| null = null, request/);
  assert.match(page, /queueRefresh\(eventRevision\)/);
  assert.match(page, /let refreshTrailingTimer: number \| null = null/);
  assert.match(page, /const lastOnlineListsLoad = useRef/);
  assert.match(page, /const syncRealtimeConnected = useRef\(false\)/);
  assert.match(page, /status === "SUBSCRIBED"/);
  assert.match(page, /!syncRealtimeConnected\.current/);
  assert.doesNotMatch(page, /queueRefresh\(\); \}, 1100\)/);
  assert.doesNotMatch(page, /supabase\.channel\("track-global"/);
  assert.match(page, /from\("track_announcements"\)/);
  assert.match(syncMigration, /realtime\.topic\(\) = 'track-sync-' \|\| \(select auth\.uid\(\)::text\)/);
  assert.match(announcementsMigration, /grant select on table public\.track_announcements to authenticated/);
  assert.match(announcementFunction, /auth\.getUser\(\)/);
  assert.match(announcementFunction, /Administrator access required/);
  assert.match(config, /\[functions\.admin-announcement\]\s+verify_jwt = true/);
});

test("finish workout is a pinned header action", async () => {
  const [page, shell, finishButton, css] = await Promise.all([
    readPageSource(),
    read("app/components/TrackAppShell.tsx"),
    read("app/components/FinishWorkoutButton.tsx"),
    readCssSource(),
  ]);

  assert.match(
    page,
    /const workoutActionsAvailable =\s+identity\.cloudReady\s+&&\s+tasks\.length > 0\s+&&\s+\(dirtySplits\.has\(activeSplitId\) \|\| progressFading \|\| workoutActionsExiting\)/,
  );
  assert.match(shell, /desktop-finish-action/);
  assert.match(shell, /mobile-actions/);
  assert.match(shell, /<FinishWorkoutButton/);
  assert.match(shell, /header-sync-status/);
  assert.match(shell, /aria-label=\{sidebarProps\.headerStatus\}/);
  assert.match(shell, /title=\{sidebarProps\.headerStatus\}/);
  assert.doesNotMatch(shell, />\s*\{sidebarProps\.headerStatus\}\s*</);
  assert.match(finishButton, /TRACK_UI_COPY\.status\.saving/);
  assert.match(finishButton, /completionEnabled && openCount === 0/);
  assert.match(finishButton, /: "Finish"/);
  assert.doesNotMatch(finishButton, /Finish workout/);
  assert.match(css, /\.finish-button\.is-saved \{[\s\S]*?animation:finish-button-complete/);
  assert.match(css, /@keyframes finish-button-complete/);
  assert.match(
    css,
    /\.mobile-actions \.header-sync-status\.sync-status-busy \{[\s\S]*?var\(--track-accent-online-ink\)/,
  );
  assert.match(css, /@keyframes header-sync-change-drop/);
  assert.match(css, /\.desktop-finish-action \{ position:fixed; z-index:140; top:20px; right:22px; \}/);
  assert.match(css, /\.desktop-finish-action\.has-admin \{ right:72px; \}/);
  assert.match(css, /\.mobile-actions \.header-finish-button \{ min-height:32px; flex:0 0 auto;/);
  assert.match(css, /\.mobile-actions \.header-sync-status \{ width:10px; height:10px;/);
  assert.match(css, /\.mobile-header \.home-brand \{ flex:0 1 auto; min-width:0;/);
  assert.doesNotMatch(`${page}\n${shell}\n${finishButton}\n${css}`, /workout-actions|has-workout-actions/);
});

test("settings touch targets do not inherit Safari focus or blur interference", async () => {
  const [settingsModal, settingsNavigation, css] = await Promise.all([
    read("app/components/SettingsModal.tsx"),
    read("app/components/SettingsNavigation.tsx"),
    readCssSource(),
  ]);

  assert.match(settingsModal, /onPointerDown=\{\(event\) => event\.stopPropagation\(\)\}/);
  assert.match(settingsModal, /onPointerDown=\{\(event\) => \{\s*event\.stopPropagation\(\);\s*onClose\(\);\s*\}\}/);
  assert.match(css, /\.settings-backdrop \{[^}]*isolation:isolate[^}]*pointer-events:auto/);
  assert.match(css, /\.settings-nav button \{[^}]*outline:0[^}]*-webkit-tap-highlight-color:transparent/);
  assert.match(
    css,
    /\.settings-nav button:focus, \.settings-nav button:focus-visible \{ outline:0; box-shadow:none; \}/,
  );
  assert.match(
    css,
    /\.settings-close \{[^}]*z-index:3[^}]*touch-action:manipulation[^}]*-webkit-tap-highlight-color:transparent/,
  );
  assert.match(css, /\.settings-close:focus, \.settings-close:focus-visible \{ outline:0; box-shadow:none; \}/);
  assert.match(
    css,
    /\.settings-title-row \.settings-close\.ui-button \{[^}]*width:40px[^}]*background:var\(--raised\)[^}]*color:var\(--ink\)[^}]*box-shadow:/,
  );
  assert.match(css, /\.settings-title-row \.settings-close\.ui-button:focus-visible \{[^}]*outline:2px/);
  assert.match(
    css,
    /\.settings-backdrop \{ backdrop-filter:none; -webkit-backdrop-filter:none; background:rgba\(0,0,0,.82\); \}/,
  );
  assert.match(settingsNavigation, /type="button"/);
  assert.match(settingsNavigation, /<SettingsIcon name=\{item\.icon\} \/>/);
  assert.match(settingsNavigation, /<span>\{item\.label\}<\/span>/);
  assert.doesNotMatch(settingsNavigation, /icon: "[◐◎◈↻◇↓✦○ⓘ⌘]"/);
  assert.match(
    css,
    /\.settings-nav-icon \{[\s\S]*?stroke-width:1\.65;[\s\S]*?stroke-linecap:round;[\s\S]*?stroke-linejoin:round;/,
  );
  assert.match(settingsNavigation, /const mobileItems = desktopItems/);
  assert.match(
    css,
    /@media \(max-width: 699px\)[\s\S]*?\.settings-mobile-tabs \{[\s\S]*?display: flex;[\s\S]*?overflow-x: auto;/,
  );
});

test("responsive workout controls keep one aligned grid and remove native number chrome", async () => {
  const [taskCard, css, motion, settings] = await Promise.all([
    read("app/components/TaskCard.tsx"),
    readCssSource(),
    read("app/domMotion.ts"),
    read("app/components/SettingsSpecialViews.tsx"),
  ]);

  assert.match(taskCard, /className="set-row set-heading"/);
  assert.match(
    css,
    /@media \(max-width:700px\)[\s\S]*?\.workout-page \.set-heading \{[\s\S]*?display:grid;[\s\S]*?grid-template-columns:34px repeat\(3,minmax\(0,1fr\)\) 30px;/,
  );
  assert.match(
    css,
    /@media \(max-width:700px\)[\s\S]*?\.workout-page \.set-row:not\(\.set-heading\) \{[\s\S]*?grid-template-columns:34px repeat\(3,minmax\(0,1fr\)\) 30px;/,
  );
  assert.match(css, /--workout-set-grid:34px repeat\(3,minmax\(0,1fr\)\) 30px;/);
  assert.match(
    css,
    /\.workout-page \.set-row \.set-input:nth-child\(3\)::after,[\s\S]*?content:none;[\s\S]*?display:none;/,
  );
  assert.match(css, /\.workout-page \.title-row \{[\s\S]*?align-items:flex-start;/);
  assert.match(css, /\.workout-page \.add-set \{[\s\S]*?width:100%;/);
  assert.match(css, /input\[type="number"\] \{[\s\S]*?appearance:textfield;/);
  assert.match(css, /::-webkit-inner-spin-button/);
  assert.match(css, /--track-logo-surface:#101010/);
  assert.match(css, /\.welcome-mark,[\s\S]*?\.password-reset-mark,[\s\S]*?\.auth-logo/);
  assert.match(settings, /TRACK_DISCORD_HANDLE/);
  assert.match(motion, /prefers-reduced-motion: reduce/);
  assert.match(motion, /cubic-bezier\(\.22,1,\.36,1\)/);
});

test("beta workout flow keeps logging keyboard-friendly and mobile actions reachable", async () => {
  const [taskCard, workoutPage, workspace, finishButton, splitGesture, css] = await Promise.all([
    read("app/components/TaskCard.tsx"),
    read("app/components/WorkoutPage.tsx"),
    read("app/components/WorkspaceContent.tsx"),
    read("app/components/FinishWorkoutButton.tsx"),
    read("app/hooks/useSplitReorderGesture.ts"),
    readCssSource(),
  ]);

  assert.match(taskCard, /data-set-field="weight"/);
  assert.match(taskCard, /data-set-field="reps"/);
  assert.match(taskCard, /data-set-field="rir"/);
  assert.match(taskCard, /focusNextSetInput\(event, "reps"\)/);
  assert.match(taskCard, /focusNextSetInput\(event, "rir"\)/);
  assert.match(taskCard, /inputMode="decimal"[\s\S]*?enterKeyHint="next"/);
  assert.match(taskCard, /inputMode="numeric"[\s\S]*?enterKeyHint="done"/);
  assert.match(workoutPage, /className="workout-start-steps"/);
  assert.match(workspace, /className="welcome-start-steps"/);
  assert.match(finishButton, /aria-haspopup="dialog"/);
  assert.match(finishButton, /Finish this workout\?/);
  assert.match(finishButton, /Keep logging/);
  assert.match(workoutPage, /className="mobile-search-toggle"/);
  assert.match(workoutPage, /is-mobile-search-open/);
  assert.match(css, /\.welcome-start-steps \{[\s\S]*?gap:10px;/);
  assert.match(css, /\.welcome-start-steps \+ \.welcome-button \{[\s\S]*?margin-top:clamp\(14px,2\.5vh,20px\);/);
  assert.match(taskCard, /className=\{togglingUnitId === set\.id/);
  assert.match(taskCard, /set\.unit\.toUpperCase\(\)/);
  assert.match(splitGesture, /splitHoldMenuOpened/);
  assert.match(splitGesture, /function splitMenuPosition/);
  assert.match(splitGesture, /splitMenuOffsetY/);
  assert.match(splitGesture, /splitHoldMenuMs/);
  assert.match(
    css,
    /@media \(max-width:700px\)[\s\S]*?\.workout-page \.exercise-composer \{[\s\S]*?position:relative;[\s\S]*?max-height:0;/,
  );
  assert.match(css, /\.workout-page \.exercise-composer\.is-mobile-search-open \{[\s\S]*?max-height:96px;/);
  assert.match(css, /\.workout-page \.exercise-composer \.suggestions \{[\s\S]*?left:0;[\s\S]*?right:0;/);
  assert.match(css, /\.workout-page \.exercise-composer \.suggestions \{[\s\S]*?top:calc\(100% \+ 8px\);/);
  assert.doesNotMatch(css, /\.workout-page \.exercise-composer \{ position:fixed;/);
  assert.doesNotMatch(css, /undo-toast-positioner \{[\s\S]*?\+ 82px/);
  assert.match(css, /\.weight-unit-toggle\.is-toggling/);
  assert.match(css, /@keyframes weight-unit-toggle/);
  assert.match(css, /grid-template-columns:minmax\(0,1fr\) 34px/);
  assert.match(css, /\.workout-page \.set-delta \{[\s\S]*?transform:translateY\(-100%\);/);
  assert.match(css, /--workout-set-grid/);
  assert.match(css, /@keyframes finish-confirm-in/);
  assert.match(css, /@keyframes undo-toast-in/);
});

test("mobile settings stay balanced and boot reconciliation stays quiet", async () => {
  const [syncHook, css] = await Promise.all([read("app/hooks/useTrackCloudSync.ts"), readCssSource()]);

  assert.match(syncHook, /const initialSyncReconciliation = useRef\(false\)/);
  assert.match(
    syncHook,
    /if \(initialSyncReconciliation\.current && \(label === "Loading…" \|\| label === "Syncing…" \|\| label === "Saving…"\)\)/,
  );
  assert.match(
    css,
    /\/\* Settings polish: keep narrow-screen headings and admin actions visually balanced\. \*\/[\s\S]*\.settings-heading \{[\s\S]*display:block;[\s\S]*\.admin-card > \.setting-row \{[\s\S]*align-items:flex-start;/,
  );
});

test("mobile pages share a lower crisp surface and blur-free overlays", async () => {
  const css = await readCssSource();

  assert.match(css, /@keyframes mobile-content-arrive/);
  assert.match(css, /\.content \{ padding-top:28px; \}/);
  assert.match(css, /\.timer-screen \{ padding-top:0; \}/);
  assert.match(
    css,
    /\.settings-content \{[^}]*padding-top:22px !important;[^}]*padding-bottom:calc\(56px \+ env\(safe-area-inset-bottom\)\) !important;[^}]*\}/,
  );
  assert.match(css, /\.content, \.content-exit, \.timer-screen, \.calendar-screen, \.rank-screen,/);
  assert.match(css, /\.settings-view\[class\*="view-"\] > \.setting-section/);
  assert.match(css, /\.settings-backdrop, \.password-reset-backdrop, \.exercise-confirm-backdrop,/);
  assert.match(css, /\.admin-users-header \{ padding-top:max\(18px,env\(safe-area-inset-top\)\); \}/);
  assert.match(css, /\.admin-preview-workout \{ padding-top:18px; \}/);
  assert.match(css, /\.admin-users-close \{[^}]*width:40px[^}]*box-shadow:/);
  assert.match(
    css,
    /\.admin-users-header, \.admin-users-header \* \{[^}]*filter:none !important;[^}]*backdrop-filter:none !important;/,
  );
  assert.match(
    css,
    /\.calendar-detail-scroll \{ padding-top:max\(54px,calc\(18px \+ env\(safe-area-inset-top\)\)\); \}/,
  );
  assert.match(
    css,
    /--track-safe-bottom:min\(48px,max\(env\(safe-area-inset-bottom,0px\),var\(--track-viewport-bottom-inset,0px\)\)\)/,
  );
  assert.match(
    css,
    /\.bottom-tab-bar \{ position:fixed !important;[\s\S]*bottom:calc\(var\(--track-bottom-tab-edge\) \+ var\(--track-safe-bottom\)\) !important;/,
  );
});

test("calendar, workout, and settings surfaces keep their review controls balanced", async () => {
  const [calendar, taskCard, settings, navigation, constants, rank, timer, undoToast, css] = await Promise.all([
    readSourceBundle(["app/components/CalendarScreen.tsx", "app/components/CalendarDetailModal.tsx"]),
    read("app/components/TaskCard.tsx"),
    readSourceBundle([
      "app/components/SettingsViewContent.tsx",
      "app/components/SettingsStandardViews.tsx",
      "app/components/SettingsAiImportView.tsx",
    ]),
    read("app/components/SettingsNavigation.tsx"),
    read("app/trackConstants.ts"),
    read("app/components/RankScreen.tsx"),
    read("app/components/TimerScreen.tsx"),
    read("app/components/UndoToast.tsx"),
    readCssSource(),
  ]);

  assert.match(calendar, /calendar-detail-expand-icon expanded/);
  assert.doesNotMatch(calendar, /expanded \? "−" : "\+"/);
  assert.match(css, /\.calendar-detail-scroll \{[^}]*width:min\(1180px,calc\(100% - 32px\)\)/);
  assert.match(
    css,
    /\.calendar-detail-exercise-info \{[\s\S]*?border:1px solid color-mix\(in srgb,var\(--line\) 88%,transparent\);[\s\S]*?background:color-mix\(/,
  );
  assert.match(
    css,
    /\.workout-page \.set-row \{[\s\S]*?grid-template-columns:48px minmax\(0,1\.2fr\) minmax\(0,1fr\) minmax\(0,1fr\) 32px;/,
  );
  assert.match(settings, /className="personal-unit-selector"/);
  assert.doesNotMatch(settings, /theme-selector|Global weight unit|Installed version|about-credit/);
  assert.match(settings, /type=\{aiKeyVisible \? "text" : "password"\}/);
  assert.match(settings, /className="ai-key-visibility"/);
  assert.match(settings, /className="export-actions export-card"/);
  assert.match(settings, /className="ai-upload-icon"/);
  assert.match(settings, /notification-setting-help/);
  assert.match(navigation, /label: SETTINGS_LABELS\[item\.view\]/);
  assert.match(navigation, /label: SETTINGS_LABELS\.admin/);
  assert.doesNotMatch(navigation, /label: "Privacy & Notifications"|label: "Data & Backup"/);
  assert.match(constants, /account: "Account & Security"/);
  assert.match(constants, /about: "About Track II"/);
  assert.match(css, /\.settings-view\.view-account > \.setting-section:not\(:last-child\)/);
  assert.doesNotMatch(css, /\.settings-view\.view-account > \.setting-section:nth-child/);
  assert.match(css, /\.theme-preview-grid/);
  assert.match(css, /\.exercise-unit-settings,[\s\S]*?-webkit-font-smoothing:antialiased;/);
  assert.match(rank, /className="rank-card-progress"/);
  assert.match(rank, /to \{summary\.nextLevelLabel\}/);
  assert.match(rank, /summary\.trackedExercises === 1 \? "exercise" : "exercises"/);
  assert.doesNotMatch(rank, /rankNextColor|linear-gradient/);
  assert.doesNotMatch(timer, /timer-progress-ring|strokeDashoffset|restRingOffset|has-progress-ring/);
  assert.match(timer, /Start rest/);
  assert.doesNotMatch(timer, /STOPWATCH|REST TIMER|Configured rest/);
  assert.match(undoToast, /TRACK_TIMING\.undoNoticeDurationMs/);
  assert.match(undoToast, /--undo-duration/);
  assert.match(undoToast, /sidebarCollapsed/);
  assert.match(undoToast, /mobileSidebarOpen/);
  assert.match(undoToast, /<i \/>/);
  assert.match(css, /\.timer-display-wrap \{[\s\S]*?margin:72px auto 46px;/);
  assert.doesNotMatch(css, /timer-progress-ring|timer-progress-value|timer-progress-track/);
  assert.match(
    css,
    /\.undo-toast-positioner \{[\s\S]*?bottom:calc\(var\(--track-bottom-tab-edge\) \+ var\(--track-bottom-tab-height\) \+ 12px \+ var\(--track-safe-bottom\)\);/,
  );
  assert.match(css, /\.undo-toast-positioner\.is-mobile-sidebar-open \{[\s\S]*?visibility:hidden;/);
  assert.match(
    css,
    /\.undo-toast-positioner:not\(\.is-sidebar-collapsed\) \{[\s\S]*?left:calc\(var\(--track-sidebar-width\)/,
  );
  assert.match(css, /animation:undo-toast-progress var\(--undo-duration\) linear both/);
  assert.match(undoToast, /--undo-dismiss-duration/);
  assert.match(constants, /undoDismissMs: 360/);
  assert.match(
    css,
    /\.undo-toast-positioner\.dismiss-left \{[\s\S]*?transform:translate3d\([\s\S]*?var\(--undo-dismiss-duration,360ms\)/,
  );
  assert.match(css, /\.undo-toast-positioner \{[\s\S]*?left 0\.42s var\(--track-ease-spring\)/);
  assert.match(css, /\.rank-body-map \{[\s\S]*?shape-rendering:geometricPrecision;/);
  assert.match(css, /\.rank-anatomy-separators \{/);
  assert.match(taskCard, /className="sets-table"/);
});

test("page headers share one rhythm and scroll shortcuts sit just above the tab bar", async () => {
  const css = await readCssSource();

  assert.match(css, /\.content \{ width:min\(1120px, calc\(100% - 72px\)\); margin:0 auto; padding:28px 0 36px; \}/);
  assert.match(css, /\.rank-title-row \{[\s\S]*?margin-top:0;[\s\S]*?\}/);
  assert.match(css, /\.calendar-title-copy > \.settings-kicker \{ margin:0 0 14px; \}/);
  assert.match(css, /\.scroll-shortcuts \{ right:16px; bottom:calc\(96px \+ var\(--track-safe-bottom\)\); \}/);
  assert.match(css, /\.scroll-shortcuts \{ bottom:112px; \}/);
  assert.doesNotMatch(css, /has-workout-actions|workout-actions/);
});

test("account status actions use a crisp, aligned visual system", async () => {
  const [sidebar, css] = await Promise.all([read("app/components/Sidebar.tsx"), readCssSource()]);

  assert.doesNotMatch(sidebar, /⚙/);
  assert.match(sidebar, /<svg viewBox="0 0 24 24"[^>]*focusable="false">/);
  assert.doesNotMatch(sidebar, /brand-sync-status/);
  assert.match(sidebar, /onClick=\{\(\) => onOpenSettings\(\)\}/);
  assert.doesNotMatch(sidebar, /onClick=\{onOpenSettings\}/);
  assert.doesNotMatch(sidebar, /account-panel-heading[\s\S]*account-status/);
  assert.match(
    css,
    /\.account-panel \.settings-button svg \{[\s\S]*?stroke-width:1\.75;[\s\S]*?shape-rendering:geometricPrecision;/,
  );
  assert.match(css, /\.account-role-badge\.admin \{[\s\S]*?var\(--track-accent-online\)/);
  assert.match(css, /\.account-online \{[\s\S]*?color:var\(--track-accent-online-ink\);/);
  assert.match(css, /\.account-panel \.settings-button \{[\s\S]*?transform:none;/);
  assert.match(css, /\.account-panel \{[\s\S]*?padding-bottom:12px;/);
  assert.doesNotMatch(css, /\.brand-sync-status/);
});

test("personal unit controls keep metric storage while displaying correct imperial values", async () => {
  const [settings, measurements] = await Promise.all([
    read("app/components/SettingsStandardViews.tsx"),
    read("app/personalMeasurements.ts"),
  ]);

  assert.match(settings, /PERSONAL_CONVERSION\.centimetersPerInch/);
  assert.match(settings, /PERSONAL_CONVERSION\.poundsPerKilogram/);
  assert.match(measurements, /measurement === "height"/);
  assert.match(measurements, /1 \/ PERSONAL_CONVERSION\.centimetersPerInch/);
  assert.match(measurements, /PERSONAL_CONVERSION\.poundsPerKilogram/);
  assert.doesNotMatch(measurements, /height:\s*2\.54|weight:\s*2\.2046226218/);
});

test("native haptics enhance bottom-tab gestures with a browser fallback", async () => {
  const [page, haptics] = await Promise.all([readPageSource(), read("app/haptics.ts")]);

  assert.match(page, /from "@capacitor\/core"/);
  assert.match(haptics, /from "@capacitor\/haptics"/);
  assert.match(haptics, /Haptics\.selectionChanged\(\)/);
  assert.match(haptics, /navigator\?\.vibrate/);
});

test("calendar no longer renders workout streaks", async () => {
  const [page, calendar, css] = await Promise.all([
    readPageSource(),
    Promise.all([read("app/components/CalendarScreen.tsx"), read("app/components/CalendarMonthOverview.tsx")]).then(
      (sources) => sources.join("\n"),
    ),
    readCssSource(),
  ]);

  assert.doesNotMatch(`${page}\n${calendar}`, /workoutStreaks|calendar-streaks|Current streak|Best streak/);
  assert.doesNotMatch(css, /calendar-streaks/);
  assert.match(
    calendar,
    /className="calendar-legend">\s*<span>\s*<i \/>\s*Completed\s*<\/span>\s*<span>\s*\{workoutDates\.size\}/,
  );
  assert.match(css, /\.calendar-legend span \{[^}]*white-space:nowrap/);
  assert.match(
    css,
    /@media \(max-width:1200px\)[\s\S]*\.calendar-legend \{ align-items:center; flex-direction:row; gap:12px; \}/,
  );
});

test("Personal Info is required, saved to the account, and used by Rank", async () => {
  const [page, css, migration] = await Promise.all([
    readAppSource(),
    readCssSource(),
    read("supabase/migrations/20260810_personal_info.sql"),
  ]);

  assert.match(page, /personal: "Personal Info"/);
  assert.match(page, /personalInfoPromptOpen/);
  assert.match(page, /Height and bodyweight help Track II calculate a fairer strength rank/);
  assert.match(
    page,
    /updateUser\(\{\s*data:\s*\{\s*height_cm:\s*next\.heightCm,\s*weight_kg:\s*next\.weightKg\s*,?\s*\}\s*,?\s*\}\)/,
  );
  assert.match(page, /historyTasks=\{rankHistoryTasks\}/);
  assert.match(page, /bodyWeightKg=\{personalInfo\?\.weightKg \?\? 0\}/);
  assert.match(css, /\.personal-info-prompt/);
  assert.match(css, /\.personal-info-fields/);
  assert.match(migration, /add column if not exists height_cm numeric/);
  assert.match(migration, /add column if not exists weight_kg numeric/);
});

test("admin settings removes the debug online-user toggle and settings nav does not trail active shadows", async () => {
  const [page, css] = await Promise.all([readPageSource(), readCssSource()]);

  assert.doesNotMatch(page, /\[Debug\] Show online users/);
  assert.doesNotMatch(page, /debugOnlineUsers|onlineUsers/);
  assert.match(page, /adminUsersPanelProps\?\.open && <AdminUsersPanel/);
  assert.doesNotMatch(page, /onlineUserNames/);
  assert.match(css, /\.settings-nav button \{[\s\S]*?transition:background-color \.18s ease,color \.18s ease;/);
});

test("personal information stays owner-only and exercise menus do not resize collapsed cards", async () => {
  const [taskCard, css, privacyMigration, adminMemberFunction, usernameAuthFunction] = await Promise.all([
    read("app/components/TaskCard.tsx"),
    readCssSource(),
    read("supabase/migrations/20260812_protect_personal_info.sql"),
    read("supabase/functions/admin-member-data/index.ts"),
    read("supabase/functions/username-auth/index.ts"),
  ]);
  assert.doesNotMatch(taskCard, /mobileExerciseMenu \? " menu-open"/);
  assert.doesNotMatch(css, /\.task\.menu-open/);
  assert.doesNotMatch(css, /\.task\.collapsed\.menu-open \{ min-height:/);
  assert.match(
    css,
    /\.mobile-exercise-menu\.exercise-menu-portal \{ position:fixed; z-index:2400; top:var\(--menu-top\); left:var\(--menu-left\);/,
  );
  assert.match(taskCard, /createPortal\(/);
  assert.match(taskCard, /getBoundingClientRect\(\)/);
  assert.match(privacyMigration, /force row level security/);
  assert.match(privacyMigration, /revoke all on table public\.profiles from anon/);
  assert.match(privacyMigration, /using \(\(select auth\.uid\(\)\) = user_id\)/);
  assert.match(privacyMigration, /height_cm/);
  assert.match(privacyMigration, /weight_kg/);
  assert.doesNotMatch(adminMemberFunction, /height_cm|weight_kg/i);
  assert.doesNotMatch(usernameAuthFunction, /height_cm|weight_kg/i);
});

test("Rank detects library, renamed, imported, abbreviated, and misspelled exercises once per name", async () => {
  clearExerciseDetectionCache();
  const examples = new Map([
    ["Calves Raise", "legs"],
    ["Keenan Flap (Frontal)", "back"],
    ["Sagittal-plane Keenan flap", "back"],
    ["latpullodwn", "back"],
    ["ltpldwn", "back"],
    ["My latpulldwn imported", "back"],
    ["Machine Curl (Dead Stop, Unilateral)", "arms"],
    ["Cable overhead triceps extension (unilateral)", "arms"],
    ["Chest Fly", "chest"],
    ["Leg Extension (unilateral)", "legs"],
    ["AB Crunch", "core"],
  ]);

  for (const [name, group] of examples) {
    assert.ok(
      detectExerciseTargets(name).targets.some((target) => target.group === group),
      `${name} should target ${group}`,
    );
  }
  assert.deepEqual(
    detectExerciseTargets("Leg Curl").targets.map((target) => target.group),
    ["legs"],
  );
  assert.equal(detectExerciseTargets("Shoulder Press Machine (Frontal Plane)").targets[0]?.group, "shoulders");
  assert.equal(detectExerciseTargets("Rear Delts Fly Machine (Unilaterally)").targets[0]?.group, "shoulders");
  assert.equal(detectExerciseTargets("rear delt fly custom edited").targets[0]?.group, "shoulders");
  assert.equal(detectExerciseTargets("Sagittal Shoulder Press (Upper Chest)").targets[0]?.group, "chest");
  assert.equal(detectExerciseTargets("Quantum telescope orbit").targets.length, 0);
  const unilateralNames = [
    "Leg Extension (unilateral)",
    "single arm pulldown",
    "one-leg curl",
    "1 arm row",
    "unilatral cable raise",
    "singel arm curl",
  ];
  for (const name of unilateralNames)
    assert.equal(detectExerciseTargets(name).unilateral, true, `${name} should be unilateral`);
  assert.equal(detectExerciseTargets("bilateral leg extension").unilateral, false);

  const beforeRepeat = exerciseDetectionCacheSize();
  detectExerciseTargets("Keenan Flap (Frontal)");
  assert.equal(exerciseDetectionCacheSize(), beforeRepeat, "unchanged names should reuse their scan");
  detectExerciseTargets("Keenan Flap (Frontal) edited");
  assert.equal(
    exerciseDetectionCacheSize(),
    beforeRepeat + 1,
    "renamed exercises should be scanned once under the new name",
  );

  assert.equal(EXERCISE_PRIMARY_CATALOG.length, 584);
  for (const entry of EXERCISE_PRIMARY_CATALOG) {
    const detection = detectExerciseTargets(entry.name);
    const primary = [...detection.targets].sort((left, right) => right.weight - left.weight)[0]?.group;
    assert.equal(
      primary,
      entry.group,
      `${entry.name} should have reviewed primary target ${entry.group}, received ${primary ?? "unmatched"}`,
    );
  }

  const rankSource = await readRankSource();
  assert.match(rankSource, /primaryMuscleTarget/);
  assert.match(rankSource, /const targets = \[primary\]/);
  assert.match(rankSource, /evidenceAdjustedLevel\(scoreToLevel\(score\)/);
  assert.match(rankSource, /exerciseCount <= 1/);
  assert.match(rankSource, /sessionCount < 2/);
  assert.match(rankSource, /level === "elite" \? 100 : 99/);
});

test("progression history follows stable exercise ids and survives sync merges", async () => {
  const [page, taskCard] = await Promise.all([readAppSource(), read("app/components/TaskCard.tsx")]);

  assert.match(page, /session_id,exercise_id,exercise_name,set_number/);
  assert.match(page, /latestByExercise\.get\(`\$\{exercise\.id\}:\$\{setNumber\}`\)/);
  assert.match(page, /lastReps: set\.lastReps \?\? remoteSet\?\.lastReps/);
  assert.match(taskCard, /Number\(set\.reps\) - set\.lastReps/);
  assert.match(taskCard, /rep-delta set-delta up/);
});

test("large private reads are paginated and presentation state stays local", async () => {
  const [page, api, pagination, adminFunction, saveMigration, deletionMigration] = await Promise.all([
    readAppSource(),
    read("app/data/trackApi.ts"),
    read("app/data/pagination.ts"),
    read("supabase/functions/admin-member-data/index.ts"),
    read("supabase/migrations/20260824_input_validation.sql"),
    read("supabase/migrations/20260825_bound_calendar_deletion.sql"),
  ]);

  assert.match(pagination, /QUERY_PAGE_SIZE/);
  assert.match(pagination, /MAX_QUERY_PAGES/);
  assert.match(api, /fetchAllPages<SplitRow>/);
  assert.match(api, /fetchAllPages<LogRow>/);
  assert.match(page, /collapsed: false/);
  assert.match(adminFunction, /const MEMBER_DATA_PAGE_SIZE = 1000/);
  assert.match(adminFunction, /listAllRows<SplitRow>/);
  assert.match(adminFunction, /listAllRows<SetRow>/);
  assert.match(saveMigration, /validate_track_state_payload/);
  assert.match(saveMigration, /validate_workout_session_payload/);
  assert.match(saveMigration, /pg_column_size\(state\) > 1048576/);
  assert.match(deletionMigration, /cardinality\(session_ids\) > 500/);
});

test("Pages entry imports the shared UI and uses the public identity assets", async () => {
  const [entry, pagesConfig, icon, manifest] = await Promise.all([
    read("cloudflare/main.tsx"),
    read("vite.pages.config.ts"),
    read("public/track-geometric-dumbbell.svg"),
    read("public/manifest.webmanifest"),
  ]);

  assert.match(entry, /from "\.\.\/app\/page"/);
  assert.match(entry, /\.\.\/app\/globals\.css/);
  assert.match(pagesConfig, /root: "cloudflare"/);
  assert.match(pagesConfig, /outDir: "\.\.\/work\/cloudflare-pages"/);
  assert.match(icon, /<svg[\s\S]*dumbbell|<svg/);
  assert.match(manifest, /"short_name": "Track II"/);
});

test("local credentials and generated deployment folders stay out of the source review", async () => {
  const gitignore = await read(".gitignore");
  assert.match(gitignore, /\.env\*/);
  assert.match(gitignore, /!\.env\.example/);
  assert.match(gitignore, /\/work\//);
  assert.match(gitignore, /\*\.zip/);
  assert.match(gitignore, /\.env\*/);
});

test("username login never exposes account email through an anonymous database function", async () => {
  const [page, usernameFunction, privacyMigration] = await Promise.all([
    readPageSource(),
    read("supabase/functions/username-auth/index.ts"),
    read("supabase/migrations/20260818_remove_anonymous_email_lookup.sql"),
  ]);

  assert.doesNotMatch(page, /rpc\("lookup_login_email"/);
  assert.doesNotMatch(page, /email:\s*user\.email/);
  assert.doesNotMatch(usernameFunction, /body\?\.action === "check"/);
  assert.doesNotMatch(usernameFunction, /usernameAvailable/);
  assert.match(usernameFunction, /consumeRateLimit/);
  assert.doesNotMatch(usernameFunction, /new Map/);
  const cors = await read("supabase/functions/_shared/cors.ts");
  assert.match(cors, /capacitor:\/\/localhost/);
  assert.match(cors, /https:\/\/localhost/);
  assert.match(privacyMigration, /drop function if exists public\.lookup_login_email\(text\)/);
});

test("public Edge Functions require constrained origins, signed-in access, and distributed limits", async () => {
  const [extractFunction, usernameFunction, adminFunction, adminHelper, cors, limiter, migration, config] =
    await Promise.all([
      read("supabase/functions/extract-workout/index.ts"),
      read("supabase/functions/username-auth/index.ts"),
      read("supabase/functions/admin-member-data/index.ts"),
      read("supabase/functions/_shared/admin.ts"),
      read("supabase/functions/_shared/cors.ts"),
      read("supabase/functions/_shared/rateLimit.ts"),
      read("supabase/migrations/20260817_edge_rate_limits.sql"),
      read("supabase/config.toml"),
    ]);

  assert.match(extractFunction, /Authorization/);
  assert.match(extractFunction, /auth\.getUser\(\)/);
  assert.match(extractFunction, /consumeRateLimit/);
  assert.match(extractFunction, /MAX_BODY_BYTES/);
  assert.doesNotMatch(extractFunction, /Access-Control-Allow-Origin.*\*/);
  assert.match(usernameFunction, /consumeRateLimit/);
  assert.doesNotMatch(usernameFunction, /body\?\.action === "check"/);
  assert.doesNotMatch(usernameFunction, /new Map/);
  assert.doesNotMatch(usernameFunction, /usernameAvailable/);
  assert.doesNotMatch(usernameFunction, /Access-Control-Allow-Origin.*\*/);
  assert.match(adminFunction, /auth\.getUser\(\)/);
  assert.match(adminFunction, /consumeRateLimit/);
  assert.match(adminHelper, /TRACK_ADMIN_USERNAME/);
  assert.match(adminHelper, /TRACK_ADMIN_USER_ID/);
  assert.match(adminHelper, /\.eq\("user_id", user\.id\)/);
  assert.match(adminFunction, /isAllowedOrigin, responseHeaders/);
  assert.match(adminFunction, /headers: responseHeaders\(request\)/);
  assert.match(adminHelper, /count: "exact"/);
  assert.doesNotMatch(adminFunction, /auth\.admin\.listUsers/);
  assert.doesNotMatch(adminFunction, /Access-Control-Allow-Origin.*\*/);
  assert.match(cors, /TRACK_ALLOWED_ORIGINS/);
  assert.match(cors, /Vary: "Origin"/);
  assert.doesNotMatch(cors, /Access-Control-Allow-Origin.*\*/);
  assert.match(limiter, /consume_edge_rate_limit/);
  assert.match(migration, /create table if not exists public\.edge_rate_limits/);
  assert.match(migration, /force row level security/);
  assert.match(migration, /grant execute on function public\.consume_edge_rate_limit[\s\S]*to service_role/);
  assert.match(config, /\[functions\.extract-workout\][\s\S]*verify_jwt = true/);
  assert.match(config, /\[functions\.admin-member-data\][\s\S]*verify_jwt = true/);
});

test("owner RLS keeps child rows attached to owner-controlled parents", async () => {
  const rlsMigration = await read("supabase/migrations/20260808_complete_owner_rls.sql");

  assert.doesNotMatch(rlsMigration, /for all/i);
  assert.match(rlsMigration, /splits\.id = exercises\.split_id/);
  assert.match(rlsMigration, /exercises\.id = exercise_sets\.exercise_id/);
  assert.match(rlsMigration, /workout_sessions\.id = workout_set_logs\.session_id/);
  assert.match(rlsMigration, /to authenticated/);
});

test("admin member directory is username-gated, private, and stays outside the Admin Panel controls", async () => {
  const [
    page,
    panel,
    memberViewer,
    settingsModal,
    adminFunction,
    adminHelper,
    trackConfig,
    adminMigration,
    pagesStyles,
  ] = await Promise.all([
    readAppSource(),
    Promise.all([
      read("app/components/AdminUsersPanel.tsx"),
      read("app/components/AdminUsersDirectoryModels.tsx"),
    ]).then((sources) => sources.join("\n")),
    read("app/components/AdminMemberViewer.tsx"),
    read("app/components/SettingsModal.tsx"),
    read("supabase/functions/admin-member-data/index.ts"),
    read("supabase/functions/_shared/admin.ts"),
    read("app/trackConfig.ts"),
    read("supabase/migrations/20260820_admin_users.sql"),
    readCssSource(),
  ]);

  assert.match(page, /adminUsersPanelProps\?\.open && <AdminUsersPanel/);
  assert.match(page, /isAdmin: adminAuthorized/);
  assert.match(page, /SETTINGS_CONTENT_VIEWS\.includes\(settingsView\)/);
  assert.match(page, /settingsView === "about"[\s\S]*<section className="about-page"/);
  assert.match(page, /settingsView === "admin" && isAdmin[\s\S]*<section className="admin-page"/);
  assert.match(page, /\[debug\] Fake update notification/);
  assert.match(page, /showFakeUpdateNotification/);
  assert.doesNotMatch(page, /<strong>Manage members<\/strong>/);
  assert.doesNotMatch(page, /Open directory/);
  assert.doesNotMatch(settingsModal, /AdminMemberViewer/);
  assert.doesNotMatch(trackConfig, /ADMIN_USERNAME|TRACK_ADMIN_USERNAME|TRACK_ADMIN_USER_ID/i);
  assert.match(panel, /Last online/);
  assert.match(panel, /export function isMemberOnline/);
  assert.match(panel, /const online = isMemberOnline\(/);
  assert.match(panel, /admin-user-avatar/);
  assert.match(panel, /admin-user-role-badge/);
  assert.match(pagesStyles, /\.admin-user-avatar > i\.online \{[\s\S]*?background:var\(--track-accent-online\);/);
  assert.match(panel, /Read-only split preview/);
  assert.match(panel, />\s*View split\s*</);
  assert.doesNotMatch(panel, /Preview account|View splits/);
  assert.match(panel, /aria-haspopup="menu"/);
  assert.match(panel, /createPortal\([\s\S]*?className="admin-user-context"[\s\S]*?document\.body/);
  assert.match(panel, /role="button"[\s\S]*?tabIndex=\{0\}[\s\S]*?onKeyDown=\{\(event\) => openMenuFromKeyboard/);
  assert.match(
    pagesStyles,
    /\.admin-user-row:focus-visible \{ outline:2px solid color-mix\(in srgb,var\(--ink\) 58%,transparent\);/,
  );
  assert.match(pagesStyles, /\.admin-user-row:hover \{ background:color-mix\(in srgb,var\(--ink\) 6%,transparent\);/);
  assert.match(pagesStyles, /\.admin-user-more > span \{[\s\S]*?letter-spacing:2px;[\s\S]*?transform:none;/);
  assert.match(panel, /Promote to admin/);
  assert.match(panel, /Demote from admin/);
  assert.match(panel, /At least one administrator must remain/);
  assert.doesNotMatch(panel, /update\(|upsert\(|delete\(/);
  assert.match(adminFunction, /Administrator access required/);
  assert.match(adminHelper, /TRACK_ADMIN_USERNAME/);
  assert.match(adminHelper, /TRACK_ADMIN_USER_ID/);
  assert.match(adminHelper, /checkAdminAccess/);
  assert.match(adminFunction, /isAdmin: isRosterAdmin/);
  assert.match(adminFunction, /isAllowedOrigin/);
  assert.doesNotMatch(adminFunction, /Access-Control-Allow-Origin.*\*/);
  assert.match(adminFunction, /action === "list-users"/);
  assert.match(adminFunction, /action === "set-admin"/);
  assert.match(adminFunction, /admin_users/);
  assert.match(adminFunction, /At least one administrator must remain/);
  assert.match(adminFunction, /isAdmin: isRosterAdmin/);
  assert.match(adminMigration, /create table if not exists public\.admin_users/);
  assert.match(adminMigration, /force row level security/);
  assert.match(adminMigration, /revoke all on table public\.admin_users from anon, authenticated/);
  assert.match(adminMigration, /to service_role/);
  assert.doesNotMatch(page, /ADMIN_EMAIL|mailto:/);
  assert.doesNotMatch(adminFunction, /ADMIN_EMAIL|private-admin-identifier/);
  assert.doesNotMatch(memberViewer, /member\.email|target\.email/);
});

test("iOS keeps persistent mobile surfaces sharp", async () => {
  const css = await readCssSource();

  assert.match(css, /@supports \(-webkit-touch-callout:none\)/);
  assert.match(
    css,
    /\.mobile-header \{[\s\S]*?animation:none !important;[\s\S]*?-webkit-backdrop-filter:none !important;/,
  );
  assert.match(css, /\.admin-users-backdrop \{[\s\S]*?-webkit-backdrop-filter:none !important;/);
  assert.match(
    css,
    /\.content, \.content-exit, \.timer-screen, \.calendar-screen, \.rank-screen \{[\s\S]*?animation:none !important;/,
  );
  assert.match(css, /\.admin-users-modal,\s*\.admin-users-preview \{[\s\S]*?animation:none !important;/);
});

test("Settings exposes a user-facing GitHub release check", async () => {
  const [page, trackConfig] = await Promise.all([readAppSource(), read("app/trackConfig.ts")]);

  assert.match(page, /type SettingsView\s*=\s*[\s\S]*?"updates"/);
  assert.match(trackConfig, /NEXT_PUBLIC_TRACK_RELEASES_URL/);
  assert.match(trackConfig, /NEXT_PUBLIC_TRACK_WEB_ORIGIN/);
  assert.doesNotMatch(trackConfig, /github\.com\/your-account|your-pages-project\.pages\.dev/i);
  assert.match(page, /checkForUpdatesFromSettings/);
  assert.match(page, /Check for updates/);
  assert.match(page, /isNewerTrackVersion/);
  assert.match(page, /TRACK_BUILD_ID/);
  assert.match(page, /remoteBuildId/);
  assert.match(page, /Update in \$\{siteUpdateSeconds\}s/);
  assert.match(page, /No updates yet\./);
  assert.match(page, /Update ready/);
  assert.match(page, /Download update/);
  assert.doesNotMatch(page, /settingsView === "changelog"|>Changelog</i);
  assert.doesNotMatch(page, /window\.location\.assign\(TRACK_RELEASES_URL\)/);
});

test("native updates and notification permissions use native-safe paths", async () => {
  const [releaseManager, interactions, settings, settingsSpecial, trackUtils, updateNotification] = await Promise.all([
    read("app/hooks/useReleaseManager.ts"),
    read("app/hooks/useTrackAppInteractions.ts"),
    read("app/components/SettingsStandardViews.tsx"),
    read("app/components/SettingsSpecialViews.tsx"),
    read("app/trackUtils.ts"),
    read("app/components/UpdateNotification.tsx"),
  ]);

  assert.match(releaseManager, /nativeApp\s*&&\s*remoteRelease\.buildId/);
  assert.match(releaseManager, /if \(!nativeApp\)/);
  assert.match(releaseManager, /githubLatestReleaseAssetUrl/);
  assert.match(releaseManager, /altstore-source\.json/);
  assert.match(releaseManager, /firstApp\.versions/);
  assert.match(trackUtils, /openNativeNotificationSettings/);
  assert.match(trackUtils, /AppLauncher\.openUrl\(\{\s*url\s*\}\)/);
  assert.match(trackUtils, /"app-settings:"/);
  assert.match(trackUtils, /foreground:\s*true/);
  assert.match(interactions, /showFakeUpdateNotification/);
  assert.match(settings, /notificationSettingsAvailable/);
  assert.match(settings, /Open Settings/);
  assert.match(settingsSpecial, /\[debug\] Fake update notification/);
  assert.match(updateNotification, /createPortal/);
  assert.match(updateNotification, /document\.body/);
  assert.match(updateNotification, /debug && !isAdmin/);
  assert.match(updateNotification, /!nativeApp \|\| !globalThis\.document/);
});

test("update and announcement notifications keep their centered entrance transform", async () => {
  const [components, polish] = await Promise.all([read("app/styles/components.css"), read("app/styles/polish.css")]);

  assert.match(
    components,
    /@keyframes notification-in \{[\s\S]*?from \{[\s\S]*?transform: translate3d\(calc\(-50% \+ var\(--announcement-offset, 0px\)\), -18px, 0\) scale\(0\.96\);[\s\S]*?to \{[\s\S]*?transform: translate3d\(calc\(-50% \+ var\(--announcement-offset, 0px\)\), 0, 0\) scale\(1\);[\s\S]*?\}/,
  );
  assert.match(
    polish,
    /@keyframes mobile-notification-in \{[\s\S]*?from \{[\s\S]*?transform: translate3d\(calc\(-50% \+ var\(--announcement-offset, 0px\)\), -12px, 0\) scale\(0\.98\);[\s\S]*?to \{[\s\S]*?transform: translate3d\(calc\(-50% \+ var\(--announcement-offset, 0px\)\), 0, 0\) scale\(1\);[\s\S]*?\}/,
  );
  assert.doesNotMatch(components, /@keyframes notification-in[\s\S]*?translate:\s*-50%/);
  assert.doesNotMatch(polish, /@keyframes mobile-notification-in[\s\S]*?translate:\s*-50%/);
});

test("new persistence and privacy paths avoid scans, plaintext snapshots, and inline boot scripts", async () => {
  const [
    api,
    offlineStore,
    usernameFunction,
    extractFunction,
    adminFunction,
    adminHelper,
    announcementFunction,
    sharedHttp,
    migration,
    integrityMigration,
    headers,
    pagesEntry,
    bootScript,
    packageJson,
    trackUtils,
    syncHook,
    localSnapshotHook,
    syncStatusHook,
    splitMenu,
    workspaceContent,
    page,
  ] = await Promise.all([
    read("app/data/trackApi.ts"),
    read("app/offlineStore.ts"),
    read("supabase/functions/username-auth/index.ts"),
    read("supabase/functions/extract-workout/index.ts"),
    read("supabase/functions/admin-member-data/index.ts"),
    read("supabase/functions/_shared/admin.ts"),
    read("supabase/functions/admin-announcement/index.ts"),
    read("supabase/functions/_shared/http.ts"),
    read("supabase/migrations/20260828_incremental_sync_identity_audit.sql"),
    read("supabase/migrations/20260829_sync_payload_integrity.sql"),
    read("public/_headers"),
    read("cloudflare/index.html"),
    read("public/track-boot.js"),
    read("package.json"),
    read("app/trackUtils.ts"),
    read("app/hooks/useTrackCloudSync.ts"),
    read("app/hooks/useTrackLocalSnapshot.ts"),
    read("app/hooks/useTrackSyncStatus.ts"),
    read("app/components/SplitMenu.tsx"),
    read("app/components/WorkspaceContent.tsx"),
    readPageSource(),
  ]);

  assert.match(api, /save_track_state_incremental/);
  assert.match(api, /save_track_state/);
  assert.match(offlineStore, /AES-GCM/);
  assert.match(offlineStore, /Legacy plaintext snapshots remain readable/);
  assert.match(usernameFunction, /auth_username_directory/);
  assert.doesNotMatch(usernameFunction, /auth\.admin\.listUsers/);
  assert.match(sharedHttp, /export function json/);
  assert.match(sharedHttp, /export function isIntegerValue/);
  assert.doesNotMatch(usernameFunction, /function json\(/);
  assert.doesNotMatch(extractFunction, /function json\(/);
  assert.doesNotMatch(adminFunction, /function json\(/);
  assert.doesNotMatch(announcementFunction, /function json\(/);
  assert.match(adminHelper, /\.eq\("user_id", user\.id\)/);
  assert.match(adminFunction, /loadAdminIds/);
  assert.doesNotMatch(adminFunction, /auth\.admin\.listUsers/);
  assert.match(adminFunction, /set_admin_user/);
  assert.match(announcementFunction, /admin_audit_log/);
  assert.match(announcementFunction, /auditError/);
  assert.match(announcementFunction, /auditLogged/);
  assert.match(migration, /save_track_state_incremental/);
  assert.match(migration, /auth_username_directory_normalized_idx/);
  assert.match(migration, /admin_audit_log/);
  assert.match(migration, /is distinct from/);
  assert.match(migration, /ownership/i);
  assert.doesNotMatch(migration, /collapsed\s*=\s*excluded\.collapsed/);
  assert.match(integrityMigration, /validate_track_state_payload/);
  assert.match(integrityMigration, /jsonb_array_length/);
  assert.match(trackUtils, /cloudListSignature/);
  assert.match(trackUtils, /addText/);
  assert.match(trackUtils, /addNumber/);
  assert.doesNotMatch(trackUtils, /JSON\.stringify\(trackStatePayload/);
  assert.doesNotMatch(trackUtils, /export function workoutValueSignature[\s\S]*?JSON\.stringify/);
  assert.match(syncHook, /useTrackSyncStatus/);
  assert.match(syncHook, /useTrackLocalSnapshot/);
  assert.doesNotMatch(syncHook, /writeTrackSnapshot/);
  assert.match(localSnapshotHook, /writeTrackSnapshot/);
  assert.match(localSnapshotHook, /writeQueue/);
  assert.doesNotMatch(page, /<div className="split-menu"/);
  assert.match(splitMenu, /className="split-menu"/);
  assert.match(workspaceContent, /WorkoutEditorProvider/);
  assert.match(workspaceContent, /CalendarScreenSkeleton/);
  assert.doesNotMatch(page, /<WorkoutPage/);
  assert.match(syncStatusHook, /syncSavedFeedbackMs/);
  assert.match(headers, /script-src 'self'/);
  assert.match(headers, /script-src-attr 'none'/);
  assert.match(headers, /style-src-elem 'self'/);
  assert.match(headers, /style-src-attr 'none'/);
  assert.doesNotMatch(headers, /script-src[^;]*unsafe-inline/);
  assert.doesNotMatch(headers, /style-src[^;]*unsafe-inline/);
  assert.doesNotMatch(pagesEntry, /<script>\s/);
  assert.match(pagesEntry, /track-boot\.js/);
  assert.match(bootScript, /quiet-checklist-theme/);
  assert.doesNotMatch(packageJson, /drizzle-kit|db:generate/);
});

test("native Capacitor configuration packages the shared app with haptics, notifications, and icons", async () => {
  const [page, trackConfig, capacitor, packageJson, pagesConfig, headers] = await Promise.all([
    readAppSource(),
    read("app/trackConfig.ts"),
    read("capacitor.config.ts"),
    read("package.json"),
    read("vite.pages.config.ts"),
    read("public/_headers"),
  ]);

  assert.match(capacitor, /webDir: "work\/cloudflare-pages"/);
  assert.match(packageJson, /"@capacitor\/haptics": "\^8/);
  assert.match(packageJson, /"@capacitor\/app-launcher": "\^8/);
  assert.match(packageJson, /"@capacitor\/assets": "\^3/);
  assert.match(packageJson, /"@capacitor\/local-notifications": "\^8/);
  assert.match(packageJson, /"generate:native-icons"/);
  assert.match(page, /LocalNotifications\.schedule/);
  assert.match(trackConfig, /NEXT_PUBLIC_TRACK_WEB_ORIGIN/);
  assert.doesNotMatch(trackConfig, /trackz\.pages\.dev/i);
  assert.match(pagesConfig, /track-release\.json/);
  assert.match(pagesConfig, /releaseVersion/);
  assert.match(pagesConfig, /version: releaseVersion/);
  assert.match(headers, /Access-Control-Allow-Origin: \*/);
  assert.match(page, /promiseWithTimeout/);
  assert.match(page, /notificationRequestBusy/);
});
