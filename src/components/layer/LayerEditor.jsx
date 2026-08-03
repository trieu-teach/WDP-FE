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
import { apiNoteToUi, apiTaskToUi, buildChapterPageAnnotations, mergeMangakaNoteLists, parsePageNotesResponse, filterSpatialMangakaNotes, keepLatestRevisionNotes, sortPagesByNumber } from '@/utils/apiMappers.js'
import { chaptersService } from '@/api/chapters.service.js'
import { tasksService } from '@/api/tasks.service.js'
import { getApiErrorMessage, resolveMediaUrl } from '@/api/http.js'
import { normalizeResultImageUrl, dedupeTasksByPage, sortTasksByPage, listTasksMissingResultImage, formatSubmitAllAssistantError } from '@/utils/chapterTaskFlow.js'
import {
  filterOutDoneMangakaNotes,
  mangakaNoteDoneKeysFor,
  readDoneMangakaNoteKeys,
  writeDoneMangakaNoteKeys,
} from '@/utils/assistantMangakaNotesDone.js'
import { cn } from '@/lib/utils'
import LayerCanvas from './LayerCanvas.jsx'
import MangakaNoteOverlay from './MangakaNoteOverlay.jsx'
import MangakaNotesPanel from './MangakaNotesPanel.jsx'
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

