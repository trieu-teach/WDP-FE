import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
  Handshake,
  Image as ImageIcon,
  Inbox,
  Layers as LayersIcon,
  Lightbulb,
  Maximize2,
  Send,
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

const NAV_LINKS = [{ to: '/', label: 'Trang chủ' }]

const STATS = [
  { label: 'Đã nhận', icon: Inbox, color: 'amber' },
  { label: 'Đang làm', icon: LayersIcon, color: 'violet' },
  { label: 'Đã gửi', icon: Clock, color: 'sky' },
  { label: 'Đã xong', icon: CheckCircle2, color: 'emerald' },
  { label: 'Thu nhập tháng', icon: DollarSign, color: 'rose' },
]

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
}

const TASK_STATUS_LABEL = {
  pending: 'Chờ nhận',
  in_progress: 'Đang làm',
  submitted: 'Chờ duyệt',
  approved: 'Đã duyệt',
  revision: 'Cần sửa',
}

function formatEarnings(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  const n = Number(value)
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

export default function Assistant() {
  const { user } = getSession() ?? {}
  const navigate = useNavigate()

  const { assignments, loading, error, refresh, loadChapterPages } = useAssistantAssignments()
  const { allTasks, stats: taskStats, loading: tasksLoading, refresh: refreshTasks } = useAssistantTasks()

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
  const [hireBusyId, setHireBusyId] = useState(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

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

  // Khi auto-select chapter đầu tiên, đồng thời load pages
  useEffect(() => {
    if (!assignments.length) {
      setSelectedChapterId(null)
      return
    }
    const firstAssignment = assignments[0]
    if (!assignments.some(a => a.chapterId === selectedChapterId)) {
      setSelectedChapterId(firstAssignment?.chapterId ?? null)
      // Load pages ngay để hiển thị ảnh thumbnail
      if (firstAssignment?.chapterId) {
        void loadChapterPages(firstAssignment.chapterId, firstAssignment._task)
          .then(({ pages, chapter }) => {
            setSelectedChapterPages(pages)
            setSelectedChapterDetail(chapter)
          })
          .catch(() => null)
      }
    }
  }, [assignments, selectedChapterId, loadChapterPages])

  const selectedChapter = useMemo(
    () => assignments.find(a => a.chapterId === selectedChapterId) ?? null,
    [assignments, selectedChapterId],
  )

  const chapterTaskMap = useMemo(() => {
    const map = {}
    for (const t of allTasks) {
      const k = String(t.chapterId ?? t.id)
      if (!map[k]) map[k] = t
    }
    return map
  }, [allTasks])

  const selectedWithTask = useMemo(() => {
    if (!selectedChapter) return null
    const key = String(selectedChapter.chapterId)
    const task = chapterTaskMap[key] ?? null
    const seriesTitle = selectedChapterDetail?.seriesTitle ?? selectedChapter.seriesTitle ?? ''
    return {
      ...selectedChapter,
      ...selectedChapterDetail,
      seriesTitle,
      // Ưu tiên selectedChapterPages (từ loadChapterPages), không dùng selectedChapter.pages vì nó luôn []
      pages: selectedChapterPages,
      _task: task,
    }
  }, [selectedChapter, chapterTaskMap, selectedChapterPages, selectedChapterDetail])

  const filteredChapters = useMemo(() => {
    const list = (assignments ?? []).map(a => ({
      ...a,
      _task: chapterTaskMap[String(a.chapterId)] ?? null,
    }))
    if (taskFilter === 'all') return list
    if (taskFilter === 'needs-attention') {
      return list.filter(a => a._task?.status === 'revision' || a._task?.status === 'submitted')
    }
    return list.filter(a => a._task?.status === taskFilter)
  }, [assignments, chapterTaskMap, taskFilter])

  const listForCount = useMemo(() => {
    return (assignments ?? []).map(a => ({
      ...a,
      _task: chapterTaskMap[String(a.chapterId)] ?? null,
    }))
  }, [assignments, chapterTaskMap])

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
      { ...STATS[4], value: formatEarnings(taskStats?.earningsThisMonth) },
    ]
  }, [allTasks, taskStats])

  function handleLogout() {
    logout()
    navigate('/login')
  }

  async function handleSelectChapter(chapter) {
    setSelectedChapterId(chapter.chapterId)
    setSelectedChapterPages([])
    setSelectedChapterDetail(null)
    const { pages, chapter: detail } = await loadChapterPages(chapter.chapterId, chapter._task)
    setSelectedChapterPages(pages)
    setSelectedChapterDetail(detail)
  }

  async function handleCooperationAction(req, action) {
    if (!user?.id) return
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
    <div className="flex min-h-screen flex-col bg-background">
      <Header links={NAV_LINKS} onLogout={user ? handleLogout : undefined} />

      <WorkspaceHero
        className="from-violet-950 to-zinc-950"
        label="Assistant Workspace"
        title={`Xin chào${user?.name ? `, ${user.name.split(' ')[0]}` : ''}`}
        description="Nhận chapter từ Mangaka. Mỗi chapter = 1 task. Upload layer theo thứ tự, gộp và gửi."
      >
        <div className="mt-5 flex flex-wrap gap-3 text-xs text-zinc-300">
          <Badge variant="secondary" className="bg-white/10 text-white hover:bg-white/15">
            <LayersIcon className="size-3" />
            Layer Editor
          </Badge>
          <Badge variant="secondary" className="bg-white/10 text-white hover:bg-white/15">
            <Sparkles className="size-3" />
            1 chapter = 1 task
          </Badge>
        </div>
      </WorkspaceHero>

      <main className="page-container flex-1 py-8">
        {/* Revision alert banner — chapters bị Mangaka từ chối */}
        {(() => {
          const revisionAssignments = (assignments ?? []).filter(a => {
            const task = chapterTaskMap[String(a.chapterId)]
            return task?.status === 'revision'
          })
          if (revisionAssignments.length === 0) return null
          return (
            <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 dark:border-red-500/30 dark:bg-red-500/10">
              <AlertTriangle className="size-5 shrink-0 text-red-500" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                  {revisionAssignments.length} chapter bị từ chối — cần sửa lại
                </p>
                <p className="text-xs text-red-600/80 dark:text-red-400/70">
                  Chọn chapter trong danh sách bên trái, xem ghi chú ở dưới editor, và upload layer sửa lại.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 border-red-300 text-red-600 hover:bg-red-100 dark:border-red-500/40 dark:text-red-400 dark:hover:bg-red-500/20"
                onClick={() => setTaskFilter('revision')}
              >
                Xem ngay
              </Button>
            </div>
          )
        })()}

        {/* Cooperation requests */}
        {cooperationLoading ? (
          <Card className="mb-6">
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              Đang tải yêu cầu hợp tác...
            </CardContent>
          </Card>
        ) : cooperationRequests.length > 0 ? (
          <Card className="mb-6 overflow-hidden border-violet-200 bg-gradient-to-br from-violet-500/5 via-background to-background dark:border-violet-500/30">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Handshake className="size-4 text-violet-600" />
                Yêu cầu hợp tác từ Mangaka
              </CardTitle>
              <CardDescription>
                Đồng ý gặp → chốt hợp tác → nhận chapter.
              </CardDescription>
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
                    {req.status === 'pending_meet' && (
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
                    {isPendingRequest(req.status) && (
                      <Badge variant="secondary" className="text-xs">Đang xử lý</Badge>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {/* Fullscreen overlay */}
        {isFullscreen && selectedWithTask ? (
          <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950" role="dialog" aria-modal="true">
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-zinc-900 px-5 py-3 text-white">
              <div>
                <strong>{selectedWithTask.seriesTitle}</strong>
                <span className="ml-2 text-sm text-zinc-400">· Ch.{selectedWithTask.chapterNum}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-white/10 text-white hover:bg-white/15">
                  {selectedWithTask._task?.status ? TASK_STATUS_LABEL[selectedWithTask._task.status] : '—'}
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-white/20 bg-transparent text-white hover:bg-white/10"
                  onClick={() => setIsFullscreen(false)}
                >
                  <X className="size-4" />
                  Thu nhỏ
                </Button>
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

        {/* Main workspace: 2-column grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
          {/* Left: chapter list */}
          <aside className="space-y-4">
            <Card className="border-sky-200 dark:border-sky-500/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Chapter được giao</CardTitle>
                <CardDescription>Chọn chapter để xử lý</CardDescription>
                <div className="-mb-1 mt-1 flex flex-wrap gap-1 pt-2">
                  {[
                    { id: 'all', label: 'Tất cả' },
                    { id: 'pending', label: 'Đã nhận' },
                    { id: 'in_progress', label: 'Đang làm' },
                    { id: 'submitted', label: 'Đã gửi' },
                    { id: 'approved', label: 'Đã xong' },
                    { id: 'revision', label: 'Bị từ chối' },
                  ].map(f => {
                    const count = f.id === 'all'
                      ? filteredChapters.length
                      : listForCount.filter(a => a._task?.status === f.id).length
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setTaskFilter(f.id)}
                        className={cn(
                          'rounded-full border px-2 py-0.5 text-[11px] transition-colors',
                          taskFilter === f.id
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-muted text-muted-foreground hover:border-foreground/30 hover:text-foreground',
                        )}
                      >
                        {f.label}
                        {count > 0 && (
                          <span className={cn(
                            'ml-1 rounded-full px-1 py-0.5 text-[10px] font-bold',
                            taskFilter === f.id
                              ? 'bg-primary/20 text-primary'
                              : 'bg-muted text-muted-foreground',
                          )}>
                            {count}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </CardHeader>
              <CardContent className="px-0">
                {filteredChapters.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground">
                    Không có chapter nào.
                  </div>
                ) : (
                  <ScrollArea className="max-h-[calc(100vh-280px)]">
                    <ul className="space-y-1 p-3 pt-0">
                      {filteredChapters.map(ch => {
                        const badge =
                          STATUS_BADGE[ch._task?.status] ??
                          STATUS_BADGE[ch.status] ??
                          STATUS_BADGE.pending_assistant
                        const cover = ch.pages?.find(p => p.url) ?? ch.pages?.[0]
                        const pageCount = ch.pageCount ?? ch.pages?.length ?? 0
                        const isSelected = ch.chapterId === selectedChapterId
                        return (
                          <li key={ch.chapterId}>
                            <button
                              type="button"
                              onClick={() => handleSelectChapter(ch)}
                              className={cn(
                                'flex w-full items-start gap-3 p-3 text-left transition-colors',
                                isSelected ? 'bg-primary/10' : 'hover:bg-muted/50',
                              )}
                            >
                              <span className="manga-page manga-page--thumb-md shrink-0 overflow-hidden rounded">
                                {cover?.url ? (
                                  <img src={cover.url} alt="" className="manga-page__media" />
                                ) : (
                                  <span className="flex h-full items-center justify-center text-xs text-muted-foreground">📄</span>
                                )}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold">
                                  {ch.seriesTitle}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">
                                  Ch.{ch.chapterNum}{ch.title ? ` · ${ch.title}` : ''}
                                </p>
                                <p className="text-xs text-muted-foreground">{pageCount} trang</p>
                                <Badge className={cn('mt-1', badge.className)} variant="secondary">
                                  {badge.label}
                                </Badge>
                              </div>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            {/* Stats card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="size-4 text-primary" />
                  Thống kê
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {statsDisplayed.map((s, i) => {
                  const Icon = s.icon
                  return (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className={cn('size-4', `text-${s.color}-500`)} />
                        <span className="text-xs text-muted-foreground">{s.label}</span>
                      </div>
                      <span className="font-semibold tabular-nums">{s.value}</span>
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            {/* Process guide */}
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Lightbulb className="size-4 text-primary" />
                  Quy trình
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="relative space-y-2.5 border-l border-muted pl-5">
                  {[
                    { step: 1, text: 'Mangaka gửi chapter cho bạn' },
                    { step: 2, text: 'Chọn chapter bên trái' },
                    { step: 3, text: 'Tải ảnh gốc từng trang về' },
                    { step: 4, text: 'Chỉnh trong Photoshop / CSP' },
                    { step: 5, text: 'Upload layer theo thứ tự (0, 1, 2...)' },
                    { step: 6, text: 'Gộp layer & gửi Mangaka' },
                  ].map(it => (
                    <li key={it.step} className="relative">
                      <span className="absolute -left-[26px] flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground ring-2 ring-card">
                        {it.step}
                      </span>
                      <p className="text-xs text-muted-foreground">{it.text}</p>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>

            {/* Earnings */}
            {taskStats ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <DollarSign className="size-4 text-emerald-600" />
                    Thu nhập
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="rounded-md border p-2.5 text-sm">
                    <p className="text-xs text-muted-foreground">Kỳ thống kê</p>
                    <p className="font-medium">{taskStats.period ?? 'Tháng này'}</p>
                  </div>
                  <div className="flex items-center justify-between rounded-md border p-2.5">
                    <div>
                      <p className="text-sm font-medium">Task đã duyệt</p>
                      <p className="text-xs text-muted-foreground">Trong tháng</p>
                    </div>
                    <span className="font-bold tabular-nums text-emerald-600">
                      {taskStats.approvedTasksThisMonth ?? '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-md border p-2.5">
                    <div>
                      <p className="text-sm font-medium">Thu nhập tháng</p>
                    </div>
                    <span className="font-bold tabular-nums text-emerald-600">
                      {formatEarnings(taskStats.earningsThisMonth)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </aside>

          {/* Right: editor */}
          <div className="flex min-h-0 flex-col">
            {selectedWithTask ? (
              <div className="group/editor relative flex h-full min-h-0 flex-col">
                <LayerEditor
                  chapter={selectedWithTask}
                  pages={selectedChapterPages}
                  task={selectedWithTask._task}
                  pageId={selectedWithTask._task?.pageId ?? null}
                  onSubmitted={() => { void refreshTasks(); void refresh() }}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setIsFullscreen(true)}
                  className="absolute right-4 top-4 z-20 opacity-0 transition-opacity group-hover/editor:opacity-100"
                  title="Phóng to toàn màn hình"
                >
                  <Maximize2 className="size-4" />
                </Button>
              </div>
            ) : (
              <Card className="flex flex-1 flex-col items-center justify-center gap-3 py-20 text-center">
                <ImageIcon className="size-12 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  Chọn một chapter bên trái để bắt đầu.
                </p>
                <p className="text-xs text-muted-foreground">
                  Upload layer → Gộp → Gửi Mangaka
                </p>
              </Card>
            )}

            {/* Chapter detail panel */}
            {selectedWithTask && (
              <Card className="mt-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    {selectedWithTask.seriesTitle} · Ch.{selectedWithTask.chapterNum}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {(selectedWithTask.pages ?? []).length} trang
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-muted-foreground">
                  {(() => {
                    const task = chapterTaskMap[String(selectedChapterId)]
                    if (!task) {
                      return <p>Chưa có task — chờ Mangaka gửi chapter.</p>
                    }
                    const isRevision = task.status === 'revision'
                    return (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-foreground">
                            {TASK_STATUS_LABEL[task.status] ?? task.status}
                          </span>
                          {isRevision && (
                            <Badge className="bg-amber-500 text-white hover:bg-amber-500">Cần sửa</Badge>
                          )}
                        </div>
                        {task.description ? (
                          <p className="whitespace-pre-line text-foreground/80">{task.description}</p>
                        ) : (
                          <p>(Không có mô tả.)</p>
                        )}
                        {isRevision && task.revisionNote ? (
                          <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-2 dark:border-amber-500/30 dark:bg-amber-500/10">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                              Yêu cầu chỉnh sửa gần nhất
                            </p>
                            <p className="mt-0.5 text-foreground/80">{task.revisionNote}</p>
                          </div>
                        ) : null}
                      </>
                    )
                  })()}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
