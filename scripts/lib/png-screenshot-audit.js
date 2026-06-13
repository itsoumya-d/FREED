#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const zlib = require("node:zlib");

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const DEFAULT_OPTIONS = {
  minHeight: 240,
  minLuminanceStdDev: 2.5,
  minNonTransparentRatio: 0.95,
  minSampledUniqueColors: 8,
  minWidth: 240,
};

function parsePng(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < PNG_SIGNATURE.length + 12) {
    throw new Error("PNG buffer is too small");
  }
  if (!buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new Error("Screenshot is not a PNG");
  }

  let offset = PNG_SIGNATURE.length;
  let header = null;
  let palette = null;
  let transparency = null;
  const idatChunks = [];

  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const nextOffset = dataEnd + 4;

    if (dataEnd > buffer.length || nextOffset > buffer.length) {
      throw new Error(`PNG chunk ${type} exceeds file length`);
    }

    const data = buffer.subarray(dataStart, dataEnd);
    if (type === "IHDR") {
      header = {
        bitDepth: data[8],
        colorType: data[9],
        compression: data[10],
        filter: data[11],
        height: data.readUInt32BE(4),
        interlace: data[12],
        width: data.readUInt32BE(0),
      };
    } else if (type === "PLTE") {
      palette = data;
    } else if (type === "tRNS") {
      transparency = data;
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "IEND") {
      break;
    }

    offset = nextOffset;
  }

  if (!header) {
    throw new Error("PNG is missing IHDR");
  }
  if (idatChunks.length === 0) {
    throw new Error("PNG is missing IDAT");
  }
  if (header.bitDepth !== 8) {
    throw new Error(`Unsupported PNG bit depth: ${header.bitDepth}`);
  }
  if (header.compression !== 0 || header.filter !== 0 || header.interlace !== 0) {
    throw new Error("Unsupported PNG compression, filter, or interlace mode");
  }

  const channels = channelsForColorType(header.colorType);
  const inflated = zlib.inflateSync(Buffer.concat(idatChunks));
  const pixels = unfilterScanlines(inflated, header.width, header.height, channels);

  return { ...header, channels, palette, pixels, transparency };
}

function channelsForColorType(colorType) {
  switch (colorType) {
    case 0:
    case 3:
      return 1;
    case 2:
      return 3;
    case 4:
      return 2;
    case 6:
      return 4;
    default:
      throw new Error(`Unsupported PNG color type: ${colorType}`);
  }
}

function unfilterScanlines(inflated, width, height, channels) {
  const rowBytes = width * channels;
  const expected = (rowBytes + 1) * height;
  if (inflated.length < expected) {
    throw new Error("PNG pixel data is shorter than expected");
  }

  const pixels = Buffer.alloc(rowBytes * height);
  let sourceOffset = 0;
  let targetOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[sourceOffset];
    sourceOffset += 1;
    const source = inflated.subarray(sourceOffset, sourceOffset + rowBytes);
    sourceOffset += rowBytes;

    for (let x = 0; x < rowBytes; x += 1) {
      const raw = source[x];
      const left = x >= channels ? pixels[targetOffset + x - channels] : 0;
      const up = y > 0 ? pixels[targetOffset + x - rowBytes] : 0;
      const upLeft = y > 0 && x >= channels ? pixels[targetOffset + x - rowBytes - channels] : 0;

      let value;
      if (filter === 0) {
        value = raw;
      } else if (filter === 1) {
        value = raw + left;
      } else if (filter === 2) {
        value = raw + up;
      } else if (filter === 3) {
        value = raw + Math.floor((left + up) / 2);
      } else if (filter === 4) {
        value = raw + paeth(left, up, upLeft);
      } else {
        throw new Error(`Unsupported PNG scanline filter: ${filter}`);
      }
      pixels[targetOffset + x] = value & 0xff;
    }

    targetOffset += rowBytes;
  }

  return pixels;
}

function paeth(left, up, upLeft) {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upLeftDistance = Math.abs(estimate - upLeft);
  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) return left;
  if (upDistance <= upLeftDistance) return up;
  return upLeft;
}

function pixelAt(png, pixelIndex) {
  const offset = pixelIndex * png.channels;

  if (png.colorType === 0) {
    const gray = png.pixels[offset];
    return [gray, gray, gray, 255];
  }
  if (png.colorType === 2) {
    return [png.pixels[offset], png.pixels[offset + 1], png.pixels[offset + 2], 255];
  }
  if (png.colorType === 3) {
    const paletteIndex = png.pixels[offset];
    const paletteOffset = paletteIndex * 3;
    if (!png.palette || paletteOffset + 2 >= png.palette.length) {
      throw new Error("Indexed PNG is missing a valid palette entry");
    }
    return [
      png.palette[paletteOffset],
      png.palette[paletteOffset + 1],
      png.palette[paletteOffset + 2],
      png.transparency && paletteIndex < png.transparency.length ? png.transparency[paletteIndex] : 255,
    ];
  }
  if (png.colorType === 4) {
    const gray = png.pixels[offset];
    return [gray, gray, gray, png.pixels[offset + 1]];
  }

  return [png.pixels[offset], png.pixels[offset + 1], png.pixels[offset + 2], png.pixels[offset + 3]];
}

