import fs from "fs";
import zlib from "zlib";
import { encodePng } from "./png-tools.mjs";

function decodePng(filePath) {
  const buf = fs.readFileSync(filePath);
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);

  let offset = 8;
  const idatChunks = [];

  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString("ascii", offset + 4, offset + 8);
    if (type === "IDAT") {
      idatChunks.push(buf.subarray(offset + 8, offset + 8 + length));
    }
    offset += 12 + length;
  }

  const decompressed = zlib.inflateSync(Buffer.concat(idatChunks));
  const bytesPerPixel = 4;
  const stride = 1 + width * bytesPerPixel;
  const pixels = Buffer.alloc(width * height * 4);

  let prevScanline = Buffer.alloc(width * bytesPerPixel);

  for (let y = 0; y < height; y++) {
    const filter = decompressed[y * stride];
    const scanline = decompressed.subarray(y * stride + 1, (y + 1) * stride);
    const currScanline = Buffer.alloc(width * bytesPerPixel);

    for (let x = 0; x < width * bytesPerPixel; x++) {
      const byte = scanline[x];
      const a = x >= bytesPerPixel ? currScanline[x - bytesPerPixel] : 0;
      const b = prevScanline[x];
      const c = x >= bytesPerPixel ? prevScanline[x - bytesPerPixel] : 0;

      let val = 0;
      if (filter === 0) val = byte;
      else if (filter === 1) val = (byte + a) & 0xff;
      else if (filter === 2) val = (byte + b) & 0xff;
      else if (filter === 3) val = (byte + Math.floor((a + b) / 2)) & 0xff;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        let pr = c;
        if (pa <= pb && pa <= pc) pr = a;
        else if (pb <= pc) pr = b;
        val = (byte + pr) & 0xff;
      }
      currScanline[x] = val;
    }
    currScanline.copy(pixels, y * width * 4);
    prevScanline = currScanline;
  }

  return { width, height, pixels };
}

// Bilinear scale function
function resample(srcPixels, srcW, srcH, dstW, dstH) {
  const dst = Buffer.alloc(dstW * dstH * 4);
  const xRatio = srcW / dstW;
  const yRatio = srcH / dstH;

  for (let dy = 0; dy < dstH; dy++) {
    const sy = dy * yRatio;
    const y0 = Math.floor(sy);
    const y1 = Math.min(y0 + 1, srcH - 1);
    const yWeight = sy - y0;

    for (let dx = 0; dx < dstW; dx++) {
      const sx = dx * xRatio;
      const x0 = Math.floor(sx);
      const x1 = Math.min(x0 + 1, srcW - 1);
      const xWeight = sx - x0;

      const idx00 = (y0 * srcW + x0) * 4;
      const idx10 = (y0 * srcW + x1) * 4;
      const idx01 = (y1 * srcW + x0) * 4;
      const idx11 = (y1 * srcW + x1) * 4;

      const dstIdx = (dy * dstW + dx) * 4;

      for (let c = 0; c < 4; c++) {
        const top = srcPixels[idx00 + c] * (1 - xWeight) + srcPixels[idx10 + c] * xWeight;
        const bottom = srcPixels[idx01 + c] * (1 - xWeight) + srcPixels[idx11 + c] * xWeight;
        dst[dstIdx + c] = Math.round(top * (1 - yWeight) + bottom * yWeight);
      }
    }
  }
  return dst;
}

// Simple ICO generator for 32x32 PNG
function makeIcoFromPng(pngBuf) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // ICO image
  header.writeUInt16LE(1, 4); // 1 image

  const entry = Buffer.alloc(16);
  entry.writeUInt8(32, 0); // width
  entry.writeUInt8(32, 1); // height
  entry.writeUInt8(0, 2);  // color palette
  entry.writeUInt8(0, 3);  // reserved
  entry.writeUInt16LE(1, 4); // color planes
  entry.writeUInt16LE(32, 6); // bpp
  entry.writeUInt32LE(pngBuf.length, 8); // size of image data
  entry.writeUInt32LE(6 + 16, 12); // offset

  return Buffer.concat([header, entry, pngBuf]);
}

const logoDark = decodePng("public/brand/logo-on-dark.png");

// 1. Generate Favicon (32x32) on Navy #031047
// Navy #031047 is R:3, G:16, B:71
const favSize = 32;
const favBuf = Buffer.alloc(favSize * favSize * 4);
for (let i = 0; i < favBuf.length; i += 4) {
  favBuf[i] = 3;
  favBuf[i + 1] = 16;
  favBuf[i + 2] = 71;
  favBuf[i + 3] = 255;
}

