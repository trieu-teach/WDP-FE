/** Tiện ích màu & tô vùng cho canvas Assistant. */

export function hexToRgba(hex, alpha = 1) {
  const h = String(hex).replace('#', '')
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  const n = parseInt(full, 16)
  if (!Number.isFinite(n)) return `rgba(0,0,0,${alpha})`
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r},${g},${b},${alpha})`
}

export function colorWithOpacity(hex, opacityPercent) {
  return hexToRgba(hex, Math.max(0, Math.min(1, opacityPercent / 100)))
}

/** Tô màu flood-fill đơn giản trên canvas 2D (kiểu Paint). */
export function floodFillAt(canvasEl, x, y, fillHex, tolerance = 32) {
  const ctx = canvasEl.getContext('2d')
  if (!ctx) return false
  const w = canvasEl.width
  const h = canvasEl.height
  const px = Math.floor(x)
  const py = Math.floor(y)
  if (px < 0 || py < 0 || px >= w || py >= h) return false

  const img = ctx.getImageData(0, 0, w, h)
  const data = img.data
  const start = (py * w + px) * 4
  const sr = data[start]
  const sg = data[start + 1]
  const sb = data[start + 2]
  const sa = data[start + 3]

  const fill = hexToRgb(fillHex)
  if (!fill) return false
  if (colorsMatch(sr, sg, sb, sa, fill.r, fill.g, fill.b, 255, tolerance)) return true

  const stack = [[px, py]]
  const visited = new Uint8Array(w * h)

  while (stack.length) {
    const [cx, cy] = stack.pop()
    const i = cy * w + cx
    if (cx < 0 || cy < 0 || cx >= w || cy >= h || visited[i]) continue
    const p = i * 4
    if (!colorsMatch(data[p], data[p + 1], data[p + 2], data[p + 3], sr, sg, sb, sa, tolerance)) continue
    visited[i] = 1
    data[p] = fill.r
    data[p + 1] = fill.g
    data[p + 2] = fill.b
    data[p + 3] = 255
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1])
  }

  ctx.putImageData(img, 0, 0)
  return true
}

function hexToRgb(hex) {
  const h = String(hex).replace('#', '')
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  const n = parseInt(full, 16)
  if (!Number.isFinite(n)) return null
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function colorsMatch(r1, g1, b1, a1, r2, g2, b2, a2, tolerance) {
  return (
    Math.abs(r1 - r2) <= tolerance
    && Math.abs(g1 - g2) <= tolerance
    && Math.abs(b1 - b2) <= tolerance
    && Math.abs(a1 - a2) <= tolerance
  )
}

export function pickColorFromCanvas(canvas, x, y) {
  const ctx = canvas.getContext()
  if (!ctx) return null
  const px = Math.floor(x)
  const py = Math.floor(y)
  const d = ctx.getImageData(px, py, 1, 1).data
  const hex = `#${[d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join('')}`
  return hex
}
