import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ArrowDownToLine,
  CheckCircle2,
  Clock,
  DollarSign,
  Eye,
  EyeOff,
  Handshake,
  Image as ImageIcon,
  Inbox,
  Layers as LayersIcon,
  Lightbulb,
  Lock,
  MonitorOff,
  Send,
  Sparkles,
  StickyNote,
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
import { ASSISTANT_PRODUCTION_STEPS } from '@/constants/assistantProductionLayers.js'
import { MANGA_PAGE_HEIGHT, MANGA_PAGE_WIDTH } from '@/constants/mangaPageDimensions.js'
import { noteTaskLabel } from '@/constants/workspaceTasks.js'
import { ProductionLayerRow } from '@/components/Assistant/ProductionLayerRow.jsx'
import { CompositeSettingsPanel } from '@/components/Assistant/CompositeSettingsPanel.jsx'
import { ExportOptionsDialog } from '@/components/Assistant/ExportOptionsDialog.jsx'
import {
  getBlob,
  paintLayerVersionBlobKey,
} from '@/utils/assistantLayerBlobs.js'
import {
  appendLayerVersion,
  moveLayerOrder,
  setActiveLayerVersion,
  sortLayersForStack,
} from '@/utils/assistantProductionLayerUtils.js'
import {
  loadAssistantPaintLayers,
  migrateAssistantStorage,
  saveAssistantPaintLayers,
} from '@/utils/assistantWorkspaceStorage.js'
import { useAssistantAssignments } from '@/hooks/useAssistantAssignments.js'
import { useAssistantTasks } from '@/hooks/useAssistantTasks.js'
import { useAssistantCooperation } from '@/hooks/useAssistantCooperation.js'
import { useNotifications } from '@/hooks/useNotifications.js'
import { apiNoteToUi } from '@/utils/apiMappers.js'
import { getApiErrorMessage } from '@/api/http.js'
import { chaptersService } from '@/api/chapters.service.js'
import { isMeetingPhase, isPendingRequest, requestStatusLabel } from '@/utils/cooperationMappers.js'
import '@/styles/mangaPage.css'

const NAV_LINKS = [{ to: '/', label: 'Trang chủ' }]

const STATS = [
  { label: 'Việc được giao', icon: Inbox, color: 'sky' },
  { label: 'Đang xử lý', icon: LayersIcon, color: 'violet' },
  { label: 'Chờ Mangaka duyệt', icon: Clock, color: 'amber' },
  { label: 'Trang đã duyệt', icon: CheckCircle2, color: 'emerald' },
  { label: 'Thu nhập tháng này', icon: DollarSign, color: 'rose' },
]

const STAT_ICON_BG = {
  sky: 'bg-sky-500/10 text-sky-600',
  violet: 'bg-violet-500/10 text-violet-600',
  amber: 'bg-amber-500/10 text-amber-600',
  emerald: 'bg-emerald-500/10 text-emerald-600',
  rose: 'bg-rose-500/10 text-rose-600',
}

const STATUS_BADGE = {
  pending_assistant: { label: 'Chờ nhận', className: 'bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-400' },
  in_progress: { label: 'Đang xử lý', className: 'bg-violet-100 text-violet-700 hover:bg-violet-100 dark:bg-violet-500/15 dark:text-violet-400' },
  submitted_to_mangaka: { label: 'Đã gửi', className: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-400' },
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

async function dataUrlToFile(dataUrl, filename = 'result.png') {
  const res = await fetch(dataUrl)
  const blob = await res.blob()
  return new File([blob], filename, { type: blob.type || 'image/png' })
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function drawFitted(ctx, img, width, height) {
  const iw = img.naturalWidth || img.width || 1
  const ih = img.naturalHeight || img.height || 1
  const scale = Math.min(width / iw, height / ih)
  const w = iw * scale
  const h = ih * scale
  const x = (width - w) / 2
  const y = (height - h) / 2
  ctx.drawImage(img, x, y, w, h)
}

// Blend mode tương thích canvas — cố ý giữ tập con phù hợp manga (shading)
const LAYER_BLEND_MODES = ['source-over', 'multiply', 'screen', 'overlay', 'lighten', 'darken']
const BLEND_MODE_LABEL = {
  'source-over': 'Bình thường',
  multiply: 'Multiply (đổ bóng)',
  screen: 'Screen (làm sáng)',
  overlay: 'Overlay (tăng tương phản)',
  lighten: 'Lighten (chỉ phần sáng hơn)',
  darken: 'Darken (chỉ phần tối hơn)',
}

async function renderComposite({
  baseUrl,
  notes,
  paintLayers,
  notesVisible,
  includeBase,
  transparentBg,
  baseOpacity = 100,
  onionOpacity = 0,
  outputMode = 'final', // 'final' | 'lineart' | 'clean' (ảnh phẳng 100% không note)
}) {
  const W = MANGA_PAGE_WIDTH
  const H = MANGA_PAGE_HEIGHT
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  if (!transparentBg) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, W, H)
  }

  // Output 'clean' = ảnh phẳng không có note, không có base, layer 100% opacity
  const skipBase = outputMode === 'clean' || !includeBase
  const skipNotes = outputMode === 'clean' || outputMode === 'lineart'
  const finalOpacity = outputMode === 'clean' ? 100 : null

  if (!skipBase && baseUrl) {
    try {
      const img = await loadImage(baseUrl)
      ctx.globalAlpha = Math.max(0, Math.min(1, baseOpacity / 100))
      drawFitted(ctx, img, W, H)
      ctx.globalAlpha = 1
    } catch {
      /* ignore */
    }
  }

  for (const layer of sortLayersForStack(paintLayers)) {
    if (!layer.dataUrl) continue
    try {
      const img = await loadImage(layer.dataUrl)
      const layerOpacity = finalOpacity ?? (layer.visible
        ? Math.max(0, Math.min(1, (layer.opacity ?? 100) / 100))
        : 0)
      const onion = onionOpacity > 0 && !layer.visible
        ? onionOpacity / 100
        : 0
      const finalA = Math.max(layerOpacity, onion)
      if (finalA <= 0) continue
      ctx.globalAlpha = finalA
      const blend = LAYER_BLEND_MODES.includes(layer.blendMode)
        ? layer.blendMode
        : 'source-over'
      ctx.globalCompositeOperation = blend
      drawFitted(ctx, img, W, H)
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 1
    } catch {
      /* ignore */
    }
  }

  if (!skipNotes && notesVisible && notes?.length) {
    notes.forEach((n, idx) => {
      const x = (n.x / 100) * W
      const y = (n.y / 100) * H
      const w = (n.w / 100) * W
      const h = (n.h / 100) * H
      ctx.save()
      ctx.fillStyle = 'rgba(230, 57, 70, 0.10)'
      ctx.fillRect(x, y, w, h)
      ctx.strokeStyle = '#e63946'
      ctx.lineWidth = 2
      ctx.setLineDash([8, 5])
      ctx.strokeRect(x, y, w, h)
      ctx.setLineDash([])
      ctx.fillStyle = 'rgba(230, 57, 70, 0.92)'
      ctx.fillRect(x, y, 22, 18)
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 12px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(idx + 1), x + 11, y + 9)
      ctx.restore()
    })
  }

  return canvas.toDataURL('image/png')
}

