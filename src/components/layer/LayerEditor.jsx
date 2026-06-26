import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowDownToLine,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  FileDown,
  Image as ImageIcon,
  Layers as LayersIcon,
  Loader2,
  Maximize2,
  RefreshCw,
  Send,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { usePageLayers } from '@/hooks/usePageLayers.js'
import { layersService } from '@/api/layers.service.js'
import { apiNoteToUi, apiTaskToUi } from '@/utils/apiMappers.js'
import { chaptersService } from '@/api/chapters.service.js'
import { getApiErrorMessage } from '@/api/http.js'
import { cn } from '@/lib/utils'
import LayerCanvas from './LayerCanvas.jsx'
import LayerStackPanel from './LayerStackPanel.jsx'
import { ImageLightbox } from './ImageLightbox.jsx'

function buildLayerNote(layers, notes) {
  if (!Array.isArray(notes)) return null
  // Chỉ filter bỏ notes placeholder: full canvas (w=100, h=100, x=0, y=0) VÀ text rỗng/whitespace
  const valid = notes.filter(n => {
    const hasText = n.text && n.text.trim().length > 0
    const isPlaceholder = (n.w >= 100 && n.h >= 100 && n.x === 0 && n.y === 0)
    return hasText || !isPlaceholder
  })
  const blocked = valid.find(n => n.status === 'open' && n.layerIndex !== undefined && n.layerIndex !== null)
  if (!blocked) return null
  const layer = layers.find(l => l.index === blocked.layerIndex)
  return { note: blocked, layer }
}

const CANVAS_W = 960
const CANVAS_H = 1360
const PADDING = 12