export default function LayerEditor({ chapter, pageId: pageIdProp, task: taskProp, onSubmitted, pages: pagesProp, fullscreen = false, onEnterFullscreen }) {
  const chapterPages = chapter?.pages ?? []
  const pages = pagesProp ?? chapterPages
  const sortedPages = useMemo(() => sortPagesByNumber(pages), [pages])
  const [pageIdx, setPageIdx] = useState(0)
  const [submittingAll, setSubmittingAll] = useState(false)
  const [showOriginal, setShowOriginal] = useState(true)
  const [showRegionOverlay, setShowRegionOverlay] = useState(true)
  const [showNoteOverlay, setShowNoteOverlay] = useState(true)
  const [doneNoteKeys, setDoneNoteKeys] = useState(() => new Set())
  const [lightboxImage, setLightboxImage] = useState(null)
  const [lightboxTitle, setLightboxTitle] = useState('')
  const [downloadingImage, setDownloadingImage] = useState(null) // 'original' | 'merged' | null
  // Track trang nào đã có ảnh gộp (finalized) và đã gửi cho Mangaka
  const [finalizedPages, setFinalizedPages] = useState({})   // pageId → true
  const [submittedPages, setSubmittedPages] = useState({})  // pageId → true
  // Cache ảnh gộp (URL) cho từng page, để hiển thị ngay sau khi gộp
  const [finalImagesByPage, setFinalImagesByPage] = useState({})  // pageId → url
  const [tasksByPageId, setTasksByPageId] = useState({})  // pageId → task UI

  const taskFromProp = taskProp ? (typeof taskProp === 'object' ? apiTaskToUi(taskProp) : null) : null
  const chapterId = chapter?.chapterId ?? chapter?.id ?? chapter?._id ?? null

  const safeIdx = Math.min(Math.max(0, pageIdx), Math.max(0, sortedPages.length - 1))
  const safePage = sortedPages[safeIdx] ?? null
  const activePageId = safePage?.id ?? safePage?._id ?? pageIdProp ?? null

  const fallbackTask = chapter?._task ?? taskFromProp
  const activeTask = tasksByPageId[String(activePageId)] ?? fallbackTask ?? null
  const taskNotes = activeTask?.noteIds ?? []

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
      const url = normalizeResultImageUrl(await finalize())
      setFinalizedPages(prev => ({ ...prev, [activePageId]: true }))
      if (url) {
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

  // Load task theo page — Assistant: GET /tasks/my-assignments?chapter_id=
  useEffect(() => {
    if (!chapterId) return
    let cancelled = false
    tasksService.getAssignmentsByChapter(chapterId)
      .then((raw) => {
        if (cancelled) return
        const list = dedupeTasksByPage(
          (Array.isArray(raw) ? raw : []).map(apiTaskToUi),
        )
        const map = {}
        const submitted = {}
        for (const t of list) {
          if (t.pageId) {
            map[String(t.pageId)] = t
            if (['submitted', 'in_review', 'approved'].includes(t.status)) {
              submitted[String(t.pageId)] = true
            }
          }
        }
        setTasksByPageId(map)
        if (Object.keys(submitted).length) {
          setSubmittedPages((prev) => ({ ...prev, ...submitted }))
        }
      })
      .catch(() => { if (!cancelled) setTasksByPageId({}) })
    return () => { cancelled = true }
  }, [chapterId])

  // Đánh dấu trang đã có resultUrl từ BE
  useEffect(() => {
    const nextFinal = {}
    const nextImages = {}
    for (const p of pages) {
      const pid = p?.id ?? p?._id
      if (!pid) continue
      if (p.resultUrl) {
        nextFinal[pid] = true
        nextImages[pid] = p.resultUrl
      }
    }
    if (Object.keys(nextFinal).length) {
      setFinalizedPages((prev) => ({ ...prev, ...nextFinal }))
      setFinalImagesByPage((prev) => ({ ...prev, ...nextImages }))
    }
  }, [pages])

  const [pageNotes, setPageNotes] = useState([])
  const [notesPageMeta, setNotesPageMeta] = useState(null)
  const [notesLoading, setNotesLoading] = useState(false)

  const chapterPageAnnotations = useMemo(
    () => buildChapterPageAnnotations(chapter, safeIdx, sortedPages),
    [chapter, safeIdx, sortedPages],
  )

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

    // 3. Notes từ API /pages/:id/notes — luôn gọi để chắc chắn note có trong DB hiện lên
    if (activePageId) {
      setNotesLoading(true)
      try {
        const revisionRound =
          safePage?.current_version
          ?? safePage?.currentVersion
          ?? notesPageMeta?.current_version
          ?? 1
        const isRevisionFlow = activeTask?.status === 'revision'
        const notesQuery = isRevisionFlow
          ? { note_kind: 'revision', revision_round: revisionRound }
          : { note_kind: 'brief' }
        let res = await chaptersService.getPageNotes(activePageId, notesQuery).catch((err) => {
          if (import.meta.env.DEV) {
            console.warn('[LayerEditor.loadNotes] GET notes failed', { pageId: activePageId, notesQuery, err })
          }
          return null
        })
        let { page: notesPage, notes: apiNotes } = parsePageNotesResponse(res)
        if (!apiNotes.length && notesQuery.note_kind) {
          res = await chaptersService.getPageNotes(activePageId).catch((err) => {
            if (import.meta.env.DEV) {
              console.warn('[LayerEditor.loadNotes] GET notes fallback failed', { pageId: activePageId, err })
            }
            return null
          })
          const fallback = parsePageNotesResponse(res)
          notesPage = fallback.page ?? notesPage
          apiNotes = fallback.notes
        }
        setNotesPageMeta(notesPage)
        if (import.meta.env.DEV) {
          console.debug('[LayerEditor.loadNotes] /pages/:id/notes', {
            pageId: activePageId,
            count: apiNotes.length,
            sample: apiNotes[0],
            originalUrl: notesPage?.original_image_url,
          })
        }
        results.push(...apiNotes)
      } finally {
        setNotesLoading(false)
      }
    }

    setPageNotes(mergeMangakaNoteLists(results))
  }

  useEffect(() => {
    setNotesPageMeta(null)
  }, [activePageId])

  useEffect(() => {
    void loadNotes()
  }, [
    activePageId,
    safeIdx,
    taskNotes.length,
    chapterPageAnnotations.length,
    activeTask?.status,
    activeTask?.id,
    chapter?.revision_annotations,
    chapter?.revision_notes_parsed,
  ])

  // 3 nguồn giữ nguyên; merge theo vùng để cùng 1 ô Mangaka không nhân bản khi khác id
  const allNotes = useMemo(() => {
    const taskList = taskNotes.map(n => ({
      ...n,
      source: n.source ?? 'taskNotes',
      clientKey: n.clientKey ?? (n.id ? String(n.id) : undefined),
    }))
    const chapterList = chapterPageAnnotations.map(n => ({
      ...n,
      source: n.source ?? 'chapterAnnotations',
    }))
    return keepLatestRevisionNotes(
      mergeMangakaNoteLists(pageNotes, taskList, chapterList),
    )
  }, [taskNotes, chapterPageAnnotations, pageNotes])

  const overlayNotes = useMemo(
    () => filterSpatialMangakaNotes(allNotes),
    [allNotes],
  )

  // Ẩn note đã đánh dấu hoàn thành (list + overlay) — không đổi 3 nguồn load
  const visibleOverlayNotes = useMemo(
    () => filterOutDoneMangakaNotes(overlayNotes, doneNoteKeys),
    [overlayNotes, doneNoteKeys],
  )

  useEffect(() => {
    setDoneNoteKeys(readDoneMangakaNoteKeys(chapterId, activePageId))
  }, [chapterId, activePageId])

  function markMangakaNoteDone(note) {
    const keys = mangakaNoteDoneKeysFor(note)
    if (!keys.length) return
    setDoneNoteKeys((prev) => {
      const next = new Set(prev)
      for (const k of keys) next.add(k)
      writeDoneMangakaNoteKeys(chapterId, activePageId, next)
      return next
    })
  }

  function restoreDoneMangakaNotes() {
    setDoneNoteKeys(() => {
      const next = new Set()
      writeDoneMangakaNoteKeys(chapterId, activePageId, next)
      return next
    })
  }

  // DEBUG: theo dõi note đến từ đâu, có toạ độ không
  useEffect(() => {
    console.debug('[NOTE-DEBUG] pageIdx=', pageIdx, 'taskNotesCount=', taskNotes.length, 'chapterAnnotationsCount=', chapterPageAnnotations.length, 'pageNotesCount=', pageNotes.length, 'allNotesCount=', allNotes.length)
    console.debug('[NOTE-DEBUG] chapter.revision_annotations raw =', chapter?.revision_annotations)
    console.debug('[NOTE-DEBUG] chapter.revision_notes_parsed =', chapter?.revision_notes_parsed)
    console.debug('[NOTE-DEBUG] allNotes =', allNotes.map(n => ({ id: n.id, source: n.source, x: n.x, y: n.y, w: n.w, h: n.h, taskType: n.taskType, text: n.text?.slice(0, 30) })))
    console.debug('[NOTE-DEBUG] overlayNotes =', overlayNotes.map(n => ({ id: n.id, source: n.source, x: n.x, y: n.y, w: n.w, h: n.h })))
  }, [pageIdx, taskNotes, chapterPageAnnotations, pageNotes, allNotes, overlayNotes, chapter?.revision_annotations, chapter?.revision_notes_parsed])

  const layerNoteInfo = useMemo(() => buildLayerNote(layers, allNotes), [layers, allNotes])

  const notesOriginalUrl = notesPageMeta?.original_image_url
    ? resolveMediaUrl(notesPageMeta.original_image_url)
    : null

  // Ảnh gốc Mangaka — luôn hiện làm nền (khớp toạ độ % khi có note overlay)
  const mangakaReferenceImage = useMemo(() => (
    notesOriginalUrl
    || safePage?.originalUrl
    || safePage?.url
    || (originalImage ? resolveMediaUrl(originalImage) : null)
    || null
  ), [notesOriginalUrl, safePage, originalImage])

  const baseImage = showOriginal ? mangakaReferenceImage : null

  if (import.meta.env.DEV) {
    console.debug('[LayerEditor]', {
      pagesCount: pages.length,
      pageIdx,
      safeIdx,
      hasSafePage: !!safePage,
      safePageId: safePage?.id,
      safePageUrl: safePage?.url,
      originalImage,
      baseImage,
      layersCount: layers.length,
      activePageId,
    })
  }

  async function handleAddLayer(file) {
    if (!activePageId) {
      toast.error('Chưa có trang để thêm layer. Hãy chọn 1 trang trước.')
      return
    }
    // Auto-chuyển task: pending → in_progress khi upload layer đầu tiên
    if (layers.length === 0 && activeTask?.status === 'pending') {
      try {
        await tasksService.start(activeTask.id)
        setTasksByPageId((prev) => ({
          ...prev,
          [String(activePageId)]: { ...activeTask, status: 'in_progress' },
        }))
        onSubmitted?.({ ...activeTask, status: 'in_progress' })
        toast.success('Đã bắt đầu làm.')
      } catch {
        // Không block upload vì lỗi start không ảnh hưởng layer
      }
    }
    const nextIdx = layers.length
    await addLayer({ file, index: nextIdx })
    // Có chỉnh sửa tiếp → cho phép gộp & gửi lại
    clearSubmittedForActivePage()
  }

  function clearSubmittedForActivePage() {
    if (!activePageId) return
    setSubmittedPages((prev) => {
      if (!prev[activePageId]) return prev
      const next = { ...prev }
      delete next[activePageId]
      return next
    })
  }

  async function handleUploadVersion(layerId, file) {
    const target = layerNoteInfo?.layer
    const note = target && target.id === layerId
      ? layerNoteInfo.note?.content ?? layerNoteInfo.note?.text ?? ''
      : ''
    await uploadNewVersion(layerId, { file, note })
    // Có chỉnh sửa tiếp → cho phép gộp & gửi lại
    clearSubmittedForActivePage()
  }

  /**
   * LUỒNG 2 — Bước 3→6 (từng task) rồi Bước 7 submit-all-by-assistant.
   * Ảnh kết quả lấy từ finalize (URL) → PATCH upload-result, không POST multipart submit.
   */
  async function pushTaskResultUrl(pageTask, imageUrl) {
    if (!pageTask?.id) return null

    const absoluteUrl = normalizeResultImageUrl(imageUrl)
    if (!absoluteUrl) return null

    const alreadyOnServer = normalizeResultImageUrl(pageTask.resultImageUrl)
    if (
      ['submitted', 'in_review', 'approved'].includes(pageTask.status)
      && alreadyOnServer
    ) {
      return pageTask
    }

    if (pageTask.status === 'pending') {
      await tasksService.start(pageTask.id)
    }

    const raw = await tasksService.uploadResult(pageTask.id, absoluteUrl)
    const payload = raw?.data ?? raw
    return apiTaskToUi(payload?.task ?? payload)
  }

  function resolvePageTaskImageUrl(page, pageTask) {
    const pid = page?.id ?? page?._id
    const fromCache = pid ? finalImagesByPage[pid] : null
    return (
      normalizeResultImageUrl(fromCache)
      ?? normalizeResultImageUrl(page?.resultUrl)
      ?? normalizeResultImageUrl(pageTask?.resultImageUrl)
      ?? null
    )
  }

  async function handleSubmitChapter() {
    if (!chapterId) {
      toast.error('Không tìm thấy chapterId — không thể gửi.')
      return
    }
    setSubmittingAll(true)
    try {
      toast.info('Đang lưu kết quả từng task…')
      const raw = await tasksService.getAssignmentsByChapter(chapterId)
      const allTasks = (Array.isArray(raw) ? raw : []).map(apiTaskToUi)
      const tasksToSubmit = sortTasksByPage(allTasks)

      if (!tasksToSubmit.length) {
        toast.error('Không tìm thấy task nào cho chapter này.')
        return
      }

      const imageUrlByPageId = new Map()
      let uploadedCount = 0
      let alreadyDoneCount = 0

      for (const pageTask of tasksToSubmit) {
        const pid = pageTask.pageId ? String(pageTask.pageId) : null
        const page = pid
          ? pages.find((p) => String(p?.id ?? p?._id) === pid)
          : null
        const pageLabel = pageTask.pageNumber ?? page?.pageNumber ?? pageTask.id

        let imageUrl = pid ? imageUrlByPageId.get(pid) : null
        if (!imageUrl) {
          imageUrl = resolvePageTaskImageUrl(page, pageTask)
          if (!imageUrl) {
            const missing = listTasksMissingResultImage(tasksToSubmit, pages)
            const label = missing.length
              ? missing
                .filter((m) => m.pageNumber != null)
                .map((m) => `Trang ${m.pageNumber}`)
                .join(', ') || `Trang ${pageLabel}`
              : `Trang ${pageLabel}`
            toast.error(
              `${label} chưa gộp layer — hãy bấm "Gộp layer" trước khi gửi Mangaka.`,
            )
            return
          }
          if (pid) imageUrlByPageId.set(pid, imageUrl)
        }

        const alreadyOnServer = normalizeResultImageUrl(pageTask.resultImageUrl)
        if (
          ['submitted', 'in_review', 'approved'].includes(pageTask.status)
          && alreadyOnServer
        ) {
          uploadedCount += 1
          alreadyDoneCount += 1
          if (pid) setSubmittedPages((prev) => ({ ...prev, [pid]: true }))
          continue
        }

        if (alreadyOnServer) {
          uploadedCount += 1
          if (pid) setSubmittedPages((prev) => ({ ...prev, [pid]: true }))
          continue
        }

        const updated = await pushTaskResultUrl(pageTask, imageUrl)
        const savedUrl = normalizeResultImageUrl(updated?.resultImageUrl)
        if (!updated || !savedUrl) {
          toast.error(`Không lưu được ảnh cho task trang ${pageLabel}. Thử gộp layer lại.`)
          return
        }
        if (pid) {
          setTasksByPageId((prev) => ({ ...prev, [pid]: updated }))
          setSubmittedPages((prev) => ({ ...prev, [pid]: true }))
        }
        uploadedCount += 1
      }

      const refreshedRaw = await tasksService.getAssignmentsByChapter(chapterId)
      const refreshedTasks = (Array.isArray(refreshedRaw) ? refreshedRaw : []).map(apiTaskToUi)
      const stillMissing = listTasksMissingResultImage(refreshedTasks, pages)
      if (stillMissing.length) {
        const pageLabels = [...new Set(
          stillMissing.map((m) => m.pageNumber).filter((n) => n != null),
        )].sort((a, b) => Number(a) - Number(b))
        const pagesText = pageLabels.length
          ? pageLabels.map((n) => `Trang ${n}`).join(', ')
          : `${stillMissing.length} task`
        toast.error(
          `${stillMissing.length} task chưa có ảnh trên server (${pagesText}). `
          + 'Vào từng trang còn thiếu, bấm "Gộp layer" rồi thử lại.',
        )
        return
      }

      const freshlySubmitted = tasksToSubmit.length - alreadyDoneCount
      if (freshlySubmitted === 0) {
        toast.info('Chapter này đã được nộp trước đó — không cần gửi lại.')
        onSubmitted?.()
        return
      }

      toast.info('Đang nộp chapter cho Mangaka…')
      const submitRes = await tasksService.submitAllByAssistant(chapterId)
      const submittedTasks = submitRes?.data?.tasks ?? submitRes?.tasks ?? []
      const count = submittedTasks.length || uploadedCount

      for (const p of pages) {
        const pid = p?.id ?? p?._id
        if (pid) setSubmittedPages((prev) => ({ ...prev, [pid]: true }))
      }

      toast.success(
        submitRes?.message ?? `Đã nộp ${count} task cho Mangaka.`,
      )
      onSubmitted?.()
    } catch (err) {
      console.error('[handleSubmitChapter] submit failed:', err)
      toast.error(formatSubmitAllAssistantError(err, pages))
    } finally {
      setSubmittingAll(false)
    }
  }

  const baseFileName = `${chapter?.seriesTitle ?? ''}-Ch${chapter?.chapterNum ?? ''}`

  const handleDownloadImage = useCallback(async (type) => {
    if (!activePageId) return
    setDownloadingImage(type)
    try {
      const suffix = type === 'merged' ? '-final' : ''
      const fallbackFilename = `${baseFileName}-p${safeIdx + 1}${suffix}.png`
      await layersService.downloadPageImage(activePageId, type, fallbackFilename)
      toast.success(type === 'merged' ? 'Đã tải ảnh gộp.' : 'Đã tải ảnh gốc.')
    } catch (err) {
      toast.error(getApiErrorMessage(
        err,
        type === 'merged'
          ? 'Chưa có ảnh gộp — hãy bấm "Gộp layer" trước.'
          : 'Không tải được ảnh gốc.',
      ))
    } finally {
      setDownloadingImage(null)
    }
  }, [activePageId, baseFileName, safeIdx])

  return (
    <div className={cn(
      'relative flex h-full w-full flex-1 flex-col overflow-hidden bg-slate-950',
      fullscreen ? 'rounded-none border-none' : 'rounded-none border-0',
    )}>
      {/* ── TOOLBAR (single header — chapter meta + tools) ── */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-950/95 px-3 py-2 backdrop-blur-md sm:px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm shadow-indigo-900/40">
            <Sparkles className="size-3.5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight text-slate-100">
              {chapter?.seriesTitle}
              <span className="font-medium text-slate-400"> · Ch.{chapter?.chapterNum}</span>
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
              <span className="font-medium text-slate-400">
                Trang {safeIdx + 1}/{pages.length}
              </span>
              <span className="text-slate-700">·</span>
              <span>
                <span className="font-semibold text-indigo-400">{layers.length}</span> layer
              </span>
              {finalImage ? (
                <>
                  <span className="text-slate-700">·</span>
                  <span className="inline-flex items-center gap-1 font-medium text-emerald-400">
                    <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
                    đã gộp
                  </span>
                </>
              ) : null}
              {submittedPages[activePageId] ? (
                <>
                  <span className="text-slate-700">·</span>
                  <span className="font-medium text-emerald-300">✓ đã gửi</span>
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1">
          <div className="flex items-center rounded-lg border border-slate-700/80 bg-slate-900 p-0.5">
            <Button
              size="icon-sm"
              variant="ghost"
              className="size-7 rounded-md text-slate-400 hover:bg-slate-800 hover:text-slate-100"
              disabled={safeIdx <= 0}
              onClick={() => setPageIdx(i => Math.max(0, i - 1))}
              title="Trang trước"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-[3.25rem] px-1.5 text-center text-xs font-bold tabular-nums text-slate-200">
              {safeIdx + 1} / {pages.length}
            </span>
            <Button
              size="icon-sm"
              variant="ghost"
              className="size-7 rounded-md text-slate-400 hover:bg-slate-800 hover:text-slate-100"
              disabled={safeIdx >= pages.length - 1}
              onClick={() => setPageIdx(i => Math.min(pages.length - 1, i + 1))}
              title="Trang sau"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <div className="mx-0.5 hidden h-6 w-px bg-slate-700 sm:block" />

          <Button
            size="sm"
            variant={showOriginal ? 'secondary' : 'ghost'}
            className={cn(
              'h-8 gap-1.5 px-2.5 text-xs font-medium',
              showOriginal
                ? 'border border-indigo-500/40 bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200',
            )}
            onClick={() => setShowOriginal(v => !v)}
          >
            {showOriginal ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
            Gốc
          </Button>

          {activeTask?.region && (
            <Button
              size="sm"
              variant={showRegionOverlay ? 'secondary' : 'ghost'}
              className={cn(
                'h-8 gap-1.5 px-2.5 text-xs font-medium',
                showRegionOverlay
                  ? 'border border-indigo-500/40 bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200',
              )}
              onClick={() => setShowRegionOverlay(v => !v)}
            >
              <span className="inline-block size-2 rounded-sm bg-indigo-500" />
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
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200',
            )}
            onClick={() => setShowNoteOverlay(v => !v)}
          >
            {showNoteOverlay ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
            {showNoteOverlay ? 'Ẩn Note' : 'Hiện Note'}
          </Button>

          <div className="mx-0.5 hidden h-6 w-px bg-slate-700 sm:block" />

          <Button
            size="icon-sm"
            variant="ghost"
            className="size-8 text-slate-400 transition-all hover:bg-slate-800 hover:text-slate-100 active:scale-95"
            onClick={() => void handleDownloadImage('original')}
            disabled={!activePageId || downloadingImage === 'original'}
            title="Tải ảnh gốc"
          >
            {downloadingImage === 'original' ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <ArrowDownToLine className="size-3.5" />
            )}
          </Button>

          {finalImage && (
            <Button
              size="icon-sm"
              variant="ghost"
              className="size-8 text-slate-400 transition-all hover:bg-slate-800 hover:text-slate-100 active:scale-95"
              onClick={() => void handleDownloadImage('merged')}
              disabled={downloadingImage === 'merged'}
              title="Tải ảnh gộp"
            >
              {downloadingImage === 'merged' ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <FileDown className="size-3.5" />
              )}
            </Button>
          )}

          <Button
            size="icon-sm"
            variant="ghost"
            className={cn(
              'size-8 text-slate-400 hover:bg-slate-800 hover:text-slate-100',
              loading && 'animate-spin',
            )}
            onClick={() => { refresh(); loadNotes() }}
            title="Làm mới"
          >
            <RefreshCw className="size-4" />
          </Button>

          {!fullscreen && onEnterFullscreen ? (
            <Button
              size="icon-sm"
              variant="ghost"
              className="size-8 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
              onClick={onEnterFullscreen}
              title="Toàn màn hình"
            >
              <Maximize2 className="size-4" />
            </Button>
          ) : null}

          <Button
            size="icon-sm"
            variant="ghost"
            className="size-8 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            onClick={() => {
              setLightboxImage(finalImage || baseImage)
              setLightboxTitle(`Trang ${safeIdx + 1} · ${layers.length} layer`)
            }}
            disabled={!baseImage && !finalImage}
            title="Xem ảnh"
          >
            <ImageIcon className="size-4" />
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
        <div className="scrollbar-hide relative flex min-h-0 flex-1 flex-col overflow-auto bg-slate-900/80">
          {/* Canvas container — fills available space, canvas scales to fit */}
          <div
            className="scrollbar-hide relative flex min-h-0 flex-1 items-center justify-center overflow-auto p-3 pb-20"
          >
            {/* Aspect-ratio box so canvas keeps 960×1360 ratio when scaled */}
            <div
              className="relative w-full overflow-hidden rounded-lg shadow-2xl shadow-black/50 ring-1 ring-slate-700/70"
              style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}
            >
              {/* Layer canvas — ảnh gốc được vẽ làm nền, layers xếp đè lên */}
              <LayerCanvas
                layers={layers}
                width={CANVAS_W}
                height={CANVAS_H}
                mode="edit"
                fullscreen={fullscreen}
                baseImage={showOriginal ? mangakaReferenceImage : null}
                className="absolute inset-0 z-0 h-full w-full"
                region={activeTask?.region ?? null}
                notes={[]}
                showRegion={showRegionOverlay}
                showNotes={false}
                overlay={
                  <MangakaNoteOverlay notes={visibleOverlayNotes} visible={showNoteOverlay} />
                }
              />
            </div>
          </div>

          {/* Bottom toolbar */}
          <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center px-4">
            <div className="pointer-events-auto flex max-w-full flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-900/90 p-3 shadow-xl backdrop-blur-md">
              <div className="flex min-w-0 items-center gap-3">
                {(uploading || notesLoading || finalizing) && (
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-600 bg-slate-800/80 px-3 py-1 text-[11px] font-medium text-slate-300">
                    <Loader2 className="h-3 w-3 animate-spin text-indigo-400" />
                    {uploading ? 'Đang upload layer…' : finalizing ? 'Đang gộp ảnh…' : 'Đang tải ghi chú…'}
                  </div>
                )}
                {pages.length > 1 && (
                  <span className="hidden text-[11px] text-slate-500 sm:inline">
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
                      'h-9 gap-1.5 rounded-lg border px-3 text-xs font-medium',
                      finalImage
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                        : 'border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700',
                    )}
                    onClick={handleFinalize}
                    disabled={finalizing || submittedPages[activePageId]}
                    title={submittedPages[activePageId] ? 'Đã gửi — thêm layer để chỉnh sửa tiếp' : ''}
                  >
                    {finalizing ? (
                      <><Loader2 className="size-3.5 animate-spin" /> Đang gộp…</>
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
                    'h-9 gap-1.5 rounded-lg bg-indigo-600 px-5 text-xs font-medium text-white shadow-lg shadow-indigo-900/30',
                    'transition-all hover:bg-indigo-500',
                  )}
                  disabled={submittingAll || finalizing || pages.length === 0 || submittedPages[activePageId]}
                  onClick={() => void handleSubmitChapter()}
                  title={submittedPages[activePageId] ? 'Đã gửi — thêm layer để chỉnh sửa tiếp' : ''}
                >
                  {submittingAll ? (
                    <><Loader2 className="size-3.5 animate-spin" /> Đang nộp task…</>
                  ) : (
                    <><Send className="size-3.5" /> Gửi Mangaka</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="flex w-96 shrink-0 flex-col border-l border-slate-700/60 bg-slate-950">
          <div className="scrollbar-hide flex min-h-0 max-h-[calc(100vh-140px)] flex-1 flex-col overflow-y-auto">
            {/* Ghi chú Mangaka — chỉ UI đọc, dùng cùng overlayNotes (không đổi 3 nguồn load) */}
            <MangakaNotesPanel
              notes={visibleOverlayNotes}
              loading={notesLoading}
              doneCount={doneNoteKeys.size}
              onMarkDone={markMangakaNoteDone}
              onRestoreDone={restoreDoneMangakaNotes}
            />

            {/* Final image preview — dùng URL cache theo pageId, fallback sang finalImage */}
            {(finalImagesByPage[activePageId] || finalImage) && (
              <div className="border-b border-slate-700/60 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex size-6 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
                      <ImageIcon className="size-3" />
                    </div>
                    <span className="text-xs font-semibold text-slate-200">Ảnh gộp</span>
                  </div>
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                    sẵn sàng
                  </span>
                </div>
                <button
                  type="button"
                  className="group/final relative w-full cursor-pointer overflow-hidden rounded-xl border border-slate-700/60 bg-slate-800/50 text-left transition-all hover:border-slate-600 hover:bg-slate-800"
                  onClick={() => {
                    setLightboxImage(finalImagesByPage[activePageId] || finalImage)
                    setLightboxTitle(`Ảnh gộp trang ${safeIdx + 1}`)
                  }}
                  title="Xem ảnh gộp"
                >
                  <img
                    src={finalImagesByPage[activePageId] || finalImage}
                    alt="Final"
                    className="block h-28 w-full object-contain transition-transform duration-300 group-hover/final:scale-[1.03]"
                    style={{ background: 'rgba(255,255,255,0.03)' }}
                  />
                </button>
              </div>
            )}

            {/* Layer stack — scrollable */}
            <div className="w-full">
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
                onViewImage={(url) => {
                  setLightboxImage(url)
                  setLightboxTitle(`Ảnh gộp trang ${safeIdx + 1}`)
                }}
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
