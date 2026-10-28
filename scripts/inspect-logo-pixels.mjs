import fs from "fs";
import zlib from "zlib";

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

for (const file of ["public/brand/logo-on-light.png", "public/brand/logo-on-dark.png"]) {
  const { width, height, pixels } = decodePng(file);
  console.log(`\n=== ${file} ===`);
  console.log(`Width: ${width}, Height: ${height}`);
  const cornerR = pixels[0], cornerG = pixels[1], cornerB = pixels[2], cornerA = pixels[3];
  console.log(`Top-left pixel (0,0): RGBA(${cornerR}, ${cornerG}, ${cornerB}, ${cornerA})`);

  // Sample unique dominant non-white/non-black colors
  const colorCounts = new Map();
  for (let i = 0; i < pixels.length; i += 4) {
    const a = pixels[i + 3];
    if (a < 50) continue; // transparent
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const hex = "#" + [r, g, b].map(x => x.toString(16).padStart(2, "0")).join("").toUpperCase();
    colorCounts.set(hex, (colorCounts.get(hex) || 0) + 1);
  }

  const sorted = [...colorCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  console.log("Top colors:", sorted);
}
