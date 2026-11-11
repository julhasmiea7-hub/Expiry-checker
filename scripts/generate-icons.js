import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function createPng(width, height, r, g, b, accentR, accentG, accentB) {
  // Simple PNG encoder using Node zlib
  const rowBytes = 1 + width * 4;
  const rawData = Buffer.alloc(height * rowBytes);

  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.36;

  for (let y = 0; y < height; y++) {
    const rowStart = y * rowBytes;
    rawData[rowStart] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const px = rowStart + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Icon center badge or background
      if (dist < radius) {
        // Emerald/cyan accent
        const t = (x + y) / (width + height);
        rawData[px] = Math.round(accentR * (1 - t) + 6 * t);
        rawData[px + 1] = Math.round(accentG * (1 - t) + 182 * t);
        rawData[px + 2] = Math.round(accentB * (1 - t) + 212 * t);
        rawData[px + 3] = 255;
      } else if (dist < radius + 6) {
        // Outline ring
        rawData[px] = 255;
        rawData[px + 1] = 255;
        rawData[px + 2] = 255;
        rawData[px + 3] = 220;
      } else {
        // Dark background
        rawData[px] = r;
        rawData[px + 1] = g;
        rawData[px + 2] = b;
        rawData[px + 3] = 255;
      }
    }
  }

  const deflated = zlib.deflateSync(rawData);

  function createChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crc = crc32(Buffer.concat([typeBuf, data]));
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const ihdrChunk = createChunk('IHDR', ihdr);
  const idatChunk = createChunk('IDAT', deflated);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// CRC32 table
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) {
      c = 0xedb88320 ^ (c >>> 1);
    } else {
      c = c >>> 1;
    }
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

const outDir = path.resolve('public');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// 192x192
const png192 = createPng(192, 192, 15, 23, 42, 16, 185, 129);
fs.writeFileSync(path.join(outDir, 'pwa-192x192.png'), png192);

// 512x512
const png512 = createPng(512, 512, 15, 23, 42, 16, 185, 129);
fs.writeFileSync(path.join(outDir, 'pwa-512x512.png'), png512);

// 512x512 maskable (extra padding safe zone)
const pngMaskable = createPng(512, 512, 15, 23, 42, 16, 185, 129);
fs.writeFileSync(path.join(outDir, 'pwa-maskable-512x512.png'), pngMaskable);

// 180x180 apple touch icon
const png180 = createPng(180, 180, 15, 23, 42, 16, 185, 129);
fs.writeFileSync(path.join(outDir, 'apple-touch-icon.png'), png180);

console.log('Successfully generated PWA PNG icons in /public');
