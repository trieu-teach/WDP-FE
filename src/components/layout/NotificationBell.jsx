import { useState } from 'react'
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  FileUp,
  Flag,
  Inbox,
  Info,
  ListChecks,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useNotifications } from '@/hooks/useNotifications.js'
import { getSession } from '@/lib/auth.js'
import { NotificationDetailDialog } from '@/components/layout/NotificationDetailDialog.jsx'

const TYPE_META = {
  info: { tone: 'sky', label: 'Thông báo', icon: Info },
  success: { tone: 'emerald', label: 'Thành công', icon: CheckCircle2 },
  warning: { tone: 'amber', label: 'Cảnh báo', icon: Flag },
  error: { tone: 'rose', label: 'Lỗi', icon: Flag },
  assignment: { tone: 'violet', label: 'Giao việc', icon: ListChecks },
  review: { tone: 'amber', label: 'Duyệt bản', icon: ListChecks },
  cooperation: { tone: 'violet', label: 'Hợp tác', icon: ListChecks },
  te_review: { tone: 'sky', label: 'TE review', icon: ListChecks },
  eb_evaluation: { tone: 'emerald', label: 'EB đánh giá', icon: CheckCircle2 },
  chapter: { tone: 'sky', label: 'Chapter', icon: CheckCircle2 },
  series: { tone: 'emerald', label: 'Series', icon: CheckCircle2 },
  page: { tone: 'violet', label: 'Trang', icon: FileUp },
  task: { tone: 'violet', label: 'Task', icon: CheckCircle2 },
  vote: { tone: 'emerald', label: 'Biểu quyết', icon: CheckCircle2 },
  series_end_request_submitted: { tone: 'amber', label: 'Yêu cầu kết thúc', icon: Flag },
  series_end_approved: { tone: 'emerald', label: 'Duyệt kết thúc', icon: Flag },
  series_end_final_chapter_pending: { tone: 'amber', label: 'Chapter cuối', icon: Flag },
  series_end_rejected: { tone: 'rose', label: 'Từ chối kết thúc', icon: Flag },
  series_end_auto_cancelled: { tone: 'amber', label: 'Hủy yêu cầu', icon: Flag },
  series_end_notify_readers: { tone: 'emerald', label: 'Series kết thúc', icon: CheckCircle2 },
  series_end_notify_assistant: { tone: 'violet', label: 'Series kết thúc', icon: CheckCircle2 },
}

const TONE_ICON_RING = {
  sky: 'bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400',
  emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  rose: 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400',
  violet: 'bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400',
}

