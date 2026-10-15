const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Minimal pure-Node PNG generator using built-in zlib
function createPng(width, height, drawPixelFn) {
  const rowSize = 1 + width * 4;
  const rawBuffer = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawBuffer[rowOffset] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = drawPixelFn(x, y, width, height);
      const pixelOffset = rowOffset + 1 + x * 4;
      rawBuffer[pixelOffset] = r;
      rawBuffer[pixelOffset + 1] = g;
      rawBuffer[pixelOffset + 2] = b;
      rawBuffer[pixelOffset + 3] = a;
    }
  }

  const compressedData = zlib.deflateSync(rawBuffer);

  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i];
      for (let k = 0; k < 8; k++) {
        c = (c >>> 1) ^ (-(c & 1) & 0xedb88320);
      }
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  function createChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([len, typeBuf, data, crc]);
  }

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 6;  // RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdrChunk = createChunk('IHDR', ihdrData);

  const idatChunk = createChunk('IDAT', compressedData);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Draw a modern Shield icon with an emerald checkmark
function drawShield(x, y, w, h) {
  const nx = (x / w) * 2 - 1; // -1 to 1
  const ny = (y / h) * 2 - 1; // -1 to 1

  // Outer Shield curve
  // Top: flat with rounded corners; Bottom: curves to point (0, 0.85)
  const inTopHalf = ny <= 0.1;
  const inBottomHalf = ny > 0.1 && ny <= 0.85;

  let inShield = false;
  if (inTopHalf && ny >= -0.75) {
    inShield = Math.abs(nx) <= 0.72;
  } else if (inBottomHalf) {
    const bottomFactor = 1 - (ny - 0.1) / 0.75;
    inShield = Math.abs(nx) <= 0.72 * Math.sqrt(Math.max(0, bottomFactor));
  }

  if (!inShield) {
    return [0, 0, 0, 0]; // transparent
  }

  // Border thickness check
  let isBorder = false;
  const borderMargin = 0.12;
  if (ny < -0.63) isBorder = true;
  else if (inTopHalf && Math.abs(nx) >= 0.72 - borderMargin) isBorder = true;
  else if (inBottomHalf) {
    const bottomFactor = 1 - (ny - 0.1) / 0.75;
    if (Math.abs(nx) >= (0.72 - borderMargin) * Math.sqrt(Math.max(0, bottomFactor))) {
      isBorder = true;
    }
  }

  if (isBorder) {
    // Cyan/Blue shield border
    return [56, 189, 248, 255]; // #38bdf8
  }

  // Checkmark in center: from (-0.3, 0.05) to (-0.05, 0.3) to (0.35, -0.2)
  function distToSegment(px, py, x1, y1, x2, y2) {
    const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
  }

  const d1 = distToSegment(nx, ny, -0.32, 0.05, -0.08, 0.28);
  const d2 = distToSegment(nx, ny, -0.08, 0.28, 0.35, -0.25);
  const checkDist = Math.min(d1, d2);

  if (checkDist <= 0.11) {
    // Bright emerald green checkmark
    return [16, 185, 129, 255]; // #10b981
  }

  // Dark slate shield body
  return [15, 23, 42, 240]; // #0f172a
}

const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

[16, 48, 128].forEach((size) => {
  const pngBuf = createPng(size, size, drawShield);
  fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), pngBuf);
  console.log(`Generated icon${size}.png (${size}x${size})`);
});
