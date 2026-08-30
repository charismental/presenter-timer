const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

function chunk(tag, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(Buffer.concat([tag, data])) >>> 0);
  return Buffer.concat([len, tag, data, crc]);
}

function pixel(x, y, size) {
  const cx = (x + 0.5) / size - 0.5;
  const cy = (y + 0.5) / size - 0.5;
  const r = Math.sqrt(cx * cx + cy * cy);
  const rounded = r < 0.46;
  if (!rounded) return [0, 0, 0, 0];
  const gold = r > 0.34 && r < 0.4;
  if (gold) return [232, 192, 122, 255];
  return [22, 18, 14, 255];
}

function writePng(file, size) {
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    for (let x = 0; x < size; x++) {
      Buffer.from(pixel(x, y, size)).copy(row, 1 + x * 4);
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk(Buffer.from("IHDR"), ihdr),
    chunk(Buffer.from("IDAT"), zlib.deflateSync(Buffer.concat(rows))),
    chunk(Buffer.from("IEND"), Buffer.alloc(0)),
  ]);
  fs.writeFileSync(file, png);
}

const dir = path.join(__dirname, "..", "assets");
fs.mkdirSync(dir, { recursive: true });
writePng(path.join(dir, "icon.png"), 256);
writePng(path.join(dir, "tray.png"), 32);
console.log("Wrote assets/icon.png and assets/tray.png");
