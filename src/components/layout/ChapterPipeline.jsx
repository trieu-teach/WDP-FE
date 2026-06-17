import { CheckCircle2, Circle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

const STAGE_META = {
  draft: { label: 'Bản nháp', tone: 'zinc' },
  assistant: { label: 'Gửi Assistant', tone: 'violet' },
  review: { label: 'Chờ Mangaka duyệt', tone: 'amber' },
  tantou: { label: 'Chờ Tantou', tone: 'sky' },
  done: { label: 'Hoàn tất', tone: 'emerald' },
}

const TONE = {
  zinc: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700/50 dark:text-zinc-300',
  violet: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  sky: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400',
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
}

const STAGE_ORDER = ['draft', 'assistant', 'review', 'tantou', 'done']

export function ChapterPipeline({ status, className }) {
  const currentIndex = STAGE_ORDER.indexOf(status)
  const safeIndex = currentIndex === -1 ? 0 : currentIndex
  return (
    <ol className={cn('flex w-full items-center gap-1', className)}>
      {STAGE_ORDER.map((stage, i) => {
        const meta = STAGE_META[stage]
        const isPast = i < safeIndex
        const isCurrent = i === safeIndex
        const isFuture = i > safeIndex
        return (
          <li key={stage} className="flex min-w-0 flex-1 items-center gap-1.5">
            <span
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full',
                isCurrent
                  ? cn('ring-2 ring-primary ring-offset-2 ring-offset-background', TONE[meta.tone])
                  : isPast
                    ? 'bg-emerald-500 text-white'
                    : 'bg-muted text-muted-foreground',
              )}
              aria-hidden
            >
              {isPast ? (
                <CheckCircle2 className="size-3.5" />
              ) : isCurrent ? (
                <Clock className="size-3.5" />
              ) : (
                <Circle className="size-3.5" />
              )}
            </span>
            <span
              className={cn(
                'truncate text-[10px] font-medium',
                isCurrent ? 'text-foreground' : isFuture ? 'text-muted-foreground/70' : 'text-foreground/80',
              )}
            >
              {meta.label}
            </span>
            {i < STAGE_ORDER.length - 1 ? (
              <span
                className={cn(
                  'mx-0.5 h-px flex-1',
                  isPast ? 'bg-emerald-500/60' : 'bg-border',
                )}
                aria-hidden
              />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

export default ChapterPipeline
