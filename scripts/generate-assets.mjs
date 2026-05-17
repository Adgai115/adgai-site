#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = path.resolve(ROOT, '..', 'adgai-site-public', 'assets', 'resource-workbench.png');
const WIDTH = 1200;
const HEIGHT = 760;

function rgba(hex, alpha = 255) {
  const clean = hex.replace('#', '');
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16),
    alpha,
  ];
}

function blend(base, over) {
  const alpha = over[3] / 255;
  return [
    Math.round(over[0] * alpha + base[0] * (1 - alpha)),
    Math.round(over[1] * alpha + base[1] * (1 - alpha)),
    Math.round(over[2] * alpha + base[2] * (1 - alpha)),
    255,
  ];
}

function rect(pixels, x, y, width, height, color, radius = 0) {
  const maxY = Math.min(HEIGHT, y + height);
  const maxX = Math.min(WIDTH, x + width);
  for (let py = Math.max(0, y); py < maxY; py += 1) {
    for (let px = Math.max(0, x); px < maxX; px += 1) {
      if (radius) {
        const dx = Math.min(px - x, x + width - 1 - px);
        const dy = Math.min(py - y, y + height - 1 - py);
        if (dx < radius && dy < radius) {
          const cx = radius - dx;
          const cy = radius - dy;
          if (cx * cx + cy * cy > radius * radius) continue;
        }
      }
      pixels[py][px] = blend(pixels[py][px], color);
    }
  }
}

function line(pixels, x, y, width, color) {
  rect(pixels, x, y, width, 2, color);
}

function makePixels() {
  const top = rgba('#17211f');
  const bottom = rgba('#0f1514');
  const pixels = [];

  for (let y = 0; y < HEIGHT; y += 1) {
    const row = [];
    const t = y / (HEIGHT - 1);
    for (let x = 0; x < WIDTH; x += 1) {
      const side = Math.abs(x - WIDTH / 2) / (WIDTH / 2);
      row.push([
        Math.round(top[0] * (1 - t) + bottom[0] * t + 10 * (1 - side) * (1 - t)),
        Math.round(top[1] * (1 - t) + bottom[1] * t + 14 * (1 - side) * (1 - t)),
        Math.round(top[2] * (1 - t) + bottom[2] * t + 11 * (1 - side) * (1 - t)),
        255,
      ]);
    }
    pixels.push(row);
  }

  const panel = rgba('#f6faf8', 235);
  const header = rgba('#dfece7', 235);
  const white = rgba('#ffffff', 246);
  const muted = rgba('#9aa9a3', 150);
  const green = rgba('#55c7a9', 235);
  const amber = rgba('#d8aa4e', 235);
  const red = rgba('#d66d63', 235);
  const ink = rgba('#20312c', 220);
  const blue = rgba('#6aa3c8', 220);

  rect(pixels, 72, 64, 1056, 632, panel, 24);
  rect(pixels, 72, 64, 1056, 74, header, 24);

  [112, 142, 172].forEach((x, index) => rect(pixels, x, 94, 18, 18, [green, amber, red][index], 9));
  [190, 140, 170, 120].forEach((width, index) => line(pixels, 840 - index * 160, 101, width, muted));

  [
    [112, 176],
    [372, 176],
    [632, 176],
    [892, 176],
  ].forEach(([x, y], index) => {
    rect(pixels, x, y, 200, 122, white, 14);
    line(pixels, x + 24, y + 28, 86, muted);
    rect(pixels, x + 24, y + 58, 72 + index * 14, 22, [green, blue, amber, ink][index], 6);
    line(pixels, x + 24, y + 96, 136, muted);
  });

  rect(pixels, 112, 334, 472, 276, white, 16);
  line(pixels, 138, 362, 156, ink);
  [green, green, amber, green, blue, green].forEach((color, index) => {
    const y = 404 + index * 32;
    rect(pixels, 138, y, 10, 10, color, 5);
    line(pixels, 164, y + 4, 260 - index * 18, muted);
    line(pixels, 478, y + 4, 62 + index * 6, color);
  });

  rect(pixels, 616, 334, 472, 276, white, 16);
  line(pixels, 642, 362, 174, ink);
  [78, 118, 62, 148, 92, 132, 106].forEach((height, index) => {
    const x = 650 + index * 56;
    rect(pixels, x, 552 - height, 28, height, [green, blue, amber, green, ink, blue, green][index], 6);
    line(pixels, x - 4, 566, 36, muted);
  });

  rect(pixels, 112, 634, 976, 28, rgba('#dfece7', 210), 10);
  rect(pixels, 126, 644, 292, 8, green, 4);
  rect(pixels, 436, 644, 190, 8, amber, 4);
  rect(pixels, 644, 644, 312, 8, blue, 4);

  return pixels;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const name = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32 ? zlib.crc32(Buffer.concat([name, data])) : crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writePng(pixels) {
  const scanlines = [];
  for (const row of pixels) {
    const current = [0];
    for (const pixel of row) current.push(...pixel);
    scanlines.push(Buffer.from(current));
  }

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(
    OUTPUT,
    Buffer.concat([
      Buffer.from('\x89PNG\r\n\x1a\n', 'binary'),
      chunk('IHDR', Buffer.from([
        (WIDTH >>> 24) & 255, (WIDTH >>> 16) & 255, (WIDTH >>> 8) & 255, WIDTH & 255,
        (HEIGHT >>> 24) & 255, (HEIGHT >>> 16) & 255, (HEIGHT >>> 8) & 255, HEIGHT & 255,
        8, 6, 0, 0, 0,
      ])),
      chunk('IDAT', zlib.deflateSync(Buffer.concat(scanlines), { level: 9 })),
      chunk('IEND', Buffer.alloc(0)),
    ]),
  );
}

writePng(makePixels());
console.log(`Generated ${OUTPUT}`);