function timeAgo(iso) {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const diff = Date.now() - t
  if (diff < 60_000) return 'vừa xong'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} phút`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} giờ`
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)} ngày`
  return new Date(iso).toLocaleDateString('vi-VN')
}

/** Icon + tone theo type BE hoặc nội dung tiêu đề (chỉ UI). */
function resolveNotificationVisual(n) {
  const typeKey = String(n.type ?? '').toLowerCase()
  const fromType = TYPE_META[typeKey]
  if (fromType) return fromType

  const combined = `${n.title ?? ''} ${n.message ?? ''}`.toLowerCase()

  if (/assistant đã nộp|đã nộp kết quả/.test(combined)) {
    return { icon: FileUp, tone: 'sky', label: 'Nộp kết quả' }
  }
  if (/yêu cầu kết thúc|kết thúc truyện/.test(combined)) {
    return { icon: Flag, tone: 'amber', label: 'Kết thúc truyện' }
  }
  if (
    /tasks đã được duyệt|chapter đã xuất bản|đã xuất bản|đã publish/.test(
      combined,
    )
  ) {
    return { icon: CheckCircle2, tone: 'emerald', label: 'Hoàn tất' }
  }

  return TYPE_META.info
}

export function NotificationBell({ className }) {
  const user = getSession()
  const {
    items,
    unreadCount,
    loading,
    refresh,
    markRead,
    markAllRead,
    dismiss,
  } = useNotifications({ enabled: Boolean(user) })
  const [openDetail, setOpenDetail] = useState(null)
  const visibleItems = items.slice(0, 8)
  const hasMore = items.length > visibleItems.length

  function openItem(n) {
    if (!n.isRead) void markRead(n.id)
    setOpenDetail(n)
  }

  return (
    <>
      <DropdownMenu onOpenChange={(open) => { if (open) void refresh() }}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn(
              'relative size-9 shrink-0 cursor-pointer rounded-full p-2 text-gray-600',
              'hover:bg-gray-100 hover:text-gray-900',
              'dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50',
              className,
            )}
            aria-label={unreadCount > 0 ? `${unreadCount} thông báo chưa đọc` : 'Thông báo'}
          >
            <Bell className="size-4" />
            {unreadCount > 0 ? (
              <span
                className="pointer-events-none absolute -right-1 -top-1 z-10 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-center text-[10px] font-bold leading-none text-white shadow-sm"
                aria-hidden
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            ) : null}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={8}
          className="w-[min(100vw-1.5rem,400px)] overflow-hidden rounded-xl border border-border/80 p-0 shadow-lg"
        >
          <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-popover px-4 py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Bell className="size-4" />
              </span>
              <div className="min-w-0 leading-tight">
                <p className="text-sm font-semibold text-foreground">Thông báo</p>
                <p className="text-[11px] text-muted-foreground">
                  {unreadCount > 0
                    ? `${unreadCount} chưa đọc`
                    : 'Đã đọc hết'}
                </p>
              </div>
            </div>
            <Button
              size="xs"
              variant="ghost"
              disabled={unreadCount === 0}
              onClick={() => void markAllRead()}
              className="shrink-0 gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <CheckCheck className="size-3.5" />
              Đọc tất cả
            </Button>
          </div>

          <div className="max-h-[min(60vh,420px)] overflow-y-auto overscroll-contain">
            {visibleItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-4 py-14 text-center">
                <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Inbox className="size-4" />
                </span>
                <p className="text-xs text-muted-foreground">
                  {loading ? 'Đang tải thông báo...' : 'Chưa có thông báo nào.'}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border/50">
                {visibleItems.map((n) => {
                  const visual = resolveNotificationVisual(n)
                  const Icon = visual.icon ?? Info
                  const iconRing =
                    TONE_ICON_RING[visual.tone] ?? TONE_ICON_RING.sky

                  function handleKeyDown(e) {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      openItem(n)
                    }
                  }

                  return (
                    <li key={n.id}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => openItem(n)}
                        onKeyDown={handleKeyDown}
                        className={cn(
                          'group flex w-full cursor-pointer items-start gap-3 px-3 py-3 text-left transition-colors',
                          'hover:bg-muted/50 focus:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40',
                          !n.isRead
                            ? 'border-l-[3px] border-l-primary bg-slate-50 dark:bg-slate-900/50'
                            : 'border-l-[3px] border-l-transparent bg-popover',
                        )}
                      >
                        <span
                          className={cn(
                            'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg',
                            iconRing,
                          )}
                          aria-hidden
                        >
                          <Icon className="size-4" strokeWidth={2} />
                        </span>

                        <div className="min-w-0 flex-1 space-y-1 pr-1">
                          <div className="flex items-start gap-2">
                            <p
                              className={cn(
                                'min-w-0 flex-1 text-[13px] leading-snug',
                                !n.isRead
                                  ? 'font-semibold text-foreground'
                                  : 'font-medium text-foreground/70',
                              )}
                            >
                              {n.title}
                            </p>
                            <span className="shrink-0 pt-0.5 text-[10px] tabular-nums text-muted-foreground">
                              {timeAgo(n.createdAt)}
                            </span>
                          </div>
                          {n.message ? (
                            <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                              {n.message}
                            </p>
                          ) : null}
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            void dismiss(n.id)
                          }}
                          className="mt-0.5 shrink-0 rounded-md p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 focus:opacity-100"
                          aria-label="Xoá thông báo"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {hasMore ? (
            <div className="border-t border-border/60 bg-muted/25 px-4 py-2.5 text-center">
              <span className="inline-flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
                Hiển thị {visibleItems.length} / {items.length} thông báo
                <ChevronDown className="size-3 opacity-50" aria-hidden />
              </span>
            </div>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <NotificationDetailDialog
        notification={openDetail}
        open={Boolean(openDetail)}
        onOpenChange={(o) => { if (!o) setOpenDetail(null) }}
      />
    </>
  )
}

export default NotificationBell
