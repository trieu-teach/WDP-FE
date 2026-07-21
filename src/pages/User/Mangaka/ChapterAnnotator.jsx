import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ChevronRight,
  Eraser,
  Image as ImageIcon,
  Maximize2,
  MousePointer2,
  PenSquare,
  Plus,
  Send,
  Square,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { LABEL_EDITOR_BOARD, LABEL_TANTOU_EDITOR } from '@/constants/roleTerminology.js'
import { NOTE_TASK_TYPES, noteTaskLabel } from '@/constants/workspaceTasks.js'
import { fileToStorableDataUrl } from '@/utils/mangakaWorkspaceStorage.js'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

function uid() {
  return `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function noteStableKey(note) {
  return note?.clientKey ?? note?.id ?? ''
}

/** Màu accent theo loại việc — dùng chung cho marker trên ảnh và card trong panel. */
const NOTE_TASK_COLOR = {
  background: '#0ea5e9',
  shading: '#8b5cf6',
  fx: '#f59e0b',
  other: '#71717a',
}

function noteTaskColor(type) {
  return NOTE_TASK_COLOR[type] ?? NOTE_TASK_COLOR.other
}

function displayChapterNum(baseStr, index) {
  const s = String(baseStr ?? '').trim()
  if (!s) return String(index + 1)
  const base = parseInt(s, 10)
  const isPureInt = Number.isFinite(base) && /^\d+$/.test(s)
  if (isPureInt) return base + index
  if (index === 0) return s
  return `${s}-${index + 1}`
}

function countChapterNotes(chapterId, pageList, notesMap) {
  return pageList.reduce(
    (sum, _, i) => sum + (notesMap[`${chapterId}-${i}`]?.length ?? 0),
    0,
  )
}

export default function ChapterAnnotator({
  selectedSeriesTitle,
  onSelectedSeriesTitleChange,
  seriesOptions = [],
  chapterNum,
  onChapterNumChange,
  chapterNumHint,
  chapters,
  setChapters,
  activeChapterId,
  setActiveChapterId,
  pageIndex,
  setPageIndex,
  notes,
  setNotes,
  hiredAssistants = [],
  onOpenAssistantsTab,
  onUploadProgress,
  onSendToAssistant,
  onSendToTantou,
  workspaceApi = null,
  pendingReviewCount = 0,
}) {
  const fileRef = useRef(null)
  const coverFileRef = useRef(null)
  const boardRef = useRef(null)
  const fsBoardRef = useRef(null)
  const noteSaveTimersRef = useRef({})
  const loadedNoteKeysRef = useRef(new Set())
  const draftTextRef = useRef(new Map())
  const noteTextareaRefs = useRef(new Map())

  const [drawStart, setDrawStart] = useState(null)
  const [drawCurrent, setDrawCurrent] = useState(null)
  const [selectedNoteId, setSelectedNoteId] = useState(null)
  const [tool, setTool] = useState('draw')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [uploadUi, setUploadUi] = useState(null)
  const [uploadRejectMessage, setUploadRejectMessage] = useState(null)
  const [sendAssistantId, setSendAssistantId] = useState('')
  const [sendingToAssistant, setSendingToAssistant] = useState(false)

  const activeChapter = chapters.find(c => c.id === activeChapterId)
  const pages = activeChapter?.pages ?? []
  const pageKey = activeChapter ? `${activeChapterId}-${pageIndex}` : ''
  const currentPageId = pages[pageIndex]?.id ?? null
  // Phòng thủ: chỉ gọi BE khi có ObjectId hợp lệ (24 ký tự hex).
  // Nếu page chưa sync _id từ BE (id là placeholder "page-X" hoặc rỗng), bỏ qua.
  const isValidObjectId = (id) => typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id)
  const pageNotes = notes[pageKey] ?? []

  useEffect(() => {
    if (!isFullscreen) return undefined
    const onKey = (e) => { if (e.key === 'Escape') setIsFullscreen(false) }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [isFullscreen])

  useEffect(() => {
    if (!uploadRejectMessage) return undefined
    const t = window.setTimeout(() => setUploadRejectMessage(null), 6000)
    return () => window.clearTimeout(t)
  }, [uploadRejectMessage])

  const deleteNote = useCallback(async (stableKey) => {
    const page = pages[pageIndex]
    const target = (notes[pageKey] ?? []).find(n => noteStableKey(n) === stableKey)
    if (workspaceApi?.deletePageNote && page?.id && target?.id) {
      try {
        await workspaceApi.deletePageNote(page.id, pageKey, target.id)
      } catch { /* local fallback below */ }
    }
    setNotes(prev => ({
      ...prev,
      [pageKey]: (prev[pageKey] ?? []).filter(n => noteStableKey(n) !== stableKey),
    }))
    setSelectedNoteId(prev => (prev === stableKey ? null : prev))
  }, [setNotes, pageKey, pages, pageIndex, workspaceApi, notes])

  useEffect(() => {
    function onKey(e) {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNoteId) {
        const tag = e.target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        e.preventDefault()
        deleteNote(selectedNoteId)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedNoteId, deleteNote])

  const seriesChapters = useMemo(() => {
    const trimmed = selectedSeriesTitle.trim()
    if (!trimmed) return []
    return chapters.filter(c => c.series === trimmed)
  }, [chapters, selectedSeriesTitle])

  const uploadTargetChapter = useMemo(
    () => chapters.find(c => c.id === activeChapterId && c.series === selectedSeriesTitle.trim()) ?? null,
    [chapters, activeChapterId, selectedSeriesTitle],
  )

  useEffect(() => {
    if (hiredAssistants.length === 1 && !sendAssistantId) {
      setSendAssistantId(String(hiredAssistants[0].assistantId))
    }
  }, [hiredAssistants, sendAssistantId])

  const persistNoteById = useCallback(async (stableKey) => {
    const page = pages[pageIndex]
    if (!workspaceApi?.savePageNote || !page?.id || !pageKey || !stableKey) return

    const draftValue = draftTextRef.current.get(stableKey)
    if (draftValue !== undefined) {
      setNotes(prev => ({
        ...prev,
        [pageKey]: (prev[pageKey] ?? []).map(n =>
          noteStableKey(n) === stableKey ? { ...n, text: draftValue } : n
        ),
      }))
      draftTextRef.current.delete(stableKey)
    }

    let noteSnapshot = null
    setNotes(prev => {
      noteSnapshot = (prev[pageKey] ?? []).find(n => noteStableKey(n) === stableKey) ?? null
      return prev
    })
    if (!noteSnapshot) return

    try {
      await workspaceApi.savePageNote(page.id, pageKey, noteSnapshot)
    } catch {
      /* giữ bản local, thử lại lần sau */
    }
  }, [pageIndex, pageKey, pages, workspaceApi, setNotes])

  const flushNotesBeforeSend = useCallback(async () => {
    for (const timerId of Object.values(noteSaveTimersRef.current)) {
      window.clearTimeout(timerId)
    }
    noteSaveTimersRef.current = {}

    for (const stableKey of [...draftTextRef.current.keys()]) {
      await persistNoteById(stableKey)
    }

    const snapshot = {}
    for (const [pk, list] of Object.entries(notes)) {
      snapshot[pk] = (list ?? []).map((n) => {
        const key = noteStableKey(n)
        const draft = draftTextRef.current.get(key)
        return draft !== undefined ? { ...n, text: draft } : n
      })
    }
    return snapshot
  }, [notes, persistNoteById])

  const scheduleNoteSave = useCallback((stableKey, currentText) => {
    if (!stableKey) return
    if (!currentText?.trim()) return
    clearTimeout(noteSaveTimersRef.current[stableKey])
    noteSaveTimersRef.current[stableKey] = window.setTimeout(() => {
      void persistNoteById(stableKey)
    }, 1500)
  }, [persistNoteById])

  useEffect(() => () => {
    Object.values(noteSaveTimersRef.current).forEach(t => window.clearTimeout(t))
    for (const [stableKey] of draftTextRef.current.entries()) {
      void persistNoteById(stableKey)
    }
  }, [persistNoteById])

  useEffect(() => {
    const trimmed = selectedSeriesTitle.trim()
    if (!trimmed) return
    const forSeries = chapters.filter(c => c.series === trimmed)
    if (!forSeries.length) {
      if (activeChapterId) setActiveChapterId(null)
      return
    }
    if (!forSeries.some(c => c.id === activeChapterId)) {
      setActiveChapterId(forSeries[0].id)
      setPageIndex(0)
      setSelectedNoteId(null)
    }
  }, [selectedSeriesTitle]) // eslint-disable-line react-hooks/exhaustive-deps

  const activateChapter = useCallback((ch, pageIdx = 0) => {
    setActiveChapterId(ch.id)
    setPageIndex(pageIdx)
    setSelectedNoteId(null)
  }, [setActiveChapterId, setPageIndex])

  const nextChapterNum = useMemo(() => {
    const trimmed = selectedSeriesTitle.trim()
    if (!trimmed) return 1
    const nums = chapters
      .filter(c => c.series === trimmed)
      .map(c => parseInt(String(c.num), 10))
      .filter(Number.isFinite)
    return nums.length === 0 ? 1 : Math.max(...nums) + 1
  }, [selectedSeriesTitle, chapters])

  const createNewChapter = useCallback(async () => {
    const trimmedSeries = selectedSeriesTitle.trim()
    if (!trimmedSeries) return

    const num = nextChapterNum
    const numKey = String(num)
    const existing = chapters.find(c => c.series === trimmedSeries && String(c.num) === numKey)
    if (existing) {
      activateChapter(existing, 0)
      return
    }

    const seriesMeta = seriesOptions.find(s => s.title === trimmedSeries)
    const assistantId = hiredAssistants.length === 1 ? String(hiredAssistants[0].assistantId) : null
    if (workspaceApi?.createChapter && seriesMeta?.id) {
      try {
        const ch = await workspaceApi.createChapter(seriesMeta.id, trimmedSeries, num, assistantId)
        setActiveChapterId(ch.id)
        setPageIndex(0)
        setSelectedNoteId(null)
        setUploadRejectMessage(null)
        onChapterNumChange?.(String(num + 1))
        return
      } catch (err) {
        const status = err?.response?.status
        if (status === 409) {
          setUploadRejectMessage('Chapter đã tồn tại — đang đồng bộ dữ liệu.')
          workspaceApi.refresh?.().catch(() => null)
        } else {
          setUploadRejectMessage('Không tạo được chapter — thử lại.')
        }
        return
      }
    }

    const createdAt = new Date().toLocaleDateString('vi-VN')
    const ch = { id: uid(), series: trimmedSeries, num, pages: [], createdAt }
    setChapters(prev => [ch, ...prev])
    setActiveChapterId(ch.id)
    setPageIndex(0)
    setSelectedNoteId(null)
    setUploadRejectMessage(null)
    onChapterNumChange?.(String(num + 1))
  }, [
    selectedSeriesTitle, nextChapterNum, chapters, setChapters, seriesOptions,
    setActiveChapterId, setPageIndex, onChapterNumChange, activateChapter, workspaceApi,
    hiredAssistants,
  ])

  const handleFiles = useCallback(async (files) => {
    if (!files?.length) return
    const trimmedSeries = selectedSeriesTitle.trim()
    if (!trimmedSeries) return

    setUploadRejectMessage(null)

    const target = chapters.find(
      c => c.id === activeChapterId && c.series === trimmedSeries,
    )
    if (!target) {
      setUploadRejectMessage('Chọn hoặc bấm "Tạo chapter" trước.')
      return
    }

    const seriesMeta = seriesOptions.find(s => s.title === trimmedSeries)
    const assistantId = hiredAssistants.length === 1 ? String(hiredAssistants[0].assistantId) : null

    const fileList = Array.from(files).filter(
      f => f.type.startsWith('image/') || f.name.match(/\.(png|jpe?g|webp)$/i),
    )
    if (!fileList.length) return

    const targetId = target.id
    const hasProgress = typeof onUploadProgress === 'function'
    const sleep = ms => new Promise(r => setTimeout(r, ms))
    const filesToAdd = fileList
    let newPages = []

    try {
      if (hasProgress) {
        onUploadProgress(trimmedSeries, 5)
        setUploadUi({ series: trimmedSeries, chapter: target.num, pct: 5 })
      }

      // Chapter chưa sync server → gộp tạo + upload thành 1 request (BE yêu cầu multipart)
      if (workspaceApi?.createChapterWithPages && seriesMeta?.id) {
        const isLocalChapter = !/^[0-9a-f]{24}$/i.test(targetId)
        if (isLocalChapter) {
          try {
            const ch = await workspaceApi.createChapterWithPages(
              seriesMeta.id, trimmedSeries, target.num, assistantId, filesToAdd,
            )
            setChapters(prev => prev.map(c => (c.id !== targetId ? c : ch)))
            setActiveChapterId(ch.id)
            setPageIndex(0)
            setUploadRejectMessage(null)
            if (hasProgress) onUploadProgress(trimmedSeries, 100)
            return
          } catch (err) {
            const status = err?.response?.status
            if (status === 409) {
              setUploadRejectMessage('Chapter đã tồn tại — đang đồng bộ dữ liệu.')
              workspaceApi.refresh?.().catch(() => null)
            } else {
              setUploadRejectMessage('Không tạo được chapter — thử lại.')
            }
            return
          }
        }
      }

      if (workspaceApi?.uploadChapterPages) {
        const uploadedPages = await workspaceApi.uploadChapterPages(targetId, filesToAdd)
        newPages = Array.isArray(uploadedPages) ? uploadedPages : []
        // Deduplicate theo id để chắc chắn không có page trùng (BE có thể trả về list đầy đủ)
        const seen = new Set()
        newPages = newPages.filter(p => {
          const k = p?.id ?? p?._id
          if (!k || seen.has(k)) return false
          seen.add(k)
          return true
        })
        setNotes(prev => {
          const next = { ...prev }
          const startIdx = target.pages.length
          for (let pi = 0; pi < newPages.length; pi++) {
            const key = `${targetId}-${startIdx + pi}`
            if (!next[key]) next[key] = []
          }
          return next
        })
      } else {
        for (let i = 0; i < filesToAdd.length; i++) {
          const url = await fileToStorableDataUrl(filesToAdd[i])
          newPages.push({ id: uid(), name: filesToAdd[i].name, url })
          if (hasProgress) {
            const pct = 10 + Math.round(((i + 1) / filesToAdd.length) * 80)
            setUploadUi({ series: trimmedSeries, chapter: target.num, pct })
            onUploadProgress(trimmedSeries, pct)
          }
        }
        const nextChapters = chapters.map(ch => (
          ch.id !== targetId ? ch : { ...ch, pages: [...ch.pages, ...newPages] }
        ))
        setChapters(nextChapters)
      }
    } catch {
      setUploadRejectMessage('Không upload được ảnh — thử lại.')
      setUploadUi(null)
      if (hasProgress) onUploadProgress(trimmedSeries, 0)
      return
    }

    if (hasProgress) {
      onUploadProgress(trimmedSeries, 100)
      await sleep(400)
      onUploadProgress(trimmedSeries, 0)
    }
    setUploadUi(null)
  }, [
    selectedSeriesTitle, activeChapterId, chapters, setChapters, setNotes,
    onUploadProgress, workspaceApi, seriesOptions, hiredAssistants,
  ])

  function onFileChange(e) {
    void handleFiles(e.target.files)
    e.target.value = ''
  }

  function onDrop(e) {
    e.preventDefault()
    void handleFiles(e.dataTransfer.files)
  }

  const handleCoverFile = useCallback(async (file) => {
    if (!file || !activeChapterId) return
    const ok = file.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(file.name)
    if (!ok) {
      setUploadRejectMessage('Ảnh bìa cần là PNG/JPG/WEBP.')
      return
    }
    try {
      const url = await fileToStorableDataUrl(file)
      setChapters(prev => prev.map(c => (c.id === activeChapterId ? { ...c, cover: { url, name: file.name } } : c)))
      setUploadRejectMessage(null)
    } catch {
      setUploadRejectMessage('Không đọc được ảnh bìa — thử lại.')
    }
  }, [activeChapterId, setChapters])

  function onCoverChange(e) {
    void handleCoverFile(e.target.files?.[0])
    e.target.value = ''
  }

  function onCoverDrop(e) {
    e.preventDefault()
    void handleCoverFile(e.dataTransfer.files?.[0])
  }

  const removeCover = useCallback(() => {
    if (!activeChapterId) return
    setChapters(prev => prev.map(c => (c.id === activeChapterId ? { ...c, cover: null } : c)))
  }, [activeChapterId, setChapters])

  const deleteChapter = useCallback((chapterId) => {
    if (!chapterId) return
    const target = chapters.find(c => c.id === chapterId)
    if (!target) return
    const label = `Ch. ${target.num}${target.pages.length ? ` (${target.pages.length} trang)` : ''}`
    if (typeof window !== 'undefined' && !window.confirm(`Xóa ${label}? Hành động không thể hoàn tác.`)) return

    setChapters(prev => prev.filter(c => c.id !== chapterId))
    setNotes(prev => {
      const next = {}
      for (const k of Object.keys(prev)) {
        if (!k.startsWith(`${chapterId}-`)) next[k] = prev[k]
      }
      return next
    })
    if (activeChapterId === chapterId) {
      setActiveChapterId(null)
      setPageIndex(0)
      setSelectedNoteId(null)
    }
  }, [chapters, activeChapterId, setChapters, setNotes, setActiveChapterId, setPageIndex])

  function getPercent(e, ref) {
    const el = ref?.current
    if (!el) return { x: 0, y: 0 }
    const rect = el.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) }
  }

  function onNoteClick(e, stableKey) {
    e.stopPropagation()
    if (tool === 'delete') {
      deleteNote(stableKey)
      return
    }
    setSelectedNoteId(stableKey)
    setTool('select')
  }

  function onBoardMouseDown(e, ref) {
    if (!activeChapter) return
    if (tool === 'delete') { setSelectedNoteId(null); return }
    if (tool !== 'draw') return
    const pt = getPercent(e, ref)
    setDrawStart(pt)
    setDrawCurrent(pt)
    setSelectedNoteId(null)
  }

  function onBoardMouseMove(e, ref) {
    if (!drawStart) return
    setDrawCurrent(getPercent(e, ref))
  }

  function onBoardMouseUp() {
    if (!drawStart || !drawCurrent) return
    const x = Math.min(drawStart.x, drawCurrent.x)
    const y = Math.min(drawStart.y, drawCurrent.y)
    const w = Math.abs(drawCurrent.x - drawStart.x)
    const h = Math.abs(drawCurrent.y - drawStart.y)
    setDrawStart(null)
    setDrawCurrent(null)
    if (w < 2 || h < 2) return

    const clientKey = uid()
    const newNote = {
      id: clientKey,
      clientKey,
      x,
      y,
      w,
      h,
      text: '',
      taskType: 'background',
      assignee: '',
    }
    setNotes(prev => ({
      ...prev,
      [pageKey]: [...(prev[pageKey] ?? []), newNote],
    }))
    setSelectedNoteId(clientKey)
    // Lưu ngay lên BE (kể cả khi text rỗng) để giữ toạ độ x,y,w,h cho Assistant
    void persistNoteById(clientKey)
  }

  function updateNoteField(stableKey, field, value) {
    if (field === 'text') {
      draftTextRef.current.set(stableKey, value)
      setDraftText(prev => ({ ...prev, [stableKey]: value }))
    } else {
      setNotes(prev => ({
        ...prev,
        [pageKey]: (prev[pageKey] ?? []).map(n => (
          noteStableKey(n) === stableKey ? { ...n, [field]: value } : n
        )),
      }))
    }
    scheduleNoteSave(stableKey, field === 'text' ? value : undefined)
  }

  useEffect(() => {
    return () => {
      for (const [stableKey] of draftTextRef.current.entries()) {
        if (noteSaveTimersRef.current[stableKey]) {
          window.clearTimeout(noteSaveTimersRef.current[stableKey])
        }
        void persistNoteById(stableKey)
      }
    }
  }, [pageKey, persistNoteById])

  useEffect(() => {
    if (!activeChapterId || !workspaceApi?.loadChapterPages) return
    void workspaceApi.loadChapterPages(activeChapterId)
  }, [activeChapterId, workspaceApi?.loadChapterPages])

  useEffect(() => {
    if (!workspaceApi?.loadPageNotes || !currentPageId || !pageKey) return
    if (!isValidObjectId(currentPageId)) return
    if (loadedNoteKeysRef.current.has(pageKey)) return
    loadedNoteKeysRef.current.add(pageKey)
    void workspaceApi.loadPageNotes(currentPageId, pageKey)
  }, [currentPageId, pageKey, workspaceApi?.loadPageNotes, isValidObjectId])

  useEffect(() => {
    loadedNoteKeysRef.current.clear()
  }, [activeChapterId])

  function goPage(delta) {
    setPageIndex(i => {
      const next = i + delta
      if (next < 0 || next >= pages.length) return i
      return next
    })
    setSelectedNoteId(null)
  }

  const removeCurrentPage = useCallback(async () => {
    if (!activeChapterId || !activeChapter) return
    const chId = activeChapterId
    const idx = pageIndex
    const oldPages = activeChapter.pages
    if (oldPages.length === 0) return

    const removed = oldPages[idx]
    if (removed?.url?.startsWith('blob:')) URL.revokeObjectURL(removed.url)

    const serverPage = removed?.id && !String(removed.id).startsWith('note-')
      ? removed
      : null

    if (serverPage && workspaceApi?.deleteChapterPage) {
      try {
        await workspaceApi.deleteChapterPage(chId, serverPage.id)
      } catch { /* local fallback: renumber anyway */ }
    }

    const newPages = oldPages.filter((_, i) => i !== idx)
    const chapterRemoved = newPages.length === 0

    setNotes((prev) => {
      const next = {}
      for (const k of Object.keys(prev)) {
        if (!k.startsWith(`${chId}-`)) next[k] = prev[k]
      }
      let ni = 0
      for (let oi = 0; oi < oldPages.length; oi++) {
        if (oi === idx) continue
        next[`${chId}-${ni}`] = prev[`${chId}-${oi}`] ?? []
        ni++
      }
      return next
    })
    setSelectedNoteId(null)
    setTool('draw')

    if (chapterRemoved) {
      const wasIdx = chapters.findIndex(c => c.id === chId)
      const out = chapters.filter(c => c.id !== chId)
      const pick = out.length ? out[Math.min(Math.max(wasIdx, 0), out.length - 1)] : null
      setChapters(out)
      setActiveChapterId(pick ? pick.id : null)
      setPageIndex(0)
      return
    }

    setChapters(prev => prev.map(ch => (ch.id === chId ? { ...ch, pages: newPages } : ch)))
    setPageIndex((pi) => {
      const max = newPages.length - 1
      return pi > max ? max : pi
    })
  }, [activeChapter, activeChapterId, pageIndex, chapters, setChapters, setNotes, setActiveChapterId, setPageIndex, workspaceApi])

  const draftRect = drawStart && drawCurrent ? {
    x: Math.min(drawStart.x, drawCurrent.x),
    y: Math.min(drawStart.y, drawCurrent.y),
    w: Math.abs(drawCurrent.x - drawStart.x),
    h: Math.abs(drawCurrent.y - drawStart.y),
  } : null

  const totalNotes = activeChapter
    ? pages.reduce((sum, _, i) => sum + (notes[`${activeChapterId}-${i}`]?.length ?? 0), 0)
    : 0

  const canUpload = seriesOptions.length > 0
    && selectedSeriesTitle.trim().length > 0
    && !!uploadTargetChapter
    && (hiredAssistants.length === 0 || !!sendAssistantId)

  const selectedSeriesPipeline = seriesOptions.find(s => s.title === selectedSeriesTitle.trim())

  function ToolButtons({ onDark = false }) {
    const outlineOnDark =
      'border-white/15 bg-zinc-800/90 text-zinc-100 shadow-none hover:border-white/25 hover:bg-zinc-700 hover:text-white'

    return (
      <div
        className={cn(
          'flex flex-wrap items-center gap-1.5',
          onDark && 'rounded-lg border border-white/10 bg-black/30 p-1',
        )}
      >
        <Button
          size="sm"
          variant={tool === 'draw' ? 'default' : 'outline'}
          className={cn(tool !== 'draw' && onDark && outlineOnDark)}
          onClick={() => setTool('draw')}
        >
          <Square className="size-3.5" />
          Tạo ô
        </Button>
        <Button
          size="sm"
          variant={tool === 'select' ? 'default' : 'outline'}
          className={cn(tool !== 'select' && onDark && outlineOnDark)}
          onClick={() => setTool('select')}
        >
          <MousePointer2 className="size-3.5" />
          Chọn ô
        </Button>
        <Button
          size="sm"
          variant={tool === 'delete' ? 'destructive' : 'outline'}
          className={cn(tool !== 'delete' && onDark && outlineOnDark)}
          onClick={() => setTool('delete')}
          title="Bấm vào ô trên trang để gỡ. Không xóa ảnh trang."
        >
          <Eraser className="size-3.5" />
          Gỡ ô
        </Button>
      </div>
    )
  }

  function PageNav({ compact = false, onDark = false }) {
    const canRemovePage = !!(activeChapter && pages.length > 0)
    const navBtnCls = onDark
      ? 'border-white/15 bg-zinc-800/90 text-zinc-100 shadow-none hover:bg-zinc-700 hover:text-white disabled:opacity-35'
      : undefined

    return (
      <div
        className={cn(
          'flex items-center gap-2',
          onDark && 'rounded-lg border border-white/10 bg-black/30 px-2 py-1',
        )}
      >
        <Button
          size="icon-sm"
          variant="outline"
          className={navBtnCls}
          disabled={pageIndex === 0}
          onClick={() => goPage(-1)}
        >
          ‹
        </Button>
        <span className={cn('text-xs tabular-nums', onDark ? 'text-zinc-400' : 'text-muted-foreground')}>
          <strong className={onDark ? 'text-white' : 'text-foreground'}>{pageIndex + 1}</strong> / {pages.length}
        </span>
        <Button
          size="icon-sm"
          variant="outline"
          className={navBtnCls}
          disabled={pageIndex >= pages.length - 1}
          onClick={() => goPage(1)}
        >
          ›
        </Button>
        {canRemovePage ? (
          <Button
            size="sm"
            variant="ghost"
            className={cn(
              onDark
                ? 'text-amber-300 hover:bg-amber-500/15 hover:text-amber-200'
                : 'text-destructive hover:bg-destructive/10 hover:text-destructive',
            )}
            onClick={removeCurrentPage}
            title="Gỡ ảnh trang đang xem"
          >
            <Trash2 className="size-3.5" />
            {compact ? 'Gỡ' : 'Gỡ trang'}
          </Button>
        ) : null}
      </div>
    )
  }

  function PageThumbs() {
    if (!pages.length) {
      return <p className="text-xs text-muted-foreground">Chưa có trang — upload ở bên trên.</p>
    }
    return (
      <div className="flex gap-2 overflow-x-auto py-1">
        {pages.map((pg, i) => {
          const badge = notes[`${activeChapterId}-${i}`]?.length ?? 0
          return (
            <button
              key={`${activeChapterId}-${pg.pageNumber ?? i}-${pg.id ?? i}`}
              type="button"
              onClick={() => { setPageIndex(i); setSelectedNoteId(null) }}
              title={`${pg.name} | url=${pg.url ?? 'none'}`}
              className={cn(
                'relative shrink-0 overflow-hidden rounded-md border-2 transition-colors',
                i === pageIndex ? 'border-primary' : 'border-transparent hover:border-muted-foreground/30',
              )}
            >
              <span className="manga-page manga-page--thumb-strip block h-10 w-6">
                {pg.url ? (
                  <img src={pg.url} alt={pg.name} className="manga-page__media" />
                ) : (
                  <span className="flex h-full items-center justify-center text-[10px] text-muted-foreground">
                    {i + 1}
                  </span>
                )}
              </span>
              {badge > 0 ? (
                <Badge className="absolute right-0.5 top-0.5 h-4 px-1 text-[9px]" variant="destructive">
                  {badge}
                </Badge>
              ) : null}
            </button>
          )
        })}
      </div>
    )
  }

  function CanvasBoard({ refEl, fs = false }) {
    return (
      <div
        ref={refEl}
        className={cn(
          'mk-board manga-page manga-page--canvas relative mx-auto',
          tool === 'draw' && 'mk-board--draw',
          tool === 'delete' && 'mk-board--delete',
          fs && 'mk-board--fullscreen',
        )}
        onMouseDown={e => onBoardMouseDown(e, refEl)}
        onMouseMove={e => onBoardMouseMove(e, refEl)}
        onMouseUp={onBoardMouseUp}
        onMouseLeave={onBoardMouseUp}
      >
        {pages[pageIndex]?.url ? (
          <img
            src={pages[pageIndex].url}
            alt=""
            className="mk-board__img manga-page__media"
            draggable={false}
            width={728}
            height={1030}
          />
        ) : (
          <div className="mk-board__placeholder manga-page__empty">
            <span>Trang {pageIndex + 1}</span>
            <p>728×1030 · upload ảnh để xem đúng khổ trang</p>
          </div>
        )}

        {pageNotes.map((n, idx) => {
          const stableKey = noteStableKey(n)
          return (
          <div
            key={stableKey}
            className={cn(
              'mk-note-box',
              selectedNoteId === stableKey && 'selected',
              tool === 'delete' && 'mk-note-box--target',
            )}
            style={{ left: `${n.x}%`, top: `${n.y}%`, width: `${n.w}%`, height: `${n.h}%` }}
            onClick={e => onNoteClick(e, stableKey)}
          >
            <span className="mk-note-box__num" style={{ background: noteTaskColor(n.taskType) }}>{idx + 1}</span>
            {n.taskType ? (
              <span
                className="mk-note-box__task"
                style={{ background: noteTaskColor(n.taskType) }}
                title={n.assignee ? `Giao: ${n.assignee}` : undefined}
              >
                {noteTaskLabel(n.taskType)}
              </span>
            ) : null}
            {(selectedNoteId === stableKey || tool === 'delete') ? (
              <button
                type="button"
                className="mk-note-box__delete"
                onClick={e => { e.stopPropagation(); deleteNote(stableKey) }}
                aria-label={`Gỡ ô ghi chú ${idx + 1}`}
              >
                ×
              </button>
            ) : null}
          </div>
        )})}

        {draftRect ? (
          <div
            className="mk-note-box mk-note-box--draft"
            style={{
              left: `${draftRect.x}%`,
              top: `${draftRect.y}%`,
              width: `${draftRect.w}%`,
              height: `${draftRect.h}%`,
            }}
          />
        ) : null}
      </div>
    )
  }

  function NotesPanel({ inFullscreen = false, embedded = false }) {
    const panelContent = (
      <>
        {!embedded && !inFullscreen && (
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Ô ghi chú — Trang {pageIndex + 1}</CardTitle>
              {selectedNoteId ? (
                <Button size="xs" variant="ghost" className="text-destructive" onClick={() => deleteNote(selectedNoteId)}>
                  Gỡ ô đang chọn
                </Button>
              ) : null}
            </div>
          </CardHeader>
        )}
        {embedded || inFullscreen ? (
          <div className="mb-3 flex shrink-0 items-center justify-between gap-2 border-b border-white/10 pb-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/10 text-zinc-200">
                <PenSquare className="size-3.5" />
              </span>
              <p className="truncate text-sm font-semibold text-zinc-100">
                Ô ghi chú · Trang {pageIndex + 1}
              </p>
              {pageNotes.length > 0 ? (
                <Badge className="h-5 shrink-0 border-transparent bg-white/15 px-1.5 text-[11px] font-semibold text-zinc-100">
                  {pageNotes.length}
                </Badge>
              ) : null}
            </div>
            {selectedNoteId ? (
              <Button
                size="xs"
                variant="ghost"
                className="h-7 shrink-0 gap-1 rounded-md bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 hover:text-rose-200"
                onClick={() => deleteNote(selectedNoteId)}
              >
                <Trash2 className="size-3" />
                Gỡ ô
              </Button>
            ) : null}
          </div>
        ) : null}
        <div className={cn('flex min-w-0 flex-col gap-3', (embedded || inFullscreen) ? 'min-h-0 flex-1' : '')}>
          {hiredAssistants.length === 0 ? (
            <Alert className="border-violet-200 bg-violet-50/50 dark:border-violet-500/30 dark:bg-violet-500/5">
              <AlertDescription className="text-xs">
                Chưa có Assistant trong đội —{' '}
                {onOpenAssistantsTab ? (
                  <button type="button" className="font-medium text-primary underline-offset-2 hover:underline" onClick={onOpenAssistantsTab}>
                    thuê Assistant
                  </button>
                ) : (
                  'thuê Assistant ở tab Thuê Assistant'
                )}
                {' '}trước khi giao việc.
              </AlertDescription>
            </Alert>
          ) : null}

          {tool === 'delete' ? (
            <Alert className="border-destructive/30 bg-destructive/5">
              <Eraser className="size-4 text-destructive" />
              <AlertDescription className="text-xs">
                Đang ở chế độ <strong>gỡ ô ghi chú</strong> — chạm ô trên trang để xóa.
              </AlertDescription>
            </Alert>
          ) : null}

          {pageNotes.length === 0 ? (
            <div className={cn(
              'rounded-lg border border-dashed px-3 py-6 text-center',
              embedded || inFullscreen
                ? 'border-white/15 bg-zinc-950/40'
                : 'border-muted-foreground/25 bg-muted/20',
            )}>
              <span className={cn(
                'mx-auto mb-3 flex size-10 items-center justify-center rounded-full',
                embedded || inFullscreen ? 'bg-white/10 text-zinc-400' : 'bg-muted text-muted-foreground',
              )}>
                <PenSquare className="size-5" />
              </span>
              <p className={cn('text-xs font-medium leading-relaxed', embedded || inFullscreen ? 'text-zinc-300' : 'text-muted-foreground')}>
                Chưa có ô trên trang này.
              </p>
              <p className={cn(
                'mt-1.5 break-words text-[11px] leading-relaxed',
                embedded || inFullscreen ? 'text-zinc-500' : 'text-muted-foreground',
              )}>
                Chọn <strong className={embedded || inFullscreen ? 'text-zinc-200' : 'text-foreground'}>Tạo ô</strong>, kéo vùng trên trang và mô tả việc cần làm.
              </p>
            </div>
          ) : (
            <div
              className={cn(
                'mk-notes-scroll min-h-0 min-w-0 overflow-x-hidden overscroll-contain pr-1',
                pageNotes.length >= 2 ? 'overflow-y-auto' : 'overflow-y-visible',
                inFullscreen || embedded ? 'flex-1' : 'max-h-[calc(100vh-480px)]',
              )}
            >
              <ul className="space-y-3">
                {pageNotes.map((n, idx) => {
                  const stableKey = noteStableKey(n)
                  return (
                  <li
                    key={stableKey}
                    style={{ borderLeftColor: noteTaskColor(n.taskType), borderLeftWidth: 4 }}
                    className={cn(
                      'min-w-0 rounded-lg border p-3 shadow-sm transition-all duration-150 hover:shadow-md',
                      embedded || inFullscreen
                        ? selectedNoteId === stableKey
                          ? 'border-rose-400/60 bg-rose-500/10 text-zinc-100 ring-2 ring-rose-400/40'
                          : 'border-white/10 bg-zinc-950/60 text-zinc-100 hover:border-white/20'
                        : selectedNoteId === stableKey
                          ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                          : 'bg-background hover:border-primary/30',
                    )}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm"
                          style={{ background: noteTaskColor(n.taskType) }}
                        >
                          {idx + 1}
                        </span>
                        <span
                          className="truncate text-xs font-semibold"
                          style={{ color: noteTaskColor(n.taskType) }}
                        >
                          {noteTaskLabel(n.taskType ?? 'background')}
                        </span>
                      </div>
                      <Button size="xs" variant="ghost" className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => deleteNote(stableKey)}>
                        <Trash2 className="size-3" />
                        Gỡ
                      </Button>
                    </div>
                    <div className="space-y-1">
                      <Label className={cn('text-xs', (embedded || inFullscreen) && 'text-zinc-400')}>Loại việc</Label>
                      <Select
                        value={n.taskType ?? 'background'}
                        onValueChange={v => updateNoteField(stableKey, 'taskType', v)}
                      >
                        <SelectTrigger
                          className={cn('h-8', (embedded || inFullscreen) && 'border-white/15 bg-zinc-900/80 text-zinc-100')}
                          onFocus={() => setSelectedNoteId(stableKey)}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className={cn(inFullscreen && 'z-[10000]')}>
                          {NOTE_TASK_TYPES.map(t => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Textarea
                      ref={el => {
                        if (el) noteTextareaRefs.current.set(stableKey, el)
                        else noteTextareaRefs.current.delete(stableKey)
                      }}
                      className={cn('mt-2 text-sm', (embedded || inFullscreen) && 'border-white/15 bg-zinc-900/80 text-zinc-100 placeholder:text-zinc-500')}
                      placeholder="Mô tả chi tiết (VD: vẽ cảnh phố đêm, thêm đèn neon)..."
                      defaultValue={n.text ?? ''}
                      onInput={e => {
                        const value = e.target.value
                        draftTextRef.current.set(stableKey, value)
                        scheduleNoteSave(stableKey, value)
                      }}
                      onFocus={() => setSelectedNoteId(stableKey)}
                      rows={3}
                    />
                  </li>
                )})}
              </ul>
            </div>
          )}
        </div>
      </>
    )

    if (inFullscreen) {
      return (
        <div className="flex h-full min-h-0 w-full flex-col overflow-hidden text-zinc-100">
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
            {panelContent}
          </div>
        </div>
      )
    }

    if (embedded) {
      return (
        <div className="flex h-full min-h-0 w-full min-w-0 max-w-full flex-col overflow-hidden rounded-lg border border-white/10 bg-zinc-900/95 text-zinc-100">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden p-4">
            {panelContent}
          </div>
        </div>
      )
    }

    return (
      <Card className="flex flex-col">
        <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
          {panelContent}
        </CardContent>
      </Card>
    )
  }

  function SendActionsBar({ compact = false, embedded = false, inline = false }) {
    const handleAssistant = async () => {
      if (!activeChapter || !onSendToAssistant || sendingToAssistant) return
      setSendingToAssistant(true)
      try {
        const syncedNotes = await flushNotesBeforeSend()
        await onSendToAssistant({
          chapter: activeChapter,
          pages,
          assistantId: sendAssistantId,
          notesByPage: syncedNotes,
        })
      } finally {
        setSendingToAssistant(false)
      }
    }
    const handleTantou = () => {
      if (!activeChapter || !onSendToTantou) return
      const page = pages[pageIndex]
      onSendToTantou({
        chapter: activeChapter,
        pageIndex,
        pageUrl: page?.url ?? null,
        pageName: page?.name,
        notes: pageNotes,
      })
    }

    const innerContent = (
      <div className={cn(
        'min-w-0',
        compact || embedded ? 'space-y-2' : 'space-y-3 p-4',
        inline && 'p-0',
      )}>
        {hiredAssistants.length > 0 && sendAssistantId ? (
          <p className={cn(
            'truncate text-xs',
            compact ? 'text-zinc-300' : 'text-muted-foreground',
            inline && 'text-zinc-400',
            embedded && !inline && 'text-zinc-400',
          )}>
            Assistant:{' '}
            <strong className={cn(
              compact || inline || embedded ? 'text-zinc-100' : 'text-foreground',
            )}>
              {hiredAssistants.find(a => String(a.assistantId) === String(sendAssistantId))?.label ?? sendAssistantId}
            </strong>
          </p>
        ) : hiredAssistants.length === 0 ? (
          <p className={cn(
            'break-words text-xs leading-relaxed',
            compact ? 'text-zinc-400' : 'text-muted-foreground',
            inline && 'text-zinc-500',
            embedded && !inline && 'text-zinc-500',
          )}>
            Thuê Assistant ở tab <strong className="text-zinc-300">Thuê Assistant</strong> trước khi gửi chapter.
          </p>
        ) : null}
        <div className="flex w-full min-w-0 flex-col gap-1.5">
          {onSendToTantou ? (
            <Button
              size="sm"
              variant="outline"
              disabled={!activeChapter || pages.length === 0 || !sendAssistantId}
              title={`Gửi bản thảo sang ${LABEL_TANTOU_EDITOR}`}
              onClick={handleTantou}
              className={cn(
                'h-8 w-full min-w-0 text-xs',
                (inline || embedded) && 'border-white/15 bg-zinc-950/50 text-zinc-200 hover:bg-zinc-800',
                compact && 'border-white/20 bg-transparent text-white hover:bg-white/10',
              )}
            >
              Gửi {LABEL_TANTOU_EDITOR}
            </Button>
          ) : null}
          <Button
            size="sm"
            disabled={!activeChapter || pages.length === 0 || !sendAssistantId || sendingToAssistant}
            onClick={() => { void handleAssistant() }}
            className="h-8 w-full min-w-0 text-xs"
          >
            <Send className="size-3 shrink-0" />
            {sendingToAssistant ? 'Đang gửi…' : 'Gửi Assistant'}
          </Button>
        </div>
      </div>
    )

    if (embedded && inline) {
      return innerContent
    }

    if (embedded) {
      return (
        <div className="w-full min-w-0 overflow-hidden rounded-lg border border-rose-500/30 bg-zinc-900/90 p-2 shadow-sm">
          {innerContent}
        </div>
      )
    }

    return (
      <Card
        className={cn(
          'border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background',
          compact && 'border-white/10 bg-zinc-900/80 text-white shadow-xl backdrop-blur',
        )}
      >
        <CardContent className={cn(compact && 'p-2')}>{innerContent}</CardContent>
      </Card>
    )
  }

  function AssistantPicker() {
    const assistantReady = hiredAssistants.length > 0 && sendAssistantId
    return (
      <Card className={cn(
        'border-violet-200 bg-gradient-to-br from-violet-50/80 to-background dark:border-violet-500/30 dark:from-violet-500/5',
      )}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="size-6 justify-center p-0 font-semibold">1</Badge>
            <CardTitle className="text-base">Chọn Assistant nhận chapter</CardTitle>
          </div>
          <CardDescription>
            Chọn assistant trước khi upload ảnh, tạo ghi chú và gửi chapter.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {assistantReady ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm">
                Đang giao cho: <strong>{hiredAssistants.find(a => String(a.assistantId) === String(sendAssistantId))?.label ?? sendAssistantId}</strong>
              </p>
              <Button size="sm" variant="ghost" onClick={() => setSendAssistantId('')}>
                Đổi Assistant
              </Button>
            </div>
          ) : hiredAssistants.length > 0 ? (
            <div className="space-y-1">
              <Label className="text-xs">Chọn Assistant nhận chapter</Label>
              <Select value={sendAssistantId ? String(sendAssistantId) : '__none__'} onValueChange={v => setSendAssistantId(v === '__none__' ? '' : v)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="— Chọn Assistant —" />
                </SelectTrigger>
                <SelectContent>
                  {hiredAssistants.map(a => (
                    <SelectItem key={a.assistantId} value={String(a.assistantId)}>{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Chưa có Assistant trong đội — {onOpenAssistantsTab ? (
                <button type="button" className="font-medium text-primary underline-offset-2 hover:underline" onClick={onOpenAssistantsTab}>
                  thuê Assistant
                </button>
              ) : (
                <span>thuê Assistant ở tab Thuê Assistant</span>
              )} trước.
            </p>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="mk-annotate space-y-6">
      {pendingReviewCount > 0 ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2.5">
          <p className="text-sm">
            <strong>{pendingReviewCount}</strong> chapter chờ duyệt Assistant
          </p>
          <Button size="xs" asChild>
            <Link to="/mangaka/review">Duyệt</Link>
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <span className={cn(
          'rounded-full px-2.5 py-1 font-medium transition-colors',
          sendAssistantId ? 'bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300' : 'bg-background text-foreground shadow-sm',
        )}>
          1 · Assistant
        </span>
        <ChevronRight className="size-3.5 opacity-40" aria-hidden />
        <span className={cn(
          'rounded-full px-2.5 py-1 font-medium',
          activeChapterId ? 'bg-background text-foreground shadow-sm' : 'opacity-60',
        )}>
          2 · Upload
        </span>
        <ChevronRight className="size-3.5 opacity-40" aria-hidden />
        <span className={cn(
          'rounded-full px-2.5 py-1 font-medium',
          totalNotes > 0 ? 'bg-background text-foreground shadow-sm' : 'opacity-60',
        )}>
          3 · Ghi chú & gửi
        </span>
      </div>

      <AssistantPicker />

      <Card className="overflow-hidden border-border/80 shadow-sm">
        <CardHeader className="border-b bg-muted/20">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="size-6 justify-center p-0 font-semibold">2</Badge>
            <CardTitle className="text-base">Chapter & upload ảnh</CardTitle>
          </div>
          <CardDescription>
            Chọn chapter, nhập số trang — upload đúng bấy nhiêu ảnh (1 ảnh = 1 trang).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-5">
          <div className="space-y-2">
            <Label>Series</Label>
            <Select
              value={seriesOptions.some(s => s.title === selectedSeriesTitle) ? selectedSeriesTitle : ''}
              onValueChange={(v) => onSelectedSeriesTitleChange(v)}
              disabled={seriesOptions.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder="— Chọn series —" />
              </SelectTrigger>
              <SelectContent>
                {seriesOptions.map(s => (
                  <SelectItem key={s.id} value={s.title}>{s.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {chapterNumHint ? <p className="text-xs text-muted-foreground">{chapterNumHint}</p> : null}
            {selectedSeriesPipeline?.needsFullDebutPipeline ? (
              <Alert>
                <AlertDescription className="text-xs">
                  <strong>✦ Lần đầu:</strong> Assistant → bạn duyệt → {LABEL_TANTOU_EDITOR} → {LABEL_EDITOR_BOARD} biểu quyết → xuất bản.
                </AlertDescription>
              </Alert>
            ) : selectedSeriesPipeline ? (
              <Alert>
                <AlertDescription className="text-xs">
                  <strong>Lần 2+:</strong> {LABEL_TANTOU_EDITOR} duyệt trực tiếp → xuất bản.
                </AlertDescription>
              </Alert>
            ) : null}
          </div>

          <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Chapter</h3>
              <Button
                size="sm"
                className="w-full"
                disabled={!selectedSeriesTitle.trim()}
                onClick={createNewChapter}
              >
                <Plus className="size-3.5" />
                Tạo Chapter {nextChapterNum}
              </Button>

              {seriesChapters.length === 0 ? (
                <p className="text-xs text-muted-foreground">Chưa có chapter — bấm nút trên để tạo Ch. {nextChapterNum}.</p>
              ) : (
                <ScrollArea className="max-h-64 rounded-lg border">
                  <ul className="divide-y">
                    {seriesChapters.map(ch => {
                      const isPick = ch.id === activeChapterId
                      const noteCount = countChapterNotes(ch.id, ch.pages, notes)
                      const thumb = ch.cover?.url ?? ch.pages?.[0]?.url
                      return (
                        <li
                          key={ch.id}
                          className={cn(
                            'group flex items-center gap-2 px-3 py-2 transition-colors',
                            isPick ? 'bg-primary/10' : 'hover:bg-muted/50',
                          )}
                        >
                          <button
                            type="button"
                            className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
                            onClick={() => activateChapter(ch, 0)}
                          >
                            <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                              {thumb ? (
                                <img src={thumb} alt="" className="size-full object-cover" />
                              ) : (
                                <ImageIcon className="size-4 text-muted-foreground" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-semibold">Ch. {ch.num}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {ch.pages.length} trang{ch.cover ? ' · có bìa' : ''}
                              </p>
                            </div>
                            {noteCount > 0 ? (
                              <Badge variant="secondary" className="text-[10px]">
                                {noteCount} ô
                              </Badge>
                            ) : null}
                          </button>
                          <Button
                            size="xs"
                            variant="ghost"
                            className="size-7 shrink-0 p-0 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100 data-[active=true]:opacity-100"
                            data-active={isPick || undefined}
                            title={`Xóa Ch. ${ch.num}`}
                            onClick={(e) => { e.stopPropagation(); deleteChapter(ch.id) }}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </li>
                      )
                    })}
                  </ul>
                </ScrollArea>
              )}
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">
                  Upload{uploadTargetChapter ? <> — <strong>Ch. {uploadTargetChapter.num}</strong></> : null}
                </h3>
                {uploadTargetChapter ? (
                  <Badge variant="outline" className="text-[10px]">
                    {uploadTargetChapter.pages.length} trang
                    {uploadTargetChapter.cover ? ' · có bìa' : ''}
                  </Badge>
                ) : null}
              </div>

              {uploadRejectMessage ? (
                <Alert variant="destructive">
                  <AlertDescription>{uploadRejectMessage}</AlertDescription>
                </Alert>
              ) : null}

              <input
                ref={coverFileRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                hidden
                disabled={!uploadTargetChapter}
                onChange={onCoverChange}
              />
              <div className="rounded-xl border bg-muted/20 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <ImageIcon className="size-3.5" />
                    Ảnh bìa chapter
                  </div>
                  {uploadTargetChapter?.cover ? (
                    <Button size="xs" variant="ghost" className="text-destructive" onClick={removeCover}>
                      <Trash2 className="size-3" />
                      Gỡ
                    </Button>
                  ) : null}
                </div>
                {uploadTargetChapter?.cover ? (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => uploadTargetChapter && coverFileRef.current?.click()}
                      className="group relative h-24 w-20 shrink-0 overflow-hidden rounded-lg border bg-background"
                      title="Bấm để đổi ảnh bìa"
                    >
                      <img src={uploadTargetChapter.cover.url} alt="Ảnh bìa" className="size-full object-cover transition-transform group-hover:scale-105" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{uploadTargetChapter.cover.name || 'cover.png'}</p>
                      <p className="text-xs text-muted-foreground">Bấm vào ảnh để đổi.</p>
                      <Button
                        size="xs"
                        variant="outline"
                        className="mt-2"
                        onClick={() => uploadTargetChapter && coverFileRef.current?.click()}
                      >
                        <Upload className="size-3" />
                        Đổi ảnh
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    className={cn(
                      'flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed px-4 py-5 text-center transition-colors',
                      uploadTargetChapter
                        ? 'hover:border-primary/50 hover:bg-muted/50'
                        : 'cursor-not-allowed opacity-60',
                    )}
                    onDrop={uploadTargetChapter ? onCoverDrop : e => e.preventDefault()}
                    onDragOver={e => e.preventDefault()}
                    onClick={() => { if (uploadTargetChapter) coverFileRef.current?.click() }}
                    role={uploadTargetChapter ? 'button' : undefined}
                  >
                    <ImageIcon className="size-5 text-muted-foreground" />
                    <p className="text-xs font-medium">Bấm hoặc kéo thả ảnh bìa</p>
                    <p className="text-[11px] text-muted-foreground">
                      {uploadTargetChapter ? 'Chỉ 1 ảnh — dùng làm thumbnail chapter.' : 'Tạo / chọn chapter trước'}
                    </p>
                  </div>
                )}
              </div>

              <div
                className={cn(
                  'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors',
                  canUpload
                    ? 'border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/50'
                    : 'cursor-not-allowed border-muted bg-muted/20 opacity-60',
                  uploadUi && 'border-primary bg-primary/5',
                )}
                onDrop={canUpload ? onDrop : e => e.preventDefault()}
                onDragOver={e => e.preventDefault()}
                onClick={() => { if (canUpload) fileRef.current?.click() }}
                role={canUpload ? 'button' : undefined}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  multiple
                  hidden
                  disabled={!canUpload}
                  onChange={onFileChange}
                />
                <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Upload className="size-5" />
                </div>
                <p className="text-sm font-medium">Kéo thả ảnh trang hoặc bấm để chọn</p>
                {uploadUi ? (
                  <p className="text-xs text-primary">
                    Đang tải <strong>{uploadUi.series}</strong> · Ch. <strong>{uploadUi.chapter}</strong> · {uploadUi.pct}%
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {!selectedSeriesTitle.trim()
                      ? 'Chọn series ở trên'
                      : !uploadTargetChapter
                        ? 'Tạo hoặc chọn chapter bên trái'
                        : hiredAssistants.length > 0 && !sendAssistantId
                          ? 'Chọn Assistant trước khi upload'
                          : `Thêm ảnh vào Ch. ${uploadTargetChapter.num} (${uploadTargetChapter.pages.length} trang đã có)`}
                  </p>
                )}
              </div>
            </section>
          </div>
        </CardContent>
      </Card>

      {activeChapter ? (
        <Card className="overflow-hidden border-border/80 shadow-sm">
          <CardHeader className="border-b bg-muted/20">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="size-6 justify-center p-0 font-semibold">3</Badge>
                <div>
                  <CardTitle className="text-base">Ghi chú trên trang truyện</CardTitle>
                  <CardDescription>
                    <strong>{activeChapter.series}</strong> · Ch. <strong>{activeChapter.num}</strong>
                  </CardDescription>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ToolButtons />
                <Button size="sm" variant="outline" onClick={() => setIsFullscreen(true)}>
                  <Maximize2 className="size-3.5" />
                  Phóng to
                </Button>
                <Badge variant="secondary">
                  {totalNotes} ô · {pages.length} trang
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <PageNav />
              <div className="min-w-0 flex-1 overflow-x-auto">
                <PageThumbs />
              </div>
            </div>
            <div
              className="flex h-[min(720px,calc(100vh-280px))] min-h-[480px] gap-3 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 p-3"
            >
              <div className="mk-board-stage-scroll min-h-0 min-w-0 flex-1 overflow-auto">
                <div className="flex justify-center p-1">
                  <CanvasBoard refEl={boardRef} />
                </div>
              </div>
              <aside className="flex h-full w-[min(300px,100%)] min-w-[260px] max-w-[300px] shrink-0 flex-col gap-3 overflow-hidden">
                <div className="min-h-0 flex-1 overflow-hidden">
                  {NotesPanel({ embedded: true })}
                </div>
                <div className="shrink-0">
                  {SendActionsBar({ embedded: true })}
                </div>
              </aside>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Chọn hoặc tạo chapter ở <strong>Bước 1</strong> để bắt đầu ghi chú.
          </CardContent>
        </Card>
      )}

      {isFullscreen && activeChapter ? (
        <div className="mk-fullscreen" role="dialog" aria-modal="true">
          <header className="mk-fullscreen__header">
            <div className="mk-fullscreen__title">
              <strong>{activeChapter.series} — Ch.{activeChapter.num}</strong>
              <span>· Trang {pageIndex + 1}/{pages.length}</span>
            </div>
            <div className="mk-fullscreen__tools">
              <ToolButtons onDark />
              <PageNav compact onDark />
              <button type="button" className="mk-fullscreen__close" onClick={() => setIsFullscreen(false)}>
                <X className="size-4" aria-hidden />
                Thu nhỏ
              </button>
            </div>
          </header>

          <div className="mk-fullscreen__body">
            <div className="mk-fullscreen__stage">
              <CanvasBoard refEl={fsBoardRef} fs />
            </div>
            <div className="mk-fullscreen__panel">
              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
                <div className="min-h-0 flex-1 overflow-hidden">
                  {NotesPanel({ inFullscreen: true })}
                </div>
                <div className="shrink-0">
                  {SendActionsBar({ compact: true })}
                </div>
              </div>
            </div>
          </div>

          <div className="mk-fullscreen__thumbs">
            {pages.map((pg, i) => (
              <button
                key={pg.id ?? i}
                type="button"
                onClick={() => { setPageIndex(i); setSelectedNoteId(null) }}
                title={pg.name}
                className={cn(
                  'mk-page-thumb shrink-0 overflow-hidden rounded border-2 transition-colors',
                  i === pageIndex ? 'border-primary' : 'border-transparent',
                )}
              >
                <span className="manga-page manga-page--thumb-strip block">
                  {pg.url ? (
                    <img src={pg.url} alt={pg.name} className="manga-page__media" />
                  ) : (
                    <span className="flex h-full items-center justify-center text-[10px] text-zinc-500">{i + 1}</span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
