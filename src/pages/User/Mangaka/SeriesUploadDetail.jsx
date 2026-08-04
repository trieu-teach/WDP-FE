import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  FileImage,
  Flag,
  ImageIcon,
  Inbox,
  MessageSquareWarning,
  PenSquare,
  Sparkles,
  Upload,
  Zap,
} from 'lucide-react'
import Header from '@/components/User/Header/Header.jsx'
import Footer from '@/components/User/Footer/Footer.jsx'
import SeriesEndRequestDialog from '@/components/Mangaka/SeriesEndRequestDialog.jsx'
import { getSession, logout } from '@/lib/auth.js'
import { seriesService } from '@/api/series.service.js'
import { chaptersService } from '@/api/chapters.service.js'
import { seriesEndRequestsService } from '@/api/seriesEndRequests.service.js'
import { ebEvaluationsService } from '@/api/ebEvaluations.service.js'
import { notificationsService } from '@/api/notifications.service.js'
import { getApiErrorMessage, resolveMediaUrl } from '@/api/http.js'
import {
  getPage1OriginalUrl,
  resolveChapterCoverDisplay,
} from '@/utils/chapterCover.js'
import {
  apiChapterToAnnotator,
  apiChapterToRow,
  apiPageToUi,
  apiSeriesToUi,
  apiTaskToUi,
  findSeriesByIdOrSlug,
  getAnnotatorPageDisplayUrl,
  shouldShowAssistantEditedOnAnnotate,
  uiSeriesFormToApi,
  canShowQuickRevision,
} from '@/utils/apiMappers.js'
import { buildMangakaQuickRevisionState } from '@/utils/mangakaQuickRevisionNav.js'
import { tasksService } from '@/api/tasks.service.js'
import {
  allChapterTasksApproved,
  mergeTaskResultsIntoPages,
} from '@/utils/chapterTaskFlow.js'
import {
  markAssistantApprovedPages,
  stampAssistantApprovedOnPages,
  unwrapChapterPagesPayload,
} from '@/utils/assistantApprovedPages.js'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import {
  blocksNewEndRequest,
  canRequestSeriesEnd,
  isApprovedAwaitingFinalPublish,
  mapSeriesEndRequestListItem,
  mapSeriesEndRequestListResponse,
} from '@/utils/seriesEndRequestMappers.js'
import {
  applySeriesFormUpdate,
  formatSeriesCardLine,
  isSeriesEbResubmitStatus,
  seriesToForm,
  slugifySeriesTitle,
} from '@/utils/seriesModel.js'
import { resolveEntityId } from '@/utils/notificationTarget.js'
import { mapEbHistoryDetailResponse } from '@/utils/ebEvaluationMappers.js'
import { LABEL_EDITOR_BOARD } from '@/constants/roleTerminology.js'
import { MANGAKA_NAV_LINKS } from '@/constants/mangakaNav.js'
import AddSeriesModal from './AddSeriesModal.jsx'
import '@/styles/mangaPage.css'

const NAV_LINKS = MANGAKA_NAV_LINKS

