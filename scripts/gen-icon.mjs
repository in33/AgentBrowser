/**
 * 生成 AgentBrowser 应用图标 (PNG)
 * 设计概念：地球（浏览器/Web）+ AI 星芒（Agent 智能）
 * 256x256，渐变背景，圆角，白色线条
 */
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, '..', 'assets', 'icon.png');

const WIDTH = 256;
const HEIGHT = 256;
const pixels = Buffer.alloc(WIDTH * HEIGHT * 4);

// ---- 渐变背景：#6c5ce7 (左上) → #00d2ff (右下) ----
for (let y = 0; y < HEIGHT; y++) {
  for (let x = 0; x < WIDTH; x++) {
    const t = (x + y) / (WIDTH + HEIGHT);
    const r = Math.round(0x6c + (0x00 - 0x6c) * t);
    const g = Math.round(0x5c + (0xd2 - 0x5c) * t);
    const b = Math.round(0xe7 + (0xff - 0xe7) * t);
    const idx = (y * WIDTH + x) * 4;
    pixels[idx] = r;
    pixels[idx + 1] = g;
    pixels[idx + 2] = b;
    pixels[idx + 3] = 255;
  }
}

// ---- 圆角矩形遮罩（半径 48px）----
const radius = 48;
for (let y = 0; y < HEIGHT; y++) {
  for (let x = 0; x < WIDTH; x++) {
    const idx = (y * WIDTH + x) * 4;
    let inCorner = false, cx, cy;
    if (x < radius && y < radius) { cx = radius; cy = radius; inCorner = true; }
    else if (x >= WIDTH - radius && y < radius) { cx = WIDTH - radius - 1; cy = radius; inCorner = true; }
    else if (x < radius && y >= HEIGHT - radius) { cx = radius; cy = HEIGHT - radius - 1; inCorner = true; }
    else if (x >= WIDTH - radius && y >= HEIGHT - radius) { cx = WIDTH - radius - 1; cy = HEIGHT - radius - 1; inCorner = true; }
    if (inCorner) {
      const dx = x - cx, dy = y - cy;
      if (Math.sqrt(dx * dx + dy * dy) > radius) pixels[idx + 3] = 0;
    }
  }
}

// ---- 绘图辅助函数 ----
const cx = 128, cy = 128;

function setWhite(x, y, alpha = 255) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;
  const idx = (y * WIDTH + x) * 4;
  if (pixels[idx + 3] === 0) return;
  const a = alpha / 255;
  pixels[idx]     = Math.round(pixels[idx]     * (1 - a) + 255 * a);
  pixels[idx + 1] = Math.round(pixels[idx + 1] * (1 - a) + 255 * a);
  pixels[idx + 2] = Math.round(pixels[idx + 2] * (1 - a) + 255 * a);
}

function drawRing(centerX, centerY, r, strokeW) {
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const idx = (y * WIDTH + x) * 4;
      if (pixels[idx + 3] === 0) continue;
      const dx = x - centerX, dy = y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const diff = Math.abs(dist - r);
      if (diff < strokeW) {
        const alpha = Math.max(0, 1 - diff / strokeW) * 255;
        setWhite(x, y, alpha);
      }
    }
  }
}

function drawLatitude(centerX, centerY, r, yOffset, strokeW) {
  const y = centerY + yOffset;
  if (Math.abs(yOffset) >= r) return;
  const halfChord = Math.sqrt(r * r - yOffset * yOffset);
  for (let x = centerX - halfChord; x <= centerX + halfChord; x += 0.5) {
    for (let w = -strokeW; w <= strokeW; w += 0.5) {
      const alpha = Math.max(0, 1 - Math.abs(w) / strokeW) * 200;
      setWhite(x, y + w, alpha);
    }
  }
}

function drawEllipseArc(centerX, centerY, rx, ry, strokeW) {
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const idx = (y * WIDTH + x) * 4;
      if (pixels[idx + 3] === 0) continue;
      const dx = x - centerX, dy = y - centerY;
      const ellipseDist = Math.sqrt((dx / rx) ** 2 + (dy / ry) ** 2);
      const diff = Math.abs(ellipseDist - 1);
      if (diff * Math.min(rx, ry) < strokeW) {
        const alpha = Math.max(0, 1 - diff * Math.min(rx, ry) / strokeW) * 200;
        setWhite(x, y, alpha);
      }
    }
  }
}

