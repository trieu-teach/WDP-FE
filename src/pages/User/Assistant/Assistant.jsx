import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
  Lightbulb,
  RefreshCw,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react'
import Header from '@/components/User/Header/Header.jsx'
import Footer from '@/components/User/Footer/Footer.jsx'
import { WorkspaceHero } from '@/components/layout/WorkspaceHero.jsx'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
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
import './Assistant.css'

const NAV_LINKS = [{ to: '/', label: 'Trang chủ' }]

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

const STATUS_BADGE = {
  pending_assistant: {
    label: 'Chờ nhận',
    className: 'bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-400',
  },
  in_progress: {
    label: 'Đang xử lý',
    className: 'bg-violet-100 text-violet-700 hover:bg-violet-100 dark:bg-violet-500/15 dark:text-violet-400',
  },
  submitted: {
    label: 'Đã gửi Mangaka',
    className: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-400',
  },
  submitted_to_mangaka: {
    label: 'Đã gửi Mangaka',
    className: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-400',
  },
  approved: {
    label: 'Đã duyệt',
    className: 'bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-500/15 dark:text-blue-400',
  },
  revision: {
    label: 'Cần sửa',
    className: 'bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-500/15 dark:text-red-400',
  },
  TE_revision: {
    label: 'TE sửa',
    className: 'bg-orange-100 text-orange-700 hover:bg-orange-100 dark:bg-orange-500/15 dark:text-orange-400',
  },
  submitted_by_assistant: {
    label: 'Chờ Mangaka',
    className: 'bg-sky-100 text-sky-700 hover:bg-sky-100 dark:bg-sky-500/15 dark:text-sky-400',
  },
}

const TASK_STATUS_LABEL = {
  pending: 'Chờ nhận',
  in_progress: 'Đang làm',
  submitted: 'Chờ duyệt',
  approved: 'Đã duyệt',
  revision: 'Cần sửa',
}

const TASK_FILTERS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'pending', label: 'Đã nhận' },
  { id: 'in_progress', label: 'Đang làm' },
  { id: 'submitted', label: 'Đã gửi' },
  { id: 'approved', label: 'Đã xong' },
  { id: 'revision', label: 'Bị từ chối' },
]

function ChapterInboxSkeleton() {
  return (
    <ul className="space-y-2 p-3 pt-0">
      {Array.from({ length: 4 }, (_, i) => (
        <li key={i} className="flex gap-3 rounded-lg border p-3">
          <div className="manga-page manga-page--thumb-md shrink-0 animate-pulse rounded bg-muted" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
            <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
          </div>
        </li>
      ))}
    </ul>
  )
}

