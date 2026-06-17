import {
  Bell,
  CheckCheck,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Handshake,
  Image as ImageIcon,
  Info,
  ListChecks,
  Sparkles,
  Trash2,
  TrendingUp,
  UserPlus,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

const TYPE_META = {
  info: { icon: Info, label: 'Thông báo', tone: 'sky' },
  success: { icon: CheckCircle2, label: 'Thành công', tone: 'emerald' },
  warning: { icon: Clock, label: 'Cảnh báo', tone: 'amber' },
  error: { icon: XCircle, label: 'Lỗi', tone: 'rose' },
  assignment: { icon: UserPlus, label: 'Giao việc', tone: 'violet' },
  review: { icon: ListChecks, label: 'Duyệt bản', tone: 'amber' },
  cooperation: { icon: Handshake, label: 'Hợp tác', tone: 'violet' },
  te_review: { icon: ListChecks, label: 'TE review', tone: 'sky' },
  eb_evaluation: { icon: Sparkles, label: 'EB đánh giá', tone: 'emerald' },
  chapter: { icon: FileText, label: 'Chapter', tone: 'sky' },
  series: { icon: TrendingUp, label: 'Series', tone: 'emerald' },
  page: { icon: ImageIcon, label: 'Trang', tone: 'violet' },
  task: { icon: UserPlus, label: 'Task', tone: 'violet' },
  vote: { icon: CheckCircle2, label: 'Biểu quyết', tone: 'emerald' },
}

const TONE_STYLE = {
  sky: { ring: 'bg-sky-500/10 text-sky-600', dot: 'bg-sky-500' },
  emerald: { ring: 'bg-emerald-500/10 text-emerald-600', dot: 'bg-emerald-500' },
  amber: { ring: 'bg-amber-500/10 text-amber-600', dot: 'bg-amber-500' },
  rose: { ring: 'bg-rose-500/10 text-rose-600', dot: 'bg-rose-500' },
  violet: { ring: 'bg-violet-500/10 text-violet-600', dot: 'bg-violet-500' },
}

const RELATED_TYPE_LABEL = {
  series: 'Series',
  chapter: 'Chapter',
  page: 'Trang',
  task: 'Task',
  cooperation_request: 'Yêu cầu hợp tác',
  cooperation: 'Hợp tác',
  te_review: 'TE review',
  eb_evaluation: 'EB đánh giá',
  vote: 'Biểu quyết',
}

function timeText(iso) {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const full = new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  const diff = Date.now() - t
  if (diff < 60_000) return `${full} · vừa xong`
  if (diff < 3_600_000) return `${full} · ${Math.floor(diff / 60_000)} phút trước`
  if (diff < 86_400_000) return `${full} · ${Math.floor(diff / 3_600_000)} giờ trước`
  return full
}

function MetaRow({ label, value, mono = false }) {
  if (!value && value !== 0) return null
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className={cn('truncate text-right font-medium text-foreground', mono && 'font-mono')}>
        {String(value)}
      </span>
    </div>
  )
}

function Pill({ children, tone = 'sky' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium',
        TONE_STYLE[tone]?.ring ?? TONE_STYLE.sky.ring,
      )}
    >
      {children}
    </span>
  )
}

export function NotificationDetailDialog({ notification, open, onOpenChange }) {
  if (!notification) return null

  const typeKey = String(notification.type ?? '').toLowerCase()
  const meta = TYPE_META[typeKey] ?? TYPE_META.info
  const Icon = meta.icon
  const tone = meta.tone
  const toneStyle = TONE_STYLE[tone] ?? TONE_STYLE.sky
  const relatedType = notification.relatedEntityType
  const relatedId = notification.relatedEntityId
  const metaObj = notification.meta ?? {}

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-md">
        <div className={cn('relative px-6 pb-5 pt-6', toneStyle.ring)}>
          <span
            className={cn('absolute left-0 top-0 h-1 w-full', toneStyle.dot)}
            aria-hidden
          />
          <DialogHeader>
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  'flex size-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset',
                  'bg-card text-foreground ring-border/60 shadow-sm',
                )}
              >
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Pill tone={tone}>
                    <span className={cn('size-1.5 rounded-full', toneStyle.dot)} />
                    {meta.label}
                  </Pill>
                  {relatedType ? (
                    <Pill tone="sky">
                      {RELATED_TYPE_LABEL[relatedType] ?? relatedType}
                    </Pill>
                  ) : null}
                </div>
                <DialogTitle className="text-base leading-snug">
                  {notification.title || meta.label}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {timeText(notification.createdAt)}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4 px-6 py-5">
            {notification.message ? (
              <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-sm leading-relaxed text-foreground">
                {notification.message}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
                Thông báo này không có nội dung chi tiết.
              </div>
            )}

            {(relatedId || Object.keys(metaObj).length > 0) ? (
              <div className="space-y-2.5 rounded-xl border border-border/60 bg-card p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Chi tiết
                </p>
                <div className="space-y-2">
                  {metaObj?.mangakaName ? (
                    <MetaRow label="Mangaka" value={metaObj.mangakaName} />
                  ) : null}
                  {metaObj?.assistantName ? (
                    <MetaRow label="Assistant" value={metaObj.assistantName} />
                  ) : null}
                  {metaObj?.seriesName ? (
                    <MetaRow label="Series" value={metaObj.seriesName} />
                  ) : null}
                  {metaObj?.chapterNumber ? (
                    <MetaRow label="Chapter" value={metaObj.chapterNumber} />
                  ) : null}
                  {metaObj?.pageNumber ? (
                    <MetaRow label="Trang" value={metaObj.pageNumber} />
                  ) : null}
                  {metaObj?.status ? (
                    <MetaRow label="Trạng thái" value={String(metaObj.status)} />
                  ) : null}
                  {metaObj?.role ? (
                    <MetaRow label="Vai trò" value={String(metaObj.role)} />
                  ) : null}
                  {relatedId ? (
                    <MetaRow label="Mã đối tượng" value={relatedId} mono />
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </ScrollArea>

        {notification.link ? (
          <div className="flex items-center justify-end gap-2 border-t bg-muted/20 px-6 py-3">
            <Button asChild size="sm" className="gap-1.5">
              <a href={notification.link}>
                <ExternalLink className="size-3.5" />
                Mở chi tiết
              </a>
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

export default NotificationDetailDialog
