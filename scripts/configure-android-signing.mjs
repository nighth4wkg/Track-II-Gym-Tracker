import { readFile, writeFile } from "node:fs/promises";

const buildFile = "android/app/build.gradle";
let source = await readFile(buildFile, "utf8");

if (/signingConfig\s+signingConfigs\.release/.test(source)) {
  console.log("Android release signing is already configured.");
  process.exit(0);
}

const androidMarker = "android {";
const androidIndex = source.indexOf(androidMarker);
if (androidIndex < 0) throw new Error(`Could not find the Android block in ${buildFile}.`);

const signingBlock = `
    signingConfigs {
        release {
            storeFile file(System.getenv("ANDROID_KEYSTORE_FILE"))
            storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
            keyAlias System.getenv("ANDROID_KEY_ALIAS")
            keyPassword System.getenv("ANDROID_KEY_PASSWORD")
        }
    }
`;
source =
  source.slice(0, androidIndex + androidMarker.length) +
  signingBlock +
  source.slice(androidIndex + androidMarker.length);

const releaseBuildType = /(buildTypes\s*\{\s*release\s*\{)/;
if (!releaseBuildType.test(source)) throw new Error(`Could not find the release build type in ${buildFile}.`);
source = source.replace(releaseBuildType, "$1\n            signingConfig signingConfigs.release");

await writeFile(buildFile, source, "utf8");
console.log(`Configured release signing in ${buildFile} using CI-only environment variables.`);
