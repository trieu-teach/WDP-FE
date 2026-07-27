import { useCallback, useEffect, useState } from 'react'
import {
  BookOpen,
  Check,
  Flag,
  Loader2,
  RefreshCw,
  User,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/api/http.js'
import { seriesEndRequestsService } from '@/api/seriesEndRequests.service.js'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  formatChapterWorkflowStatus,
  formatSeriesEndDateTime,
  finalChapterNeedsMangakaAction,
  getSeriesEndRequestDisplayStatus,
  isApprovedAwaitingFinalPublish,
  mapSeriesEndDecideResult,
  mapSeriesEndRequestDetail,
  mapSeriesEndRequestListResponse,
  truncateText,
} from '@/utils/seriesEndRequestMappers.js'

export default function EndRequests() {
  const [statusFilter, setStatusFilter] = useState('pending')
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20 })
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detail, setDetail] = useState(null)
  const [adminNote, setAdminNote] = useState('')
  const [deciding, setDeciding] = useState(null)
  const [confirmApprove, setConfirmApprove] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const raw = await seriesEndRequestsService.adminList({
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
      toast.error(getApiErrorMessage(err, 'Không tải được yêu cầu kết thúc.'))
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

  async function openDetail(id) {
    setDetailOpen(true)
    setDetailLoading(true)
    setDetail(null)
    setAdminNote('')
    setConfirmApprove(false)
    try {
      const raw = await seriesEndRequestsService.adminGetById(id)
      setDetail(mapSeriesEndRequestDetail(raw))
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Không tải được chi tiết.'))
      setDetailOpen(false)
    } finally {
      setDetailLoading(false)
    }
  }

  async function decide(decision) {
    if (!detail?.id) return
    if (decision === 'approved' && !confirmApprove) {
      setConfirmApprove(true)
      return
    }
    setDeciding(decision)
    try {
      const res = await seriesEndRequestsService.adminDecide(detail.id, {
        decision,
        admin_note: adminNote,
      })
      const decided = mapSeriesEndDecideResult(res.data ?? {})
      toast.success(
        res.message
          || (decision === 'approved'
            ? 'Đã duyệt yêu cầu kết thúc truyện.'
            : 'Đã từ chối yêu cầu kết thúc truyện.'),
      )
      if (decision === 'approved') {
        if (decided.completedNow) {
          toast.message(
            'Chapter chốt đã publish sẵn — series đã chuyển completed.',
          )
        } else if (decided.finalChapter?.number != null) {
          toast.message(
            `Đã duyệt. Series chưa completed — chờ chapter #${decided.finalChapter.number} được publish.`,
          )
        }
        const cancelled =
          decided.cancelledScheduledChaptersAfterFinal
            ?? decided.chaptersCancelled
        if (cancelled != null && cancelled > 0) {
          toast.message(
            `Đã gỡ lịch ${cancelled} chapter sau mốc chốt.`,
          )
        }
      }
      setConfirmApprove(false)
      setDetailOpen(false)
      await load()
    } catch (err) {
      toast.error(
        getApiErrorMessage(
          err,
          err?.response?.status === 409
            ? 'Yêu cầu đã được xử lý trước đó.'
            : 'Không xử lý được yêu cầu.',
        ),
      )
    } finally {
      setDeciding(null)
    }
  }

  const scheduledCount = detail?.chaptersSummary?.scheduledFuture
    ?? detail?.scheduledChapters?.length
    ?? 0
  const seriesName = detail?.series?.name || 'series này'
  const finalChapter = detail?.finalChapter ?? null
  const finalNeedsAction = finalChapterNeedsMangakaAction(finalChapter)
  const otherScheduledCount = finalChapter
    ? (detail?.scheduledChapters ?? []).filter(
        (ch) => ch.chapterNumber !== finalChapter.number,
      ).length
    : scheduledCount

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/20">
              <Flag className="size-5 text-white" />
            </div>
            Yêu cầu kết thúc
          </h1>
          <p className="mt-2 pl-[52px] text-sm text-muted-foreground">
            Duyệt yêu cầu end series từ Mangaka · {meta.total} mục
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Chờ duyệt</SelectItem>
              <SelectItem value="approved">Đã duyệt</SelectItem>
              <SelectItem value="rejected">Từ chối</SelectItem>
              <SelectItem value="cancelled">Đã hủy</SelectItem>
              <SelectItem value="all">Tất cả</SelectItem>
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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Danh sách yêu cầu</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              Đang tải...
            </div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              Không có yêu cầu nào.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Mangaka</th>
                    <th className="px-4 py-3 font-medium">Series</th>
                    <th className="px-4 py-3 font-medium">Chapter cuối</th>
                    <th className="px-4 py-3 font-medium">Lý do</th>
                    <th className="px-4 py-3 font-medium">Ngày gửi</th>
                    <th className="px-4 py-3 font-medium">Trạng thái</th>
                    <th className="px-4 py-3 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const display = getSeriesEndRequestDisplayStatus(item)
                    return (
                    <tr
                      key={item.id}
                      className="border-b border-border/50 last:border-0 hover:bg-muted/30"
                    >
                      <td className="px-4 py-3 align-middle">
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {item.requestedBy?.name || '—'}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {item.requestedBy?.email || ''}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <div className="flex items-center gap-2.5">
                          <div className="size-10 shrink-0 overflow-hidden rounded-md bg-muted">
                            {item.series?.coverImageUrl ? (
                              <img
                                src={item.series.coverImageUrl}
                                alt=""
                                className="size-full object-cover"
                              />
                            ) : (
                              <div className="flex size-full items-center justify-center">
                                <BookOpen className="size-4 opacity-40" />
                              </div>
                            )}
                          </div>
                          <span className="line-clamp-2 font-medium">
                            {item.series?.name || '—'}
                          </span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 align-middle font-medium">
                        {item.plannedFinalChapterNumber != null
                          ? `#${item.plannedFinalChapterNumber}`
                          : '—'}
                      </td>
                      <td className="max-w-[220px] px-4 py-3 align-middle text-muted-foreground">
                        {truncateText(item.reason || '—', 60)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 align-middle text-xs text-muted-foreground">
                        {formatSeriesEndDateTime(item.createdAt)}
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge
                            variant="outline"
                            className={cn('text-[11px]', display.className)}
                          >
                            {display.label}
                          </Badge>
                          {isApprovedAwaitingFinalPublish(item) ? (
                            <Badge
                              variant="outline"
                              className="border-sky-200 bg-sky-50 text-[10px] text-sky-800 dark:border-sky-500/40 dark:bg-sky-500/15 dark:text-sky-200"
                            >
                              Chờ publish #{item.plannedFinalChapterNumber ?? '?'}
                            </Badge>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void openDetail(item.id)}
                        >
                          Chi tiết
                        </Button>
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={detailOpen}
        onOpenChange={(o) => {
          if (!o) {
            setDetailOpen(false)
            setConfirmApprove(false)
          }
        }}
      >
        <DialogContent className="scrollbar-hide max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Chi tiết yêu cầu kết thúc</DialogTitle>
            <DialogDescription>
              Xem thông tin series và quyết định duyệt / từ chối.
            </DialogDescription>
          </DialogHeader>

          {detailLoading || !detail ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              Đang tải chi tiết...
            </div>
          ) : (
            <div className="space-y-4 text-sm">
              <div className="flex gap-3 rounded-xl border bg-muted/20 p-3">
                <div className="size-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                  {detail.series?.coverImageUrl ? (
                    <img
                      src={detail.series.coverImageUrl}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center">
                      <BookOpen className="size-6 opacity-40" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 space-y-1">
                  <p className="font-semibold">{detail.series?.name || '—'}</p>
                  <p className="text-xs text-muted-foreground">
                    Phát hành: {detail.series?.publicationLabel ?? '—'}
                  </p>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[11px]',
                      getSeriesEndRequestDisplayStatus(detail).className,
                    )}
                  >
                    {getSeriesEndRequestDisplayStatus(detail).label}
                  </Badge>
                  {isApprovedAwaitingFinalPublish(detail) ? (
                    <p className="text-xs text-sky-800 dark:text-sky-200">
                      Đã duyệt — đang chờ chapter #
                      {detail.plannedFinalChapterNumber
                        ?? detail.finalChapter?.number
                        ?? '?'}{' '}
                      publish để series completed.
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-2 rounded-lg border p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <User className="size-3.5" />
                  Mangaka
                </div>
                <p className="font-medium">{detail.requestedBy?.name || '—'}</p>
                <p className="text-xs text-muted-foreground">
                  {detail.requestedBy?.email || '—'}
                  {detail.requestedBy?.phoneNumber
                    ? ` · ${detail.requestedBy.phoneNumber}`
                    : ''}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Lý do</p>
                <p className="rounded-md bg-muted/40 px-3 py-2">
                  {detail.reason || '—'}
                </p>
              </div>

              {detail.plannedFinalChapterNumber != null || finalChapter ? (
                <div
                  className={cn(
                    'space-y-2 rounded-lg border p-3',
                    finalNeedsAction
                      ? 'border-amber-300 bg-amber-50/60 dark:border-amber-500/40 dark:bg-amber-500/10'
                      : 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-500/30 dark:bg-emerald-500/10',
                  )}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Chapter kết thúc
                  </p>
                  <p className="font-medium">
                    Chapter #{finalChapter?.number ?? detail.plannedFinalChapterNumber}
                    {finalChapter?.status ? (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        · {formatChapterWorkflowStatus(finalChapter.status)}
                      </span>
                    ) : null}
                  </p>
                  {finalChapter ? (
                    <div className="flex flex-wrap gap-1.5">
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[11px]',
                          finalChapter.isPublished
                            ? 'border-emerald-300 bg-emerald-100 text-emerald-800'
                            : 'border-amber-300 bg-amber-100 text-amber-900',
                        )}
                      >
                        {finalChapter.isPublished ? 'Đã publish' : 'Chưa publish'}
                      </Badge>
                      {finalChapter.isScheduled ? (
                        <Badge variant="outline" className="text-[11px]">
                          Có lịch publish
                        </Badge>
                      ) : null}
                    </div>
                  ) : null}
                  {finalNeedsAction ? (
                    <p className="text-xs text-amber-900 dark:text-amber-100">
                      Khi duyệt: yêu cầu chuyển <strong>approved</strong>, series
                      {' '}
                      <strong>không</strong>
                      {' '}
                      completed ngay. Giữ lịch chapter chốt; gỡ lịch các chapter sau mốc.
                      Series chỉ completed khi chapter này publish thật sự.
                    </p>
                  ) : (
                    <p className="text-xs text-emerald-900 dark:text-emerald-100">
                      Chapter chốt đã publish — duyệt sẽ completed series ngay
                      (<code className="mx-1 text-[10px]">completed_now</code>).
                    </p>
                  )}
                </div>
              ) : null}

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border p-2">
                  <p className="text-lg font-bold">{detail.chaptersSummary.total}</p>
                  <p className="text-[11px] text-muted-foreground">Tổng chapter</p>
                </div>
                <div className="rounded-lg border p-2">
                  <p className="text-lg font-bold">{detail.chaptersSummary.published}</p>
                  <p className="text-[11px] text-muted-foreground">Đã publish</p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-2 dark:border-amber-500/30 dark:bg-amber-500/10">
                  <p className="text-lg font-bold text-amber-800 dark:text-amber-200">
                    {detail.chaptersSummary.scheduledFuture}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Lịch tương lai</p>
                </div>
              </div>

              {detail.scheduledChapters?.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Chapter đã lên lịch
                    {finalNeedsAction
                      ? ' — chapter cuối được giữ, các chapter khác sẽ hủy khi duyệt'
                      : ' — sẽ bị hủy khi duyệt'}
                  </p>
                  <ul className="scrollbar-hide max-h-36 space-y-1.5 overflow-y-auto rounded-lg border p-2">
                    {detail.scheduledChapters.map((ch) => {
                      const isFinal =
                        finalChapter != null
                        && ch.chapterNumber === finalChapter.number
                      return (
                        <li
                          key={ch.id}
                          className={cn(
                            'flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs',
                            isFinal && finalNeedsAction
                              ? 'border border-amber-200 bg-amber-50/80 dark:border-amber-500/30 dark:bg-amber-500/10'
                              : 'bg-muted/30',
                          )}
                        >
                          <span className="truncate font-medium">
                            Ch.{ch.chapterNumber}{' '}
                            {ch.title ? `· ${ch.title}` : ''}
                            {isFinal && finalNeedsAction ? (
                              <span className="ml-1 text-amber-700 dark:text-amber-200">
                                (giữ lịch)
                              </span>
                            ) : null}
                          </span>
                          <span className="shrink-0 text-muted-foreground">
                            {formatSeriesEndDateTime(ch.scheduledPublishAt)}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ) : null}

              {detail.activeCooperation?.assistant?.name ? (
                <p className="text-xs text-muted-foreground">
                  Assistant đang hợp tác:{' '}
                  <span className="font-medium text-foreground">
                    {detail.activeCooperation.assistant.name}
                  </span>
                </p>
              ) : null}

              <p className="text-[11px] text-muted-foreground">
                Gửi lúc {formatSeriesEndDateTime(detail.createdAt)}
              </p>

              {detail.status === 'pending' ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="admin-end-note">Ghi chú Admin (tuỳ chọn)</Label>
                    <Textarea
                      id="admin-end-note"
                      value={adminNote}
                      onChange={(e) => setAdminNote(e.target.value.slice(0, 1000))}
                      rows={3}
                      placeholder="Ghi chú gửi kèm khi duyệt / từ chối..."
                      maxLength={1000}
                    />
                  </div>
                </>
              ) : detail.adminNote ? (
                <p className="rounded-md border bg-muted/40 px-3 py-2 text-xs">
                  <span className="font-medium">Ghi chú: </span>
                  {detail.adminNote}
                </p>
              ) : null}
            </div>
          )}

          {detail?.status === 'pending' && !detailLoading ? (
            <DialogFooter className="gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="gap-1.5 border-rose-200 text-rose-700 hover:bg-rose-50"
                disabled={Boolean(deciding)}
                onClick={() => void decide('rejected')}
              >
                {deciding === 'rejected' ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <X className="size-4" />
                )}
                Từ chối
              </Button>
              <Button
                type="button"
                className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                disabled={Boolean(deciding)}
                onClick={() => setConfirmApprove(true)}
              >
                <Check className="size-4" />
                Duyệt
              </Button>
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmApprove}
        onOpenChange={(o) => {
          if (!o && !deciding) setConfirmApprove(false)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Xác nhận duyệt yêu cầu kết thúc?</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Duyệt yêu cầu này sẽ{' '}
                  <strong className="text-foreground">không</strong>
                  {' '}
                  kết thúc series ngay. Series chỉ completed khi chapter{' '}
                  <strong className="text-foreground">
                    #{finalChapter?.number ?? detail?.plannedFinalChapterNumber ?? '?'}
                  </strong>
                  {' '}
                  được publish.
                </p>
                <p>
                  Bạn có chắc chắn muốn duyệt yêu cầu kết thúc series{' '}
                  <span className="font-semibold text-foreground">
                    “{seriesName}”
                  </span>
                  ?
                </p>
                <ul className="list-disc space-y-1 pl-4">
                  <li>
                    End request sẽ chuyển sang{' '}
                    <strong className="text-foreground">approved</strong>.
                  </li>
                  {finalNeedsAction && finalChapter ? (
                    <>
                      <li>
                        Series{' '}
                        <strong className="text-amber-700 dark:text-amber-300">
                          chưa completed ngay
                        </strong>
                        {' '}
                        — đang chờ chapter{' '}
                        <strong className="text-foreground">
                          #{finalChapter.number}
                        </strong>
                        {' '}
                        publish
                        {finalChapter.status
                          ? ` (hiện: ${formatChapterWorkflowStatus(finalChapter.status)})`
                          : ''}
                        .
                      </li>
                      <li>
                        Lịch chapter chốt được giữ; khoảng{' '}
                        <strong className="text-foreground">{otherScheduledCount}</strong>{' '}
                        chapter sau mốc sẽ bị gỡ lịch.
                      </li>
                      <li>
                        TE không được schedule/publish chapter &gt; #{finalChapter.number}.
                      </li>
                    </>
                  ) : (
                    <>
                      <li>
                        Chapter chốt đã publish — series có thể completed ngay
                        (<code className="text-[10px]">completed_now</code>).
                      </li>
                      <li>
                        Các chapter lịch sau mốc chốt sẽ bị gỡ.
                      </li>
                    </>
                  )}
                </ul>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={Boolean(deciding)}
              onClick={() => setConfirmApprove(false)}
            >
              Huỷ
            </Button>
            <Button
              type="button"
              className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={Boolean(deciding)}
              onClick={() => void decide('approved')}
            >
              {deciding === 'approved' ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              Chắc chắn — duyệt kết thúc
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