export default function Assistant() {
  const user = getSession()
  const navigate = useNavigate()

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
  const [taskFilter, setTaskFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [hireBusyId, setHireBusyId] = useState(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [showTaskDetail, setShowTaskDetail] = useState(false)
  const [hubView, setHubView] = useState('pick')
  const [selectedMangakaId, setSelectedMangakaId] = useState(null)

  useNotifications({
    enabled: Boolean(user),
    onNew: (n) => {
      const t = String(n.type ?? '').toLowerCase()
      if (t === 'revision' || t === 'task' || /yêu cầu.*sửa|chỉnh sửa|revision/i.test(`${n.title ?? ''} ${n.message ?? ''}`)) {
        toast.warning(`${n.title}${n.message ? ` — ${n.message}` : ''}`, {
          description: 'Bấm vào chuông để xem chi tiết.',
          duration: 8000,
        })
        void refreshTasks()
        void refresh()
      }
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

  const filteredChapters = useMemo(() => {
    const list = hubView === 'editor' && selectedMangakaId ? mangakaAssignments : enrichedAssignments
    if (taskFilter === 'all') return list
    if (taskFilter === 'needs-attention') {
      return list.filter(a => a._task?.status === 'revision' || a._task?.status === 'submitted')
    }
    return list.filter(a => a._task?.status === taskFilter)
  }, [enrichedAssignments, mangakaAssignments, hubView, selectedMangakaId, taskFilter])

  const ITEMS_PER_PAGE = 6

  const paginatedChapters = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredChapters.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredChapters, currentPage])

  const totalPages = Math.max(1, Math.ceil(filteredChapters.length / ITEMS_PER_PAGE))

  const handleFilterChange = useCallback((f) => {
    setTaskFilter(f)
    setCurrentPage(1)
  }, [])

  const listForCount = useMemo(() => {
    return hubView === 'editor' && selectedMangakaId ? mangakaAssignments : enrichedAssignments
  }, [enrichedAssignments, mangakaAssignments, hubView, selectedMangakaId])

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
  }

  function handlePickMangaka(mangakaId) {
    setSelectedMangakaId(mangakaId)
    setHubView('board')
    setSelectedChapterId(null)
    setSelectedChapterPages([])
    setSelectedChapterDetail(null)
    setTaskFilter('all')
    setCurrentPage(1)
  }

  function handleBackToMangakaPicker() {
    setHubView('pick')
    setSelectedMangakaId(null)
    setSelectedChapterId(null)
    setSelectedChapterPages([])
    setSelectedChapterDetail(null)
  }

  function handleBackToMangakaBoard() {
    setHubView('board')
    setSelectedChapterId(null)
    setSelectedChapterPages([])
    setSelectedChapterDetail(null)
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

  function filterCount(filterId) {
    if (filterId === 'all') return listForCount.length
    return listForCount.filter(a => a._task?.status === filterId).length
  }

  return (
    <div className="ws-page--assistant flex min-h-screen flex-col bg-background">
      <Header links={NAV_LINKS} onLogout={user ? handleLogout : undefined} />

      <WorkspaceHero
        className="ws-hero--assistant border-b border-white/5"
        label="Không gian Assistant"
        title={`Xin chào${user?.name ? `, ${user.name.split(' ')[0]}` : ''}`}
        description="Nhận chapter từ Mangaka · upload layer theo thứ tự · gộp và gửi lại."
      >
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-zinc-300">
          <Badge variant="secondary" className="bg-white/10 text-white hover:bg-white/15">
            <LayersIcon className="size-3" />
            Layer Editor
          </Badge>
          <Badge variant="secondary" className="bg-white/10 text-white hover:bg-white/15">
            <Sparkles className="size-3" />
            1 chapter = 1 task
          </Badge>
          {!loading && (
            <span className="text-zinc-500">
              · {assignments.length} chapter được giao
            </span>
          )}
        </div>
      </WorkspaceHero>

      <main className="page-container ws-main--assistant flex-1 py-6">
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
          <Card className="mb-4 border-violet-200/60 dark:border-violet-500/20">
            <CardContent className="py-5 text-center text-sm text-muted-foreground">
              Đang tải yêu cầu hợp tác...
            </CardContent>
          </Card>
        ) : cooperationRequests.length > 0 ? (
          <Card className="mb-4 overflow-hidden border-violet-200 bg-violet-500/5 dark:border-violet-500/30">
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
        ) : null}

        {isFullscreen && selectedWithTask ? (
          <div className="mk-fullscreen" role="dialog" aria-modal="true">
            <header className="mk-fullscreen__header">
              <div className="mk-fullscreen__title">
                <strong>{selectedWithTask.seriesTitle}</strong>
                <span>· Ch.{selectedWithTask.chapterNum}</span>
              </div>
              <div className="mk-fullscreen__tools">
                <Badge variant="secondary" className="border-white/15 bg-white/10 text-white">
                  {selectedWithTask._task?.status ? TASK_STATUS_LABEL[selectedWithTask._task.status] : '—'}
                </Badge>
                <button type="button" className="mk-fullscreen__close" onClick={() => setIsFullscreen(false)}>
                  <X className="size-4" aria-hidden />
                  Thu nhỏ
                </button>
              </div>
            </header>
            <div className="min-h-0 flex-1 overflow-hidden">
              <LayerEditor
                chapter={selectedWithTask}
                pages={selectedChapterPages}
                task={selectedWithTask._task}
                pageId={selectedWithTask._task?.pageId ?? null}
                fullscreen
                onSubmitted={() => {
                  setIsFullscreen(false)
                  void refreshTasks()
                  void refresh()
                }}
              />
            </div>
          </div>
        ) : null}

        {hubView === 'pick' ? (
          <AssistantMangakaPicker
            mangakas={mangakaOptions}
            assignmentsByMangaka={assignmentsByMangaka}
            loading={loading || cooperationLoading}
            onSelect={handlePickMangaka}
          />
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
        <div className="as-workspace grid min-h-[min(640px,calc(100vh-260px))] grid-cols-1 gap-4 lg:grid-cols-[minmax(260px,300px)_minmax(0,1fr)]">
          <div className="flex flex-wrap items-center gap-2 lg:col-span-2">
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={handleBackToMangakaBoard}>
              <ArrowLeft className="size-3.5" />
              {selectedMangaka.name}
            </Button>
            <span className="text-xs text-muted-foreground">· Layer Editor</span>
          </div>
          <aside className="flex min-h-0 flex-col gap-3 overflow-hidden">
            <Card className="flex min-h-0 flex-1 flex-col overflow-hidden shadow-sm">
              <CardHeader className="shrink-0 space-y-3 pb-3">
                <div>
                  <CardTitle className="text-base">Chapter được giao</CardTitle>
                  <CardDescription>Chọn chapter để mở Layer Editor</CardDescription>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {TASK_FILTERS.map(f => {
                    const count = filterCount(f.id)
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => handleFilterChange(f.id)}
                        className={cn(
                          'rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors',
                          taskFilter === f.id
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-muted text-muted-foreground hover:border-foreground/30 hover:text-foreground',
                        )}
                      >
                        {f.label}
                        {count > 0 ? (
                          <span className={cn(
                            'ml-1 rounded-full px-1 py-0.5 text-[10px] font-bold tabular-nums',
                            taskFilter === f.id ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground',
                          )}>
                            {count}
                          </span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              </CardHeader>
              <CardContent className="flex min-h-0 flex-1 flex-col px-0 pb-0">
                {loading && assignments.length === 0 ? (
                  <ChapterInboxSkeleton />
                ) : paginatedChapters.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                    <Inbox className="size-8 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">Không có chapter nào.</p>
                    {taskFilter !== 'all' ? (
                      <Button size="sm" variant="outline" onClick={() => handleFilterChange('all')}>
                        Xem tất cả
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <ScrollArea className="min-h-0 flex-1">
                      <ul className="space-y-1.5 p-3 pt-0">
                        {paginatedChapters.map(ch => {
                          const badge =
                            STATUS_BADGE[ch._task?.status] ??
                            STATUS_BADGE[ch.status] ??
                            STATUS_BADGE.pending_assistant
                          const coverUrl = ch.coverUrl ?? ch.pages?.find(p => p.url)?.url ?? null
                          const pageCount = ch.pageCount ?? ch.pages?.length ?? 0
                          const isSelected = ch.chapterId === selectedChapterId
                          const needsAttention = ch._task?.status === 'revision'
                          return (
                            <li key={ch.chapterId}>
                              <button
                                type="button"
                                onClick={() => void handleOpenChapter(ch)}
                                className={cn(
                                  'as-inbox-card group w-full text-left',
                                  isSelected && 'active',
                                  needsAttention && 'border-amber-300/60 dark:border-amber-500/40',
                                )}
                              >
                                <span className="as-inbox-card__thumb manga-page manga-page--thumb-md overflow-hidden rounded-md">
                                  {coverUrl ? (
                                    <img src={coverUrl} alt="" className="manga-page__media" />
                                  ) : (
                                    <ImageIcon className="size-4 text-muted-foreground/50" />
                                  )}
                                </span>
                                <span className="as-inbox-card__body">
                                  <strong className="truncate">
                                    {ch.seriesTitle?.trim() || `Chương ${ch.chapterNum || ''}`.trim()}
                                  </strong>
                                  <span className="as-inbox-card__meta truncate">
                                    Ch.{ch.chapterNum}
                                    {ch.title ? ` · ${ch.title}` : ''}
                                    {' · '}{pageCount} trang
                                  </span>
                                  <Badge className={cn('mt-1 w-fit text-[10px]', badge.className)} variant="secondary">
                                    {badge.label}
                                  </Badge>
                                </span>
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    </ScrollArea>
                    {totalPages > 1 ? (
                      <div className="flex items-center justify-center gap-3 border-t px-3 py-2 text-xs">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2"
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        >
                          Trước
                        </Button>
                        <span className="text-muted-foreground tabular-nums">
                          {currentPage} / {totalPages}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2"
                          disabled={currentPage === totalPages}
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        >
                          Sau
                        </Button>
                      </div>
                    ) : null}
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="shrink-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <TrendingUp className="size-4 text-primary" />
                  Tóm tắt
                  {tasksLoading ? (
                    <span className="text-[10px] font-normal text-muted-foreground">(đang tải…)</span>
                  ) : null}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 gap-2">
                  {statsDisplayed.map((s, i) => {
                    const Icon = s.icon
                    return (
                      <div key={i} className="rounded-lg border bg-muted/20 px-2.5 py-2">
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <Icon className={cn('size-3', STAT_ICON_CLASS[s.color])} />
                          {s.label}
                        </div>
                        <p className="mt-0.5 text-lg font-bold tabular-nums leading-none">{s.value}</p>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="shrink-0 shadow-sm">
              <button
                type="button"
                className="flex w-full items-center justify-between px-6 py-4 text-left"
                onClick={() => setShowGuide(v => !v)}
              >
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Lightbulb className="size-4 text-primary" />
                  Quy trình làm việc
                </CardTitle>
                <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', showGuide && 'rotate-180')} />
              </button>
              {showGuide ? (
                <CardContent className="pt-0">
                  <ol className="relative space-y-2 border-l border-muted pl-5">
                    {[
                      'Mangaka gửi chapter cho bạn',
                      'Chọn chapter trong danh sách',
                      'Tải ảnh gốc từng trang về',
                      'Chỉnh trong Photoshop / CSP',
                      'Upload layer theo thứ tự (0, 1, 2…)',
                      'Gộp layer & gửi Mangaka',
                    ].map((text, i) => (
                      <li key={text} className="relative text-xs text-muted-foreground">
                        <span className="absolute -left-[22px] flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                          {i + 1}
                        </span>
                        {text}
                      </li>
                    ))}
                  </ol>
                </CardContent>
              ) : null}
            </Card>
          </aside>

          <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
            {selectedWithTask ? (
              <>
                <div className="flex shrink-0 flex-wrap items-center gap-3 border-b bg-muted/20 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {selectedWithTask.seriesTitle || 'Chapter'}
                      {' · '}
                      Ch.{selectedWithTask.chapterNum}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedWithTask.pages ?? []).length} trang
                      {selectedWithTask._task?.status ? (
                        <>
                          {' · '}
                          <span className="font-medium text-foreground">
                            {TASK_STATUS_LABEL[selectedWithTask._task.status] ?? selectedWithTask._task.status}
                          </span>
                        </>
                      ) : null}
                    </p>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-hidden">
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
                        onEnterFullscreen={() => setIsFullscreen(true)}
                        onSubmitted={() => { void refreshTasks(); void refresh() }}
                      />
                    )
                  })()}
                </div>

                {selectedTask ? (
                  <div className="shrink-0 border-t">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium hover:bg-muted/30"
                      onClick={() => setShowTaskDetail(v => !v)}
                    >
                      <span>Chi tiết task &amp; ghi chú Mangaka</span>
                      <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', showTaskDetail && 'rotate-180')} />
                    </button>
                    {showTaskDetail ? (
                      <div className="space-y-2 border-t bg-muted/10 px-4 py-3 text-xs text-muted-foreground">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-foreground">
                            {TASK_STATUS_LABEL[selectedTask.status] ?? selectedTask.status}
                          </span>
                          {isRevisionTask ? (
                            <Badge className="bg-amber-500 text-white hover:bg-amber-500">Cần sửa</Badge>
                          ) : null}
                        </div>
                        {selectedTask.description ? (
                          <p className="whitespace-pre-line text-foreground/80">{selectedTask.description}</p>
                        ) : (
                          <p>(Không có mô tả.)</p>
                        )}
                        {isRevisionTask && selectedTask.revisionNote ? (
                          <div className="rounded-md border border-amber-300 bg-amber-50 p-2 dark:border-amber-500/30 dark:bg-amber-500/10">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                              Yêu cầu chỉnh sửa gần nhất
                            </p>
                            <p className="mt-0.5 text-foreground/80">{selectedTask.revisionNote}</p>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="shrink-0 border-t px-4 py-2 text-xs text-muted-foreground">
                    Chưa có task — chờ Mangaka gửi chapter.
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
                  <ImageIcon className="size-7 text-muted-foreground/50" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">
                  Chọn một chapter bên trái để bắt đầu
                </p>
                <p className="text-xs text-muted-foreground">
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