export default function LayerEditor({ chapter, pageId: pageIdProp, task: taskProp, onSubmitted, pages: pagesProp, fullscreen = false }) {
  const chapterPages = chapter?.pages ?? []
  const pages = pagesProp ?? chapterPages
  const [pageIdx, setPageIdx] = useState(0)
  const [submittingAll, setSubmittingAll] = useState(false)
  const [showOriginal, setShowOriginal] = useState(true)
  const [showRegionOverlay, setShowRegionOverlay] = useState(true)
  const [showNoteOverlay, setShowNoteOverlay] = useState(true)
  const [lightboxImage, setLightboxImage] = useState(null)
  const [lightboxTitle, setLightboxTitle] = useState('')
  // Track trang nào đã có ảnh gộp (finalized) và đã gửi cho Mangaka
  const [finalizedPages, setFinalizedPages] = useState({})   // pageId → true
  const [submittedPages, setSubmittedPages] = useState({})  // pageId → true
  // Cache ảnh gộp (URL) cho từng page, để hiển thị ngay sau khi gộp
  const [finalImagesByPage, setFinalImagesByPage] = useState({})  // pageId → url

  const taskFromProp = taskProp ? (typeof taskProp === 'object' ? apiTaskToUi(taskProp) : null) : null
  const task = chapter?._task ?? taskFromProp
  const taskNotes = task?.noteIds ?? []

  const safeIdx = Math.min(Math.max(0, pageIdx), Math.max(0, pages.length - 1))
  const safePage = pages[safeIdx] ?? null
  const activePageId = safePage?.id ?? safePage?._id ?? pageIdProp ?? null

  const layersApi = usePageLayers(activePageId)
  const {
    layers,
    versions,
    originalImage,
    finalImage,
    finalError,
    loading,
    uploading,
    finalizing,
    addLayer,
    updateLayer,
    deleteLayer,
    uploadNewVersion,
    rollback,
    loadVersions,
    reorderLayers,
    finalize,
    refresh,
  } = layersApi

  // Finalize cho trang hiện tại, đồng thời mark là đã finalize + cache URL ảnh gộp
  const handleFinalize = useCallback(async () => {
    if (!activePageId) return
    try {
      const url = await finalize()
      setFinalizedPages(prev => ({ ...prev, [activePageId]: true }))
      if (url) {
        // Lưu URL ảnh gộp vào cache theo pageId
        setFinalImagesByPage(prev => ({ ...prev, [activePageId]: url }))
      }
    } catch { /* finalize đã toast lỗi rồi */ }
  }, [activePageId, finalize])

  // Sync finalizedPages: nếu finalImage null → không còn đã finalize
  useEffect(() => {
    if (!finalImage && activePageId) {
      setFinalizedPages(prev => {
        const next = { ...prev }
        delete next[activePageId]
        return next
      })
    }
    // Đồng bộ cache ảnh gộp theo pageId
    if (activePageId) {
      setFinalImagesByPage(prev => {
        if (finalImage) {
          // Có ảnh gộp mới → lưu vào cache
          if (prev[activePageId] === finalImage) return prev
          return { ...prev, [activePageId]: finalImage }
        }
        // Không có ảnh gộp → xóa khỏi cache (nếu có)
        if (!(activePageId in prev)) return prev
        const next = { ...prev }
        delete next[activePageId]
        return next
      })
    }
  }, [finalImage, activePageId])

  const [pageNotes, setPageNotes] = useState([])
  const [notesLoading, setNotesLoading] = useState(false)

  // Build notes for the active page from revision_annotations (per-page structured notes from Mangaka)
  const chapterPageAnnotations = useMemo(() => {
    const result = []

    // 1. revision_annotations (structured array, per-page key)
    const raw = chapter?.revision_annotations
    if (raw && typeof raw === 'object') {
      const keyIndex = String(pageIdx)
      const arr = raw[`page_${keyIndex}`] ?? raw[keyIndex] ?? null
      if (Array.isArray(arr)) {
        for (const n of arr) {
          result.push({
            id: n._id ?? n.id ?? `ra-${pageIdx}`,
            clientKey: n._id ?? n.id ?? `ra-${pageIdx}`,
            text: n.text ?? '',
            x: n.x ?? 0,
            y: n.y ?? 0,
            w: n.w ?? 0,
            h: n.h ?? 0,
            taskType: n.taskType ?? 'other',
            status: n.status ?? 'open',
            assignee: n.assignee ?? '',
            layerIndex: n.layerIndex ?? null,
          })
        }
      }
    }

    // 2. revision_notes_parsed (parsed from string, includes pageIndex)
    const parsed = chapter?.revision_notes_parsed ?? []
    if (Array.isArray(parsed)) {
      for (const note of parsed) {
        // pageIndex === pageIdx HOẶC pageIndex === undefined (áp dụng cho mọi page)
        if (note.pageIndex === undefined || note.pageIndex === pageIdx) {
          result.push({
            id: note.id ?? `rn-${pageIdx}`,
            clientKey: note.id ?? `rn-${pageIdx}`,
            text: note.text ?? '',
            x: note.x ?? 0,
            y: note.y ?? 0,
            w: note.w ?? 100,
            h: note.h ?? 100,
            taskType: note.taskType ?? 'paint',
            status: 'open',
            assignee: '',
            layerIndex: null,
          })
        }
      }
    }

    return result
  }, [chapter?.revision_annotations, chapter?.revision_notes_parsed, pageIdx])

  async function loadNotes() {
    // Luôn kết hợp: task.noteIds + chapterPageAnnotations + API fallback
    const results = []

    // 1. Notes từ task.noteIds (BE populate vào task object)
    if (taskNotes.length > 0) {
      results.push(...taskNotes.map(n => ({
        ...n,
        source: 'taskNotes',
        clientKey: n.id ? String(n.id) : undefined,
        status: n.status ?? 'open',
        x: n.x ?? 0,
        y: n.y ?? 0,
        w: n.w ?? 0,
        h: n.h ?? 0,
        taskType: n.taskType ?? 'other',
        text: n.text ?? '',
      })))
    }

    // 2. Notes từ chapterPageAnnotations (revision_annotations + revision_notes_parsed)
    if (chapterPageAnnotations.length > 0) {
      results.push(...chapterPageAnnotations.map(n => ({ ...n, source: n.source ?? 'chapterAnnotations' })))
    }

    // 3. Fallback: gọi API lấy notes theo pageId nếu chưa có gì
    if (results.length === 0 && activePageId) {
      setNotesLoading(true)
      try {
        const res = await chaptersService.getPageNotes(activePageId).catch(() => [])
        results.push(...(Array.isArray(res) ? res : []).map(n => ({ ...apiNoteToUi(n), source: 'api' })))
      } finally {
        setNotesLoading(false)
      }
    }

    // Deduplicate theo id/clientKey trước khi set — phòng trường hợp 2 nguồn trả cùng 1 note
    const seenKeys = new Set()
    const deduped = []
    for (const n of results) {
      const key = n.clientKey ?? n.id ?? String(n._id ?? '')
      if (!key || seenKeys.has(key)) continue
      seenKeys.add(key)
      deduped.push(n)
    }
    setPageNotes(deduped)
  }

  useEffect(() => { void loadNotes() }, [activePageId, taskNotes.length, chapterPageAnnotations.length])

  // Gộp notes từ mọi nguồn: task.noteIds + chapter.revision_annotations + API getPageNotes
  const allNotes = useMemo(() => {
    const seen = new Set()
    const merged = []

    for (const note of taskNotes) {
      const key = note.clientKey ?? note.id ?? String(note._id ?? '')
      if (!key || seen.has(key)) continue
      seen.add(key)
      merged.push(note)
    }
    for (const note of chapterPageAnnotations) {
      const key = note.clientKey ?? note.id ?? String(note._id ?? '')
      if (!key || seen.has(key)) continue
      seen.add(key)
      merged.push(note)
    }
    for (const note of pageNotes) {
      const key = note.clientKey ?? note.id ?? String(note._id ?? '')
      if (!key || seen.has(key)) continue
      seen.add(key)
      merged.push(note)
    }
    // Giữ lại tất cả notes, kể cả text rỗng/whitespace, để LayerCanvas vẫn hiển thị badge
    return merged
  }, [taskNotes, chapterPageAnnotations, pageNotes])

  // DEBUG: theo dõi note đến từ đâu, có toạ độ không
  useEffect(() => {
    console.debug('[NOTE-DEBUG] pageIdx=', pageIdx, 'taskNotesCount=', taskNotes.length, 'chapterAnnotationsCount=', chapterPageAnnotations.length, 'pageNotesCount=', pageNotes.length, 'allNotesCount=', allNotes.length)
    console.debug('[NOTE-DEBUG] chapter.revision_annotations raw =', chapter?.revision_annotations)
    console.debug('[NOTE-DEBUG] chapter.revision_notes_parsed =', chapter?.revision_notes_parsed)
    console.debug('[NOTE-DEBUG] allNotes =', allNotes.map(n => ({ id: n.id, source: n.source, x: n.x, y: n.y, w: n.w, h: n.h, taskType: n.taskType, text: n.text?.slice(0, 30) })))
  }, [pageIdx, taskNotes, chapterPageAnnotations, pageNotes, allNotes, chapter?.revision_annotations, chapter?.revision_notes_parsed])

  const layerNoteInfo = useMemo(() => buildLayerNote(layers, allNotes), [layers, allNotes])

  // Ưu tiên: URL từ chapter pages (loadChapterPages đã gọi sẵn).
  // Fallback: originalImage từ usePageLayers (chỉ khi page chưa có URL — trường hợp BE không trả URL trong page).
  const baseImage = safePage?.url ?? originalImage ?? null

  async function handleAddLayer(file) {
    if (!activePageId) {
      toast.error('Chưa có trang để thêm layer. Hãy chọn 1 trang trước.')
      return
    }
    // Auto-chuyển task: pending → in_progress khi upload layer đầu tiên
    if (layers.length === 0 && task?.status === 'pending') {
      try {
        const { tasksService } = await import('@/api/tasks.service.js')
        await tasksService.start(task.id)
        onSubmitted?.({ ...task, status: 'in_progress' })
        toast.success('Đã bắt đầu làm.')
      } catch {
        // Không block upload vì lỗi start không ảnh hưởng layer
      }
    }
    const nextIdx = layers.length
    await addLayer({ file, index: nextIdx })
  }

  async function handleUploadVersion(layerId, file) {
    const target = layerNoteInfo?.layer
    const note = target && target.id === layerId
      ? layerNoteInfo.note?.content ?? layerNoteInfo.note?.text ?? ''
      : ''
    await uploadNewVersion(layerId, { file, note })
  }

  /**
   * GỬI cả chapter cho Mangaka (không gộp lại).
   * BE tự lấy page.result_image_url (nếu đã gộp) hoặc page.original_image_url.
   * Page nào chưa gộp → BE tự fallback về ảnh gốc.
   */
  async function handleSubmitChapter({ chapterTaskId, chapterId }) {
    if (!chapterId) {
      toast.error('Không tìm thấy chapterId — không thể gửi.')
      return
    }
    setSubmittingAll(true)
    try {
      toast.info('Đang gửi chapter cho Mangaka…')
      const { tasksService } = await import('@/api/tasks.service.js')
      const { apiTaskToUi } = await import('@/utils/apiMappers.js')
      // Không truyền files → BE tự dùng result_image_url / original_image_url
      const updated = await tasksService.submitChapter(chapterId, null)
      const newTask = apiTaskToUi(updated)
      // Mark tất cả pages đã gửi
      const submittedIds = pages.map(p => p?.id).filter(Boolean)
      setSubmittedPages(prev => {
        const next = { ...prev }
        submittedIds.forEach(id => { next[id] = true })
        return next
      })
      toast.success(`Đã gửi ${submittedIds.length} trang cho Mangaka.`)
      onSubmitted?.(newTask)
    } catch (err) {
      console.error('[handleSubmitChapter] submit failed:', err)
      toast.error(getApiErrorMessage(err, 'Gửi chapter thất bại.'))
    } finally {
      setSubmittingAll(false)
    }
  }

  const baseFileName = `${chapter?.seriesTitle ?? ''}-Ch${chapter?.chapterNum ?? ''}`

  return (
    <div className={cn(
      'relative flex h-full flex-col overflow-hidden rounded-2xl bg-[#0f0f1a]',
      'border border-white/5',
      fullscreen ? 'rounded-none border-none' : 'shadow-xl shadow-slate-900/20',
    )}>
      {/* ── TOPBAR ── */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/5 bg-[#0f0f1a]/95 px-4 py-2 backdrop-blur">
        {/* Left: icon + title */}
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-md shadow-violet-500/20">
            <Sparkles className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold tracking-tight text-white/90">
              {chapter?.seriesTitle} · Ch.{chapter?.chapterNum}
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-white/40">
              <span>
                <span className="font-medium text-white/60">
                  Trang {safeIdx + 1} / {pages.length}
                </span>
                {pages.length > 1 && (
                  <div className="mt-1 flex items-center gap-1">
                    {pages.map((page, i) => {
                      const pid = page?.id ?? page?._id
                      const isSubmitted = pid ? !!submittedPages[pid] : false
                      const isFinalized = pid ? !!finalizedPages[pid] : false
                      const isCurrent = i === safeIdx
                      return (
                        <button
                          key={pid ?? i}
                          type="button"
                          onClick={() => setPageIdx(i)}
                          title={`Trang ${i + 1}${isSubmitted ? ' — đã gửi' : isFinalized ? ' — đã gộp' : ''}`}
                          className={cn(
                            'size-2 shrink-0 rounded-full transition-all',
                            isCurrent
                              ? 'scale-125 bg-white ring-2 ring-white/40'
                              : isSubmitted
                                ? 'bg-emerald-400'
                                : isFinalized
                                  ? 'bg-violet-400'
                                  : 'bg-white/20 hover:bg-white/40',
                          )}
                        />
                      )
                    })}
                  </div>
                )}
              </span>
              <span className="text-white/20">·</span>
              <span>
                <span className="font-semibold text-violet-400">{layers.length}</span>{' '}
                layer{layers.length !== 1 ? 's' : ''}
              </span>
              {finalImage && (
                <>
                  <span className="text-white/20">·</span>
                  <span className="inline-flex items-center gap-1 font-medium text-emerald-400">
                    <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
                    đã gộp
                  </span>
                </>
              )}
              {submittedPages[activePageId] && (
                <>
                  <span className="text-white/20">·</span>
                  <span className="inline-flex items-center gap-1 font-medium text-emerald-300">
                    ✓ đã gửi Mangaka
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Center: page nav */}
        <div className="flex shrink-0 items-center gap-1.5">
          <div className="flex items-center rounded-xl border border-white/10 bg-white/5 p-0.5 backdrop-blur">
            <Button
              size="icon-sm"
              variant="ghost"
              className="size-7 rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
              disabled={safeIdx <= 0}
              onClick={() => setPageIdx(i => Math.max(0, i - 1))}
              title="Trang trước"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-[3.5rem] px-2 text-center text-xs font-bold tabular-nums text-white/80">
              {safeIdx + 1} / {pages.length}
            </span>
            <Button
              size="icon-sm"
              variant="ghost"
              className="size-7 rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
              disabled={safeIdx >= pages.length - 1}
              onClick={() => setPageIdx(i => Math.min(pages.length - 1, i + 1))}
              title="Trang sau"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <div className="mx-1 h-6 w-px bg-white/10" />

          <Button
            size="sm"
            variant={showOriginal ? 'secondary' : 'ghost'}
            className={cn(
              'h-8 gap-1.5 px-2.5 text-xs font-medium',
              showOriginal
                ? 'border border-violet-500/40 bg-violet-500/20 text-violet-300 hover:bg-violet-500/30'
                : 'text-white/50 hover:bg-white/10 hover:text-white/80',
            )}
            onClick={() => setShowOriginal(v => !v)}
          >
            {showOriginal ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
            Gốc
          </Button>

          {task?.region && (
            <Button
              size="sm"
              variant={showRegionOverlay ? 'secondary' : 'ghost'}
              className={cn(
                'h-8 gap-1.5 px-2.5 text-xs font-medium',
                showRegionOverlay
                  ? 'border border-violet-500/40 bg-violet-500/20 text-violet-300 hover:bg-violet-500/30'
                  : 'text-white/50 hover:bg-white/10 hover:text-white/80',
              )}
              onClick={() => setShowRegionOverlay(v => !v)}
            >
              <span className="inline-block size-2 rounded-sm bg-violet-500" />
              Vùng
            </Button>
          )}

          <Button
            size="sm"
            variant={showNoteOverlay ? 'secondary' : 'ghost'}
            className={cn(
              'h-8 gap-1.5 px-2.5 text-xs font-medium',
              showNoteOverlay
                ? 'border border-amber-500/40 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                : 'text-white/50 hover:bg-white/10 hover:text-white/80',
            )}
            onClick={() => setShowNoteOverlay(v => !v)}
          >
            {showNoteOverlay ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
            {showNoteOverlay ? 'Ẩn Note' : 'Hiện Note'}
          </Button>

          <div className="mx-1 h-6 w-px bg-white/10" />

          <Button
            size="icon-sm"
            variant="ghost"
            className="size-8 text-white/50 hover:bg-white/10 hover:text-white"
            onClick={() => {
              const url = safePage?.url
              if (!url) return
              const a = document.createElement('a')
              a.href = url
              a.download = `${baseFileName}-p${safeIdx + 1}.png`
              document.body.appendChild(a)
              a.click()
              document.body.removeChild(a)
              toast.success('Đã tải ảnh gốc.')
            }}
            disabled={!safePage?.url}
            title="Tải ảnh gốc"
          >
            <ArrowDownToLine className="size-3.5" />
          </Button>

          {finalImage && (
            <Button
              size="icon-sm"
              variant="ghost"
              className="size-8 text-white/50 hover:bg-white/10 hover:text-white"
              onClick={() => {
                const a = document.createElement('a')
                a.href = finalImage
                a.download = `${baseFileName}-p${safeIdx + 1}-final.png`
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                toast.success('Đã tải ảnh gộp.')
              }}
              title="Tải ảnh gộp"
            >
              <FileDown className="size-3.5" />
            </Button>
          )}

          <Button
            size="icon-sm"
            variant="ghost"
            className={cn(
              'size-8 text-white/50 hover:bg-white/10 hover:text-white',
              loading && 'animate-spin',
            )}
            onClick={() => { refresh(); loadNotes() }}
            title="Làm mới"
          >
            <RefreshCw className="size-4" />
          </Button>

          <Button
            size="icon-sm"
            variant="ghost"
            className="size-8 text-white/50 hover:bg-white/10 hover:text-white"
            onClick={() => {
              setLightboxImage(finalImage || baseImage)
              setLightboxTitle(`Trang ${safeIdx + 1} · ${layers.length} layer`)
            }}
            disabled={!baseImage && !finalImage}
            title="Phóng to ảnh"
          >
            <Maximize2 className="size-4" />
          </Button>
        </div>
      </header>

      {/* ── REVISION BANNER ── */}
      {layerNoteInfo && (
        <div className="mx-4 mt-3 shrink-0">
          <Alert className="border-amber-500/30 bg-amber-500/10">
            <AlertDescription className="flex items-start gap-2 text-xs text-amber-200">
              <span className="shrink-0 rounded-md bg-amber-500/30 px-1.5 py-0.5 font-semibold text-amber-200">
                Sửa layer #{layerNoteInfo.layer.index}
                {layerNoteInfo.layer.name ? ` (${layerNoteInfo.layer.name})` : ''}
              </span>
              <span className="text-amber-200/80">
                {layerNoteInfo.note.content ?? layerNoteInfo.note.text ?? '(không có nội dung)'}
              </span>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* ── MAIN AREA: canvas + sidebar ── */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Canvas side — scrollable if canvas is taller than available space */}
        <div className="flex min-h-0 flex-1 flex-col overflow-auto bg-[#0f0f0f]">
          {/* Lightbox trigger */}
          {(baseImage || finalImage) && (
            <button
              type="button"
              className="absolute right-4 top-4 z-20 inline-flex size-9 items-center justify-center rounded-2xl border border-white/10 bg-black/60 text-white/60 shadow-xl backdrop-blur-md transition-all hover:scale-105 hover:bg-black/80 hover:text-white"
              style={{ top: layerNoteInfo ? '72px' : '16px' }}
              onClick={() => {
                setLightboxImage(finalImage || baseImage)
                setLightboxTitle(`Trang ${safeIdx + 1} · ${layers.length} layer`)
              }}
              title="Phóng to"
            >
              <Maximize2 className="size-4" />
            </button>
          )}

          {/* Canvas container — fills available space, canvas scales to fit */}
          <div
            className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto p-3"
          >
            {/* Aspect-ratio box so canvas keeps 960×1360 ratio when scaled */}
            <div
              className="relative w-full overflow-hidden rounded-sm shadow-2xl shadow-black/60 ring-1 ring-white/10"
              style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}
            >
              {/* Layer canvas — ảnh gốc được vẽ làm nền, layers xếp đè lên */}
              <LayerCanvas
                layers={layers}
                width={CANVAS_W}
                height={CANVAS_H}
                mode="edit"
                fullscreen={fullscreen}
                baseImage={showOriginal ? baseImage : null}
                className="absolute inset-0 h-full w-full"
                region={task?.region ?? null}
                notes={allNotes}
                showRegion={showRegionOverlay}
                showNotes={showNoteOverlay}
              />
            </div>
          </div>

          {/* Bottom toolbar */}
          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-white/5 bg-[#0f0f1a]/95 px-4 py-2 backdrop-blur">
            <div className="flex items-center gap-3">
              {(uploading || notesLoading || finalizing) && (
                <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-white/60 backdrop-blur">
                  <Loader2 className="h-3 w-3 animate-spin text-violet-400" />
                  {uploading ? 'Đang upload layer…' : finalizing ? 'Đang gộp ảnh…' : 'Đang tải ghi chú…'}
                </div>
              )}
              {pages.length > 1 && (
                <span className="text-[11px] text-white/30">
                  {pages.length} trang trong chapter
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
                {layers.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className={cn(
                      'h-8 gap-1.5 border px-3 text-xs font-medium',
                      submittedPages[activePageId]
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                        : finalImage
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                          : 'border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 hover:border-violet-500/50',
                    )}
                    onClick={handleFinalize}
                    disabled={finalizing}
                    title={submittedPages[activePageId] ? 'Trang đã gửi rồi' : ''}
                  >
                    {finalizing ? (
                      <><Loader2 className="size-3.5 animate-spin" /> Đang gộp…</>
                    ) : submittedPages[activePageId] ? (
                      <><Eye className="size-3.5" /> Đã gửi</>
                    ) : finalImage ? (
                      <><LayersIcon className="size-3.5" /> Gộp lại</>
                    ) : (
                      <><LayersIcon className="size-3.5" /> Gộp layer</>
                    )}
                  </Button>
                )}
                {/* Button "Gửi Mangaka" — nộp cả chapter, BE tự dùng result_image_url đã gộp */}
                <Button
                  size="sm"
                  className={cn(
                    'h-8 gap-1.5 px-4 text-xs font-semibold shadow-lg',
                    submittedPages[activePageId]
                      ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-500/50'
                      : 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-violet-500/20 hover:from-violet-500 hover:to-indigo-500',
                  )}
                  disabled={submittingAll || finalizing || pages.length === 0 || task?.status === 'submitted'}
                  onClick={() => handleSubmitChapter({ chapterTaskId: chapter?._task?.id, chapterId: chapter?.chapterId })}
                >
                  {submittingAll ? (
                    <><Loader2 className="size-3.5 animate-spin" /> Đang gửi {pages.length} trang…</>
                  ) : task?.status === 'submitted' || submittedPages[activePageId] ? (
                    <><Eye className="size-3.5" /> Đã gửi</>
                  ) : (
                    <><Send className="size-3.5" /> Gửi Mangaka</>
                  )}
                </Button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="flex w-96 shrink-0 flex-col border-l border-white/5 bg-[#0f0f1a]">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {/* Final image preview — dùng URL cache theo pageId, fallback sang finalImage */}
            {(finalImagesByPage[activePageId] || finalImage) && (
              <div className="border-b border-white/5 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex size-6 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
                      <ImageIcon className="size-3" />
                    </div>
                    <span className="text-xs font-semibold text-white/80">Ảnh gộp</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                      sẵn sàng
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setLightboxImage(finalImagesByPage[activePageId] || finalImage)
                        setLightboxTitle(`Ảnh gộp trang ${safeIdx + 1}`)
                      }}
                      className="inline-flex size-6 items-center justify-center rounded-md text-white/40 transition-colors hover:bg-white/10 hover:text-white"
                      title="Phóng to"
                    >
                      <Maximize2 className="size-3" />
                    </button>
                  </div>
                </div>
                <div
                  className="group/final relative cursor-pointer overflow-hidden rounded-xl border border-white/10 bg-white/5 transition-shadow hover:shadow-lg hover:shadow-violet-500/10"
                  onClick={() => {
                    setLightboxImage(finalImagesByPage[activePageId] || finalImage)
                    setLightboxTitle(`Ảnh gộp trang ${safeIdx + 1}`)
                  }}
                >
                  <img
                    src={finalImagesByPage[activePageId] || finalImage}
                    alt="Final"
                    className="block h-28 w-full object-contain transition-transform duration-300 group-hover/final:scale-[1.03]"
                    style={{ background: 'rgba(255,255,255,0.03)' }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover/final:bg-black/20">
                    <div className="flex items-center gap-1 rounded-full border border-white/20 bg-black/60 px-2 py-1 text-[10px] font-medium text-white opacity-0 backdrop-blur transition-opacity group-hover/final:opacity-100">
                      <Maximize2 className="size-3" />
                      Xem phóng to
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Layer stack — scrollable */}
            <div className="self-start w-full">
              <LayerStackPanel
                layers={layers}
                versions={versions}
                loading={loading}
                uploading={uploading}
                finalizing={finalizing}
                finalImage={finalImage}
                onAddLayer={handleAddLayer}
                onUpdateLayer={updateLayer}
                onDeleteLayer={deleteLayer}
                onUploadVersion={handleUploadVersion}
                onRollback={rollback}
                onLoadVersions={loadVersions}
                onReorder={reorderLayers}
                onFinalize={finalize}
                canEdit
                className="rounded-none border-0 bg-transparent p-3"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── LIGHTBOX ── */}
      {lightboxImage && (
        <ImageLightbox
          src={lightboxImage}
          alt={lightboxTitle}
          title={lightboxTitle}
          onClose={() => { setLightboxImage(null); setLightboxTitle('') }}
        />
      )}
    </div>
  )
}
