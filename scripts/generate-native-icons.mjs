import { copyFile, mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

const source = "public/track-icon.svg";
const notificationSource = "public/track-notification-icon.svg";

async function render(path, size, assetSource = source) {
  await mkdir(path.slice(0, path.lastIndexOf("/")), { recursive: true });
  await sharp(assetSource).resize(size, size, { fit: "contain" }).png({ compressionLevel: 9 }).toFile(path);
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
await render("android/app/src/main/res/drawable/ic_stat_track.png", 96, notificationSource);

const iosIconSizes = [
  ["iphone", "20", 2],
  ["iphone", "20", 3],
  ["iphone", "29", 2],
  ["iphone", "29", 3],
  ["iphone", "40", 2],
  ["iphone", "40", 3],
  ["iphone", "60", 2],
  ["iphone", "60", 3],
  ["ipad", "20", 1],
  ["ipad", "20", 2],
  ["ipad", "29", 1],
  ["ipad", "29", 2],
  ["ipad", "40", 1],
  ["ipad", "40", 2],
  ["ipad", "76", 1],
  ["ipad", "76", 2],
  ["ipad", "83.5", 2],
  ["ios-marketing", "1024", 1],
];
const iosDirectory = "ios/App/App/Assets.xcassets/AppIcon.appiconset";
const iosImages = [];
for (const [idiom, pointSize, scale] of iosIconSizes) {
  const filename = `AppIcon-${idiom}-${pointSize.replace(".", "_")}x${scale}.png`;
  await render(`${iosDirectory}/${filename}`, Math.round(Number(pointSize) * scale));
  iosImages.push({
    filename,
    idiom,
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
