import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

const BLEND_TO_GLOBAL = {
  normal: 'source-over',
  multiply: 'multiply',
  screen: 'screen',
  overlay: 'overlay',
  darken: 'darken',
  lighten: 'lighten',
  'color-dodge': 'color-dodge',
  'color-burn': 'color-burn',
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export default function LayerCanvas({ layers, width = 800, height = 1100, className, mode = 'edit' }) {
  const canvasRef = useRef(null)
  const [imgCache, setImgCache] = useState({})
  const [renderError, setRenderError] = useState(null)

  const sorted = useMemo(() => [...layers].sort((a, b) => a.index - b.index), [layers])

  useEffect(() => {
    const urls = sorted.map((l) => l.imageUrl).filter(Boolean)
    const newOnes = urls.filter((u) => !imgCache[u])
    if (newOnes.length === 0) return
    let cancelled = false
    Promise.allSettled(newOnes.map(loadImage)).then((results) => {
      if (cancelled) return
      setImgCache((cur) => {
        const next = { ...cur }
        results.forEach((r, i) => {
          if (r.status === 'fulfilled') next[newOnes[i]] = r.value
        })
        return next
      })
    })
    return () => { cancelled = true }
  }, [sorted, imgCache])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (mode === 'preview') {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }

    const drawList = sorted.filter((l) => l.visible)
    let cancelled = false

    async function draw() {
      try {
        for (const layer of drawList) {
          const img = imgCache[layer.imageUrl]
          if (!img) continue
          const op = (layer.opacity ?? 100) / 100
          ctx.save()
          ctx.globalAlpha = op
          ctx.globalCompositeOperation = BLEND_TO_GLOBAL[layer.blendMode] || 'source-over'
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          ctx.restore()
        }
        setRenderError(null)
      } catch (err) {
        if (!cancelled) setRenderError(err.message)
      }
    }

    draw()
    return () => { cancelled = true }
  }, [sorted, imgCache, mode])

  return (
    <div className={cn('relative h-full w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm', className)}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="block h-full w-full"
        style={{ aspectRatio: `${width} / ${height}` }}
      />
      {renderError && (
        <div className="absolute inset-x-0 bottom-0 bg-red-50 px-2 py-1 text-[10px] text-red-600">
          Render lỗi: {renderError}
        </div>
      )}
      {sorted.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-400">
          Chưa có layer nào — upload để bắt đầu.
        </div>
      )}
    </div>
  )
}