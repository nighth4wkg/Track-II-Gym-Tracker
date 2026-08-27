import { execFileSync } from "node:child_process";

const databaseUrl = process.env.RESTORE_DATABASE_URL;
if (!databaseUrl) {
  console.error("RESTORE_DATABASE_URL is required for restore verification.");
  process.exit(1);
}

const requiredTables = [
  "profiles",
  "splits",
  "exercises",
  "exercise_sets",
  "workout_sessions",
  "workout_set_logs",
  "workout_notes",
  "track_state_revisions",
  "workout_sync_revisions",
];
const rlsTables = [
  "profiles",
  "splits",
  "exercises",
  "exercise_sets",
  "workout_sessions",
  "workout_set_logs",
  "workout_notes",
  "track_state_revisions",
  "workout_sync_revisions",
];

function query(sql) {
  return execFileSync(
    "psql",
    [databaseUrl, "--no-psqlrc", "--tuples-only", "--no-align", "-v", "ON_ERROR_STOP=1", "-c", sql],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  ).trim();
}

const tableRows = query(
  `select table_name from information_schema.tables where table_schema = 'public' and table_name = any (array[${requiredTables.map((table) => `'${table}'`).join(", ")}]) order by table_name;`,
)
  .split(/\r?\n/)
  .filter(Boolean);
const missingTables = requiredTables.filter((table) => !tableRows.includes(table));
if (missingTables.length) throw new Error(`Restored backup is missing tables: ${missingTables.join(", ")}.`);

const rlsRows = query(
  `select c.relname || ':' || c.relrowsecurity::text from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = any (array[${rlsTables.map((table) => `'${table}'`).join(", ")}]) order by c.relname;`,
)
  .split(/\r?\n/)
  .filter(Boolean);
const disabledRls = rlsTables.filter((table) => !rlsRows.includes(`${table}:t`));
if (disabledRls.length) throw new Error(`Restored backup has RLS disabled for: ${disabledRls.join(", ")}.`);

const sessionCount = query("select count(*) from public.workout_sessions;");
const logCount = query("select count(*) from public.workout_set_logs;");
console.log(
  `Restore verification passed: ${sessionCount} workout sessions, ${logCount} set logs, required RLS enabled.`,
);
