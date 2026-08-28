const fs = require('node:fs')
const path = require('node:path')

const sizes = [16, 24, 32, 48, 64, 128, 256]
const outPath = path.join(process.cwd(), 'resources', 'app-icon.ico')

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

function makeCanvas(size) {
  const pixels = new Uint8ClampedArray(size * size * 4)
  const setPixel = (x, y, r, g, b, a = 255) => {
    x = Math.round(x); y = Math.round(y)
    if (x < 0 || y < 0 || x >= size || y >= size) return
    const index = (y * size + x) * 4
    const alpha = a / 255
    const inv = 1 - alpha
    pixels[index] = Math.round(r * alpha + pixels[index] * inv)
    pixels[index + 1] = Math.round(g * alpha + pixels[index + 1] * inv)
    pixels[index + 2] = Math.round(b * alpha + pixels[index + 2] * inv)
    pixels[index + 3] = clamp(Math.round(a + pixels[index + 3] * inv), 0, 255)
  }
  const fillRect = (x0, y0, x1, y1, color) => {
    for (let y = Math.floor(y0); y < Math.ceil(y1); y++) for (let x = Math.floor(x0); x < Math.ceil(x1); x++) setPixel(x, y, ...color)
  }
  const fillCircle = (cx, cy, radius, color) => {
    const r2 = radius * radius
    for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
      for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
        const dx = x + .5 - cx, dy = y + .5 - cy
        if (dx * dx + dy * dy <= r2) setPixel(x, y, ...color)
      }
    }
  }
  const fillTriangle = (a, b, c, color) => {
    const minX = Math.floor(Math.min(a[0], b[0], c[0])), maxX = Math.ceil(Math.max(a[0], b[0], c[0]))
    const minY = Math.floor(Math.min(a[1], b[1], c[1])), maxY = Math.ceil(Math.max(a[1], b[1], c[1]))
    const area = (p1, p2, p3) => (p1[0] * (p2[1] - p3[1]) + p2[0] * (p3[1] - p1[1]) + p3[0] * (p1[1] - p2[1]))
    const total = area(a, b, c)
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const p = [x + .5, y + .5]
      const w1 = area(p, b, c) / total, w2 = area(a, p, c) / total, w3 = area(a, b, p) / total
      if (w1 >= 0 && w2 >= 0 && w3 >= 0) setPixel(x, y, ...color)
    }
  }
  const thickLine = (x0, y0, x1, y1, width, color) => {
    const dx = x1 - x0, dy = y1 - y0, length = Math.max(1, Math.hypot(dx, dy))
    const steps = Math.ceil(length * 2)
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      fillCircle(x0 + dx * t, y0 + dy * t, width / 2, color)
    }
  }
  return { pixels, setPixel, fillRect, fillCircle, fillTriangle, thickLine }
}

function renderIcon(size) {
  const c = makeCanvas(size)
  const s = size / 256
  const dark = [26, 33, 43, 255]
  const edge = [48, 61, 77, 255]
  const white = [245, 247, 250, 255]
  const blue = [57, 143, 238, 255]

  const radius = 34 * s
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const px = x + .5, py = y + .5
    const cx = clamp(px, radius, size - radius), cy = clamp(py, radius, size - radius)
    if ((px - cx) ** 2 + (py - cy) ** 2 <= radius ** 2) c.setPixel(x, y, ...dark)
  }

  const bw = Math.max(1, Math.round(4 * s))
  for (let i = 0; i < bw; i++) {
    const pad = Math.round((6 + i) * s)
    c.fillRect(pad, pad, size - pad, pad + 1, edge)
    c.fillRect(pad, size - pad - 1, size - pad, size - pad, edge)
    c.fillRect(pad, pad, pad + 1, size - pad, edge)
    c.fillRect(size - pad - 1, pad, size - pad, size - pad, edge)
  }

  const x0 = 58 * s, y0 = 64 * s, x1 = 190 * s, y1 = 171 * s, fw = Math.max(2, 11 * s)
  c.fillRect(x0, y0, x1, y0 + fw, white)
  c.fillRect(x0, y1 - fw, x1, y1, white)
  c.fillRect(x0, y0, x0 + fw, y1, white)
  c.fillRect(x1 - fw, y0, x1, y1, white)
  const hole = Math.max(2, 9 * s)
  for (const yy of [82, 112, 142]) {
    c.fillRect((x0 + 2 * s), yy * s, (x0 + 2 * s) + hole, yy * s + hole, dark)
    c.fillRect((x1 - 2 * s) - hole, yy * s, x1 - 2 * s, yy * s + hole, dark)
  }

  c.fillTriangle([107 * s, 88 * s], [107 * s, 149 * s], [159 * s, 119 * s], blue)

  c.fillCircle(151 * s, 181 * s, 18 * s, blue)
  c.fillCircle(194 * s, 181 * s, 18 * s, blue)
  c.fillCircle(151 * s, 181 * s, 8 * s, dark)
  c.fillCircle(194 * s, 181 * s, 8 * s, dark)
  c.thickLine(162 * s, 169 * s, 210 * s, 121 * s, Math.max(2, 9 * s), blue)
  c.thickLine(183 * s, 169 * s, 135 * s, 127 * s, Math.max(2, 9 * s), blue)
  c.fillTriangle([202 * s, 128 * s], [217 * s, 112 * s], [207 * s, 137 * s], blue)
  c.fillTriangle([141 * s, 133 * s], [127 * s, 119 * s], [148 * s, 142 * s], blue)
  return c.pixels
}

function dibForSize(size) {
  const rgba = renderIcon(size)
  const xorBytes = size * size * 4
  const maskStride = Math.ceil(size / 32) * 4
  const maskBytes = maskStride * size
  const dib = Buffer.alloc(40 + xorBytes + maskBytes)
  dib.writeUInt32LE(40, 0)
  dib.writeInt32LE(size, 4)
  dib.writeInt32LE(size * 2, 8)
  dib.writeUInt16LE(1, 12)
  dib.writeUInt16LE(32, 14)
  dib.writeUInt32LE(0, 16)
  dib.writeUInt32LE(xorBytes + maskBytes, 20)
  let out = 40
  for (let y = size - 1; y >= 0; y--) {
    for (let x = 0; x < size; x++) {
      const src = (y * size + x) * 4
      dib[out++] = rgba[src + 2]
      dib[out++] = rgba[src + 1]
      dib[out++] = rgba[src]
      dib[out++] = rgba[src + 3]
    }
  }
  return dib
}

const images = sizes.map((size) => ({ size, data: dibForSize(size) }))
const headerSize = 6 + images.length * 16
let offset = headerSize
const icon = Buffer.alloc(headerSize + images.reduce((sum, image) => sum + image.data.length, 0))
icon.writeUInt16LE(0, 0)
icon.writeUInt16LE(1, 2)
icon.writeUInt16LE(images.length, 4)
images.forEach((image, index) => {
  const entry = 6 + index * 16
  icon[entry] = image.size === 256 ? 0 : image.size
  icon[entry + 1] = image.size === 256 ? 0 : image.size
  icon[entry + 2] = 0
  icon[entry + 3] = 0
  icon.writeUInt16LE(1, entry + 4)
  icon.writeUInt16LE(32, entry + 6)
  icon.writeUInt32LE(image.data.length, entry + 8)
  icon.writeUInt32LE(offset, entry + 12)
  image.data.copy(icon, offset)
  offset += image.data.length
})

fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, icon)
console.log(`Generated Windows app icon: ${outPath} (${icon.length} bytes)`)
