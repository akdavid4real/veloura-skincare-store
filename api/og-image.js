import { deflateSync } from 'node:zlib'

const W = 1200
const H = 630

function crc32(buf) {
  let crc = 0xffffffff
  for (const byte of buf) {
    crc ^= byte
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data = Buffer.alloc(0)) {
  const t = Buffer.from(type)
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0)
  return Buffer.concat([len, t, data, crc])
}

function makePng() {
  const rgba = Buffer.alloc(W * H * 4)

  const set = (x, y, r, g, b, a = 255) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return
    const i = (y * W + x) * 4
    rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = a
  }

  const blend = (x, y, r, g, b, alpha) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return
    const i = (y * W + x) * 4
    const a = alpha / 255
    rgba[i] = Math.round(rgba[i] * (1 - a) + r * a)
    rgba[i + 1] = Math.round(rgba[i + 1] * (1 - a) + g * a)
    rgba[i + 2] = Math.round(rgba[i + 2] * (1 - a) + b * a)
    rgba[i + 3] = 255
  }

  const rect = (x, y, w, h, c) => {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) set(xx, yy, ...c)
  }

  const circle = (cx, cy, radius, c, alpha = 255) => {
    const r2 = radius * radius
    for (let y = Math.max(0, cy - radius); y <= Math.min(H - 1, cy + radius); y++) {
      const dy = y - cy
      const dx = Math.floor(Math.sqrt(Math.max(0, r2 - dy * dy)))
      for (let x = Math.max(0, cx - dx); x <= Math.min(W - 1, cx + dx); x++) {
        if (alpha === 255) set(x, y, ...c)
        else blend(x, y, ...c, alpha)
      }
    }
  }

  const roundedRect = (x, y, w, h, rad, c) => {
    rect(x + rad, y, w - rad * 2, h, c)
    rect(x, y + rad, w, h - rad * 2, c)
    circle(x + rad, y + rad, rad, c)
    circle(x + w - rad - 1, y + rad, rad, c)
    circle(x + rad, y + h - rad - 1, rad, c)
    circle(x + w - rad - 1, y + h - rad - 1, rad, c)
  }

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const t = x / (W - 1)
      const s = y / (H - 1)
      set(
        x, y,
        Math.round(255 * (1 - t) + 239 * t),
        Math.round((247 - 8 * s) * (1 - t) + (212 - 8 * s) * t),
        Math.round((244 - 6 * s) * (1 - t) + (222 - 6 * s) * t)
      )
    }
  }

  circle(1040, 130, 210, [139, 63, 90], 18)
  circle(1110, 520, 250, [139, 63, 90], 12)
  circle(80, 570, 130, [255, 255, 255], 70)

  roundedRect(690, 486, 380, 34, 17, [222, 195, 188])
  for (let r = 180; r > 120; r -= 4) circle(880, 493, r, [120, 70, 80], 2)

  roundedRect(748, 238, 286, 252, 36, [255, 249, 247])
  roundedRect(766, 176, 250, 92, 28, [198, 151, 137])
  rect(786, 188, 210, 12, [232, 194, 177])
  roundedRect(780, 288, 224, 122, 18, [250, 239, 237])
  circle(892, 346, 78, [255, 255, 255], 20)

  for (let i = 0; i < 5; i++) {
    circle(1020 + i * 22, 420 - i * 35, 13, [139, 63, 90], 95)
    circle(1042 + i * 22, 430 - i * 35, 9, [139, 63, 90], 65)
  }

  const font = {
    A:['01110','10001','10001','11111','10001','10001','10001'],
    C:['01111','10000','10000','10000','10000','10000','01111'],
    E:['11111','10000','10000','11110','10000','10000','11111'],
    I:['11111','00100','00100','00100','00100','00100','11111'],
    K:['10001','10010','10100','11000','10100','10010','10001'],
    L:['10000','10000','10000','10000','10000','10000','11111'],
    N:['10001','11001','10101','10011','10001','10001','10001'],
    O:['01110','10001','10001','10001','10001','10001','01110'],
    R:['11110','10001','10001','11110','10100','10010','10001'],
    S:['01111','10000','10000','01110','00001','00001','11110'],
    U:['10001','10001','10001','10001','10001','10001','01110'],
    V:['10001','10001','10001','10001','10001','01010','00100'],
  }

  const drawText = (text, x, y, scale, color, tracking = 2) => {
    let cursor = x
    for (const ch of text) {
      if (ch === ' ') { cursor += 4 * scale; continue }
      const glyph = font[ch]
      if (!glyph) { cursor += 6 * scale; continue }
      for (let gy = 0; gy < 7; gy++) for (let gx = 0; gx < 5; gx++) {
        if (glyph[gy][gx] === '1') rect(cursor + gx * scale, y + gy * scale, scale, scale, color)
      }
      cursor += 5 * scale + tracking * scale
    }
  }

  drawText('VELOURA', 82, 150, 12, [45, 32, 37], 1)
  drawText('SKINCARE', 88, 270, 4, [139, 63, 90], 2)
  drawText('VELOURA', 802, 318, 4, [75, 47, 54], 1)
  drawText('SKINCARE', 824, 374, 2, [139, 63, 90], 1)

  rect(88, 325, 360, 4, [139, 63, 90])
  rect(88, 405, 480, 2, [199, 155, 165])

  const raw = Buffer.alloc((W * 4 + 1) * H)
  for (let y = 0; y < H; y++) {
    const row = y * (W * 4 + 1)
    raw[row] = 0
    rgba.copy(raw, row + 1, y * W * 4, (y + 1) * W * 4)
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(W, 0)
  ihdr.writeUInt32BE(H, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND')
  ])
}

const png = makePng()

export default function handler(_req, res) {
  res.setHeader('Content-Type', 'image/png')
  res.setHeader('Content-Length', String(png.length))
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400')
  res.status(200).send(png)
}