const STATUS_BADGE = {
  draft: { label: 'Nháp', className: 'bg-zinc-100 text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-500/15 dark:text-zinc-400' },
  assistant: { label: 'Assistant', className: 'bg-violet-100 text-violet-700 hover:bg-violet-100 dark:bg-violet-500/15 dark:text-violet-400' },
  review: { label: 'Chờ duyệt', className: 'bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-400' },
  tantou: { label: 'Tantou', className: 'bg-sky-100 text-sky-700 hover:bg-sky-100 dark:bg-sky-500/15 dark:text-sky-400' },
  revision: { label: 'Cần chỉnh sửa EB', className: 'bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-200' },
  rejected: { label: 'Bị từ chối', className: 'bg-rose-100 text-rose-800 hover:bg-rose-100 dark:bg-rose-500/20 dark:text-rose-300' },
  done: { label: 'Hoàn tất', className: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-400' },
}

function unwrapSeriesDetailPayload(detail) {
  if (!detail || typeof detail !== 'object') return {}
  const nested = detail.series && typeof detail.series === 'object' ? detail.series : null
  const base = nested ? { ...nested } : { ...detail }
  const evaluation =
    detail.evaluation
    ?? detail.latest_evaluation
    ?? detail.latestEvaluation
    ?? nested?.evaluation
    ?? nested?.latest_evaluation
    ?? nested?.latestEvaluation
    ?? null
  const evaluations =
    detail.evaluations
    ?? detail.evaluation_history
    ?? detail.evaluationHistory
    ?? nested?.evaluations
    ?? nested?.evaluation_history
    ?? null
  return {
    ...base,
    evaluation: evaluation ?? base.evaluation ?? null,
    latest_evaluation: evaluation ?? base.latest_evaluation ?? null,
    evaluations: Array.isArray(evaluations) ? evaluations : base.evaluations,
    eb_evaluation_id:
      detail.eb_evaluation_id
      ?? detail.ebEvaluationId
      ?? nested?.eb_evaluation_id
      ?? resolveEntityId(evaluation?._id ?? evaluation?.id)
      ?? base.eb_evaluation_id
      ?? null,
  }
}

function mapEbFeedbackFromEvaluation(raw) {
  if (!raw || typeof raw !== 'object') return null
  // Có thể là { data }, history-detail mapped, hoặc evaluation document
  const data = raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data)
    && (raw.notes == null && raw.quickNotes == null && raw.quick_notes == null)
    ? raw.data
    : raw
  const nestedEval = data.evaluation && typeof data.evaluation === 'object'
    ? data.evaluation
    : null
  const sources = [data, nestedEval].filter(Boolean)
  let notes = ''
  let result = ''
  let id = null
  let councilAverage = null
  let classificationText = ''
  let createdAt = null
  let memberNotes = []

  for (const src of sources) {
    if (!notes) {
      notes = String(
        src.notes
        ?? src.quick_notes
        ?? src.quickNotes
        ?? src.feedback
        ?? src.eb_feedback
        ?? '',
      ).trim()
    }
    if (!result) {
      result = String(
        src.result
        ?? src.quick_decision
        ?? src.quickDecision
        ?? '',
      ).toLowerCase()
    }
    if (!id) id = src._id ?? src.id ?? src.evaluationId ?? src.evaluation_id ?? null
    if (councilAverage == null) {
      const avg = src.council_average ?? src.councilAverage
      if (avg != null && Number.isFinite(Number(avg))) councilAverage = Number(avg)
    }
    if (!classificationText) {
      classificationText = String(
        src.classification_text
        ?? src.classificationText
        ?? '',
      ).trim()
    }
    if (!createdAt) createdAt = src.createdAt ?? src.created_at ?? null

    const members = Array.isArray(src.member_scores)
      ? src.member_scores
      : (Array.isArray(src.memberScores) ? src.memberScores : [])
    if (members.length && !memberNotes.length) {
      memberNotes = members
        .map((m) => {
          const name = String(
            m.member_name ?? m.memberName ?? m.name ?? m.full_name ?? 'Thành viên HĐ',
          ).trim()
          const overall = String(
            m.overall_comment ?? m.overallComment ?? m.notes ?? '',
          ).trim()
          const comments = m.comments && typeof m.comments === 'object' ? m.comments : {}
          const commentBits = Object.entries(comments)
            .map(([key, value]) => {
              const text = String(value ?? '').trim()
              return text ? `${key}: ${text}` : ''
            })
            .filter(Boolean)
          const body = [overall, ...commentBits].filter(Boolean).join('\n')
          if (!body) return null
          return { name, body }
        })
        .filter(Boolean)
    }
  }

  // Nếu notes tổng hợp trống, ghép góp ý thành viên làm nội dung chính
  if (!notes && memberNotes.length) {
    notes = memberNotes
      .map((m) => `${m.name}:\n${m.body}`)
      .join('\n\n')
  }

  if (!notes && !result && !memberNotes.length) return null
  return {
    id,
    notes,
    result,
    councilAverage,
    classificationText,
    createdAt,
    memberNotes,
  }
}

function mergeEbFeedback(current, next) {
  if (!next) return current
  if (!current) return next
  const preferNextNotes = String(next.notes ?? '').trim().length > String(current.notes ?? '').trim().length
  return {
    id: next.id ?? current.id,
    notes: preferNextNotes ? next.notes : current.notes,
    result: next.result || current.result,
    councilAverage: next.councilAverage ?? current.councilAverage,
    classificationText: next.classificationText || current.classificationText,
    createdAt: next.createdAt ?? current.createdAt,
    memberNotes: (next.memberNotes?.length ? next.memberNotes : current.memberNotes) ?? [],
  }
}

function pickLatestEvaluation(items = []) {
  const list = Array.isArray(items) ? items.filter(Boolean) : []
  if (!list.length) return null
  const preferred = [...list].reverse().find((item) => {
    const result = String(
      item?.result ?? item?.quick_decision ?? item?.quickDecision ?? '',
    ).toLowerCase()
    return result === 'revision' || result === 'rejected'
  })
  return preferred ?? list.at(-1) ?? list[0]
}

