import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  BookOpen,
  Flag,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
import Header from '@/components/User/Header/Header.jsx'
import Footer from '@/components/User/Footer/Footer.jsx'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { logout } from '@/lib/auth.js'
import { getApiErrorMessage } from '@/api/http.js'
import { seriesEndRequestsService } from '@/api/seriesEndRequests.service.js'
import {
  approvedAwaitingFinalPublishMessage,
  formatSeriesEndDateTime,
  getSeriesEndRequestDisplayStatus,
  isApprovedAwaitingFinalPublish,
  mapSeriesEndRequestListResponse,
} from '@/utils/seriesEndRequestMappers.js'
import { cn } from '@/lib/utils'

const NAV_LINKS = [
  { to: '/', label: 'Trang chủ' },
  { to: '/mangaka', label: 'Mangaka' },
]

export default function MangakaEndRequests() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [cancellingId, setCancellingId] = useState(null)
  const [items, setItems] = useState([])
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20 })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const raw = await seriesEndRequestsService.getMine({
        ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
        page: 1,
        limit: 50,
      })
      const mapped = mapSeriesEndRequestListResponse(raw)
      setItems(mapped.items)
      setMeta({
        total: mapped.total,
        page: mapped.page,
        limit: mapped.limit,
      })
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Không tải được danh sách yêu cầu.'))
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load()
    }, 0)
    return () => window.clearTimeout(t)
  }, [load])

  function handleLogout() {
    logout()
    navigate('/login')
  }

  async function handleCancel(id) {
    setCancellingId(id)
    try {
      const res = await seriesEndRequestsService.cancel(id)
      toast.success(res.message || 'Đã hủy yêu cầu.')
      setItems((prev) =>
        prev.map((it) =>
          it.id === id ? { ...it, status: 'cancelled', autoCancelled: false } : it,
        ),
      )
    } catch (err) {
      toast.error(
        getApiErrorMessage(
          err,
          err?.response?.status === 409
            ? 'Yêu cầu không còn ở trạng thái chờ duyệt.'
            : 'Không hủy được yêu cầu.',
        ),
      )
    } finally {
      setCancellingId(null)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header links={NAV_LINKS} onLogout={handleLogout} />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <Button variant="ghost" size="sm" className="mb-2 -ml-2 gap-1.5" asChild>
              <Link to="/mangaka">
                <ArrowLeft className="size-4" />
                Về workspace
              </Link>
            </Button>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <Flag className="size-6 text-amber-600" />
              Yêu cầu kết thúc truyện
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Theo dõi các yêu cầu end series bạn đã gửi ({meta.total})
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-[150px]">
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="pending">Chờ duyệt</SelectItem>
                <SelectItem value="approved">Đã duyệt</SelectItem>
                <SelectItem value="rejected">Từ chối</SelectItem>
                <SelectItem value="cancelled">Đã hủy</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-1.5"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
              Làm mới
            </Button>
          </div>
        </div>

        {loading ? (
          <Card>
            <CardContent className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              Đang tải...
            </CardContent>
          </Card>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              <BookOpen className="mx-auto mb-3 size-10 opacity-30" />
              Chưa có yêu cầu nào.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const display = getSeriesEndRequestDisplayStatus(item)
              return (
              <Card key={item.id} className="overflow-hidden">
                <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-3">
                  <div className="size-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {item.series?.coverImageUrl ? (
                      <img
                        src={item.series.coverImageUrl}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center text-muted-foreground">
                        <BookOpen className="size-5 opacity-40" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-base">
                        {item.series?.name || 'Series'}
                      </CardTitle>
                      <Badge
                        variant="outline"
                        className={cn('text-[11px]', display.className)}
                      >
                        {display.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Gửi lúc {formatSeriesEndDateTime(item.createdAt)}
                      {item.plannedFinalChapterNumber != null
                        ? ` · Chapter dự kiến #${item.plannedFinalChapterNumber}`
                        : ''}
                    </p>
                  </div>
                  {item.status === 'pending' ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      disabled={cancellingId === item.id}
                      onClick={() => void handleCancel(item.id)}
                    >
                      {cancellingId === item.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : null}
                      Hủy
                    </Button>
                  ) : null}
                </CardHeader>
                <CardContent className="space-y-2 pt-0 text-sm">
                  {item.reason ? (
                    <p className="text-muted-foreground">
                      <span className="font-medium text-foreground">Lý do: </span>
                      {item.reason}
                    </p>
                  ) : null}
                  {isApprovedAwaitingFinalPublish(item) ? (
                    <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-950 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100">
                      {approvedAwaitingFinalPublishMessage(item)}
                    </p>
                  ) : null}
                  {item.status === 'approved'
                    && String(item.seriesPublicationStatus ?? item.series?.publicationStatus ?? '').toLowerCase() === 'completed' ? (
                    <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
                      Series đã hoàn thành (<code className="text-[10px]">publication_status = completed</code>).
                    </p>
                  ) : null}
                  {item.adminNote ? (
                    <p className="rounded-md border bg-muted/40 px-3 py-2 text-xs">
                      <span className="font-medium">Ghi chú Admin: </span>
                      {item.adminNote}
                    </p>
                  ) : null}
                  {item.autoCancelMessage ? (
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      {item.autoCancelMessage}
                    </p>
                  ) : null}
                  {item.decidedAt && item.status !== 'pending' ? (
                    <p className="text-[11px] text-muted-foreground">
                      Quyết định lúc {formatSeriesEndDateTime(item.decidedAt)}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
              )
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
