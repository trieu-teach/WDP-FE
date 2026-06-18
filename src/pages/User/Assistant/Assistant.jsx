import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  CheckCircle2,
  Clock,
  DollarSign,
  Handshake,
  Image as ImageIcon,
  Inbox,
  Layers as LayersIcon,
  Lightbulb,
  Send,
  Sparkles,
  TrendingUp,
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
  { label: 'Chapter nhận', icon: Inbox, color: 'sky' },
  { label: 'Đang làm', icon: LayersIcon, color: 'violet' },
  { label: 'Chờ duyệt', icon: Clock, color: 'amber' },
  { label: 'Đã duyệt', icon: CheckCircle2, color: 'emerald' },
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
  submitted_to_mangaka: {
    label: 'Đã gửi',
    className: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-400',
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

  const { assignments, loading, error, refresh, loadChapterPages, loadPageDetail } = useAssistantAssignments()
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
    if (!assignments.length) {
      setSelectedChapterId(null)
      return
    }
    if (!assignments.some(a => a.chapterId === selectedChapterId)) {
      setSelectedChapterId(assignments[0]?.chapterId ?? null)
    }
  }, [assignments, selectedChapterId])

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
    return {
      ...selectedChapter,
      pages: selectedChapterPages.length > 0 ? selectedChapterPages : selectedChapter.pages,
      _task: chapterTaskMap[String(selectedChapter.chapterId)] ?? null,
    }
  }, [selectedChapter, chapterTaskMap, selectedChapterPages])

  const chapterAllSubmitted = useMemo(() => {
    const task = chapterTaskMap[String(selectedChapterId)]
    if (!task) return false
    return task.status === 'submitted' || task.status === 'approved'
  }, [chapterTaskMap, selectedChapterId])

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
      { ...STATS[0], value: String(chapterList.length || assignments.length) },
      { ...STATS[1], value: String(progress || (selectedChapter ? 1 : 0)) },
      { ...STATS[2], value: String(review) },
      { ...STATS[3], value: String(approved) },
      { ...STATS[4], value: formatEarnings(taskStats?.earningsThisMonth) },
    ]
  }, [allTasks, assignments.length, selectedChapter, taskStats])

  function handleLogout() {
    logout()
    navigate('/login')
  }

  async function handleSelectChapter(chapter) {
    setSelectedChapterId(chapter.chapterId)
    setSelectedChapterPages([])
    setSelectedChapterDetail(null)
    const { pages, chapter: detail } = await loadChapterPages(chapter.chapterId)
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

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr] xl:grid-cols-[280px_1fr_300px]">
          <aside className="space-y-4">
            <Card className="border-sky-200 dark:border-sky-500/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Chapter được giao</CardTitle>
                <CardDescription>1 chapter = 1 task · chọn chapter để xử lý</CardDescription>
                <div className="-mb-1 mt-1 flex flex-wrap gap-1 pt-2">
                  {[
                    { id: 'all', label: 'Tất cả' },
                    { id: 'needs-attention', label: 'Cần xử lý' },
                    { id: 'pending', label: 'Chờ' },
                    { id: 'in_progress', label: 'Làm' },
                    { id: 'revision', label: 'Sửa' },
                    { id: 'submitted', label: 'Chờ duyệt' },
                  ].map(f => (
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
                    </button>
                  ))}
                </div>
              </CardHeader>
              <CardContent className="px-0">
                {filteredChapters.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground">
                    Không có chapter nào.
                  </div>
                ) : (
                  <ScrollArea className="max-h-[calc(100vh-220px)]">
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
          </aside>

          <div className="space-y-4">
            {selectedWithTask ? (
              <LayerEditor
                chapter={selectedWithTask}
                onSubmitted={() => { void refreshTasks(); void refresh() }}
              />
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
                  <ImageIcon className="size-12 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    Chọn một chapter bên trái để bắt đầu.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Upload layer → Gộp → Gửi Mangaka
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          <aside className="space-y-4">
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

            {selectedWithTask && (
              <Card>
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
                      return (
                        <p>Chưa có task — chờ Mangaka gửi chapter.</p>
                      )
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
        </div>
      </main>

      <Footer />
    </div>
  )
}