function analyzePngBuffer(buffer, options = {}) {
  const png = parsePng(buffer);
  const config = { ...DEFAULT_OPTIONS, ...options };
  const pixelCount = png.width * png.height;
  const step = Math.max(1, Math.floor(pixelCount / 200000));
  const uniqueColors = new Set();
  let luminanceSum = 0;
  let luminanceSquareSum = 0;
  let nonTransparent = 0;
  let sampledPixels = 0;

  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += step) {
    const [red, green, blue, alpha] = pixelAt(png, pixelIndex);
    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    luminanceSum += luminance;
    luminanceSquareSum += luminance * luminance;
    sampledPixels += 1;
    if (alpha > 0) {
      nonTransparent += 1;
    }
    if (uniqueColors.size < 10000) {
      uniqueColors.add(`${red},${green},${blue},${alpha}`);
    }
  }

  const mean = sampledPixels > 0 ? luminanceSum / sampledPixels : 0;
  const variance = sampledPixels > 0 ? luminanceSquareSum / sampledPixels - mean * mean : 0;
  const luminanceStdDev = Math.sqrt(Math.max(0, variance));
  const nonTransparentRatio = sampledPixels > 0 ? nonTransparent / sampledPixels : 0;
  const failures = [];

  if (png.width < config.minWidth) failures.push(`width ${png.width} is below ${config.minWidth}`);
  if (png.height < config.minHeight) failures.push(`height ${png.height} is below ${config.minHeight}`);
  if (uniqueColors.size < config.minSampledUniqueColors) {
    failures.push(`only ${uniqueColors.size} sampled colors found`);
  }
  if (luminanceStdDev < config.minLuminanceStdDev) {
    failures.push(`luminance stddev ${round(luminanceStdDev)} is below ${config.minLuminanceStdDev}`);
  }
  if (nonTransparentRatio < config.minNonTransparentRatio) {
    failures.push(`non-transparent ratio ${round(nonTransparentRatio)} is below ${config.minNonTransparentRatio}`);
  }

  return {
    bitDepth: png.bitDepth,
    colorType: png.colorType,
    failures,
    height: png.height,
    luminanceStdDev: round(luminanceStdDev),
    nonBlank: failures.length === 0,
    nonTransparentRatio: round(nonTransparentRatio),
    sampledPixels,
    uniqueSampledColors: uniqueColors.size,
    width: png.width,
  };
}

function analyzePngFile(filePath, options = {}) {
  const buffer = fs.readFileSync(filePath);
  if (buffer.length <= 1024) {
    throw new Error(`Screenshot is too small to be credible: ${filePath}`);
  }
  return analyzePngBuffer(buffer, options);
}

function assertUsefulScreenshot(filePath, options = {}) {
  const analysis = analyzePngFile(filePath, options);
  if (!analysis.nonBlank) {
    throw new Error(`Screenshot does not look like a rendered app screen: ${analysis.failures.join("; ")}`);
  }
  return analysis;
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

function createRgbaPng(width, height, pixelFor) {
  const rowBytes = width * 4;
  const raw = Buffer.alloc((rowBytes + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * (rowBytes + 1);
    raw[rowOffset] = 0;
    for (let x = 0; x < width; x += 1) {
      const [red, green, blue, alpha = 255] = pixelFor(x, y);
      const offset = rowOffset + 1 + x * 4;
      raw[offset] = red;
      raw[offset + 1] = green;
      raw[offset + 2] = blue;
      raw[offset + 3] = alpha;
    }
  }

  return Buffer.concat([
    PNG_SIGNATURE,
    chunk("IHDR", ihdr(width, height)),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function ihdr(width, height) {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(width, 0);
  data.writeUInt32BE(height, 4);
  data[8] = 8;
  data[9] = 6;
  data[10] = 0;
  data[11] = 0;
  data[12] = 0;
  return data;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const output = Buffer.alloc(8 + data.length + 4);
  output.writeUInt32BE(data.length, 0);
  typeBuffer.copy(output, 4);
  data.copy(output, 8);
  output.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);
  return output;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function runSelfTest() {
  const useful = createRgbaPng(320, 320, (x, y) => [
    (x * 7 + y * 3) % 256,
    (x * 5 + y * 11) % 256,
    (x + y * 13) % 256,
    255,
  ]);
  const usefulAnalysis = analyzePngBuffer(useful);
  assert.equal(usefulAnalysis.nonBlank, true);
  assert.equal(usefulAnalysis.width, 320);
  assert.equal(usefulAnalysis.height, 320);

  const solid = createRgbaPng(320, 320, () => [255, 255, 255, 255]);
  const solidAnalysis = analyzePngBuffer(solid);
  assert.equal(solidAnalysis.nonBlank, false);
  assert.match(solidAnalysis.failures.join(" "), /sampled colors|luminance/);

  const tiny = createRgbaPng(80, 80, (x, y) => [x % 256, y % 256, 64, 255]);
  const tinyAnalysis = analyzePngBuffer(tiny);
  assert.equal(tinyAnalysis.nonBlank, false);
  assert.match(tinyAnalysis.failures.join(" "), /width 80|height 80/);

  assert.throws(() => analyzePngBuffer(Buffer.from("not a png")), /not a PNG|too small/);
  console.log("png-screenshot-audit self-test: pass");
}

if (require.main === module) {
  if (process.argv.includes("--self-test")) {
    runSelfTest();
  } else {
    const filePath = process.argv[2];
    if (!filePath) {
      console.error("Usage: node scripts/lib/png-screenshot-audit.js <screenshot.png> | --self-test");
      process.exit(1);
    }
    const analysis = assertUsefulScreenshot(filePath);
    console.log(JSON.stringify(analysis, null, 2));
  }
}

module.exports = {
  analyzePngBuffer,
  analyzePngFile,
  assertUsefulScreenshot,
  createRgbaPng,
};