// Find bounding box in logoDark
let minX = logoDark.width, maxX = 0, minY = logoDark.height, maxY = 0;
for (let y = 0; y < logoDark.height; y++) {
  for (let x = 0; x < logoDark.width; x++) {
    const idx = (y * logoDark.width + x) * 4;
    if (logoDark.pixels[idx + 3] > 30) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}
const contentW = maxX - minX + 1;
const contentH = maxY - minY + 1;
const croppedLogo = Buffer.alloc(contentW * contentH * 4);
for (let y = 0; y < contentH; y++) {
  for (let x = 0; x < contentW; x++) {
    const srcIdx = ((minY + y) * logoDark.width + (minX + x)) * 4;
    const dstIdx = (y * contentW + x) * 4;
    logoDark.pixels.copy(croppedLogo, dstIdx, srcIdx, srcIdx + 4);
  }
}

// Scale down cropped logo to fit 30x15 inside 32x32
const favLogoW = 28;
const favLogoH = Math.round((contentH / contentW) * favLogoW);
const scaledFavLogo = resample(croppedLogo, contentW, contentH, favLogoW, favLogoH);

// Blit onto favBuf centered
const offX = Math.floor((favSize - favLogoW) / 2);
const offY = Math.floor((favSize - favLogoH) / 2);
for (let y = 0; y < favLogoH; y++) {
  for (let x = 0; x < favLogoW; x++) {
    const sIdx = (y * favLogoW + x) * 4;
    const dIdx = ((offY + y) * favSize + (offX + x)) * 4;
    const a = scaledFavLogo[sIdx + 3] / 255;
    if (a > 0) {
      favBuf[dIdx] = Math.round(scaledFavLogo[sIdx] * a + favBuf[dIdx] * (1 - a));
      favBuf[dIdx + 1] = Math.round(scaledFavLogo[sIdx + 1] * a + favBuf[dIdx + 1] * (1 - a));
      favBuf[dIdx + 2] = Math.round(scaledFavLogo[sIdx + 2] * a + favBuf[dIdx + 2] * (1 - a));
    }
  }
}

const favPng = encodePng(favSize, favSize, favBuf);
fs.writeFileSync("public/favicon.png", favPng);
fs.writeFileSync("public/brand/favicon.png", favPng);
fs.writeFileSync("public/favicon.ico", makeIcoFromPng(favPng));
console.log("Wrote public/favicon.png and public/favicon.ico");

// 2. Apple Touch Icon (180x180) on Navy #031047
const atiSize = 180;
const atiBuf = Buffer.alloc(atiSize * atiSize * 4);
for (let i = 0; i < atiBuf.length; i += 4) {
  atiBuf[i] = 3;
  atiBuf[i + 1] = 16;
  atiBuf[i + 2] = 71;
  atiBuf[i + 3] = 255;
}
const atiLogoW = 150;
const atiLogoH = Math.round((contentH / contentW) * atiLogoW);
const scaledAtiLogo = resample(croppedLogo, contentW, contentH, atiLogoW, atiLogoH);
const atiOffX = Math.floor((atiSize - atiLogoW) / 2);
const atiOffY = Math.floor((atiSize - atiLogoH) / 2);
for (let y = 0; y < atiLogoH; y++) {
  for (let x = 0; x < atiLogoW; x++) {
    const sIdx = (y * atiLogoW + x) * 4;
    const dIdx = ((atiOffY + y) * atiSize + (atiOffX + x)) * 4;
    const a = scaledAtiLogo[sIdx + 3] / 255;
    if (a > 0) {
      atiBuf[dIdx] = Math.round(scaledAtiLogo[sIdx] * a + atiBuf[dIdx] * (1 - a));
      atiBuf[dIdx + 1] = Math.round(scaledAtiLogo[sIdx + 1] * a + atiBuf[dIdx + 1] * (1 - a));
      atiBuf[dIdx + 2] = Math.round(scaledAtiLogo[sIdx + 2] * a + atiBuf[dIdx + 2] * (1 - a));
    }
  }
}
const atiPng = encodePng(atiSize, atiSize, atiBuf);
fs.writeFileSync("public/apple-touch-icon.png", atiPng);
fs.writeFileSync("public/brand/apple-touch-icon.png", atiPng);
console.log("Wrote public/apple-touch-icon.png");

// 3. OG Image (1200x630, cap + FARO SCHOOL, navy background #031047)
const ogW = 1200;
const ogH = 630;
const ogBuf = Buffer.alloc(ogW * ogH * 4);
for (let i = 0; i < ogBuf.length; i += 4) {
  ogBuf[i] = 3;
  ogBuf[i + 1] = 16;
  ogBuf[i + 2] = 71;
  ogBuf[i + 3] = 255;
}
const ogLogoW = 750;
const ogLogoH = Math.round((contentH / contentW) * ogLogoW);
const scaledOgLogo = resample(croppedLogo, contentW, contentH, ogLogoW, ogLogoH);
const ogOffX = Math.floor((ogW - ogLogoW) / 2);
const ogOffY = Math.floor((ogH - ogLogoH) / 2);
for (let y = 0; y < ogLogoH; y++) {
  for (let x = 0; x < ogLogoW; x++) {
    const sIdx = (y * ogLogoW + x) * 4;
    const dIdx = ((ogOffY + y) * ogW + (ogOffX + x)) * 4;
    const a = scaledOgLogo[sIdx + 3] / 255;
    if (a > 0) {
      ogBuf[dIdx] = Math.round(scaledOgLogo[sIdx] * a + ogBuf[dIdx] * (1 - a));
      ogBuf[dIdx + 1] = Math.round(scaledOgLogo[sIdx + 1] * a + ogBuf[dIdx + 1] * (1 - a));
      ogBuf[dIdx + 2] = Math.round(scaledOgLogo[sIdx + 2] * a + ogBuf[dIdx + 2] * (1 - a));
    }
  }
}
const ogPng = encodePng(ogW, ogH, ogBuf);
fs.writeFileSync("public/og-image.png", ogPng);
fs.writeFileSync("public/brand/og-image.png", ogPng);
console.log("Wrote public/og-image.png (1200x630)");
