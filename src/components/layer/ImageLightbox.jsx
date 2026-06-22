import { Download, Maximize2, X } from 'lucide-react'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Nút mở lightbox xem ảnh phóng to.
 * - `src` / `alt` là ảnh hiển thị.
 * - `title` hiển thị trên header của dialog.
 * - `trigger` tuỳ chỉnh (mặc định là nút Maximize2 absolute ở góc phải-trên).
 */
export function ImageLightbox({ src, alt, title, className, trigger }) {
  if (!src) return null

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button
            type="button"
            variant="secondary"
            size="icon-sm"
            className={cn(
              'size-8 rounded-full border border-slate-200/80 bg-white/90 text-slate-700 shadow-sm backdrop-blur transition-all hover:scale-105 hover:bg-white',
              className,
            )}
            title="Xem ảnh phóng to"
            aria-label="Xem ảnh phóng to"
            onClick={e => e.stopPropagation()}
          >
            <Maximize2 className="size-3.5" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className="max-w-[96vw] gap-0 overflow-hidden border-none bg-slate-950/95 p-0 shadow-2xl backdrop-blur sm:max-w-[96vw]"
      >
        {title ? (
          <DialogTitle className="sr-only">{title}</DialogTitle>
        ) : (
          <DialogTitle className="sr-only">{alt || 'Xem ảnh'}</DialogTitle>
        )}

        <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-gradient-to-b from-slate-900/80 to-transparent px-4 py-3 text-white">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-md">
              <Maximize2 className="size-3.5" />
            </div>
            <span className="truncate text-sm font-semibold tracking-tight">
              {title || alt || 'Xem ảnh'}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <a
              href={src}
              download
              className="inline-flex"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                size="icon-sm"
                variant="ghost"
                className="size-8 text-white hover:bg-white/10"
                title="Tải ảnh"
              >
                <Download className="size-4" />
              </Button>
            </a>
            <DialogClose asChild>
              <Button
                size="icon-sm"
                variant="ghost"
                className="size-8 text-white hover:bg-white/10"
                title="Đóng"
              >
                <X className="size-4" />
              </Button>
            </DialogClose>
          </div>
        </div>

        <div className="flex max-h-[88vh] min-h-0 items-center justify-center overflow-auto p-4">
          <img
            src={src}
            alt={alt || ''}
            className="mx-auto max-h-[84vh] w-auto rounded-md object-contain shadow-2xl ring-1 ring-white/10"
            draggable={false}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
