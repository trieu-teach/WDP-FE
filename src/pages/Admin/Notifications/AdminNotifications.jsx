import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bell,
  CheckCheck,
  History,
  Inbox,
  Loader2,
  RefreshCw,
  Search,
} from 'lucide-react'
import { toast } from 'sonner'
import { notificationsService } from '@/api/notifications.service.js'
import { getApiErrorMessage } from '@/api/http.js'
import { NotificationDetailDialog } from '@/components/layout/NotificationDetailDialog.jsx'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import {
  ADMIN_NOTIFICATION_TYPE_LABELS,
  ADMIN_RELATED_ENTITY_LABELS,
  adminNotificationTypeLabel,
  adminRelatedEntityLabel,
  formatAdminNotificationDateTime,
  formatAdminNotificationTimeAgo,
  joinNotificationTypes,
  mapAdminNotificationHistoryResponse,
  mapAdminNotificationListResponse,
  mapAdminNotificationStats,
} from '@/utils/adminNotificationMappers.js'

const READ_FILTER_OPTIONS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'unread', label: 'Chưa đọc' },
  { value: 'read', label: 'Đã đọc' },
]

const TYPE_FILTER_OPTIONS = Object.entries(ADMIN_NOTIFICATION_TYPE_LABELS).map(
  ([value, label]) => ({ value, label }),
)

const ENTITY_FILTER_OPTIONS = Object.entries(ADMIN_RELATED_ENTITY_LABELS).map(
  ([value, label]) => ({ value, label }),
)

function StatCard({ label, value, tone = 'default' }) {
  const tones = {
    default: 'text-foreground',
    unread: 'text-amber-700 dark:text-amber-300',
    read: 'text-emerald-700 dark:text-emerald-300',
    total: 'text-primary',
  }
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn('mt-1 text-2xl font-bold tabular-nums', tones[tone])}>
          {value}
        </p>
      </CardContent>
    </Card>
  )
}

