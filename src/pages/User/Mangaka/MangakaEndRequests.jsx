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
import { Button } from '@/components/ui/button'
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
import { MANGAKA_NAV_LINKS } from '@/constants/mangakaNav.js'

const NAV_LINKS = MANGAKA_NAV_LINKS

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

      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="min-w-0 space-y-1.5">
            <Link
              to="/mangaka"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 transition-colors hover:text-gray-800"
            >
              <ArrowLeft className="size-3.5" />
              Về workspace
            </Link>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900">
              <Flag className="size-5 shrink-0 text-amber-600" />
              Yêu cầu kết thúc truyện
            </h1>
            <p className="text-sm text-gray-500">
              Theo dõi các yêu cầu end series bạn đã gửi ({meta.total})
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-[140px] rounded-xl border-gray-200 bg-white text-xs shadow-2xs">
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
              className="flex h-9 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 shadow-2xs transition-colors hover:bg-gray-50"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
              Làm mới
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white py-16 text-sm text-gray-500 shadow-2xs">
            <Loader2 className="size-5 animate-spin" />
            Đang tải...
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-16 text-center shadow-2xs">
            <BookOpen className="mx-auto mb-3 size-10 text-gray-300" />
            <p className="text-sm text-gray-500">Chưa có yêu cầu nào.</p>
          </div>
        ) : (
          <div>
            {items.map((item) => {
              const display = getSeriesEndRequestDisplayStatus(item)
              const awaitingPublish = isApprovedAwaitingFinalPublish(item)
              return (
                <article
                  key={item.id}
                  className="mb-4 space-y-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-2xs transition-all hover:border-gray-200"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                      {item.series?.coverImageUrl ? (
                        <img
                          src={item.series.coverImageUrl}
                          alt=""
                          className="size-full object-cover"
                        />
                      ) : (
                        <div className="flex size-full items-center justify-center text-gray-400">
                          <BookOpen className="size-4 opacity-50" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-start justify-between gap-3">
                        <h2 className="text-base font-bold text-gray-900">
                          {item.series?.name || 'Series'}
                        </h2>
                        <span
                          className={cn(
                            'shrink-0 rounded-full border px-3 py-1 text-xs font-medium',
                            awaitingPublish
                              ? 'border-blue-100 bg-blue-50 text-blue-700'
                              : display.className,
                          )}
                        >
                          {display.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
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
                        className="h-8 shrink-0 rounded-xl border-gray-200 text-xs"
                        disabled={cancellingId === item.id}
                        onClick={() => void handleCancel(item.id)}
                      >
                        {cancellingId === item.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : null}
                        Hủy
                      </Button>
                    ) : null}
                  </div>

                  {item.reason ? (
                    <p className="rounded-xl border border-gray-100 bg-gray-50/70 p-2.5 text-xs text-gray-600">
                      <span className="font-medium text-gray-800">Lý do: </span>
                      {item.reason}
                    </p>
                  ) : null}

                  {awaitingPublish ? (
                    <div className="flex flex-col gap-1 rounded-xl border border-sky-100 bg-sky-50/60 p-3 text-xs text-sky-900">
                      <p>{approvedAwaitingFinalPublishMessage(item)}</p>
                    </div>
                  ) : null}

                  {item.status === 'approved'
                    && String(item.seriesPublicationStatus ?? item.series?.publicationStatus ?? '').toLowerCase() === 'completed' ? (
                    <div className="flex flex-col gap-1 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-xs text-emerald-900">
                      <p>
                        Series đã hoàn thành (
                        <code className="text-[10px]">publication_status = completed</code>
                        ).
                      </p>
                    </div>
                  ) : null}

                  {item.adminNote ? (
                    <div className="flex flex-col gap-1 rounded-xl border border-sky-100 bg-sky-50/60 p-3 text-xs text-sky-900">
                      <p className="font-medium">Ghi chú Admin</p>
                      <p>{item.adminNote}</p>
                    </div>
                  ) : null}

                  {item.autoCancelMessage ? (
                    <p className="text-xs text-slate-600">
                      {item.autoCancelMessage}
                    </p>
                  ) : null}

                  {item.decidedAt && item.status !== 'pending' ? (
                    <p className="text-[11px] font-normal text-gray-400">
                      Quyết định lúc {formatSeriesEndDateTime(item.decidedAt)}
                    </p>
                  ) : null}
                </article>
              )
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