function collectEvaluationsFromPayload(payload) {
  if (!payload) return []
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload.items)) return payload.items
  if (Array.isArray(payload.evaluations)) return payload.evaluations
  if (Array.isArray(payload.evaluation_history)) return payload.evaluation_history
  if (Array.isArray(payload.history)) return payload.history
  if (payload.evaluation && typeof payload.evaluation === 'object') {
    return [payload.evaluation]
  }
  if (payload.data) return collectEvaluationsFromPayload(payload.data)
  return []
}

async function fetchEbFeedbackFromNotifications(seriesId) {
  const sid = String(seriesId ?? '').trim()
  if (!sid) return null
  try {
    const res = await notificationsService.list({ limit: 50 })
    const rawItems = res.items
    const items = Array.isArray(rawItems)
      ? rawItems
      : (Array.isArray(rawItems?.notifications)
        ? rawItems.notifications
        : (Array.isArray(rawItems?.items) ? rawItems.items : []))
    const match = items.find((raw) => {
      const type = String(raw.type ?? raw.category ?? '').toLowerCase()
      if (type !== 'series_eb_revision' && type !== 'series_rejected') return false
      const meta = {
        ...(typeof raw.data === 'object' && raw.data ? raw.data : {}),
        ...(typeof raw.meta === 'object' && raw.meta ? raw.meta : {}),
      }
      const metaSeriesId = String(
        meta.series_id ?? meta.seriesId ?? meta.series?._id ?? meta.series?.id ?? '',
      ).trim()
      return metaSeriesId === sid && String(meta.feedback ?? meta.notes ?? '').trim()
    })
    if (!match) return null
    const meta = {
      ...(typeof match.data === 'object' && match.data ? match.data : {}),
      ...(typeof match.meta === 'object' && match.meta ? match.meta : {}),
    }
    return {
      id: match._id ?? match.id ?? null,
      notes: String(meta.feedback ?? meta.notes ?? '').trim(),
      result: String(match.type ?? '').includes('rejected') ? 'rejected' : 'revision',
      councilAverage: null,
      classificationText: '',
      createdAt: match.createdAt ?? match.created_at ?? null,
      memberNotes: [],
    }
  } catch {
    return null
  }
}

export function seriesPath(series) {
  const slug = series.slug ?? slugifySeriesTitle(series.title)
  return `/mangaka/series/${slug}`
}

function DetailShell({ children, onLogout }) {
  const user = getSession()
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header links={NAV_LINKS} onLogout={user ? onLogout : undefined} />
      <main className="page-container flex-1 py-8">{children}</main>
      <Footer />
    </div>
  )
}

function Breadcrumb({ items }) {
  return (
    <nav className="mb-6 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground" aria-label="Đường dẫn">
      {items.map((item, i) => {
        const isLast = i === items.length - 1
        return (
          <span key={i} className="flex items-center gap-1.5">
            {item.to && !isLast ? (
              <Link to={item.to} className="transition-colors hover:text-foreground">{item.label}</Link>
            ) : (
              <span className={isLast ? 'font-medium text-foreground' : ''}>{item.label}</span>
            )}
            {!isLast ? <ChevronRight className="size-3.5" /> : null}
          </span>
        )
      })}
    </nav>
  )
}

