import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Eye, Images, Maximize2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

function Lightbox({ open, onOpenChange, src, title }) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => { if (e.key === 'Escape') onOpenChange(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] border-none bg-transparent p-0 shadow-none sm:max-w-[95vw]">
        {src ? (
          <div className="relative">
            <img
              src={src}
              alt={title ?? ''}
              className="mx-auto max-h-[90vh] w-auto rounded-lg bg-background object-contain"
            />
            {title ? (
              <p className="mt-2 text-center text-xs text-white/80">{title}</p>
            ) : null}
            <Button
              size="icon-sm"
              variant="secondary"
              className="absolute right-2 top-2"
              onClick={() => onOpenChange(false)}
            >
              <X className="size-4" />
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

export function ImageCompareGrid({ originals = [], results = [], className }) {
  const [mode, setMode] = useState('side') // 'side' | 'result' | 'original'
  const [lightbox, setLightbox] = useState(null)
  const [pageIndex, setPageIndex] = useState(0)

  const pairs = []
  const len = Math.max(originals.length, results.length)
  for (let i = 0; i < len; i += 1) {
    pairs.push({ original: originals[i] ?? null, result: results[i] ?? null })
  }

  useEffect(() => {
    setPageIndex((prev) => {
      if (!pairs.length) return 0
      return Math.min(prev, pairs.length - 1)
    })
  }, [len])

  useEffect(() => {
    if (!pairs.length) return undefined
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') {
        setPageIndex((i) => Math.max(0, i - 1))
      } else if (e.key === 'ArrowRight') {
        setPageIndex((i) => Math.min(pairs.length - 1, i + 1))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pairs.length])

  if (!pairs.length) {
    return null
  }

  const current = pairs[pageIndex] ?? pairs[0]
  const pageLabel = `Trang ${pageIndex + 1} / ${len}`

  function renderPage(p, i) {
    return (
      <div
        key={i}
        className={cn(
          'overflow-hidden rounded-lg border bg-muted',
          mode === 'side' && 'grid grid-cols-1 gap-px sm:grid-cols-2',
        )}
      >
        {mode !== 'result' ? (
          <div className="relative">
            {p.original ? (
              <button
                type="button"
                onClick={() => setLightbox({ src: p.original, title: `Trang ${i + 1} · Ảnh gốc` })}
                className="group block w-full"
              >
                <img
                  src={p.original}
                  alt={`Trang ${i + 1} gốc`}
                  className="block w-full transition-opacity group-hover:opacity-90"
                />
                <span className="absolute left-2 top-2 rounded-md bg-background/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground shadow-sm backdrop-blur">
                  Gốc
                </span>
                <span className="absolute right-2 top-2 rounded-md bg-background/80 p-1 text-foreground opacity-0 shadow-sm backdrop-blur transition-opacity group-hover:opacity-100">
                  <Maximize2 className="size-3" />
                </span>
              </button>
            ) : (
              <div className="flex aspect-[3/4] items-center justify-center text-xs text-muted-foreground">
                Không có ảnh gốc
              </div>
            )}
          </div>
        ) : null}

        {mode !== 'original' ? (
          <div className="relative">
            {p.result ? (
              <button
                type="button"
                onClick={() => setLightbox({ src: p.result, title: `Trang ${i + 1} · Assistant` })}
                className="group block w-full"
              >
                <img
                  src={p.result}
                  alt={`Trang ${i + 1} Assistant`}
                  className="block w-full transition-opacity group-hover:opacity-90"
                />
                <span className="absolute left-2 top-2 rounded-md bg-primary/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground shadow-sm">
                  Assistant
                </span>
                <span className="absolute right-2 top-2 rounded-md bg-background/80 p-1 text-foreground opacity-0 shadow-sm backdrop-blur transition-opacity group-hover:opacity-100">
                  <Maximize2 className="size-3" />
                </span>
              </button>
            ) : (
              <div className="flex aspect-[3/4] items-center justify-center text-xs text-muted-foreground">
                Assistant chưa nộp trang này
              </div>
            )}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-muted/40 p-1 text-xs">
        <button
          type="button"
          onClick={() => setMode('side')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors',
            mode === 'side' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Images className="size-3.5" />
          So sánh ({len} trang)
        </button>
        <button
          type="button"
          onClick={() => setMode('result')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors',
            mode === 'result' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Eye className="size-3.5" />
          Chỉ ảnh Assistant ({results.length})
        </button>
        <button
          type="button"
          onClick={() => setMode('original')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors',
            mode === 'original' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Eye className="size-3.5" />
          Chỉ ảnh gốc ({originals.length})
        </button>
      </div>

      {len > 1 ? (
        <div className="flex items-center justify-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            disabled={pageIndex <= 0}
            aria-label="Trang trước"
            onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-[5.5rem] text-center text-sm font-medium tabular-nums text-foreground">
            {pageLabel}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            disabled={pageIndex >= len - 1}
            aria-label="Trang sau"
            onClick={() => setPageIndex((i) => Math.min(len - 1, i + 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      ) : null}

      <div className="space-y-2">
        {renderPage(current, pageIndex)}
      </div>

      <Lightbox
        open={Boolean(lightbox)}
        onOpenChange={(o) => { if (!o) setLightbox(null) }}
        src={lightbox?.src}
        title={lightbox?.title}
      />
    </div>
  )
}

export default ImageCompareGrid
