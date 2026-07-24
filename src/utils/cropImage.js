/**
 * Crop vùng ảnh (từ react-easy-crop) → data URL JPEG.
 * @param {string} imageSrc
 * @param {{ x: number, y: number, width: number, height: number }} pixelCrop
 * @param {{ circular?: boolean, size?: number, width?: number, height?: number, quality?: number }} [opts]
 */
export async function getCroppedImageDataUrl(imageSrc, pixelCrop, opts = {}) {
  const { circular = true, quality = 0.92 } = opts
  const outW = Number(opts.width ?? opts.size ?? 512)
  const outH = Number(opts.height ?? opts.size ?? outW)

  const image = await loadImage(imageSrc)
  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Không tạo được canvas.')

  if (circular) {
    ctx.beginPath()
    ctx.arc(outW / 2, outH / 2, Math.min(outW, outH) / 2, 0, Math.PI * 2)
    ctx.closePath()
    ctx.clip()
  }

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outW,
    outH,
  )

  return canvas.toDataURL('image/jpeg', quality)
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.addEventListener('load', () => resolve(img))
    img.addEventListener('error', () => reject(new Error('Không tải được ảnh.')))
    img.crossOrigin = 'anonymous'
    img.src = src
  })
}
