import { useState } from 'react'
import { Bell, CheckCheck, Inbox, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { useNotifications } from '@/hooks/useNotifications.js'
import { getSession } from '@/lib/auth.js'
import { NotificationDetailDialog } from '@/components/layout/NotificationDetailDialog.jsx'

const TYPE_META = {
  info: { tone: 'sky', label: 'Thông báo' },
  success: { tone: 'emerald', label: 'Thành công' },
  warning: { tone: 'amber', label: 'Cảnh báo' },
  error: { tone: 'rose', label: 'Lỗi' },
  assignment: { tone: 'violet', label: 'Giao việc' },
  review: { tone: 'amber', label: 'Duyệt bản' },
  cooperation: { tone: 'violet', label: 'Hợp tác' },
  te_review: { tone: 'sky', label: 'TE review' },
  eb_evaluation: { tone: 'emerald', label: 'EB đánh giá' },
  chapter: { tone: 'sky', label: 'Chapter' },
  series: { tone: 'emerald', label: 'Series' },
  page: { tone: 'violet', label: 'Trang' },
  task: { tone: 'violet', label: 'Task' },
  vote: { tone: 'emerald', label: 'Biểu quyết' },
}

const TONE_DOT = {
  sky: 'bg-sky-500',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  violet: 'bg-violet-500',
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
    <DropdownMenu onOpenChange={(open) => { if (open) void refresh() }}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon-sm"
          className={cn('relative overflow-visible', className)}
          aria-label={unreadCount > 0 ? `${unreadCount} thông báo chưa đọc` : 'Thông báo'}
        >
          <Bell className="size-4" />
          {unreadCount > 0 ? (
            <span
              className="absolute -right-1.5 -top-1.5 flex min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground shadow-sm ring-2 ring-background"
              aria-hidden
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[380px] overflow-hidden p-0">
        <div className="flex items-center justify-between gap-2 border-b bg-gradient-to-b from-primary/[0.04] to-transparent px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Bell className="size-3.5" />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold">Thông báo</p>
              <p className="text-[10px] text-muted-foreground">
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
            className="gap-1 text-xs"
          >
            <CheckCheck className="size-3" />
            Đọc tất cả
          </Button>
        </div>

        <ScrollArea className="max-h-[400px]">
          {visibleItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
              <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Inbox className="size-4" />
              </span>
              <p className="text-xs text-muted-foreground">
                {loading ? 'Đang tải thông báo...' : 'Chưa có thông báo nào.'}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {visibleItems.map((n) => {
                const typeKey = String(n.type ?? '').toLowerCase()
                const typeMeta = TYPE_META[typeKey]
                const dot = TONE_DOT[typeMeta?.tone ?? 'sky'] ?? TONE_DOT.sky
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => openItem(n)}
                      className={cn(
                        'group relative flex w-full items-start gap-3 px-4 py-3 text-left transition-colors',
                        'hover:bg-muted/40',
                        !n.isRead && 'bg-primary/[0.03]',
                      )}
                    >
                      {!n.isRead ? (
                        <span
                          className="absolute left-1.5 top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-primary"
                          aria-hidden
                        />
                      ) : null}
                      <span
                        className={cn('mt-1.5 size-2 shrink-0 rounded-full ring-2 ring-background', dot)}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={cn(
                              'line-clamp-1 text-sm',
                              !n.isRead ? 'font-semibold' : 'font-medium text-foreground/80',
                            )}
                          >
                            {n.title}
                          </p>
                          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                            {timeAgo(n.createdAt)}
                          </span>
                        </div>
                        {n.message ? (
                          <p className="line-clamp-2 text-xs text-muted-foreground">
                            {n.message}
                          </p>
                        ) : null}
                        <div className="flex items-center gap-1.5 pt-0.5">
                          {typeMeta ? (
                            <Badge
                              variant="secondary"
                              className="px-1.5 py-0 text-[9px] font-medium uppercase tracking-wider text-muted-foreground"
                            >
                              {typeMeta.label}
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          void dismiss(n.id)
                        }}
                        className="shrink-0 self-start rounded-md p-1 text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                        aria-label="Xoá thông báo"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </ScrollArea>

        {hasMore ? (
          <div className="border-t bg-muted/20 px-4 py-2 text-center">
            <span className="text-[10px] text-muted-foreground">
              Hiển thị {visibleItems.length} / {items.length} thông báo
            </span>
          </div>
        ) : null}
      </DropdownMenuContent>
      <NotificationDetailDialog
        notification={openDetail}
        open={Boolean(openDetail)}
        onOpenChange={(o) => { if (!o) setOpenDetail(null) }}
      />
    </DropdownMenu>
  )
}

export default NotificationBell
