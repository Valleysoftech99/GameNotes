import { mkdir, writeFile } from 'node:fs/promises'
import { deflateSync } from 'node:zlib'

const sizes = [180, 192, 512]
const pngChunk = (type, data) => {
  const name = Buffer.from(type)
  const body = Buffer.concat([name, data])
  let crc = 0xffffffff
  for (const byte of body) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  const crcBuffer = Buffer.alloc(4)
  crcBuffer.writeUInt32BE((crc ^ 0xffffffff) >>> 0)
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  return Buffer.concat([length, body, crcBuffer])
}
const clamp = (v) => Math.max(0, Math.min(1, v))
const blend = (dst, src, alpha) => dst.map((channel, i) => Math.round(channel * (1 - alpha) + src[i] * alpha))
function makeIcon(size) {
  const rows = Buffer.alloc((size * 4 + 1) * size)
  const scale = size / 512
  const center = 255.5
  const petals = Array.from({ length: 6 }, (_, index) => {
    const angle = index * Math.PI / 3 - Math.PI / 2
    return { x: center + Math.cos(angle) * 86 * scale, y: center + Math.sin(angle) * 86 * scale, color: index % 2 ? [240, 171, 252] : [196, 181, 253] }
  })
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1)
    rows[row] = 0
    for (let x = 0; x < size; x++) {
      const px = x + 0.5; const py = y + 0.5
      const dx = px - center; const dy = py - center
      const distance = Math.hypot(dx, dy)
      const glow = Math.pow(Math.max(0, 1 - distance / (size * .72)), 2) * .32
      let color = blend([17, 16, 39], [74, 45, 120], glow)
      for (const petal of petals) {
        const d = Math.hypot(px - petal.x, py - petal.y)
        const coverage = clamp((55 * scale + 0.7 - d) / 1.4)
        if (coverage) color = blend(color, petal.color, coverage)
      }
      const centerCoverage = clamp((43 * scale + 0.7 - distance) / 1.4)
      if (centerCoverage) color = blend(color, [249, 226, 255], centerCoverage)
      const spark = Math.hypot(dx + 112 * scale, dy + 117 * scale)
      const sparkCoverage = clamp((8 * scale + 0.7 - spark) / 1.4)
      if (sparkCoverage) color = blend(color, [255, 255, 255], sparkCoverage)
      const offset = row + 1 + x * 4
      rows[offset] = color[0]; rows[offset + 1] = color[1]; rows[offset + 2] = color[2]; rows[offset + 3] = 255
    }
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4)
  header[8] = 8; header[9] = 6; header[10] = 0; header[11] = 0; header[12] = 0
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk('IHDR', header), pngChunk('IDAT', deflateSync(rows, { level: 9 })), pngChunk('IEND', Buffer.alloc(0))])
}
await mkdir('public/icons', { recursive: true })
for (const size of sizes) await writeFile(`public/icons/icon-${size}.png`, makeIcon(size))