function NotificationTable({
  items,
  loading,
  onOpen,
  emptyText = 'Không có thông báo.',
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        Đang tải...
      </div>
    )
  }
  if (!items.length) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        {emptyText}
      </div>
    )
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Thông báo</th>
            <th className="px-4 py-3 font-medium">Loại</th>
            <th className="px-4 py-3 font-medium">Entity</th>
            <th className="px-4 py-3 font-medium">Thời gian</th>
            <th className="px-4 py-3 font-medium">Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              className={cn(
                'cursor-pointer border-b border-border/50 last:border-0 hover:bg-muted/30',
                !item.isRead && 'bg-slate-50/80 dark:bg-slate-900/30',
              )}
              onClick={() => onOpen(item)}
            >
              <td className="max-w-[320px] px-4 py-3 align-top">
                <p
                  className={cn(
                    'text-sm leading-snug',
                    !item.isRead ? 'font-semibold' : 'font-medium text-foreground/80',
                  )}
                >
                  {item.title}
                </p>
                {item.message ? (
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {item.message}
                  </p>
                ) : null}
              </td>
              <td className="whitespace-nowrap px-4 py-3 align-top">
                <Badge variant="outline" className="text-[10px] font-normal">
                  {adminNotificationTypeLabel(item.type)}
                </Badge>
              </td>
              <td className="whitespace-nowrap px-4 py-3 align-top text-xs text-muted-foreground">
                {item.relatedEntityType
                  ? adminRelatedEntityLabel(item.relatedEntityType)
                  : '—'}
              </td>
              <td className="whitespace-nowrap px-4 py-3 align-top text-xs text-muted-foreground">
                <div>{formatAdminNotificationTimeAgo(item.createdAt)}</div>
                <div className="text-[10px] opacity-70">
                  {formatAdminNotificationDateTime(item.createdAt)}
                </div>
              </td>
              <td className="px-4 py-3 align-top">
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px]',
                    item.isRead
                      ? 'border-border text-muted-foreground'
                      : 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200',
                  )}
                >
                  {item.isRead ? 'Đã đọc' : 'Chưa đọc'}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DateStatsBar({ dateStats }) {
  if (!dateStats?.length) {
    return (
      <p className="py-6 text-center text-xs text-muted-foreground">
        Chưa có thống kê theo ngày.
      </p>
    )
  }
  const max = Math.max(...dateStats.map((d) => d.count), 1)
  return (
    <div className="flex items-end gap-1 px-2 py-4">
      {dateStats.map((row) => {
        const height = Math.max(8, Math.round((row.count / max) * 72))
        const label = row.date.slice(5)
        return (
          <div
            key={row.date}
            className="group flex min-w-0 flex-1 flex-col items-center gap-1"
            title={`${row.date}: ${row.count}`}
          >
            <div
              className="w-full max-w-6 rounded-t bg-primary/70 transition-colors group-hover:bg-primary"
              style={{ height: `${height}px` }}
            />
            <span className="truncate text-[9px] text-muted-foreground">
              {label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default function AdminNotifications() {
  const [tab, setTab] = useState('inbox')

  const [stats, setStats] = useState({ total: 0, unread: 0, read: 0, byType: [] })
  const [statsLoading, setStatsLoading] = useState(true)

  const [readFilter, setReadFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [entityFilter, setEntityFilter] = useState('all')
  const [inboxPage, setInboxPage] = useState(1)
  const [inboxItems, setInboxItems] = useState([])
  const [inboxMeta, setInboxMeta] = useState({ total: 0, page: 1, limit: 20 })
  const [inboxLoading, setInboxLoading] = useState(true)
  const [markingAll, setMarkingAll] = useState(false)

  const [historySearch, setHistorySearch] = useState('')
  const [historyType, setHistoryType] = useState('all')
  const [historyFrom, setHistoryFrom] = useState('')
  const [historyTo, setHistoryTo] = useState('')
  const [historyPage, setHistoryPage] = useState(1)
  const [historyItems, setHistoryItems] = useState([])
  const [historyDateStats, setHistoryDateStats] = useState([])
  const [historyMeta, setHistoryMeta] = useState({ total: 0, page: 1, limit: 50 })
  const [historyLoading, setHistoryLoading] = useState(false)

  const [openDetail, setOpenDetail] = useState(null)

  const loadStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const raw = await notificationsService.adminStats()
      setStats(mapAdminNotificationStats(raw))
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Không tải được thống kê.'))
    } finally {
      setStatsLoading(false)
    }
  }, [])

  const loadInbox = useCallback(async () => {
    setInboxLoading(true)
    try {
      const params = {
        page: inboxPage,
        limit: 20,
      }
      if (readFilter === 'unread') params.is_read = false
      if (readFilter === 'read') params.is_read = true
      if (typeFilter !== 'all') params.type = typeFilter
      if (entityFilter !== 'all') params.related_entity_type = entityFilter

      const raw = await notificationsService.adminList(params)
      const mapped = mapAdminNotificationListResponse(raw)
      setInboxItems(mapped.items)
      setInboxMeta({
        total: mapped.total,
        page: mapped.page,
        limit: mapped.limit,
      })
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Không tải được danh sách thông báo.'))
      setInboxItems([])
    } finally {
      setInboxLoading(false)
    }
  }, [readFilter, typeFilter, entityFilter, inboxPage])

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const params = {
        page: historyPage,
        limit: 50,
      }
      const typeParam = joinNotificationTypes(
        historyType !== 'all' ? historyType : undefined,
      )
      if (typeParam) params.type = typeParam
      if (historyFrom) params.from_date = historyFrom
      if (historyTo) params.to_date = historyTo
      const search = historySearch.trim()
      if (search) params.search = search

      const raw = await notificationsService.adminHistory(params)
      const mapped = mapAdminNotificationHistoryResponse(raw)
      setHistoryItems(mapped.items)
      setHistoryDateStats(mapped.dateStats)
      setHistoryMeta({
        total: mapped.total,
        page: mapped.page,
        limit: mapped.limit,
      })
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Không tải được lịch sử thông báo.'))
      setHistoryItems([])
      setHistoryDateStats([])
    } finally {
      setHistoryLoading(false)
    }
  }, [historyPage, historyType, historyFrom, historyTo, historySearch])

  useEffect(() => {
    void loadStats()
  }, [loadStats])

  useEffect(() => {
    if (tab !== 'inbox') return
    void loadInbox()
  }, [tab, loadInbox])

  useEffect(() => {
    if (tab !== 'history') return
    void loadHistory()
  }, [tab, loadHistory])

  async function handleMarkAllRead() {
    setMarkingAll(true)
    try {
      const res = await notificationsService.adminMarkAllRead()
      toast.success(res?.message || 'Đã đánh dấu tất cả đã đọc.')
      await Promise.all([loadStats(), loadInbox()])
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Không đánh dấu được tất cả đã đọc.'))
    } finally {
      setMarkingAll(false)
    }
  }

  function openItem(item) {
    if (!item.isRead) {
      void notificationsService.markRead(item.id).catch(() => {})
      setInboxItems((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)),
      )
      setHistoryItems((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)),
      )
      setStats((prev) => ({
        ...prev,
        unread: Math.max(0, prev.unread - 1),
        read: prev.read + 1,
      }))
    }
    setOpenDetail(item)
  }

  const inboxPages = Math.max(1, Math.ceil(inboxMeta.total / inboxMeta.limit))
  const historyPages = Math.max(1, Math.ceil(historyMeta.total / historyMeta.limit))

  const topTypes = useMemo(
    () => [...stats.byType].sort((a, b) => b.count - a.count).slice(0, 6),
    [stats.byType],
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 shadow-lg shadow-sky-500/20">
              <Bell className="size-5 text-white" />
            </div>
            Thông báo Admin
          </h1>
          <p className="mt-2 pl-[52px] text-sm text-muted-foreground">
            Quản lý hộp thư và lịch sử notification hệ thống
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              void loadStats()
              if (tab === 'inbox') void loadInbox()
              else void loadHistory()
            }}
          >
            <RefreshCw className="size-3.5" />
            Làm mới
          </Button>
          <Button
            type="button"
            size="sm"
            className="gap-1.5"
            disabled={markingAll || stats.unread === 0}
            onClick={() => void handleMarkAllRead()}
          >
            {markingAll ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <CheckCheck className="size-3.5" />
            )}
            Đọc tất cả
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Tổng"
          value={statsLoading ? '—' : stats.total}
          tone="total"
        />
        <StatCard
          label="Chưa đọc"
          value={statsLoading ? '—' : stats.unread}
          tone="unread"
        />
        <StatCard
          label="Đã đọc"
          value={statsLoading ? '—' : stats.read}
          tone="read"
        />
      </div>

      {topTypes.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Thống kê theo loại
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {topTypes.map((row) => (
              <Badge key={row.type} variant="secondary" className="gap-1.5 text-xs">
                {adminNotificationTypeLabel(row.type)}
                <span className="font-bold tabular-nums">{row.count}</span>
              </Badge>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="inbox" className="gap-1.5">
            <Inbox className="size-3.5" />
            Hộp thư
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <History className="size-3.5" />
            Lịch sử
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="mt-4 space-y-4">
          <Card>
            <CardContent className="flex flex-wrap items-end gap-3 p-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Trạng thái đọc</Label>
                <Select
                  value={readFilter}
                  onValueChange={(v) => {
                    setReadFilter(v)
                    setInboxPage(1)
                  }}
                >
                  <SelectTrigger className="h-9 w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {READ_FILTER_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Loại (type)</Label>
                <Select
                  value={typeFilter}
                  onValueChange={(v) => {
                    setTypeFilter(v)
                    setInboxPage(1)
                  }}
                >
                  <SelectTrigger className="h-9 w-[200px]">
                    <SelectValue placeholder="Tất cả loại" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả loại</SelectItem>
                    {TYPE_FILTER_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Entity liên quan</Label>
                <Select
                  value={entityFilter}
                  onValueChange={(v) => {
                    setEntityFilter(v)
                    setInboxPage(1)
                  }}
                >
                  <SelectTrigger className="h-9 w-[180px]">
                    <SelectValue placeholder="Tất cả" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả entity</SelectItem>
                    {ENTITY_FILTER_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">
                Danh sách ({inboxMeta.total})
              </CardTitle>
              {inboxPages > 1 ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={inboxPage <= 1 || inboxLoading}
                    onClick={() => setInboxPage((p) => Math.max(1, p - 1))}
                  >
                    Trước
                  </Button>
                  <span>
                    {inboxPage} / {inboxPages}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={inboxPage >= inboxPages || inboxLoading}
                    onClick={() => setInboxPage((p) => p + 1)}
                  >
                    Sau
                  </Button>
                </div>
              ) : null}
            </CardHeader>
            <CardContent className="p-0">
              <NotificationTable
                items={inboxItems}
                loading={inboxLoading}
                onOpen={openItem}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4 space-y-4">
          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[200px] flex-1 space-y-1.5">
                  <Label className="text-xs">Tìm kiếm title / message</Label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={historySearch}
                      onChange={(e) => setHistorySearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          setHistoryPage(1)
                          void loadHistory()
                        }
                      }}
                      placeholder="VD: end, chapter..."
                      className="h-9 pl-8"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Loại (type)</Label>
                  <Select
                    value={historyType}
                    onValueChange={(v) => {
                      setHistoryType(v)
                      setHistoryPage(1)
                    }}
                  >
                    <SelectTrigger className="h-9 w-[220px]">
                      <SelectValue placeholder="Tất cả loại" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả loại</SelectItem>
                      {TYPE_FILTER_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Từ ngày</Label>
                  <Input
                    type="date"
                    value={historyFrom}
                    onChange={(e) => {
                      setHistoryFrom(e.target.value)
                      setHistoryPage(1)
                    }}
                    className="h-9 w-[150px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Đến ngày</Label>
                  <Input
                    type="date"
                    value={historyTo}
                    onChange={(e) => {
                      setHistoryTo(e.target.value)
                      setHistoryPage(1)
                    }}
                    className="h-9 w-[150px]"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="h-9"
                  onClick={() => {
                    setHistoryPage(1)
                    void loadHistory()
                  }}
                >
                  Áp dụng
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Thống kê theo ngày (30 ngày gần nhất)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DateStatsBar dateStats={historyDateStats} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">
                Lịch sử ({historyMeta.total})
              </CardTitle>
              {historyPages > 1 ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={historyPage <= 1 || historyLoading}
                    onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                  >
                    Trước
                  </Button>
                  <span>
                    {historyPage} / {historyPages}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={historyPage >= historyPages || historyLoading}
                    onClick={() => setHistoryPage((p) => p + 1)}
                  >
                    Sau
                  </Button>
                </div>
              ) : null}
            </CardHeader>
            <CardContent className="p-0">
              <NotificationTable
                items={historyItems}
                loading={historyLoading}
                onOpen={openItem}
                emptyText="Không có bản ghi lịch sử phù hợp."
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <NotificationDetailDialog
        notification={openDetail}
        open={Boolean(openDetail)}
        onOpenChange={(o) => { if (!o) setOpenDetail(null) }}
      />
    </div>
  )
}