function LayerStack({ baseUrl, notes, baseVisible, baseOpacity = 100, onionOpacity = 0, notesVisible, paintLayers, className }) {
  return (
    <div
      className={cn(
        'manga-page manga-page--canvas relative mx-auto overflow-hidden rounded-lg border-2 border-dashed border-white/10 shadow-2xl',
        className,
      )}
    >
      {baseVisible && baseUrl ? (
        <img
          src={baseUrl}
          alt=""
          className="manga-page__media absolute inset-0 size-full"
          style={{ opacity: Math.max(0, Math.min(1, baseOpacity / 100)) }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80 text-xs text-zinc-500">
          {baseUrl ? 'Layer ảnh gốc đang ẩn' : 'Chưa có ảnh gốc'}
        </div>
      )}

      {sortLayersForStack(paintLayers).map(layer => {
        if (!layer.dataUrl) return null
        // Nếu layer đang ẩn và có onion > 0 → vẫn hiển thị mờ theo onion
        const baseOp = layer.visible
          ? (layer.opacity ?? 100) / 100
          : onionOpacity > 0
            ? onionOpacity / 100
            : 0
        if (baseOp <= 0) return null
        return (
          <img
            key={layer.id}
            src={layer.dataUrl}
            alt={layer.name}
            className="manga-page__media pointer-events-none absolute inset-0 size-full"
            style={{
              opacity: baseOp,
              mixBlendMode: layer.blendMode && layer.blendMode !== 'source-over' ? layer.blendMode : undefined,
            }}
          />
        )
      })}

      {notesVisible && notes?.length ? (
        <div className="pointer-events-none absolute inset-0">
          {notes.map((n, idx) => (
            <div
              key={n.id ?? idx}
              className="absolute rounded-md border-2 border-dashed border-rose-500/90 bg-rose-500/10"
              style={{ left: `${n.x}%`, top: `${n.y}%`, width: `${n.w}%`, height: `${n.h}%` }}
            >
              <span className="absolute left-1 top-1 flex size-5 items-center justify-center rounded-sm bg-rose-500 text-[10px] font-bold text-white shadow">
                {idx + 1}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default function Assistant() {
  const navigate = useNavigate()
  const user = getSession()

  const { assignments, loading: assignmentsLoading, refresh: refreshAssignments } = useAssistantAssignments()
  // Toast khi có notification mới về revision để Assistant biết ngay
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
        void refreshAssignments()
      }
    },
  })
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
  const [pageIndex, setPageIndex] = useState(0)
  const [pageNotes, setPageNotes] = useState([])
  const [notesLoading, setNotesLoading] = useState(false)
  const [baseVisible, setBaseVisible] = useState(true)
  const [notesVisible, setNotesVisible] = useState(true)
  const [paintLayers, setPaintLayers] = useState([])
  // Composite controls (flow mới cho phép tuỳ chỉnh opacity / onion skin khi preview)
  const [baseOpacity, setBaseOpacity] = useState(100)
  const [onionOpacity, setOnionOpacity] = useState(0)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [layerToReplace, setLayerToReplace] = useState(null)
  const skipNextPersistRef = useRef(false)
  const [hireBusyId, setHireBusyId] = useState(null)

  useEffect(() => {
    if (!assignments.length) {
      setSelectedChapterId(null)
      return
    }
    if (!assignments.some(a => a.chapterId === selectedChapterId)) {
      setSelectedChapterId(assignments[0]?.chapterId ?? null)
      setPageIndex(0)
    }
  }, [assignments, selectedChapterId])

  useEffect(() => {
    migrateAssistantStorage().catch(() => null)
  }, [])

  const selectedChapter = useMemo(
    () => assignments.find(a => a.chapterId === selectedChapterId) ?? null,
    [assignments, selectedChapterId],
  )

  const currentPage = useMemo(() => {
    const pages = selectedChapter?.pages ?? []
    if (!pages.length) return null
    const idx = Math.min(Math.max(pageIndex, 0), pages.length - 1)
    return pages[idx] ?? null
  }, [selectedChapter, pageIndex])

  const {
    allTasks,
    chapterTasks,
    pageTasks,
    stats: taskStats,
    loading: tasksLoading,
    refresh: refreshTasks,
    startTask,
    submitTask,
    submitChapterTask,
  } = useAssistantTasks({
    chapterId: selectedChapterId,
    pageId: currentPage?.id,
  })

  const chapterActionableTasks = useMemo(
    () => chapterTasks.filter(t =>
      ['pending', 'in_progress', 'revision'].includes(t.status),
    ),
    [chapterTasks],
  )

  const chapterAllSubmitted = useMemo(
    () => chapterTasks.length > 0
      && chapterTasks.every(t => t.status === 'submitted' || t.status === 'approved'),
    [chapterTasks],
  )

  const layerStorageKey = useMemo(() => {
    if (!selectedChapter || !currentPage) return null
    return `${selectedChapter.chapterId}-${currentPage.id ?? pageIndex}`
  }, [selectedChapter, currentPage, pageIndex])

  useEffect(() => {
    if (!currentPage?.id) {
      setPageNotes([])
      return undefined
    }
    let cancelled = false
    setNotesLoading(true)
    chaptersService.getPageNotes(currentPage.id)
      .then(notesRes => {
        if (cancelled) return
        setPageNotes((Array.isArray(notesRes) ? notesRes : []).map(apiNoteToUi))
      })
      .catch(() => {
        if (!cancelled) setPageNotes([])
      })
      .finally(() => {
        if (!cancelled) setNotesLoading(false)
      })
    return () => { cancelled = true }
  }, [currentPage?.id])

  const selected = useMemo(() => {
    if (!selectedChapter || !currentPage) return null
    return {
      id: layerStorageKey,
      chapterId: selectedChapter.chapterId,
      seriesTitle: selectedChapter.seriesTitle,
      chapterNum: selectedChapter.chapterNum,
      pageIndex,
      pageLabel: `Trang ${pageIndex + 1}`,
      pageId: currentPage.id,
      mangakaImageUrl: currentPage.url,
      notes: pageNotes,
      status: selectedChapter.status,
    }
  }, [selectedChapter, currentPage, pageIndex, pageNotes, layerStorageKey])

  useEffect(() => {
    if (!layerStorageKey) {
      setPaintLayers([])
      return undefined
    }
    let cancelled = false
    setBaseVisible(true)
    setNotesVisible(true)
    loadAssistantPaintLayers(layerStorageKey).then(layers => {
      if (cancelled) return
      skipNextPersistRef.current = true
      setPaintLayers(layers)
    })
    return () => { cancelled = true }
  }, [layerStorageKey])

  useEffect(() => {
    if (!layerStorageKey) return
    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false
      return
    }
    saveAssistantPaintLayers(layerStorageKey, paintLayers).catch((err) => {
      console.error('saveAssistantPaintLayers failed', err)
      toast.error('Không lưu được layer.')
    })
  }, [paintLayers, layerStorageKey])

  const statsDisplayed = useMemo(() => {
    // Dedup theo chapter để khớp flow mới (1 task = 1 chapter)
    const byChapter = new Map()
    for (const t of allTasks) {
      const k = String(t.chapterId ?? t.id)
      if (!byChapter.has(k)) byChapter.set(k, t)
    }
    const chapterTasks = [...byChapter.values()]
    const pending = chapterTasks.filter(t => t.status === 'pending').length
    const progress = chapterTasks.filter(t => t.status === 'in_progress' || t.status === 'revision').length
    const review = chapterTasks.filter(t => t.status === 'submitted').length
    const approved = chapterTasks.filter(t => t.status === 'approved').length
    return [
      { ...STATS[0], value: String(chapterTasks.length || assignments.length) },
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

  const [taskFilter, setTaskFilter] = useState('all') // 'all' | 'revision' | 'pending' | 'in_progress' | 'submitted' | 'approved'
  const filteredChapters = useMemo(() => {
    const list = (assignments ?? []).map(a => ({
      ...a,
      // Lấy task đại diện (ưu tiên `revision` để gọi sửa)
      _task: allTasks.find(t => String(t.chapterId) === String(a.chapterId))
        ?? allTasks.find(t => String(t.id) === String(a.id)),
    }))
    if (taskFilter === 'all') return list
    if (taskFilter === 'needs-attention') {
      return list.filter(a => a._task?.status === 'revision' || a._task?.status === 'submitted')
    }
    return list.filter(a => a._task?.status === taskFilter)
  }, [assignments, allTasks, taskFilter])

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

  function handleSelectChapter(chapter) {
    setSelectedChapterId(chapter.chapterId)
    setPageIndex(0)
  }

  function goPage(delta) {
    const max = (selectedChapter?.pages?.length ?? 1) - 1
    setPageIndex(i => Math.min(Math.max(0, i + delta), max))
  }

  function toggleLayerVisible(layerId) {
    setPaintLayers(prev => prev.map(l => (l.id === layerId ? { ...l, visible: !l.visible } : l)))
  }

  function changeLayerOpacity(layerId, value) {
    setPaintLayers(prev => prev.map(l => (l.id === layerId ? { ...l, opacity: value } : l)))
  }

  function changeLayerBlend(layerId, blendMode) {
    setPaintLayers(prev =>
      prev.map(l => (l.id === layerId ? { ...l, blendMode } : l))
    )
  }

  function moveLayer(layerId, direction) {
    setPaintLayers(prev => moveLayerOrder(prev, layerId, direction))
  }

  async function handleSelectVersion(layerId, versionId) {
    if (!layerStorageKey) return
    const layer = paintLayers.find(l => l.id === layerId)
    const ver = layer?.versions?.find(v => v.id === versionId)
    let dataUrl = ver?.dataUrl ?? null
    if (!dataUrl) {
      try {
        dataUrl = await getBlob(
          paintLayerVersionBlobKey(layerStorageKey, layerId, versionId),
        )
      } catch {
        dataUrl = null
      }
    }
    setPaintLayers(prev =>
      prev.map(l =>
        l.id === layerId ? setActiveLayerVersion(l, versionId, dataUrl) : l,
      ),
    )
  }

  function handleDownloadLayer(layerId) {
    const layer = paintLayers.find(l => l.id === layerId)
    if (!layer?.dataUrl || !selected) return
    const step = ASSISTANT_PRODUCTION_STEPS.find(s => layer.stepType === s.key)
    const ver = layer.versions?.find(v => v.id === layer.activeVersionId)
    const a = document.createElement('a')
    a.href = layer.dataUrl
    a.download = `${selected.seriesTitle}-Ch${selected.chapterNum}-${step?.key ?? 'layer'}-${ver?.label ?? 'file'}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    toast.success(`Đã tải ${layer.name}.`)
  }

  async function handleAddLayerFiles(files, replaceLayerId = null) {
    if (!selected || !replaceLayerId || !files?.length) return
    const arr = Array.from(files).filter(
      f => f.type === 'image/png' || f.type === 'image/webp',
    )
    if (!arr.length) {
      toast.error('Chỉ chấp nhận PNG hoặc WebP (nền trong suốt).')
      return
    }
    setBusy(true)
    try {
      const dataUrl = await fileToDataUrl(arr[0])
      setPaintLayers(prev =>
        prev.map(l => {
          if (l.id !== replaceLayerId) return l
          const updated = appendLayerVersion(l, dataUrl)
          return {
            ...updated,
            versions: updated.versions.map(v =>
              v.id === updated.activeVersionId ? { ...v, dataUrl } : v,
            ),
          }
        }),
      )
      const layerName = paintLayers.find(l => l.id === replaceLayerId)?.name
      toast.success(`Đã upload phiên bản mới cho ${layerName ?? 'layer'}.`)
    } catch {
      toast.error('Không đọc được ảnh — thử file khác.')
    } finally {
      setBusy(false)
      setLayerToReplace(null)
    }
  }

  function onFileInputChange(e) {
    const files = e.target.files
    void handleAddLayerFiles(files, layerToReplace)
    e.target.value = ''
  }

  function pickReplaceFile(layerId) {
    setLayerToReplace(layerId)
    document.getElementById('as-layer-file-input')?.click()
  }

  function handleDownloadOriginal() {
    if (!selected?.mangakaImageUrl) return
    const a = document.createElement('a')
    a.href = selected.mangakaImageUrl
    a.download = `${selected.seriesTitle}-Ch${selected.chapterNum}-${selected.pageLabel || 'page'}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    toast.success('Đã tải bản phác thảo — chỉnh trong Photoshop / Clip Studio Paint rồi upload từng layer PNG/WebP.')
  }

  async function handleDownloadAllOriginals() {
    const pages = selectedChapter?.pages ?? []
    if (!pages.length) return
    for (let i = 0; i < pages.length; i += 1) {
      const p = pages[i]
      if (!p?.url) continue
      const a = document.createElement('a')
      a.href = p.url
      a.download = `${selectedChapter.seriesTitle}-Ch${selectedChapter.chapterNum}-p${i + 1}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      // delay nhỏ để tránh trình duyệt chặn nhiều download cùng lúc
      await new Promise(r => window.setTimeout(r, 150))
    }
    toast.success(`Đã tải ${pages.length} ảnh gốc của chapter.`)
  }

  /**
   * Flow mới (1 task = 1 chapter):
   * - Mỗi chapter chỉ có 1 task duy nhất.
   * - Assistant xử lý tất cả các trang (vẽ layer, composite), rồi nộp 1 LẦN
   *   toàn bộ ảnh kết quả trong 1 task.
   * - `exportPreset` chọn cách render ảnh cuối (default/final, line art, clean).
   * - Tương thích ngược: nếu chapter vẫn có nhiều task cũ thì vẫn submit theo từng task.
   */
  async function handleSubmitChapterToMangaka(exportPreset = null) {
    if (!selectedChapter) return
    if (!chapterTasks.length) {
      toast.error('Chưa có task cho chapter này — chờ Mangaka gửi.')
      return
    }
    if (chapterAllSubmitted) {
      toast.message('Chapter này đã nộp cho Mangaka.')
      return
    }
    if (!chapterActionableTasks.length) {
      toast.error('Không còn task cần nộp trên chapter này.')
      return
    }

    const pages = selectedChapter.pages ?? []
    const outputMode = exportPreset?.values?.outputMode ?? 'final'
    const includeBase = exportPreset?.values?.includeBase ?? true
    const baseOpacityPreset = exportPreset?.values?.baseOpacity ?? 100
    const notesVisiblePreset = exportPreset?.values?.notesVisible ?? false

    setBusy(true)
    try {
      // Build 1 ảnh kết quả / trang theo export preset
      const submissionFiles = []
      for (const page of pages) {
        if (!page?.url) continue
        const storageKey = `${selectedChapter.chapterId}-${page.id}`
        const layers = await loadAssistantPaintLayers(storageKey)
        // 'clean' yêu cầu render dù layer ẩn vẫn tính
        const hasImage = layers.some(l => l.dataUrl)
        if (!hasImage) {
          const idx = pages.findIndex(p => String(p.id) === page.id)
          toast.error(`Trang ${idx + 1} chưa có layer — hoàn thành tất cả trang trước khi gửi.`)
          return
        }
        const compositeDataUrl = await renderComposite({
          baseUrl: page.url,
          notes: [],
          paintLayers: layers,
          notesVisible: notesVisiblePreset,
          includeBase,
          transparentBg: false,
          baseOpacity: baseOpacityPreset,
          onionOpacity: 0,
          outputMode,
        })
        if (!compositeDataUrl) continue
        const idx = pages.findIndex(p => String(p.id) === page.id)
        submissionFiles.push({
          file: await dataUrlToFile(
            compositeDataUrl,
            `${selectedChapter.seriesTitle}-Ch${selectedChapter.chapterNum}-p${idx + 1}.png`,
          ),
        })
      }

      if (!submissionFiles.length) {
        toast.error('Không có trang nào có layer để nộp.')
        return
      }

      // Ưu tiên: dùng `submitChapterTask` (1 task = N ảnh)
      const chapterTask = chapterActionableTasks[0]
      if (chapterActionableTasks.length === 1 && chapterTask) {
        if (chapterTask.status === 'pending' || chapterTask.status === 'revision') {
          await startTask(chapterTask.id)
        }
        await submitChapterTask(chapterTask.id, submissionFiles.map(s => s.file))
        toast.success(
          `Đã nộp chapter ${selectedChapter.chapterNum} (${submissionFiles.length} trang, kiểu "${exportPreset?.label ?? 'Ảnh cuối'}") cho Mangaka.`,
        )
      } else {
        // Fallback tương thích: nộp theo từng page/task (flow cũ)
        const pageIds = [...new Set(chapterActionableTasks.map(t => String(t.pageId)))]
        for (const pageId of pageIds) {
          const idx = pages.findIndex(p => String(p.id) === pageId)
          const file = submissionFiles[idx]?.file
          if (!file) continue
          const tasks = chapterActionableTasks.filter(t => String(t.pageId) === pageId)
          for (const task of tasks) {
            if (task.status === 'pending' || task.status === 'revision') {
              await startTask(task.id)
            }
            await submitTask(task.id, file)
          }
        }
        toast.success(
          `Đã nộp chapter ${selectedChapter.chapterNum} — ${submissionFiles.length} trang (${chapterActionableTasks.length} task, kiểu "${exportPreset?.label ?? 'Ảnh cuối'}") cho Mangaka.`,
        )
      }

      await refreshTasks()
      void refreshAssignments()
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Nộp chapter thất bại — thử lại.'))
    } finally {
      setBusy(false)
      setExportDialogOpen(false)
    }
  }

  const noteCount = selected?.notes?.length ?? 0
  const visibleLayerCount = paintLayers.filter(l => l.visible && l.dataUrl).length

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header links={NAV_LINKS} onLogout={user ? handleLogout : undefined} />

      <WorkspaceHero
        className="from-violet-950 to-zinc-950"
        label="Assistant Workspace"
        title={`Xin chào${user?.name ? `, ${user.name.split(' ')[0]}` : ''}`}
        description="Mangaka gửi cả chapter (nhiều trang). Bạn chọn chapter, xem từng trang, tải ảnh về chỉnh trong Photoshop/Clip Studio Paint rồi upload layer."
      >
        <div className="mt-5 flex flex-wrap gap-3 text-xs text-zinc-300">
          <Badge variant="secondary" className="bg-white/10 text-white hover:bg-white/15">
            <ArrowDownToLine className="size-3" />
            Download bản gốc
          </Badge>
          <Badge variant="secondary" className="bg-white/10 text-white hover:bg-white/15">
            <MonitorOff className="size-3" />
            Chỉnh ngoài PS / CSP
          </Badge>
          <Badge variant="secondary" className="bg-white/10 text-white hover:bg-white/15">
            <LayersIcon className="size-3" />
            6 layer sản xuất
          </Badge>
        </div>
      </WorkspaceHero>

      <main className="page-container flex-1 py-8">
        <input
          id="as-layer-file-input"
          type="file"
          accept="image/png,image/webp"
          hidden
          onChange={onFileInputChange}
        />

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
                Luồng 2 bước: đồng ý gặp → chốt hợp tác. Sau khi chốt, Mangaka mới gán chapter cho bạn.
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
                      {requestStatusLabel(req.status)} · Gửi lúc {new Date(req.createdAt).toLocaleString('vi-VN')}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {isPendingRequest(req.status) ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={hireBusyId === req.id}
                          onClick={() => void handleCooperationAction(req, 'reject')}
                        >
                          Từ chối
                        </Button>
                        <Button
                          size="sm"
                          disabled={hireBusyId === req.id}
                          onClick={() => void handleCooperationAction(req, 'accept-meet')}
                        >
                          <CheckCircle2 className="size-3.5" />
                          Đồng ý gặp
                        </Button>
                      </>
                    ) : isMeetingPhase(req.status) ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={hireBusyId === req.id}
                          onClick={() => void handleCooperationAction(req, 'decline-cooperation')}
                        >
                          Từ chối hợp tác
                        </Button>
                        <Button
                          size="sm"
                          disabled={hireBusyId === req.id}
                          onClick={() => void handleCooperationAction(req, 'accept-cooperation')}
                        >
                          <CheckCircle2 className="size-3.5" />
                          Chốt hợp tác
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {cooperations.length > 0 ? (
          <Card className="mb-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Mangaka đang hợp tác</CardTitle>
              <CardDescription>
                Đã chốt hợp tác — có thể nhận chapter từ các Mangaka này.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {cooperations.map(c => (
                <Badge key={c.id} variant="secondary" className="px-3 py-1.5">
                  {c.mangakaName}
                </Badge>
              ))}
            </CardContent>
          </Card>
        ) : null}

        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {statsDisplayed.map(s => {
            const Icon = s.icon
            return (
              <Card key={s.label}>
                <CardContent className="flex items-center gap-3 p-4">
                  <div className={cn('flex size-10 items-center justify-center rounded-xl', STAT_ICON_BG[s.color])}>
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xl font-bold leading-tight">{s.value}</div>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <div className="grid gap-6 xl:grid-cols-[300px_1fr_360px]">
          <Card className="flex flex-col gap-0 overflow-hidden p-0">
            <CardHeader className="border-b p-4">
              <CardTitle className="text-base">Chapter được giao</CardTitle>
              <CardDescription>1 chapter = 1 Assistant · bấm vào để xem các trang</CardDescription>
              <div className="-mb-1 mt-1 flex flex-wrap gap-1 pt-2">
                {[
                  { id: 'all', label: 'Tất cả' },
                  { id: 'needs-attention', label: 'Cần xử lý' },
                  { id: 'revision', label: 'Cần sửa' },
                  { id: 'submitted', label: 'Chờ duyệt' },
                  { id: 'in_progress', label: 'Đang làm' },
                  { id: 'pending', label: 'Chờ nhận' },
                ].map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setTaskFilter(f.id)}
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors',
                      taskFilter === f.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </CardHeader>
            {assignmentsLoading ? (
              <div className="p-6 text-center text-xs text-muted-foreground">Đang tải việc được giao...</div>
            ) : assignments.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                Chưa có chapter nào. Mangaka gửi cả chapter ở tab Upload &amp; Ghi chú.
              </div>
            ) : (
              <ScrollArea className="max-h-[calc(100vh-220px)]">
                <ul className="divide-y">
                  {filteredChapters.map(ch => {
                    const badge = STATUS_BADGE[ch.status] ?? STATUS_BADGE.pending_assistant
                    const cover = ch.pages?.find(p => p.url) ?? ch.pages?.[0]
                    const pageCount = ch.pageCount ?? ch.pages?.length ?? 0
                    return (
                      <li key={ch.chapterId}>
                        <button
                          type="button"
                          onClick={() => handleSelectChapter(ch)}
                          className={cn(
                            'flex w-full items-start gap-3 p-3 text-left transition-colors',
                            selectedChapterId === ch.chapterId ? 'bg-primary/10' : 'hover:bg-muted/50',
                          )}
                        >
                          <span className="manga-page manga-page--thumb-md shrink-0 overflow-hidden rounded">
                            {cover?.url ? (
                              <img src={cover.url} alt="" className="manga-page__media" />
                            ) : (
                              <span className="flex h-full items-center justify-center text-xs text-muted-foreground">📄</span>
                            )}
                          </span>
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <p className="truncate text-sm font-semibold">{ch.seriesTitle}</p>
                            <p className="text-xs text-muted-foreground">
                              Chapter {ch.chapterNum}{ch.title ? ` · ${ch.title}` : ''}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {pageCount} trang
                            </p>
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
          </Card>

          <div className="space-y-4">
            {selected ? (
              <>
                <Card className="overflow-hidden p-0">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {selected.seriesTitle} · Ch. {selected.chapterNum}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {selected.pageLabel} · {(selectedChapter?.pages?.length ?? 0)} trang trong chapter
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button size="icon-sm" variant="outline" disabled={pageIndex === 0} onClick={() => goPage(-1)}>‹</Button>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {pageIndex + 1} / {selectedChapter?.pages?.length ?? 1}
                      </span>
                      <Button
                        size="icon-sm"
                        variant="outline"
                        disabled={pageIndex >= (selectedChapter?.pages?.length ?? 1) - 1}
                        onClick={() => goPage(1)}
                      >
                        ›
                      </Button>
                      <Button size="sm" variant={baseVisible ? 'default' : 'outline'} onClick={() => setBaseVisible(v => !v)}>
                        {baseVisible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                        Ảnh gốc
                      </Button>
                      <Button
                        size="sm"
                        variant={notesVisible ? 'default' : 'outline'}
                        onClick={() => setNotesVisible(v => !v)}
                        disabled={noteCount === 0}
                      >
                        {notesVisible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                        Ghi chú ({noteCount})
                      </Button>
                    </div>
                  </div>

                  <div className="bg-zinc-950 p-4">
                    <LayerStack
                      baseUrl={selected.mangakaImageUrl}
                      notes={selected.notes}
                      baseVisible={baseVisible}
                      baseOpacity={baseOpacity}
                      onionOpacity={onionOpacity}
                      notesVisible={notesVisible}
                      paintLayers={paintLayers}
                      className="w-full max-w-[640px]"
                    />
                    <p className="mt-3 text-center text-xs text-zinc-400">
                      Preview · <strong className="text-white">{visibleLayerCount}</strong>/
                      {paintLayers.length} layer đang bật
                      {baseVisible ? ' · ảnh gốc' : ''}
                      {notesVisible && noteCount > 0 ? ' · ghi chú' : ''}
                    </p>
                  </div>
                </Card>

                {selected.notes?.length > 0 ? (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <StickyNote className="size-4 text-rose-500" />
                        Vùng việc Mangaka đã đánh dấu
                      </CardTitle>
                      <CardDescription>
                        Tải ảnh gốc, vẽ những phần này trên phần mềm yêu thích rồi upload PNG trong suốt lên đây.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className="grid gap-2 sm:grid-cols-2">
                        {selected.notes.map((n, i) => (
                          <li key={n.id ?? i} className="flex items-start gap-2 rounded-md border p-2.5">
                            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-rose-500 text-xs font-bold text-white">
                              {i + 1}
                            </span>
                            <div className="min-w-0 flex-1 space-y-1">
                              <Badge variant="outline" className="text-[10px]">
                                {noteTaskLabel(n.taskType)}
                              </Badge>
                              <p className="text-xs">{n.text || <span className="italic text-muted-foreground">Không có mô tả</span>}</p>
                              {n.assignee ? (
                                <p className="text-[10px] text-muted-foreground">Giao: {n.assignee}</p>
                              ) : null}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ) : null}
              </>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
                  <ImageIcon className="size-12 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">Chọn một chapter ở danh sách bên trái để xem trang và làm việc.</p>
                </CardContent>
              </Card>
            )}
          </div>

          <aside className="space-y-4">
            <Card className="border-violet-200 bg-gradient-to-b from-violet-50 to-transparent dark:border-violet-500/20 dark:from-violet-500/10">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <MonitorOff className="size-4 text-violet-600" />
                  Không chỉnh ảnh trên web
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-muted-foreground">
                <p>
                  Website chỉ <strong className="text-foreground">quản lý layer</strong> (upload, preview, bật/tắt, thứ tự, download, phiên bản).
                </p>
                <p>
                  Toàn bộ chỉnh sửa nét vẽ / màu / chữ thực hiện trong{' '}
                  <strong className="text-foreground">Photoshop</strong> hoặc{' '}
                  <strong className="text-foreground">Clip Studio Paint</strong>.
                </p>
              </CardContent>
            </Card>

            {selected && chapterTasks.length > 0 ? (
              <Card className="border-sky-200 dark:border-sky-500/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Mô tả từ Mangaka</CardTitle>
                  <CardDescription className="text-xs">
                    {tasksLoading
                      ? 'Đang tải...'
                      : `1 task = cả chapter · ${selectedChapter?.pages?.length ?? 0} trang`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {chapterTasks.map(task => {
                    const isRevision = task.status === 'revision'
                    return (
                      <div
                        key={task.id}
                        className={cn(
                          'rounded-md border p-2.5 text-xs',
                          isRevision
                            ? 'border-amber-300 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/5'
                            : 'bg-card',
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-foreground">
                            {TASK_STATUS_LABEL[task.status] ?? task.status}
                          </span>
                          {isRevision ? (
                            <Badge className="bg-amber-500 text-white hover:bg-amber-500">
                              Cần sửa
                            </Badge>
                          ) : null}
                        </div>
                        {task.description ? (
                          <p className="mt-1 whitespace-pre-line text-foreground/80">
                            {task.description}
                          </p>
                        ) : (
                          <p className="mt-1 text-muted-foreground">
                            (Mangaka không kèm mô tả — bạn xem ảnh + layer note trên từng trang.)
                          </p>
                        )}
                        {isRevision && task.revisionNote ? (
                          <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-2 dark:border-amber-500/30 dark:bg-amber-500/10">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                              Yêu cầu chỉnh sửa gần nhất
                            </p>
                            <p className="mt-0.5 text-foreground/80">{task.revisionNote}</p>
                          </div>
                        ) : null}
                        {task.revisionHistory?.length > 1 ? (
                          <details className="mt-2 text-muted-foreground">
                            <summary className="cursor-pointer text-[10px] hover:text-foreground">
                              Lịch sử yêu cầu sửa ({task.revisionHistory.length} lần)
                            </summary>
                            <ol className="mt-1 space-y-1 pl-3">
                              {task.revisionHistory.map((h, i) => (
                                <li key={i} className="list-decimal">
                                  <span className="text-foreground/80">{h.note}</span>
                                  {h.at ? (
                                    <span className="ml-1 text-[10px]">
                                      · {new Date(h.at).toLocaleString('vi-VN')}
                                    </span>
                                  ) : null}
                                </li>
                              ))}
                            </ol>
                          </details>
                        ) : null}
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <LayersIcon className="size-4 text-primary" />
                  Layer sản xuất ({paintLayers.length})
                </CardTitle>
                <CardDescription className="text-xs">
                  Sketch → Line Art → Color → Text → Effect → Final
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {!selected ? (
                  <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                    Chọn một trang để bắt đầu quản lý layer.
                  </p>
                ) : (
                  <>
                    <div className="space-y-2">
                      <div
                        className={cn(
                          'flex items-center gap-2 rounded-lg border p-2.5',
                          baseVisible ? 'bg-card' : 'border-dashed bg-muted/40',
                        )}
                        style={{ borderLeftColor: '#71717a', borderLeftWidth: 3 }}
                      >
                        <Button
                          size="icon-sm"
                          variant={baseVisible ? 'default' : 'outline'}
                          onClick={() => setBaseVisible(v => !v)}
                        >
                          {baseVisible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                        </Button>
                        <div className="size-9 shrink-0 overflow-hidden rounded border bg-muted">
                          {selected.mangakaImageUrl ? (
                            <img src={selected.mangakaImageUrl} alt="" className="size-full object-cover" />
                          ) : (
                            <span className="flex size-full items-center justify-center">🖼️</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1 truncate text-sm font-medium">
                            Ảnh gốc Mangaka
                            <Lock className="size-3 text-muted-foreground" />
                          </p>
                          <p className="text-[10px] text-muted-foreground">Không thể chỉnh sửa</p>
                        </div>
                      </div>

                      {selected.notes?.length ? (
                        <div
                          className={cn(
                            'flex items-center gap-2 rounded-lg border p-2.5',
                            notesVisible ? 'bg-card' : 'border-dashed bg-muted/40',
                          )}
                          style={{ borderLeftColor: '#e63946', borderLeftWidth: 3 }}
                        >
                          <Button
                            size="icon-sm"
                            variant={notesVisible ? 'default' : 'outline'}
                            onClick={() => setNotesVisible(v => !v)}
                          >
                            {notesVisible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                          </Button>
                          <div className="flex size-9 shrink-0 items-center justify-center rounded border bg-rose-500/10 text-base">
                            📝
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">Ô ghi chú ({selected.notes.length})</p>
                            <p className="text-[10px] text-muted-foreground">Đỏ – chỉ tham khảo</p>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <ul className="space-y-2">
                      {sortLayersForStack(paintLayers).map((layer, index, arr) => {
                        const step = ASSISTANT_PRODUCTION_STEPS.find(
                          s => s.key === layer.stepType,
                        )
                        return (
                          <ProductionLayerRow
                            key={layer.id}
                            layer={layer}
                            step={step}
                            onToggle={toggleLayerVisible}
                            onChangeOpacity={changeLayerOpacity}
                            onChangeBlend={changeLayerBlend}
                            onPickFile={pickReplaceFile}
                            onDownload={handleDownloadLayer}
                            onMoveUp={id => moveLayer(id, 'up')}
                            onMoveDown={id => moveLayer(id, 'down')}
                            canMoveUp={index > 0}
                            canMoveDown={index < arr.length - 1}
                            onSelectVersion={handleSelectVersion}
                          />
                        )
                      })}
                    </ul>
                  </>
                )}
              </CardContent>
            </Card>

            <CompositeSettingsPanel
              baseVisible={baseVisible}
              onToggleBase={() => setBaseVisible(v => !v)}
              baseOpacity={baseOpacity}
              onChangeBaseOpacity={setBaseOpacity}
              notesVisible={notesVisible}
              onToggleNotes={() => setNotesVisible(v => !v)}
              onionOpacity={onionOpacity}
              onChangeOnionOpacity={setOnionOpacity}
            />

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Nộp chapter cho Mangaka</CardTitle>
                <CardDescription className="text-xs">
                  Hoàn thành layer trên <strong>mọi trang</strong>, rồi gửi một lần cả chapter — 1 task = 1 chapter.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={!selected?.mangakaImageUrl}
                  onClick={handleDownloadOriginal}
                >
                  <ArrowDownToLine className="size-4" />
                  Tải ảnh gốc trang hiện tại
                </Button>
                {selectedChapter && (selectedChapter.pages ?? []).length > 1 ? (
                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={() => void handleDownloadAllOriginals()}
                  >
                    <ArrowDownToLine className="size-3.5" />
                    Tải tất cả ảnh gốc của chapter ({(selectedChapter.pages ?? []).length} trang)
                  </Button>
                ) : null}
                {selectedChapter && chapterTasks.length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    1 task cho cả chapter ·{' '}
                    {(selectedChapter.pages ?? []).length} trang
                    {chapterAllSubmitted ? ' · đã nộp' : ''}
                  </p>
                ) : null}
                <Button
                  className="w-full"
                  disabled={
                    !selectedChapter
                    || busy
                    || !chapterActionableTasks.length
                    || chapterAllSubmitted
                  }
                  onClick={() => setExportDialogOpen(true)}
                >
                  <Send className="size-4" />
                  Gửi cả chapter cho Mangaka
                </Button>
                {selectedChapter && !chapterTasks.length ? (
                  <p className="text-[10px] text-muted-foreground">
                    Chưa có task — chờ Mangaka gửi chapter cho bạn.
                  </p>
                ) : null}
                {selectedChapter && chapterActionableTasks.length > 0 ? (
                  <p className="text-[10px] text-muted-foreground">
                    Mỗi trang: bật ít nhất 1 layer có ảnh (bản ghép ảnh gốc + layer).
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Lightbulb className="size-4 text-primary" />
                  Quy trình gợi ý
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="relative space-y-2.5 border-l border-muted pl-5">
                  {[
                    { step: 1, text: 'Mangaka gửi bản phác thảo PNG/WebP' },
                    { step: 2, text: 'Assistant download ảnh gốc + từng layer (nếu có)' },
                    { step: 3, text: 'Chỉnh trong Photoshop / Clip Studio Paint (không vẽ trên web)' },
                    { step: 4, text: 'Upload lại từng bước: Sketch, Line Art, Color, Text, Effect, Final' },
                    { step: 5, text: 'Preview, bật/tắt, sắp xếp thứ tự, quản lý version' },
                    { step: 6, text: 'Hoàn thành mọi trang → Gửi cả chapter (ảnh) cho Mangaka' },
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

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="size-4 text-emerald-600" />
                  Trang duyệt & thu nhập
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="rounded-md border p-2.5 text-sm">
                  <p className="text-xs text-muted-foreground">Kỳ thống kê</p>
                  <p className="font-medium">{taskStats?.period ?? 'Tháng này'}</p>
                </div>
                <div className="flex items-center justify-between rounded-md border p-2.5">
                  <div>
                    <p className="text-sm font-medium">Task đã duyệt</p>
                    <p className="text-xs text-muted-foreground">Trong tháng</p>
                  </div>
                  <span className="font-bold tabular-nums text-emerald-600">
                    {taskStats?.approvedTasksThisMonth ?? '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-md border p-2.5">
                  <div>
                    <p className="text-sm font-medium">Thu nhập tháng</p>
                    <p className="text-xs text-muted-foreground">
                      Tổng: {formatEarnings(taskStats?.totalEarnings)}
                    </p>
                  </div>
                  <span className="font-bold tabular-nums text-emerald-600">
                    {formatEarnings(taskStats?.earningsThisMonth)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>

      <Footer />

      <ExportOptionsDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        busy={busy}
        pageCount={(selectedChapter?.pages ?? []).length}
        onConfirm={(preset) => handleSubmitChapterToMangaka(preset)}
      />
    </div>
  )
}
