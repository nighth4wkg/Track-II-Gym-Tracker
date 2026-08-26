import { copyFile, mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

const source = "public/track-icon.svg";

async function render(path, size) {
  await mkdir(path.slice(0, path.lastIndexOf("/")), { recursive: true });
  await sharp(source).resize(size, size, { fit: "contain" }).png({ compressionLevel: 9 }).toFile(path);
}

const androidDensities = [
  ["mdpi", 48],
  ["hdpi", 72],
  ["xhdpi", 96],
  ["xxhdpi", 144],
  ["xxxhdpi", 192],
];

for (const [density, size] of androidDensities) {
  const directory = `android/app/src/main/res/mipmap-${density}`;
  await render(`${directory}/ic_launcher.png`, size);
  await copyFile(`${directory}/ic_launcher.png`, `${directory}/ic_launcher_round.png`);
}

await render("android/app/src/main/res/drawable/ic_launcher_foreground.png", 432);

const iosIconSizes = [
  ["20", 1],
  ["20", 2],
  ["20", 3],
  ["29", 1],
  ["29", 2],
  ["29", 3],
  ["40", 1],
  ["40", 2],
  ["40", 3],
  ["60", 2],
  ["60", 3],
  ["76", 1],
  ["76", 2],
  ["83.5", 2],
  ["1024", 1],
];
const iosDirectory = "ios/App/App/Assets.xcassets/AppIcon.appiconset";
const iosImages = [];
for (const [pointSize, scale] of iosIconSizes) {
  const filename = `AppIcon-${pointSize.replace(".", "_")}x${scale}.png`;
  await render(`${iosDirectory}/${filename}`, Math.round(Number(pointSize) * scale));
  iosImages.push({
    filename,
    idiom: "universal",
    scale: `${scale}x`,
    size: `${pointSize}x${pointSize}`,
  });
}
await writeFile(
  `${iosDirectory}/Contents.json`,
  `${JSON.stringify({ images: iosImages, info: { author: "xcode", version: 1 } }, null, 2)}\n`,
  "utf8",
);

// Keep the web icon generation and the native generator on the same source
// asset. This makes a release reproducible without the outdated Capacitor
// Assets package, while the direct Capacitor 8 CLI remains untouched.
