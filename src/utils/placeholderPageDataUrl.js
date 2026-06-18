export function placeholderPageDataUrl(label = 'Chưa có ảnh trang') {
  if (typeof document === 'undefined') return ''
  const c = document.createElement('canvas')
  c.width = 728
  c.height = 1030
  const ctx = c.getContext('2d')
  if (!ctx) return ''
  ctx.fillStyle = '#1e1d1b'
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.fillStyle = '#6b6a66'
  ctx.font = '22px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(label, c.width / 2, c.height / 2)
  return c.toDataURL('image/png')
}
