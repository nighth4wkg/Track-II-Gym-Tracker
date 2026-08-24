import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const source = "public/track-icon.svg";
const outputs = [
  ["public/apple-touch-icon.png", 180],
  ["public/icon-192.png", 192],
  ["public/icon-512.png", 512],
  ["assets/icon-only.png", 1024],
];

await mkdir("assets", { recursive: true });

await Promise.all(
  outputs.map(([path, size]) => sharp(source).resize(size, size).png({ compressionLevel: 9 }).toFile(path)),
);

await sharp(source).resize(96, 96).png({ compressionLevel: 9 }).toFile("public/notification-badge.png");
