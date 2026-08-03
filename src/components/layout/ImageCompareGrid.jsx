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

const FLOATING_BADGE =
  'absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-white backdrop-blur-md'

function ComparePane({ src, emptyLabel, badge, lightboxTitle, onOpen }) {
  if (!src) {
    return (
      <div className="flex min-h-[min(52vh,560px)] items-center justify-center bg-muted/40 text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative block w-full overflow-hidden bg-zinc-950/5"
    >
      <img
        src={src}
        alt={lightboxTitle}
        className="mx-auto block max-h-[min(70vh,720px)] w-full object-contain transition-opacity group-hover:opacity-95"
      />
      <span className={FLOATING_BADGE}>{badge}</span>
      <span className="absolute right-3 top-3 rounded-full bg-black/50 p-1.5 text-white opacity-0 backdrop-blur-md transition-opacity group-hover:opacity-100">
        <Maximize2 className="size-3.5" />
      </span>
    </button>
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
          'overflow-hidden rounded-xl bg-muted/30',
          mode === 'side' && 'grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3',
        )}
      >
        {mode !== 'result' ? (
          <ComparePane
            src={p.original}
            emptyLabel="Không có ảnh gốc"
            badge="Gốc"
            lightboxTitle={`Trang ${i + 1} · Ảnh gốc`}
            onOpen={() => setLightbox({ src: p.original, title: `Trang ${i + 1} · Ảnh gốc` })}
          />
        ) : null}

        {mode !== 'original' ? (
          <ComparePane
            src={p.result}
            emptyLabel="Assistant chưa nộp trang này"
            badge="Assistant"
            lightboxTitle={`Trang ${i + 1} · Assistant`}
            onOpen={() => setLightbox({ src: p.result, title: `Trang ${i + 1} · Assistant` })}
          />
        ) : null}
      </div>
    )
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 rounded-full bg-muted/50 p-1 text-xs">
          <button
            type="button"
            onClick={() => setMode('side')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium transition-colors',
              mode === 'side' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Images className="size-3.5" />
            So sánh ({len})
          </button>
          <button
            type="button"
            onClick={() => setMode('result')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium transition-colors',
              mode === 'result' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Eye className="size-3.5" />
            Assistant ({results.length})
          </button>
          <button
            type="button"
            onClick={() => setMode('original')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium transition-colors',
              mode === 'original' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Eye className="size-3.5" />
            Gốc ({originals.length})
          </button>
        </div>

        {len > 1 ? (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="size-8 rounded-full"
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
              className="size-8 rounded-full"
              disabled={pageIndex >= len - 1}
              aria-label="Trang sau"
              onClick={() => setPageIndex((i) => Math.min(len - 1, i + 1))}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        ) : null}
      </div>

      {renderPage(current, pageIndex)}

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