export default function SeriesUploadDetail() {
  const { seriesSlug, chapterId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [series, setSeries] = useState(null)
  const [chapterRows, setChapterRows] = useState([])
  const [annotatorChapters, setAnnotatorChapters] = useState([])
  const [loading, setLoading] = useState(true)
  const [editSeriesOpen, setEditSeriesOpen] = useState(false)
  const [endRequestOpen, setEndRequestOpen] = useState(false)
  const [activeEndRequest, setActiveEndRequest] = useState(null)
  const [pageStart, setPageStart] = useState(0)
  const [ebFeedback, setEbFeedback] = useState(null)
  const [ebFeedbackLoading, setEbFeedbackLoading] = useState(false)
  const highlightFeedback = searchParams.get('ebFeedback') === '1'

  const refreshEndRequestState = useCallback(async (seriesId) => {
    if (!seriesId) {
      setActiveEndRequest(null)
      return
    }
    try {
      const raw = await seriesEndRequestsService.getMine({
        page: 1,
        limit: 50,
      })
      const mapped = mapSeriesEndRequestListResponse(raw)
      const hit = mapped.items.find((it) => {
        const sid = String(it.seriesId ?? it.series?.id ?? '')
        return sid === String(seriesId) && blocksNewEndRequest(it)
      }) ?? mapped.items.find((it) => {
        const sid = String(it.seriesId ?? it.series?.id ?? '')
        return sid === String(seriesId) && isApprovedAwaitingFinalPublish(it)
      }) ?? null
      setActiveEndRequest(hit)
    } catch {
      setActiveEndRequest(null)
    }
  }, [])

  const loadEbFeedback = useCallback(async (uiSeries, seriesRaw = null) => {
    if (!uiSeries?.id) {
      setEbFeedback(null)
      return
    }
    const needsFeedback =
      uiSeries.status === 'rejected'
      || uiSeries.status === 'revision'
      || Boolean(uiSeries.ebEvaluationId)
      || Boolean(uiSeries.ebEvaluationNotes)
    if (!needsFeedback) {
      setEbFeedback(null)
      return
    }

    setEbFeedbackLoading(true)
    let best = null
    const absorb = (mapped) => {
      if (!mapped) return
      best = mergeEbFeedback(best, mapped)
      setEbFeedback(best)
    }

    try {
      // 1) Notes đã có trên series detail
      if (uiSeries.ebEvaluationNotes) {
        absorb({
          id: uiSeries.ebEvaluationId,
          notes: uiSeries.ebEvaluationNotes,
          result: uiSeries.status === 'revision' || uiSeries.status === 'rejected'
            ? uiSeries.status
            : '',
          councilAverage: null,
          classificationText: '',
          createdAt: null,
          memberNotes: [],
        })
      }

      // 2) Evaluation lồng trong GET /series/:id
      absorb(mapEbFeedbackFromEvaluation(
        seriesRaw?.latest_evaluation
        ?? seriesRaw?.evaluation
        ?? null,
      ))

      const embeddedList = collectEvaluationsFromPayload(seriesRaw)
      const embeddedLatest = pickLatestEvaluation(embeddedList)
      absorb(mapEbFeedbackFromEvaluation(embeddedLatest))

      // 3) Lịch sử chấm theo series — luôn lấy id để gọi detail
      let evaluationId = uiSeries.ebEvaluationId
        || resolveEntityId(
          embeddedLatest?._id
          ?? embeddedLatest?.id
          ?? embeddedLatest?.evaluationId
          ?? embeddedLatest?.evaluation_id,
        )

      try {
        const list = await ebEvaluationsService.getSeriesEvaluations(uiSeries.id)
        const items = collectEvaluationsFromPayload(list)
        const latest = pickLatestEvaluation(items)
        absorb(mapEbFeedbackFromEvaluation(latest))
        evaluationId = evaluationId
          || resolveEntityId(
            latest?._id
            ?? latest?.id
            ?? latest?.evaluation_id
            ?? latest?.evaluationId,
          )
      } catch {
        /* tiếp tục getById / notification */
      }

      // 4) Chi tiết evaluation (notes + member_scores đầy đủ) — luôn gọi nếu có id
      if (evaluationId) {
        try {
          const detail = await ebEvaluationsService.getById(evaluationId)
          absorb(mapEbFeedbackFromEvaluation(detail))
          absorb(mapEbFeedbackFromEvaluation(mapEbHistoryDetailResponse(detail)))
        } catch {
          /* fallback notification */
        }
      }

      // 5) Fallback / bổ sung từ notification meta.feedback
      const fromNoti = await fetchEbFeedbackFromNotifications(uiSeries.id)
      absorb(fromNoti)
    } catch {
      const fromNoti = await fetchEbFeedbackFromNotifications(uiSeries.id)
      absorb(fromNoti)
    } finally {
      setEbFeedbackLoading(false)
    }
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const mine = await seriesService.getMine()
      const list = (Array.isArray(mine) ? mine : []).map((s, i) => apiSeriesToUi(s, i))
      const found = findSeriesByIdOrSlug(list, seriesSlug)
      if (!found) {
        setSeries(null)
        return
      }
      const detailRaw = await seriesService.getById(found.id)
      const detail = unwrapSeriesDetailPayload(detailRaw)
      const uiSeries = apiSeriesToUi({ ...found, ...detail }, 0)
      setSeries(uiSeries)
      void refreshEndRequestState(uiSeries.id)
      void loadEbFeedback(uiSeries, detail)

      const { chapters, seriesName } = await seriesService.getChapters(found.id)
      const title = seriesName || uiSeries.title
      const rows = (Array.isArray(chapters) ? chapters : []).map(ch => apiChapterToRow(ch, title))
      setChapterRows(rows)

      const annotators = await Promise.all(
        rows.map(async (row) => {
          try {
            const rawPages = await chaptersService.getPages(row.id)
            let pageList = unwrapChapterPagesPayload(rawPages).map(apiPageToUi)
            try {
              const rawTasks = await tasksService.getByChapter(row.id)
              const tasks = (Array.isArray(rawTasks) ? rawTasks : []).map(apiTaskToUi)
              pageList = mergeTaskResultsIntoPages(pageList, tasks)
              if (allChapterTasksApproved(tasks) || shouldShowAssistantEditedOnAnnotate(row.apiStatus)) {
                markAssistantApprovedPages(row.id, [], { markAll: true })
              } else {
                const approvedNums = tasks
                  .filter((t) => t.status === 'approved' && t.pageNumber != null)
                  .map((t) => t.pageNumber)
                if (approvedNums.length) markAssistantApprovedPages(row.id, approvedNums)
              }
            } catch {
              if (shouldShowAssistantEditedOnAnnotate(row.apiStatus)) {
                markAssistantApprovedPages(row.id, [], { markAll: true })
              }
            }
            const stamped = stampAssistantApprovedOnPages(row.id, pageList)
            const ch = (Array.isArray(chapters) ? chapters : []).find(
              (c) => String(c._id ?? c.id) === String(row.id),
            )
            return apiChapterToAnnotator(ch ?? row, stamped, title)
          } catch {
            return apiChapterToAnnotator(row, [], title)
          }
        }),
      )
      setAnnotatorChapters(annotators)
    } catch (err) {
      console.error(getApiErrorMessage(err))
      setSeries(null)
    } finally {
      setLoading(false)
    }
  }, [seriesSlug, refreshEndRequestState, loadEbFeedback])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    if (!highlightFeedback || loading) return undefined
    const timer = window.setTimeout(() => {
      document.getElementById('eb-feedback')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }, 200)
    return () => window.clearTimeout(timer)
  }, [highlightFeedback, loading, ebFeedback])

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const activeRow = useMemo(
    () => (chapterId ? chapterRows.find(r => String(r.id) === String(chapterId)) : null),
    [chapterRows, chapterId],
  )

  const activeAnnotator = useMemo(() => {
    if (!activeRow) return null
    return annotatorChapters.find(ch => ch.id === activeRow.id) ?? null
  }, [activeRow, annotatorChapters])

  useEffect(() => { setPageStart(0) }, [chapterId])

  async function handleEditSeriesSubmit(form) {
    if (!series) return
    try {
      await seriesService.update(series.id, uiSeriesFormToApi(form))
      await loadData()
      setEditSeriesOpen(false)
      const updated = applySeriesFormUpdate(series, form)
      const newSlug = updated.slug ?? slugifySeriesTitle(updated.title)
      if (newSlug !== seriesSlug) {
        navigate(`/mangaka/series/${newSlug}`, { replace: true })
      }
    } catch (err) {
      alert(getApiErrorMessage(err, 'Cập nhật series thất bại.'))
    }
  }

  const chapterCards = useMemo(() => chapterRows.map(row => {
    const annot = annotatorChapters.find(ch => ch.id === row.id)
    const page1Original = getPage1OriginalUrl(annot?.pages)
    const coverUrl = resolveChapterCoverDisplay({
      coverImageUrl: annot?.cover?.url || row.coverUrl,
      page1OriginalUrl: page1Original,
      seriesCoverUrl: series?.coverImage,
    })
    const cover = coverUrl
      ? { url: coverUrl, name: annot?.cover?.name ?? 'cover' }
      : null
    const uploaded = annot?.pages?.length ?? row.pages ?? 0
    return { row, annot, cover, uploaded }
  }), [chapterRows, annotatorChapters, series?.coverImage])

  const quickRevisionChapter = useMemo(
    () => chapterRows.find((row) =>
      canShowQuickRevision(row.apiStatus, series?.status),
    ) ?? null,
    [chapterRows, series?.status],
  )

  const openQuickRevisionForChapter = (row) => {
    const state = buildMangakaQuickRevisionState({
      series: series?.title,
      chapterId: row?.id,
    })
    if (!state) return
    navigate('/mangaka', { state })
  }

  if (loading) {
    return (
      <DetailShell onLogout={handleLogout}>
        <p className="text-muted-foreground">Đang tải series...</p>
      </DetailShell>
    )
  }

  if (!series) {
    return (
      <DetailShell onLogout={handleLogout}>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Inbox className="size-12 text-muted-foreground/60" />
            <h1 className="text-2xl font-bold">Không tìm thấy truyện</h1>
            <p className="text-muted-foreground">Series không tồn tại hoặc bạn chưa có quyền truy cập.</p>
            <Button asChild>
              <Link to="/mangaka">
                <ArrowLeft className="size-4" />
                Về Mangaka
              </Link>
            </Button>
          </CardContent>
        </Card>
      </DetailShell>
    )
  }

  const slug = series.slug ?? slugifySeriesTitle(series.title)
  const basePath = `/mangaka/series/${slug}`
  const seriesStatusBadge = STATUS_BADGE[series.status] ?? null
  const isRejected = series.status === 'rejected'
  const isRevision = series.status === 'revision'
  const needsEbFix = isSeriesEbResubmitStatus(series)

  if (chapterId && activeRow) {
    const rawPages = stampAssistantApprovedOnPages(
      activeRow.id,
      activeAnnotator?.pages ?? [],
    )
    // Ưu tiên ảnh Assistant (result) nếu có — series detail luôn hiện bản mới nhất
    const pages = rawPages.map((p) => ({
      ...p,
      url:
        p.resultUrl
        ?? getAnnotatorPageDisplayUrl(
          p,
          activeRow.apiStatus ?? activeAnnotator?.apiStatus,
        ),
    }))
    const pagesWithMedia = pages.filter(p => p?.url)
    const staleOnly = pages.length > 0 && pagesWithMedia.length === 0
    const progressPct = pages.length > 0 ? Math.min(100, pages.length * 4) : null
    const statusBadge = STATUS_BADGE[activeRow.status] ?? STATUS_BADGE.draft
    const showQuickRevision = canShowQuickRevision(activeRow.apiStatus, series.status)

    const PAGE_LIMIT = 6
    const visiblePages = pagesWithMedia.slice(pageStart, pageStart + PAGE_LIMIT)
    const hasPrev = pageStart > 0
    const hasNext = pageStart + PAGE_LIMIT < pagesWithMedia.length

    // Giống nút "Upload chapter" (series list): chỉ mở tab annotate + series, không ép chapterId
    const openAnnotate = () => navigate('/mangaka', {
      state: { tab: 'annotate', series: series.title },
    })

    const openQuickRevision = () => openQuickRevisionForChapter(activeRow)

    return (
      <DetailShell onLogout={handleLogout}>
        <Breadcrumb items={[
          { to: '/mangaka', label: 'Workspace' },
          { to: basePath, label: series.title },
          { label: `Chapter ${activeRow.num}` },
        ]} />
        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>Chapter {activeRow.num}</CardTitle>
                  <CardDescription>{series.title} · {activeRow.date}</CardDescription>
                </div>
                <Badge className={statusBadge.className} variant="secondary">{statusBadge.label}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {staleOnly ? (
                <p className="text-sm text-amber-600">Ảnh chapter chưa tải được — mở Upload & Ghi chú để xem lại.</p>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {visiblePages.length ? visiblePages.map((p, i) => (
                  <div key={p.id ?? i} className="overflow-hidden rounded-lg border bg-muted/30">
                    <img src={p.url} alt={p.name ?? `Trang ${pageStart + i + 1}`} className="aspect-[728/1030] w-full object-cover" />
                  </div>
                )) : (
                  <div className="col-span-full flex flex-col items-center gap-2 py-12 text-muted-foreground">
                    <FileImage className="size-10 opacity-50" />
                    <p className="text-sm">Chưa có trang nào</p>
                  </div>
                )}
              </div>
              {pagesWithMedia.length > PAGE_LIMIT ? (
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm text-muted-foreground">
                    {pageStart + 1}–{Math.min(pageStart + PAGE_LIMIT, pagesWithMedia.length)} / {pagesWithMedia.length} trang
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPageStart(s => s - PAGE_LIMIT)} disabled={!hasPrev}>
                      <ChevronLeft className="size-4" />
                      Trước
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setPageStart(s => s + PAGE_LIMIT)} disabled={!hasNext}>
                      Sau
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
              ) : null}
              <Button onClick={openAnnotate}>
                <PenSquare className="size-4" />
                Mở Upload & Ghi chú
              </Button>
              {showQuickRevision ? (
                <Button variant="default" className="bg-sky-600 hover:bg-sky-700" onClick={openQuickRevision}>
                  <Zap className="size-4" />
                  Sửa nhanh & gửi TE
                </Button>
              ) : null}
              <Button variant="outline" onClick={openAnnotate}>
                <ImageIcon className="size-4" />
                Đổi ảnh bìa
              </Button>
            </CardContent>
          </Card>
          <aside className="space-y-4">
            {progressPct != null ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Tiến độ upload</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{pages.length} trang</div>
                </CardContent>
              </Card>
            ) : null}
          </aside>
        </div>
      </DetailShell>
    )
  }

  return (
    <DetailShell onLogout={handleLogout}>
      <Breadcrumb items={[
        { to: '/mangaka', label: 'Workspace' },
        { label: series.title },
      ]} />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">{series.title}</h1>
            {seriesStatusBadge ? (
              <Badge className={seriesStatusBadge.className} variant="secondary">
                {seriesStatusBadge.label}
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-muted-foreground">{formatSeriesCardLine(series)}</p>
          {needsEbFix ? (
            <p
              className={cn(
                'mt-2 rounded-md border px-3 py-2 text-sm',
                isRevision
                  ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100'
                  : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100',
              )}
            >
              {isRejected
                ? 'Series bị EB từ chối — đọc feedback, chỉnh sửa rồi nộp lại cho TE (TE sẽ gửi EB lần nữa).'
                : 'EB yêu cầu chỉnh sửa (revision) — đọc feedback, cập nhật nội dung rồi nộp lại cho TE.'}
            </p>
          ) : null}
          {isApprovedAwaitingFinalPublish(activeEndRequest) ? (
            <p className="mt-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100">
              Series đã được duyệt kết thúc tại chapter #
              {activeEndRequest.plannedFinalChapterNumber ?? '?'}. Sẽ chuyển
              completed khi chapter này được publish.
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setEditSeriesOpen(true)}>
            Chỉnh sửa hồ sơ
          </Button>
          {canRequestSeriesEnd(series.publicationStatus) && !activeEndRequest ? (
            <Button
              type="button"
              variant="outline"
              className="gap-1.5 border-amber-200 text-amber-800 hover:bg-amber-50 dark:border-amber-500/40 dark:text-amber-200 dark:hover:bg-amber-500/10"
              onClick={() => setEndRequestOpen(true)}
            >
              <Flag className="size-4" />
              Yêu cầu kết thúc truyện
            </Button>
          ) : activeEndRequest?.status === 'pending' ? (
            <Button type="button" variant="outline" disabled className="gap-1.5">
              <Flag className="size-4" />
              Đã gửi yêu cầu kết thúc
            </Button>
          ) : null}
          <Button asChild>
            <Link to="/mangaka" state={{ tab: 'annotate', series: series.title }}>
              <Upload className="size-4" />
              {needsEbFix ? 'Chỉnh sửa / Upload chapter' : 'Upload chapter'}
            </Link>
          </Button>
          {needsEbFix && quickRevisionChapter ? (
            <Button
              type="button"
              className="bg-sky-600 hover:bg-sky-700"
              onClick={() => openQuickRevisionForChapter(quickRevisionChapter)}
            >
              <Zap className="size-4" />
              Sửa nhanh & gửi TE
            </Button>
          ) : null}
        </div>
      </div>

      {ebFeedback?.notes || ebFeedback?.memberNotes?.length || needsEbFix ? (
        <Card
          id="eb-feedback"
          className={cn(
            'mb-6',
            isRevision
              ? 'border-amber-200/80 bg-amber-50/40 dark:border-amber-500/30 dark:bg-amber-500/10'
              : 'border-rose-200/80 bg-rose-50/40 dark:border-rose-500/30 dark:bg-rose-500/10',
            highlightFeedback && (isRevision ? 'ring-2 ring-amber-400/60' : 'ring-2 ring-rose-400/60'),
          )}
        >
          <CardHeader className="pb-2">
            <CardTitle
              className={cn(
                'flex items-center gap-2 text-base',
                isRevision
                  ? 'text-amber-900 dark:text-amber-100'
                  : 'text-rose-900 dark:text-rose-100',
              )}
            >
              <MessageSquareWarning className="size-4" />
              Feedback từ {LABEL_EDITOR_BOARD}
            </CardTitle>
            <CardDescription>
              {ebFeedback?.result
                ? `Kết quả: ${ebFeedback.result}`
                : 'Góp ý từ lần chấm gần nhất'}
              {ebFeedback?.councilAverage != null
                ? ` · ĐTB ${Number(ebFeedback.councilAverage).toFixed(1)}`
                : ''}
              {ebFeedback?.classificationText
                ? ` · ${ebFeedback.classificationText}`
                : ''}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className={cn(
                'rounded-xl border bg-white/70 px-4 py-3 dark:bg-black/20',
                isRevision ? 'border-amber-200/70' : 'border-rose-200/70',
              )}
            >
              <p
                className={cn(
                  'text-[11px] font-semibold uppercase tracking-[0.12em]',
                  isRevision
                    ? 'text-amber-700 dark:text-amber-300'
                    : 'text-rose-700 dark:text-rose-300',
                )}
              >
                Ghi chú tổng hợp
              </p>
              <p
                className={cn(
                  'mt-2 text-sm leading-relaxed whitespace-pre-wrap',
                  isRevision
                    ? 'text-amber-950 dark:text-amber-50'
                    : 'text-rose-950 dark:text-rose-50',
                )}
              >
                {ebFeedbackLoading && !ebFeedback?.notes
                  ? 'Đang tải góp ý từ Editor Board…'
                  : (ebFeedback?.notes
                    || 'Chưa có ghi chú chi tiết từ lần chấm gần nhất. Kiểm tra chuông thông báo nếu EB vừa gửi feedback.')}
              </p>
            </div>

            {Array.isArray(ebFeedback?.memberNotes) && ebFeedback.memberNotes.length > 0 ? (
              <div className="space-y-2">
                <p
                  className={cn(
                    'text-[11px] font-semibold uppercase tracking-[0.12em]',
                    isRevision
                      ? 'text-amber-700 dark:text-amber-300'
                      : 'text-rose-700 dark:text-rose-300',
                  )}
                >
                  Góp ý từng thành viên hội đồng
                </p>
                <ul className="space-y-2">
                  {ebFeedback.memberNotes.map((item) => (
                    <li
                      key={`${item.name}-${item.body.slice(0, 24)}`}
                      className={cn(
                        'rounded-xl border bg-white/70 px-3 py-2.5 dark:bg-black/20',
                        isRevision ? 'border-amber-200/70' : 'border-rose-200/70',
                      )}
                    >
                      <p className="text-xs font-semibold text-foreground">{item.name}</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                        {item.body}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {needsEbFix ? (
              <div className="flex flex-wrap items-center gap-2">
                <p
                  className={cn(
                    'flex-1 text-xs',
                    isRevision
                      ? 'text-amber-800/90 dark:text-amber-200/80'
                      : 'text-rose-700/90 dark:text-rose-200/80',
                  )}
                >
                  Sau khi chỉnh theo feedback, có thể sửa nhanh 1–5 trang rồi gửi thẳng TE (bỏ Assistant).
                </p>
                {quickRevisionChapter ? (
                  <Button
                    type="button"
                    size="sm"
                    className="shrink-0 bg-sky-600 hover:bg-sky-700"
                    onClick={() => openQuickRevisionForChapter(quickRevisionChapter)}
                  >
                    <Zap className="size-4" />
                    Sửa nhanh & gửi TE
                  </Button>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Danh sách chapter</h2>
          {chapterCards.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <ImageIcon className="mx-auto mb-3 size-10 opacity-40" />
                Chưa có chapter — bấm Upload chapter để bắt đầu.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {chapterCards.map(({ row, cover, uploaded }) => {
                const badge = STATUS_BADGE[row.status] ?? STATUS_BADGE.draft
                return (
                  <Link key={row.id} to={`${basePath}/chapter/${row.id}`} className="group block h-full">
                    <Card className="flex h-full flex-col overflow-hidden transition-shadow hover:shadow-md">
                      <div className="aspect-[3/4] w-full shrink-0 overflow-hidden bg-muted">
                        {cover?.url ? (
                          <img src={cover.url} alt="" className="size-full object-cover transition-transform group-hover:scale-[1.02]" />
                        ) : (
                          <div className="flex size-full items-center justify-center text-muted-foreground">
                            <ImageIcon className="size-8 opacity-40" />
                          </div>
                        )}
                      </div>
                      <CardContent className="mt-auto p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">Ch. {row.num}</span>
                          <Badge className={cn('text-xs', badge.className)} variant="secondary">{badge.label}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{uploaded} trang · {row.date}</p>
                      </CardContent>
                    </Card>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Hồ sơ series</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {series.coverImage ? (
                <div className="overflow-hidden rounded-md">
                  <img
                    src={resolveMediaUrl(series.coverImage)}
                    alt=""
                    className="aspect-[3/4] w-full object-cover"
                  />
                </div>
              ) : null}
              <p className="text-muted-foreground">{series.synopsis || 'Chưa có tóm tắt.'}</p>
              <Separator />
              <dl className="space-y-2">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Thể loại</dt>
                  <dd className="text-right">{series.genres?.join(', ') || '—'}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Đối tượng</dt>
                  <dd>{series.demographic || '—'}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Chapter</dt>
                  <dd>{chapterRows.length}</dd>
                </div>
              </dl>
              {series.needsFullDebutPipeline ? (
                <p className="flex items-center gap-1 text-xs text-amber-600">
                  <Sparkles className="size-3" />
                  Luồng lần đầu · qua {LABEL_EDITOR_BOARD}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </aside>
      </div>

      {editSeriesOpen ? (
        <AddSeriesModal
          open={editSeriesOpen}
          onClose={() => setEditSeriesOpen(false)}
          onSubmit={handleEditSeriesSubmit}
          initialForm={seriesToForm(series)}
          existingTitles={[]}
          excludeTitle={series.title}
          mode="edit"
        />
      ) : null}

      <SeriesEndRequestDialog
        key={series?.id ?? 'series-end'}
        series={series}
        open={endRequestOpen}
        onClose={() => setEndRequestOpen(false)}
        hasActiveRequest={Boolean(activeEndRequest)}
        onSubmitted={(raw) => {
          setActiveEndRequest(mapSeriesEndRequestListItem(raw ?? {}))
        }}
      />
    </DetailShell>
  )
}
