import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Clock,
  Handshake,
  Image as ImageIcon,
  Inbox,
  Layers as LayersIcon,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react'
import Header from '@/components/User/Header/Header.jsx'
import Footer from '@/components/User/Footer/Footer.jsx'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { getSession, logout } from '@/lib/auth.js'
import { useAssistantAssignments } from '@/hooks/useAssistantAssignments.js'
import { useAssistantTasks } from '@/hooks/useAssistantTasks.js'
import { useAssistantCooperation } from '@/hooks/useAssistantCooperation.js'
import { useNotifications } from '@/hooks/useNotifications.js'
import { getApiErrorMessage } from '@/api/http.js'
import { isMeetingPhase, isPendingRequest, requestStatusLabel } from '@/utils/cooperationMappers.js'
import LayerEditor from '@/components/layer/LayerEditor.jsx'
import { AssistantMangakaBoard, AssistantMangakaPicker } from './AssistantMangakaHub.jsx'
import { buildMangakaOptions, enrichAssignments } from './assistantMangakaHub.js'
import { ASSISTANT_NAV_LINKS } from '@/constants/assistantNav.js'
import './Assistant.css'

const NAV_LINKS = ASSISTANT_NAV_LINKS

const HERO_IMAGES = [
  '/images/assistant1.png',
  '/images/assistant2.png',
  '/images/assistant3.png',
]
const HERO_SLIDE_MS = 5000

const STATS = [
  { label: 'Đã nhận', icon: Inbox, color: 'amber' },
  { label: 'Đang làm', icon: LayersIcon, color: 'violet' },
  { label: 'Đã gửi', icon: Clock, color: 'sky' },
  { label: 'Đã xong', icon: CheckCircle2, color: 'emerald' },
]

const STAT_ICON_CLASS = {
  amber: 'text-amber-500',
  violet: 'text-violet-500',
  sky: 'text-sky-500',
  emerald: 'text-emerald-500',
}

const TASK_STATUS_LABEL = {
  pending: 'Chờ nhận',
  in_progress: 'Đang làm',
  submitted: 'Chờ duyệt',
  approved: 'Đã duyệt',
  revision: 'Cần sửa',
}

