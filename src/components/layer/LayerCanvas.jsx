import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ImagePlus, Move, MoveDiagonal, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { regionToPixels } from '@/utils/apiMappers.js'

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

const WORK_TYPE_COLORS = {
  shading: 'rgba(139, 92, 246, 0.25)',
  background: 'rgba(34, 197, 94, 0.20)',
  effects: 'rgba(245, 158, 11, 0.20)',
  details: 'rgba(59, 130, 246, 0.20)',
  other: 'rgba(156, 163, 175, 0.20)',
}

const WORK_TYPE_BORDER = {
  shading: '#8b5cf6',
  background: '#22c55e',
  effects: '#f59e0b',
  details: '#3b82f6',
  other: '#9ca3af',
}

const ZOOM_STEP = 0.15
const MIN_ZOOM = 0.1
const MAX_ZOOM = 5

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export default function LayerCanvas({
  layers,
  width = 800,
  height = 1100,
  className,
  mode = 'edit',
  baseImage,
  region,
  notes = [],
  showRegion = true,
  showNotes = true,
  fullscreen = false,
}) {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  const [imgCache, setImgCache] = useState({})
  const [renderError, setRenderError] = useState(null)

  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const panStart = useRef(null)
  const [cursorMode, setCursorMode] = useState('default')

  const sorted = useMemo(() => [...layers].sort((a, b) => a.index - b.index), [layers])
  const visibleCount = sorted.filter((l) => l.visible).length

  // Preload images (base + layers)
  useEffect(() => {
    const urls = sorted.map((l) => l.imageUrl).filter(Boolean)
    if (baseImage) urls.unshift(baseImage)
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
  }, [sorted, imgCache, baseImage])

  // Render canvas
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

    async function draw() {
      try {
        // Vẽ ảnh gốc làm nền
        if (baseImage) {
          const baseImg = imgCache[baseImage]
          if (baseImg) {
            ctx.drawImage(baseImg, 0, 0, canvas.width, canvas.height)
          }
        } else if (mode === 'preview') {
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
        }

        // Vẽ layers đè lên ảnh gốc (đảo ngược để layer index thấp đè lên cao, khớp panel)
        const reversed = [...drawList].reverse()
        for (const layer of reversed) {
          const img = imgCache[layer.imageUrl]
          if (!img) continue
          const op = (layer.opacity ?? 100) / 100
          ctx.save()
          ctx.globalAlpha = op
          ctx.globalCompositeOperation = BLEND_TO_GLOBAL[layer.blendMode] || 'source-over'
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          ctx.restore()
        }

        if (showRegion && region) {
          const px = regionToPixels(region, canvas.width, canvas.height)
          ctx.save()
          ctx.fillStyle = 'rgba(139, 92, 246, 0.12)'
          ctx.strokeStyle = '#8b5cf6'
          ctx.lineWidth = 2
          ctx.setLineDash([6, 4])
          ctx.fillRect(px.x, px.y, px.width, px.height)
          ctx.strokeRect(px.x, px.y, px.width, px.height)
          ctx.setLineDash([])
          ctx.restore()
        }

        if (showNotes && notes.length > 0) {
          for (const note of notes) {
            const nx = Math.round(canvas.width * (note.x / 100))
            const ny = Math.round(canvas.height * (note.y / 100))
            const nw = Math.round(canvas.width * ((note.w ?? note.width ?? 0) / 100))
            const nh = Math.round(canvas.height * ((note.h ?? note.height ?? 0) / 100))
            const color = WORK_TYPE_BORDER[note.taskType] ?? WORK_TYPE_BORDER.other
            const fill = WORK_TYPE_COLORS[note.taskType] ?? WORK_TYPE_COLORS.other

            ctx.save()
            ctx.fillStyle = fill
            ctx.strokeStyle = color
            ctx.lineWidth = 1.5
            ctx.fillRect(nx, ny, nw, nh)
            ctx.strokeRect(nx, ny, nw, nh)

            if (note.text && note.text.trim()) {
              const label = `[${note.taskType ?? 'note'}] ${note.text.trim()}`
              ctx.font = 'bold 11px sans-serif'
              const tw = ctx.measureText(label).width
              const padX = 5, padY = 3
              const lx = Math.min(nx, nx + nw - tw - padX * 2)
              const ly = Math.max(0, ny - 18)
              ctx.fillStyle = color
              ctx.fillRect(lx, ly, tw + padX * 2, 16)
              ctx.fillStyle = '#ffffff'
              ctx.fillText(label, lx + padX, ly + 12)
            }
            ctx.restore()
          }
        }

        setRenderError(null)
      } catch (err) {
        setRenderError(err.message)
      }
    }

    draw()
  }, [sorted, imgCache, mode, region, notes, showRegion, showNotes, baseImage])

  // Zoom with wheel
  const handleWheel = useCallback((e) => {
    e.preventDefault()
    if (e.ctrlKey || e.metaKey) {
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
      setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +(z + delta).toFixed(2))))
    } else {
      setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }))
    }
  }, [])

  // Pan with mouse drag
  const handleMouseDown = useCallback((e) => {
    if (e.button === 0) {
      panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
      setIsPanning(true)
    }
  }, [pan])

  const handleMouseMove = useCallback((e) => {
    if (isPanning && panStart.current) {
      setPan({
        x: e.clientX - panStart.current.x,
        y: e.clientY - panStart.current.y,
      })
    }
  }, [isPanning])

  const handleMouseUp = useCallback(() => {
    if (isPanning) {
      setIsPanning(false)
      panStart.current = null
    }
  }, [isPanning])

  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(MAX_ZOOM, +(z + ZOOM_STEP).toFixed(2)))
  }, [])

  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(MIN_ZOOM, +(z - ZOOM_STEP).toFixed(2)))
  }, [])

  const handleZoomReset = useCallback(() => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }, [])

  const fitToView = useCallback(() => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }, [])

  // Reset pan when switching pages
  useEffect(() => {
    setPan({ x: 0, y: 0 })
    setZoom(1)
  }, [width, height, baseImage])

  const zoomPercent = Math.round(zoom * 100)

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative flex h-full w-full items-center justify-center overflow-hidden bg-[#1a1a2e]',
        className,
      )}
      style={{ cursor: isPanning ? 'grabbing' : cursorMode === 'pan' ? 'grab' : 'default' }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={fitToView}
    >
      {/* Dot-grid background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage: 'radial-gradient(circle, #888 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Canvas area — sized to canvas dimensions, transform for zoom/pan */}
      <div
        className="relative rounded-sm shadow-2xl shadow-black/60 ring-1 ring-white/10 overflow-hidden"
        style={{
          width,
          height,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: 'center center',
          transition: isPanning ? 'none' : undefined,
          flexShrink: 0,
        }}
      >
        {/* Checkerboard for transparency */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(45deg, #888 25%, transparent 25%), linear-gradient(-45deg, #888 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #888 75%), linear-gradient(-45deg, transparent 75%, #888 75%)',
            backgroundSize: '16px 16px',
            backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
          }}
        />
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="block"
        />

        {/* Empty state */}
        {sorted.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/90 backdrop-blur-sm">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 shadow-inner">
              <ImagePlus className="size-7 text-slate-400" />
            </div>
            <div className="text-base font-semibold text-slate-600">Chưa có layer nào</div>
            <div className="text-sm text-slate-400">Upload để bắt đầu ghép</div>
          </div>
        )}

        {/* All hidden state */}
        {sorted.length > 0 && visibleCount === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-sm">
            <div className="rounded-full border border-slate-300 bg-white/90 px-4 py-2 text-sm font-medium text-slate-500 shadow-sm backdrop-blur">
              Tất cả layer đang ẩn
            </div>
          </div>
        )}

        {/* Layer count badge */}
        {sorted.length > 0 && visibleCount > 0 && (
          <div className="pointer-events-none absolute left-2.5 top-2.5 z-10 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/60 px-2.5 py-1 text-[10px] font-semibold text-white shadow-sm backdrop-blur">
            <span className="size-1.5 rounded-full bg-violet-400" />
            {visibleCount}/{sorted.length} hiện
          </div>
        )}

        {/* Render error */}
        {renderError && (
          <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 rounded-md border border-red-500/30 bg-red-950/90 px-3 py-1.5 text-xs font-medium text-red-300 shadow-sm backdrop-blur">
            Render lỗi: {renderError}
          </div>
        )}
      </div>

      {/* ZOOM TOOLBAR */}
      <div className="pointer-events-none absolute bottom-4 left-1/2 z-30 flex items-center gap-1 -translate-x-1/2 rounded-2xl border border-white/10 bg-black/70 px-2 py-1.5 shadow-xl backdrop-blur-md">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-7 text-white/80 hover:bg-white/10 hover:text-white"
          onClick={handleZoomOut}
          title="Thu nhỏ (Ctrl + Wheel)"
        >
          <ZoomOut className="size-3.5" />
        </Button>

        <button
          type="button"
          onClick={handleZoomReset}
          title="Reset zoom (Double-click)"
          className="flex min-w-[52px] items-center justify-center rounded-md px-1.5 py-0.5 text-xs font-mono font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          {zoomPercent}%
        </button>

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-7 text-white/80 hover:bg-white/10 hover:text-white"
          onClick={handleZoomIn}
          title="Phóng to (Ctrl + Wheel)"
        >
          <ZoomIn className="size-3.5" />
        </Button>

        <div className="mx-1 h-4 w-px bg-white/20" />

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className={cn(
            'size-7 text-white/80 hover:bg-white/10 hover:text-white',
            cursorMode === 'pan' && 'bg-white/10 text-white',
          )}
          onClick={() => setCursorMode((m) => (m === 'pan' ? 'default' : 'pan'))}
          title="Kéo di chuyển"
        >
          <Move className="size-3.5" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-7 text-white/80 hover:bg-white/10 hover:text-white"
          onClick={fitToView}
          title="Fit to view"
        >
          <MoveDiagonal className="size-3.5" />
        </Button>

        <div className="mx-1 h-4 w-px bg-white/20" />

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-7 text-white/80 hover:bg-white/10 hover:text-white"
          onClick={handleZoomReset}
          title="Reset view"
        >
          <RotateCcw className="size-3.5" />
        </Button>
      </div>

      {/* Hint */}
      <div className="pointer-events-none absolute right-4 bottom-4 z-30 rounded-lg border border-white/10 bg-black/50 px-2 py-1 text-[10px] font-medium text-white/30 backdrop-blur">
        Ctrl+Wheel zoom · Drag to pan · Double-click reset
      </div>
    </div>
  )
}
