import { Maximize2 } from 'lucide-react'
import {
  Dialog,
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
 * - `trigger` tuỳ chỉnh (mặc định là nút Maximize2).
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
              'absolute right-2 top-2 z-20 size-7 rounded-full bg-white/90 shadow-sm backdrop-blur hover:bg-white',
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
        showCloseButton
        className="max-w-[95vw] gap-2 border-none bg-transparent p-2 shadow-none sm:max-w-[95vw]"
      >
        {title ? (
          <DialogTitle className="px-2 text-sm font-medium text-white">
            {title}
          </DialogTitle>
        ) : (
          <DialogTitle className="sr-only">{alt || 'Xem ảnh'}</DialogTitle>
        )}
        <div className="flex max-h-[92vh] min-h-0 items-center justify-center overflow-auto">
          <img
            src={src}
            alt={alt || ''}
            className="mx-auto max-h-[90vh] w-auto rounded-md object-contain shadow-2xl"
            draggable={false}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