export default function Assistant() {
  const user = getSession()
  const navigate = useNavigate()
  const location = useLocation()

  const viewParam = useMemo(() => {
    const raw = new URLSearchParams(location.search).get('view')
    if (raw === 'board' || raw === 'editor' || raw === 'coop' || raw === 'pick') {
      return raw
    }
    return 'pick'
  }, [location.search])

  const { assignments, loading, error, refresh, loadChapterPages } = useAssistantAssignments()
  const { allTasks, loading: tasksLoading, refresh: refreshTasks } = useAssistantTasks()

  const {
    actionable: cooperationRequests,
    cooperations,
    loading: cooperationLoading,
    acceptMeet,
    rejectRequest,
    acceptCooperation,
    declineCooperation,
  } = useAssistantCooperation()

  const [selectedChapterId, setSelectedChapterId] = useState(null)
  const [selectedChapterPages, setSelectedChapterPages] = useState([])
  const [selectedChapterDetail, setSelectedChapterDetail] = useState(null)
  const [hireBusyId, setHireBusyId] = useState(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showTaskDetail, setShowTaskDetail] = useState(false)
  const [hubView, setHubView] = useState(viewParam === 'coop' ? 'pick' : viewParam)
  const [selectedMangakaId, setSelectedMangakaId] = useState(null)
  const [heroSlide, setHeroSlide] = useState(0)

  function goAssistantView(view, { replace = true } = {}) {
    const next = view && view !== 'pick' ? `/assistant?view=${view}` : '/assistant?view=pick'
    navigate(next, { replace })
  }

  useNotifications({
    enabled: Boolean(user),
    onNew: (n) => {
      // Chỉ toast yêu cầu sửa mới; bỏ type=task chung (gây lặp khi vào lại trang).
      if (n.isRead) return
      const t = String(n.type ?? '').toLowerCase()
      const text = `${n.title ?? ''} ${n.message ?? ''}`
      const isRevision =
        t === 'revision'
        || /yêu cầu.*sửa|chỉnh sửa|revision/i.test(text)
      if (!isRevision) return
      toast.warning(`${n.title}${n.message ? ` — ${n.message}` : ''}`, {
        description: 'Bấm vào chuông để xem chi tiết.',
        duration: 8000,
      })
      void refreshTasks()
      void refresh()
    },
  })

  useEffect(() => {
    if (!isFullscreen) return undefined
    const onKey = (e) => { if (e.key === 'Escape') setIsFullscreen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isFullscreen])

  const chapterTaskMap = useMemo(() => {
    const map = {}
    for (const t of allTasks) {
      const k = String(t.chapterId ?? t.id)
      if (!map[k]) map[k] = t
    }
    return map
  }, [allTasks])

  const enrichedAssignments = useMemo(
    () => enrichAssignments(assignments, chapterTaskMap, cooperations),
    [assignments, chapterTaskMap, cooperations],
  )

  const mangakaOptions = useMemo(
    () => buildMangakaOptions(cooperations, enrichedAssignments, chapterTaskMap),
    [cooperations, enrichedAssignments, chapterTaskMap],
  )

  const assignmentsByMangaka = useMemo(() => {
    const map = new Map()
    for (const a of enrichedAssignments) {
      const key = a._mangakaId
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(a)
    }
    return map
  }, [enrichedAssignments])

  const selectedMangaka = useMemo(
    () => mangakaOptions.find(m => m.id === selectedMangakaId) ?? null,
    [mangakaOptions, selectedMangakaId],
  )

  // Đồng bộ navbar ?view= với hub (không đổi API / task handlers).
  useEffect(() => {
    if (viewParam === 'coop') {
      setHubView('pick')
      const timer = window.setTimeout(() => {
        document.getElementById('as-coop')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 50)
      return () => window.clearTimeout(timer)
    }

    if (viewParam === 'board') {
      if (selectedMangakaId) {
        setHubView('board')
      } else {
        setHubView('pick')
        if (location.search.includes('view=board')) {
          navigate('/assistant?view=pick', { replace: true })
        }
      }
      return undefined
    }

    if (viewParam === 'editor') {
      if (selectedMangakaId) {
        setHubView('editor')
      } else {
        setHubView('pick')
        if (location.search.includes('view=editor')) {
          navigate('/assistant?view=pick', { replace: true })
        }
      }
      return undefined
    }

    setHubView('pick')
    return undefined
  }, [viewParam, selectedMangakaId, location.search, navigate])

  const mangakaAssignments = useMemo(() => {
    if (!selectedMangakaId) return enrichedAssignments
    return assignmentsByMangaka.get(selectedMangakaId) ?? []
  }, [selectedMangakaId, enrichedAssignments, assignmentsByMangaka])

  useEffect(() => {
    if (hubView !== 'editor' || !selectedMangakaId) return
    const list = mangakaAssignments
    if (!list.length) {
      setSelectedChapterId(null)
      return
    }
    if (list.some(a => a.chapterId === selectedChapterId)) return
    const firstAssignment = list[0]
    setSelectedChapterId(firstAssignment?.chapterId ?? null)
    if (firstAssignment?.pages?.length) {
      setSelectedChapterPages(firstAssignment.pages)
    }
    if (firstAssignment?.chapterId) {
      void loadChapterPages(firstAssignment.chapterId, firstAssignment._task)
        .then(({ pages, chapter, revisionNotesParsed }) => {
          setSelectedChapterPages(prev => pages?.length ? pages : prev)
          setSelectedChapterDetail({ ...chapter, revision_notes_parsed: revisionNotesParsed })
        })
        .catch(() => null)
    }
  }, [mangakaAssignments, selectedChapterId, loadChapterPages, hubView, selectedMangakaId])

  const selectedChapter = useMemo(
    () => mangakaAssignments.find(a => a.chapterId === selectedChapterId) ?? null,
    [mangakaAssignments, selectedChapterId],
  )

  const selectedWithTask = useMemo(() => {
    if (!selectedChapter) return null
    const key = String(selectedChapter.chapterId)
    const task = chapterTaskMap[key] ?? null
    const seriesTitle = selectedChapterDetail?.seriesTitle ?? selectedChapter.seriesTitle ?? ''
    const pages = selectedChapterPages.length > 0
      ? selectedChapterPages
      : (selectedChapter.pages?.length > 0 ? selectedChapter.pages : [])
    return {
      ...selectedChapter,
      ...selectedChapterDetail,
      seriesTitle,
      pages,
      _task: task,
    }
  }, [selectedChapter, chapterTaskMap, selectedChapterPages, selectedChapterDetail])

  const selectedTask = selectedChapterId ? chapterTaskMap[String(selectedChapterId)] : null
  const isRevisionTask = selectedTask?.status === 'revision'

  useEffect(() => {
    setShowTaskDetail(isRevisionTask)
  }, [selectedChapterId, isRevisionTask])

  useEffect(() => {
    if (HERO_IMAGES.length < 2) return undefined
    const timer = window.setInterval(() => {
      setHeroSlide((index) => (index + 1) % HERO_IMAGES.length)
    }, HERO_SLIDE_MS)
    return () => window.clearInterval(timer)
  }, [])

  const statsDisplayed = useMemo(() => {
    const byChapter = {}
    for (const t of allTasks) {
      const k = String(t.chapterId ?? t.id)
      byChapter[k] = t
    }
    const chapterList = Object.values(byChapter)
    const pending = chapterList.filter(t => t.status === 'pending').length
    const progress = chapterList.filter(t => t.status === 'in_progress' || t.status === 'revision').length
    const review = chapterList.filter(t => t.status === 'submitted').length
    const approved = chapterList.filter(t => t.status === 'approved').length
    return [
      { ...STATS[0], value: String(pending) },
      { ...STATS[1], value: String(progress) },
      { ...STATS[2], value: String(review) },
      { ...STATS[3], value: String(approved) },
    ]
  }, [allTasks])

  function handleLogout() {
    logout()
    navigate('/login')
  }

  async function handleSelectChapter(chapter) {
    setSelectedChapterId(chapter.chapterId)
    setSelectedChapterPages(chapter.pages ?? [])
    setSelectedChapterDetail(null)
    try {
      const result = await loadChapterPages(chapter.chapterId, chapter._task)
      setSelectedChapterPages(prev => result.pages?.length ? result.pages : prev)
      setSelectedChapterDetail({ ...result.chapter, revision_notes_parsed: result.revisionNotesParsed })
    } catch {
      // Giữ pages đã có từ assignment
    }
  }

  async function handleOpenChapter(chapter) {
    await handleSelectChapter(chapter)
    setHubView('editor')
    goAssistantView('editor')
  }

  function handlePickMangaka(mangakaId) {
    setSelectedMangakaId(mangakaId)
    setHubView('board')
    setSelectedChapterId(null)
    setSelectedChapterPages([])
    setSelectedChapterDetail(null)
    goAssistantView('board')
  }

  function handleBackToMangakaPicker() {
    setHubView('pick')
    setSelectedMangakaId(null)
    setSelectedChapterId(null)
    setSelectedChapterPages([])
    setSelectedChapterDetail(null)
    goAssistantView('pick')
  }

  function handleBackToMangakaBoard() {
    setHubView('board')
    setSelectedChapterId(null)
    setSelectedChapterPages([])
    setSelectedChapterDetail(null)
    goAssistantView('board')
  }

  async function handleCooperationAction(req, action) {
    if (!req?.id) {
      toast.error('Thiếu mã yêu cầu hợp tác.')
      return
    }
    setHireBusyId(req.id)
    try {
      if (action === 'accept-meet') {
        await acceptMeet(req.id)
        toast.success('Đã đồng ý gặp — chờ chốt hợp tác sau buổi gặp.')
      } else if (action === 'reject') {
        await rejectRequest(req.id)
        toast.message('Đã từ chối yêu cầu hợp tác.')
      } else if (action === 'accept-cooperation') {
        await acceptCooperation(req.id)
        toast.success('Đã chốt hợp tác — bạn có thể nhận chapter từ Mangaka này.')
      } else if (action === 'decline-cooperation') {
        await declineCooperation(req.id)
        toast.message('Đã từ chối hợp tác sau buổi gặp.')
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Không xử lý được yêu cầu.'))
    } finally {
      setHireBusyId(null)
    }
  }

  return (
    <div className="ws-page--assistant flex min-h-screen flex-col bg-background">
      <Header links={NAV_LINKS} onLogout={user ? handleLogout : undefined} />

      {hubView !== 'board' && hubView !== 'editor' ? (
      <section className="ws-hero--assistant relative overflow-hidden border-b border-white/5 text-white">
        <div className="as-hero-slides" aria-hidden>
          {HERO_IMAGES.map((src, index) => (
            <img
              key={src}
              src={src}
              alt=""
              className={cn(
                'as-hero-slides__img',
                index === heroSlide && 'as-hero-slides__img--active',
              )}
            />
          ))}
        </div>
        <div className="as-hero-slides__veil" aria-hidden />
        <div className="page-container relative flex h-full items-center py-5 md:py-6">
          <div className="max-w-2xl space-y-2">
            <Badge
              variant="secondary"
              className="bg-white/15 text-white hover:bg-white/20"
            >
              Không gian Assistant
            </Badge>
            <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
              {`Xin chào${user?.name ? `, ${user.name.split(' ')[0]}` : ''}`}
            </h1>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Badge
                variant="secondary"
                className="bg-white/15 text-white hover:bg-white/20"
              >
                <LayersIcon className="size-3" />
                Layer Editor
              </Badge>
              <Badge
                variant="secondary"
                className="bg-white/15 text-white hover:bg-white/20"
              >
                <Sparkles className="size-3" />
                1 chapter = 1 task
              </Badge>
            </div>
          </div>
        </div>
      </section>
      ) : null}

      <main
        className={cn(
          'page-container ws-main--assistant flex-1 pb-8',
          hubView === 'board' || hubView === 'editor'
            ? 'pt-6'
            : 'mt-6 pt-2 md:mt-8',
        )}
      >
        {error ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
            <p className="text-sm text-destructive">{getApiErrorMessage(error, 'Không tải được danh sách chapter.')}</p>
            <Button size="sm" variant="outline" onClick={() => void refresh()}>
              <RefreshCw className="size-3.5" />
              Thử lại
            </Button>
          </div>
        ) : null}

        {cooperationLoading ? (
          <Card id="as-coop" className="mb-4 border-violet-200/60 dark:border-violet-500/20">
            <CardContent className="py-5 text-center text-sm text-muted-foreground">
              Đang tải yêu cầu hợp tác...
            </CardContent>
          </Card>
        ) : cooperationRequests.length > 0 ? (
          <Card id="as-coop" className="mb-4 overflow-hidden border-violet-200 bg-violet-500/5 dark:border-violet-500/30">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Handshake className="size-4 text-violet-600 dark:text-violet-400" />
                Yêu cầu hợp tác từ Mangaka
              </CardTitle>
              <CardDescription>Đồng ý gặp → chốt hợp tác → nhận chapter.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {cooperationRequests.map(req => (
                <div
                  key={req.id}
                  className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-semibold">{req.mangakaName}</p>
                    {req.note ? (
                      <p className="text-sm text-muted-foreground">&ldquo;{req.note}&rdquo;</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Mời bạn hợp tác làm Assistant.</p>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      {requestStatusLabel(req.status)} · Gửi lúc{' '}
                      {new Date(req.createdAt).toLocaleString('vi-VN')}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {isPendingRequest(req.status) && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void handleCooperationAction(req, 'reject')}
                          disabled={hireBusyId === req.id}
                        >
                          Từ chối
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => void handleCooperationAction(req, 'accept-meet')}
                          disabled={hireBusyId === req.id}
                        >
                          Đồng ý gặp
                        </Button>
                      </>
                    )}
                    {isMeetingPhase(req.status) && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void handleCooperationAction(req, 'decline-cooperation')}
                          disabled={hireBusyId === req.id}
                        >
                          Từ chối
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => void handleCooperationAction(req, 'accept-cooperation')}
                          disabled={hireBusyId === req.id}
                        >
                          Chốt hợp tác
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : viewParam === 'coop' ? (
          <Card
            id="as-coop"
            className="mb-0 overflow-hidden rounded-2xl border border-gray-100 bg-gray-50/60 shadow-none dark:border-zinc-800 dark:bg-zinc-900/40"
          >
            <CardContent className="flex flex-col items-center px-6 py-7 text-center">
              <span className="mb-3 flex size-12 items-center justify-center rounded-full bg-white p-3 text-gray-400 shadow-sm dark:bg-zinc-800 dark:text-zinc-500">
                <Handshake className="size-5" />
              </span>
              <p className="text-sm font-semibold text-gray-900 dark:text-zinc-50">
                Chưa có yêu cầu hợp tác mới
              </p>
              <p className="mt-1 max-w-sm text-xs text-gray-500 dark:text-zinc-400">
                Khi Mangaka gửi lời mời, bạn sẽ thấy tại đây.
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-lg border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                  asChild
                >
                  <Link to="/profile">Cập nhật hồ sơ</Link>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 rounded-lg text-gray-600 hover:text-gray-900 dark:text-zinc-400"
                  asChild
                >
                  <Link to="/assistant?view=pick">Xem Chọn Mangaka</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {hubView === 'pick' ? (
          <div
            className={cn(
              (viewParam === 'coop'
                || cooperationLoading
                || cooperationRequests.length > 0)
                && 'mt-8',
            )}
          >
            <AssistantMangakaPicker
              mangakas={mangakaOptions}
              assignmentsByMangaka={assignmentsByMangaka}
              loading={loading || cooperationLoading}
              onSelect={handlePickMangaka}
            />
          </div>
        ) : null}

        {hubView === 'board' && selectedMangaka ? (
          <AssistantMangakaBoard
            mangaka={selectedMangaka}
            assignments={mangakaAssignments}
            onBack={handleBackToMangakaPicker}
            onSelectChapter={handleOpenChapter}
          />
        ) : null}

        {hubView === 'editor' && selectedMangaka ? (
        <div className="as-workspace flex min-h-[min(820px,calc(100vh-100px))] w-full flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/90 p-2.5 shadow-lg shadow-slate-950/20">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 rounded-lg border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white"
              onClick={handleBackToMangakaBoard}
            >
              <ArrowLeft className="size-3.5" />
              {selectedMangaka.name}
            </Button>
            <div className="hidden h-7 w-px bg-slate-700 sm:block" aria-hidden />
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              {statsDisplayed.map((s, i) => {
                const Icon = s.icon
                return (
                  <div
                    key={i}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-900/80 px-2.5 py-1.5"
                    title={s.label}
                  >
                    <Icon className={cn('size-3', STAT_ICON_CLASS[s.color])} />
                    <span className="text-[10px] font-medium text-slate-400">{s.label}</span>
                    <span className="text-xs font-bold tabular-nums text-slate-100">{s.value}</span>
                  </div>
                )
              })}
              {tasksLoading ? (
                <span className="text-[10px] text-slate-500">đang tải…</span>
              ) : null}
            </div>
          </div>

          <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-xl shadow-black/30">
            {selectedWithTask ? (
              <>
                <div
                  className={cn(
                    'min-h-0 flex-1 overflow-hidden',
                    isFullscreen && 'mk-fullscreen',
                  )}
                  role={isFullscreen ? 'dialog' : undefined}
                  aria-modal={isFullscreen ? true : undefined}
                >
                  {isFullscreen ? (
                    <header className="mk-fullscreen__header">
                      <div className="mk-fullscreen__title">
                        <strong>{selectedWithTask.seriesTitle}</strong>
                        <span>· Ch.{selectedWithTask.chapterNum}</span>
                      </div>
                      <div className="mk-fullscreen__tools">
                        <Badge variant="secondary" className="border-white/15 bg-white/10 text-white">
                          {selectedWithTask._task?.status
                            ? TASK_STATUS_LABEL[selectedWithTask._task.status]
                            : '—'}
                        </Badge>
                        <button
                          type="button"
                          className="mk-fullscreen__close"
                          onClick={() => setIsFullscreen(false)}
                        >
                          <X className="size-4" aria-hidden />
                          Thu nhỏ
                        </button>
                      </div>
                    </header>
                  ) : null}
                  <div className={cn('min-h-0 overflow-hidden', isFullscreen ? 'flex-1' : 'h-full')}>
                  {(() => {
                    if (import.meta.env.DEV) {
                      const pagesCount = (selectedWithTask.pages ?? []).length
                      const pagesWithUrl = (selectedWithTask.pages ?? []).filter(p => p?.url).length
                      console.debug('[Assistant] selectedWithTask:', {
                        chapterId: selectedWithTask.chapterId,
                        pagesCount,
                        pagesWithUrl,
                        samplePage: selectedWithTask.pages?.[0],
                        hasTask: !!selectedWithTask._task,
                        taskStatus: selectedWithTask._task?.status,
                        hasRevisionNotes: !!(selectedWithTask.revision_notes_parsed?.length || selectedWithTask.revision_annotations),
                      })
                    }
                    return (
                      <LayerEditor
                        chapter={selectedWithTask}
                        pages={selectedWithTask.pages ?? []}
                        task={selectedWithTask._task}
                        pageId={selectedWithTask._task?.pageId ?? null}
                        fullscreen={isFullscreen}
                        onEnterFullscreen={() => setIsFullscreen(true)}
                        onSubmitted={() => {
                          setIsFullscreen(false)
                          void refreshTasks()
                          void refresh()
                        }}
                      />
                    )
                  })()}
                  </div>
                </div>

                {selectedTask ? (
                  <div className="shrink-0 border-t border-slate-800 bg-slate-950">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-slate-200 hover:bg-slate-900"
                      onClick={() => setShowTaskDetail(v => !v)}
                    >
                      <span>Chi tiết task &amp; ghi chú Mangaka</span>
                      <ChevronDown className={cn('size-4 text-slate-500 transition-transform', showTaskDetail && 'rotate-180')} />
                    </button>
                    {showTaskDetail ? (
                      <div className="space-y-2 border-t border-slate-800 bg-slate-900/50 px-4 py-3 text-xs text-slate-400">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-slate-100">
                            {TASK_STATUS_LABEL[selectedTask.status] ?? selectedTask.status}
                          </span>
                          {isRevisionTask ? (
                            <Badge className="bg-amber-500 text-white hover:bg-amber-500">Cần sửa</Badge>
                          ) : null}
                        </div>
                        {selectedTask.description ? (
                          <p className="whitespace-pre-line text-slate-300">{selectedTask.description}</p>
                        ) : (
                          <p>(Không có mô tả.)</p>
                        )}
                        {isRevisionTask && selectedTask.revisionNote ? (
                          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">
                              Yêu cầu chỉnh sửa gần nhất
                            </p>
                            <p className="mt-0.5 text-slate-200">{selectedTask.revisionNote}</p>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="shrink-0 border-t border-slate-800 px-4 py-2 text-xs text-slate-500">
                    Chưa có task — chờ Mangaka gửi chapter.
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-slate-900">
                  <ImageIcon className="size-7 text-slate-600" />
                </div>
                <p className="text-sm font-medium text-slate-400">
                  Chọn một chapter để bắt đầu
                </p>
                <p className="text-xs text-slate-500">
                  Upload layer → Gộp → Gửi Mangaka
                </p>
              </div>
            )}
          </div>
        </div>
        ) : null}
      </main>

      <Footer />
    </div>
  )
}
