import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { deflateSync } from "node:zlib";

const root = new URL("..", import.meta.url).pathname;
const outDir = join(root, "assets");
const androidResDir = join(root, "android", "app", "src", "main", "res");
const iosAppIcon = join(root, "ios", "FREED", "Images.xcassets", "AppIcon.appiconset", "App-Icon-1024x1024@1x.png");

function crc32(buffer) {
  let crc = -1;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
  return Buffer.concat([length, typeBytes, data, crc]);
}

function writePng(path, width, height, pixels) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    pixels.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, Buffer.concat([signature, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]));
}

function rgba(hex, alpha = 255) {
  const value = hex.replace("#", "");
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
    alpha
  ];
}

function mix(a, b, t) {
  return a.map((value, index) => Math.round(value + (b[index] - value) * t));
}

function blendPixel(pixels, width, x, y, color, alpha = color[3] / 255) {
  if (x < 0 || y < 0 || x >= width) return;
  const index = (y * width + x) * 4;
  const outAlpha = alpha + (pixels[index + 3] / 255) * (1 - alpha);
  for (let channel = 0; channel < 3; channel += 1) {
    pixels[index + channel] = Math.round((color[channel] * alpha + pixels[index + channel] * (pixels[index + 3] / 255) * (1 - alpha)) / Math.max(outAlpha, 0.001));
  }
  pixels[index + 3] = Math.round(outAlpha * 255);
}

function pointInPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const xi = points[i][0];
    const yi = points[i][1];
    const xj = points[j][0];
    const yj = points[j][1];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function fillPolygon(pixels, width, height, points, colorFn) {
  const minX = Math.max(0, Math.floor(Math.min(...points.map((point) => point[0]))));
  const maxX = Math.min(width - 1, Math.ceil(Math.max(...points.map((point) => point[0]))));
  const minY = Math.max(0, Math.floor(Math.min(...points.map((point) => point[1]))));
  const maxY = Math.min(height - 1, Math.ceil(Math.max(...points.map((point) => point[1]))));
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (pointInPolygon(x + 0.5, y + 0.5, points)) blendPixel(pixels, width, x, y, colorFn(x, y));
    }
  }
}

function fillRoundedRect(pixels, width, height, x, y, w, h, radius, color) {
  const x2 = x + w;
  const y2 = y + h;
  for (let py = Math.max(0, y); py < Math.min(height, y2); py += 1) {
    for (let px = Math.max(0, x); px < Math.min(width, x2); px += 1) {
      const dx = Math.max(x + radius - px, 0, px - (x2 - radius));
      const dy = Math.max(y + radius - py, 0, py - (y2 - radius));
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= radius) blendPixel(pixels, width, px, py, color);
    }
  }
}

function fillCircle(pixels, width, height, cx, cy, radius, color) {
  const minX = Math.max(0, Math.floor(cx - radius));
  const maxX = Math.min(width - 1, Math.ceil(cx + radius));
  const minY = Math.max(0, Math.floor(cy - radius));
  const maxY = Math.min(height - 1, Math.ceil(cy + radius));
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d <= radius) blendPixel(pixels, width, x, y, color, Math.min(1, radius - d + 0.6));
    }
  }
}

function createLogo({ width = 1024, height = 1024, background = true } = {}) {
  const pixels = Buffer.alloc(width * height * 4);
  const bgTop = rgba("#151421");
  const bgBottom = rgba("#26213d");
  const mint = rgba("#5adf9e");
  const teal = rgba("#58c8d6");
  const peach = rgba("#ffbe76");
  const dark = rgba("#151421");

  if (background) {
    for (let y = 0; y < height; y += 1) {
      const color = mix(bgTop, bgBottom, y / (height - 1));
      for (let x = 0; x < width; x += 1) blendPixel(pixels, width, x, y, color);
    }
    fillPolygon(
      pixels,
      width,
      height,
      [
        [width * 0.18, height * 0.18],
        [width * 0.82, height * 0.1],
        [width * 0.74, height * 0.18],
        [width * 0.1, height * 0.26]
      ],
      () => rgba("#5adf9e", 18)
    );
    fillPolygon(
      pixels,
      width,
      height,
      [
        [width * 0.25, height * 0.86],
        [width * 0.9, height * 0.76],
        [width * 0.82, height * 0.84],
        [width * 0.18, height * 0.94]
      ],
      () => rgba("#b898ff", 14)
    );
  }

  const shield = [
    [width * 0.5, height * 0.16],
    [width * 0.71, height * 0.25],
    [width * 0.67, height * 0.6],
    [width * 0.5, height * 0.8],
    [width * 0.33, height * 0.6],
    [width * 0.29, height * 0.25]
  ];
  const shadow = shield.map(([x, y]) => [x + width * 0.018, y + height * 0.024]);
  fillPolygon(pixels, width, height, shadow, () => rgba("#07070d", background ? 82 : 50));
  fillPolygon(pixels, width, height, shield, (_x, y) => mix(mint, teal, Math.max(0, Math.min(1, (y - height * 0.16) / (height * 0.64)))));

  fillCircle(pixels, width, height, width * 0.5, height * 0.35, width * 0.058, peach);
  fillRoundedRect(pixels, width, height, Math.round(width * 0.455), Math.round(height * 0.34), Math.round(width * 0.09), Math.round(height * 0.3), Math.round(width * 0.045), dark);
  fillPolygon(
    pixels,
    width,
    height,
    [
      [width * 0.455, height * 0.58],
      [width * 0.545, height * 0.58],
      [width * 0.62, height * 0.71],
      [width * 0.38, height * 0.71]
    ],
    () => dark
  );
  fillCircle(pixels, width, height, width * 0.5, height * 0.34, width * 0.027, rgba("#fff2c9", 210));
  return pixels;
}

mkdirSync(outDir, { recursive: true });
writePng(join(outDir, "icon.png"), 1024, 1024, createLogo({ background: true }));
writePng(join(outDir, "adaptive-icon.png"), 1024, 1024, createLogo({ background: false }));
writePng(join(outDir, "splash-icon.png"), 1024, 1024, createLogo({ background: false }));
writePng(iosAppIcon, 1024, 1024, createLogo({ background: true }));

const launcherDensities = [
  ["mipmap-mdpi", 48],
  ["mipmap-hdpi", 72],
  ["mipmap-xhdpi", 96],
  ["mipmap-xxhdpi", 144],
  ["mipmap-xxxhdpi", 192]
];

for (const [folder, size] of launcherDensities) {
  const pixels = createLogo({ width: size, height: size, background: true });
  writePng(join(androidResDir, folder, "ic_launcher.webp"), size, size, pixels);
  writePng(join(androidResDir, folder, "ic_launcher_round.webp"), size, size, pixels);
}

const splashDensities = [
  ["drawable-mdpi", 288],
  ["drawable-hdpi", 432],
  ["drawable-xhdpi", 576],
  ["drawable-xxhdpi", 864],
  ["drawable-xxxhdpi", 1152]
];

for (const [folder, size] of splashDensities) {
  writePng(join(androidResDir, folder, "splashscreen_logo.png"), size, size, createLogo({ width: size, height: size, background: false }));
}

console.log("Generated FREED logo assets:");
console.log(join(outDir, "icon.png"));
console.log(join(outDir, "adaptive-icon.png"));
console.log(join(outDir, "splash-icon.png"));
console.log(iosAppIcon);