function drawSparkle(centerX, centerY, size) {
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const idx = (y * WIDTH + x) * 4;
      if (pixels[idx + 3] === 0) continue;
      const dx = Math.abs(x - centerX), dy = Math.abs(y - centerY);
      const starVal = Math.sqrt(dx) + Math.sqrt(dy);
      const starR = Math.sqrt(size);
      if (starVal < starR) {
        const alpha = Math.max(0, 1 - starVal / starR) * 255;
        setWhite(x, y, alpha);
      }
    }
  }
  // 中心亮点
  for (let y = -3; y <= 3; y++) {
    for (let x = -3; x <= 3; x++) {
      const dist = Math.sqrt(x * x + y * y);
      if (dist < 3) setWhite(centerX + x, centerY + y, 255);
    }
  }
}

// ---- 绘制地球（浏览器/Web 概念）----
const globeR = 72;
const strokeW = 3.5;

// 地球外环
drawRing(cx, cy, globeR, strokeW);

// 纬线（水平弧线）
drawLatitude(cx, cy, globeR, 0, strokeW * 0.7);    // 赤道
drawLatitude(cx, cy, globeR, -36, strokeW * 0.6);  // 北回归线
drawLatitude(cx, cy, globeR, 36, strokeW * 0.6);   // 南回归线

// 中央经线（竖线，裁剪到圆内）
for (let y = cy - globeR; y <= cy + globeR; y += 0.5) {
  const dy = y - cy;
  const halfChord = Math.sqrt(Math.max(0, globeR * globeR - dy * dy));
  for (let w = -strokeW * 0.7; w <= strokeW * 0.7; w += 0.5) {
    const alpha = Math.max(0, 1 - Math.abs(w) / (strokeW * 0.7)) * 200;
    setWhite(cx + w, y, alpha);
  }
}

// 侧经线（椭圆弧，模拟 3D 球面）
drawEllipseArc(cx, cy, globeR * 0.45, globeR, strokeW * 0.6);
drawEllipseArc(cx, cy, globeR * 0.8, globeR, strokeW * 0.5);

// ---- 绘制 AI 星芒（Agent 智能）----
drawSparkle(cx, cy, 22);

// ---- PNG 编码 ----
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  const table = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      if (c & 1) c = 0xEDB88320 ^ (c >>> 1);
      else c = c >>> 1;
    }
    table[i] = c;
  }
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function adler32(buf) {
  let a = 1, b = 0;
  for (let i = 0; i < buf.length; i++) {
    a = (a + buf[i]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function deflateStore(data) {
  const header = Buffer.from([0x78, 0x01]);
  const blocks = [];
  let offset = 0;
  while (offset < data.length) {
    const chunk = data.subarray(offset, offset + 65535);
    const isLast = offset + chunk.length >= data.length;
    const blockHeader = Buffer.alloc(5);
    blockHeader[0] = isLast ? 0x01 : 0x00;
    blockHeader.writeUInt16LE(chunk.length, 1);
    blockHeader.writeUInt16LE(chunk.length ^ 0xFFFF, 3);
    blocks.push(blockHeader, chunk);
    offset += chunk.length;
  }
  const adler = Buffer.alloc(4);
  adler.writeUInt32BE(adler32(data), 0);
  return Buffer.concat([header, ...blocks, adler]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(WIDTH, 0);
ihdr.writeUInt32BE(HEIGHT, 4);
ihdr[8] = 8;  ihdr[9] = 6;  ihdr[10] = 0;  ihdr[11] = 0;  ihdr[12] = 0;

const rawData = Buffer.alloc((WIDTH * 4 + 1) * HEIGHT);
for (let y = 0; y < HEIGHT; y++) {
  rawData[y * (WIDTH * 4 + 1)] = 0;
  pixels.copy(rawData, y * (WIDTH * 4 + 1) + 1, y * WIDTH * 4, (y + 1) * WIDTH * 4);
}

const compressedData = deflateStore(rawData);

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
  makeChunk('IHDR', ihdr),
  makeChunk('IDAT', compressedData),
  makeChunk('IEND', Buffer.alloc(0)),
]);

writeFileSync(outPath, png);
console.log(`Icon generated: ${outPath} (${png.length} bytes)`);
