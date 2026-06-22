import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  Eraser,
  Image as ImageIcon,
  Maximize2,
  MousePointer2,
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

  const activeChapter = chapters.find(c => c.id === activeChapterId)
  const pages = activeChapter?.pages ?? []
  const pageKey = activeChapter ? `${activeChapterId}-${pageIndex}` : ''
  const currentPageId = pages[pageIndex]?.id ?? null
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
        newPages = await workspaceApi.uploadChapterPages(targetId, filesToAdd)
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
    scheduleNoteSave(clientKey, '')
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
    if (loadedNoteKeysRef.current.has(pageKey)) return
    loadedNoteKeysRef.current.add(pageKey)
    void workspaceApi.loadPageNotes(currentPageId, pageKey)
  }, [currentPageId, pageKey, workspaceApi?.loadPageNotes])

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

  function ToolButtons() {
    return (
      <div className="flex flex-wrap gap-1.5">
        <Button
          size="sm"
          variant={tool === 'draw' ? 'default' : 'outline'}
          onClick={() => setTool('draw')}
        >
          <Square className="size-3.5" />
          Tạo ô
        </Button>
        <Button
          size="sm"
          variant={tool === 'select' ? 'default' : 'outline'}
          onClick={() => setTool('select')}
        >
          <MousePointer2 className="size-3.5" />
          Chọn ô
        </Button>
        <Button
          size="sm"
          variant={tool === 'delete' ? 'destructive' : 'outline'}
          onClick={() => setTool('delete')}
          title="Bấm vào ô trên trang để gỡ. Không xóa ảnh trang."
        >
          <Eraser className="size-3.5" />
          Gỡ ô
        </Button>
      </div>
    )
  }

  function PageNav({ compact = false }) {
    const canRemovePage = !!(activeChapter && pages.length > 0)
    return (
      <div className="flex items-center gap-2">
        <Button size="icon-sm" variant="outline" disabled={pageIndex === 0} onClick={() => goPage(-1)}>
          ‹
        </Button>
        <span className="text-xs text-muted-foreground tabular-nums">
          <strong className="text-foreground">{pageIndex + 1}</strong> / {pages.length}
        </span>
        <Button size="icon-sm" variant="outline" disabled={pageIndex >= pages.length - 1} onClick={() => goPage(1)}>
          ›
        </Button>
        {canRemovePage ? (
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
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
              key={pg.id}
              type="button"
              onClick={() => { setPageIndex(i); setSelectedNoteId(null) }}
              title={pg.name}
              className={cn(
                'relative shrink-0 overflow-hidden rounded-md border-2 transition-colors',
                i === pageIndex ? 'border-primary' : 'border-transparent hover:border-muted-foreground/30',
              )}
            >
              <span className="manga-page manga-page--thumb-strip block">
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
            <span className="mk-note-box__num">{idx + 1}</span>
            {n.taskType ? (
              <span className="mk-note-box__task" title={n.assignee ? `Giao: ${n.assignee}` : undefined}>
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
        {!embedded && (
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
        <div className={cn('flex flex-col gap-3', embedded ? 'flex-1 min-h-0' : '')}>
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
            <p className="text-xs text-muted-foreground">
              Chưa có ô nào. Chọn <strong>Tạo ô</strong>, kéo vùng trên trang và mô tả việc cần làm. Gửi Assistant ở cuối — cả chapter giao cho 1 người.
            </p>
          ) : (
            <div
              className={cn(
                'min-h-0 overflow-y-auto overscroll-contain pr-1',
                inFullscreen ? 'flex-1' : 'max-h-[calc(100vh-480px)]',
              )}
            >
              <ul className="space-y-3">
                {pageNotes.map((n, idx) => {
                  const stableKey = noteStableKey(n)
                  return (
                  <li
                    key={stableKey}
                    className={cn(
                      'rounded-lg border p-3 transition-colors',
                      selectedNoteId === stableKey ? 'border-primary bg-primary/5' : 'bg-background',
                    )}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <Badge variant="outline">Ô #{idx + 1}</Badge>
                      <Button size="xs" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => deleteNote(stableKey)}>
                        <Trash2 className="size-3" />
                        Gỡ
                      </Button>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Loại việc</Label>
                      <Select
                        value={n.taskType ?? 'background'}
                        onValueChange={v => updateNoteField(stableKey, 'taskType', v)}
                      >
                        <SelectTrigger className="h-8" onFocus={() => setSelectedNoteId(stableKey)}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
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
                      className="mt-2 text-sm"
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

    if (embedded) {
      return (
        <div className="flex min-h-0 flex-1 flex-col rounded-lg border bg-card p-4">
          {panelContent}
        </div>
      )
    }

    return (
      <Card className={cn('flex flex-col', inFullscreen && 'h-full overflow-hidden')}>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
          {panelContent}
        </CardContent>
      </Card>
    )
  }

  function SendActionsBar({ compact = false, embedded = false }) {
    const handleAssistant = () => {
      if (!activeChapter || !onSendToAssistant) return
      onSendToAssistant({
        chapter: activeChapter,
        pages,
        assistantId: sendAssistantId,
      })
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
      <div className={cn('space-y-2', compact ? 'p-3' : 'p-4')}>
        <div className="min-w-0">
          <p className={cn('text-sm font-semibold', compact && 'text-white')}>
            Gửi cả chapter {activeChapter ? `Ch. ${activeChapter.num}` : ''} cho Assistant
          </p>
          <p className={cn('text-xs', compact ? 'text-zinc-300' : 'text-muted-foreground')}>
            {pages.length} trang · {totalNotes} ô ghi chú · 1 task = cả chapter
            {totalNotes > 0 ? ' · các ghi chú sẽ gộp vào mô tả' : ''}
          </p>
        </div>
        {hiredAssistants.length > 0 && sendAssistantId ? (
          <p className="text-xs text-muted-foreground">
            Assistant: <strong>{hiredAssistants.find(a => String(a.assistantId) === String(sendAssistantId))?.label ?? sendAssistantId}</strong>
          </p>
        ) : hiredAssistants.length === 0 ? (
          <p className={cn('text-xs', compact ? 'text-zinc-400' : 'text-muted-foreground')}>
            Thuê Assistant ở tab <strong>Thuê Assistant</strong> trước khi gửi chapter.
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          {onSendToTantou ? (
            <Button
              size="sm"
              variant="outline"
              disabled={!activeChapter || pages.length === 0 || !sendAssistantId}
              title={`Gửi bản thảo sang ${LABEL_TANTOU_EDITOR}`}
              onClick={handleTantou}
              className={cn(compact && 'border-white/20 bg-transparent text-white hover:bg-white/10')}
            >
              Gửi {LABEL_TANTOU_EDITOR}
            </Button>
          ) : null}
          <Button
            size="sm"
            disabled={!activeChapter || pages.length === 0 || !sendAssistantId}
            onClick={handleAssistant}
          >
            <Send className="size-3.5" />
            Gửi cả chapter
          </Button>
        </div>
      </div>
    )

    if (embedded) {
      return (
        <div className={cn(
          'rounded-lg border border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background',
        )}>
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
        <CardContent>{innerContent}</CardContent>
      </Card>
    )
  }

  function AssistantPicker() {
    const assistantReady = hiredAssistants.length > 0 && sendAssistantId
    return (
      <Card className={cn(
        'border-violet-200 bg-violet-50/50 dark:border-violet-500/30 dark:bg-violet-500/5',
      )}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="size-6 justify-center p-0">0</Badge>
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
    <div className="space-y-6">
      <AssistantPicker />

      {!sendAssistantId && hiredAssistants.length > 0 ? (
        <Alert className="border-amber-200 bg-amber-50/50 dark:border-amber-500/30 dark:bg-amber-500/5">
          <AlertDescription className="text-xs">
            Chọn Assistant trước khi upload ảnh, tạo ghi chú hoặc gửi chapter.
          </AlertDescription>
        </Alert>
      ) : null}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="size-6 justify-center p-0">1</Badge>
            <CardTitle className="text-base">Chapter & upload ảnh</CardTitle>
          </div>
          <CardDescription>
            Chọn chapter, nhập số trang — upload đúng bấy nhiêu ảnh (1 ảnh = 1 trang).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Series (draft)</Label>
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
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="size-6 justify-center p-0">2</Badge>
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
              className="flex gap-3 overflow-hidden rounded-lg border bg-zinc-950 p-3"
              style={{ maxHeight: 'calc(100vh - 300px)' }}
            >
              <div className="flex shrink-0 justify-center overflow-hidden">
                <CanvasBoard refEl={boardRef} />
              </div>
              <div
                className="min-w-0 flex flex-1 flex-col overflow-y-auto"
                style={{ maxHeight: 'calc(100vh - 340px)' }}
              >
                <NotesPanel embedded />
                <div className="mt-3 shrink-0">
                  <SendActionsBar embedded />
                </div>
              </div>
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
        <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950" role="dialog" aria-modal="true">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-zinc-900 px-5 py-3 text-white">
            <div>
              <strong>{activeChapter.series} — Ch.{activeChapter.num}</strong>
              <span className="ml-2 text-sm text-zinc-400">· Trang {pageIndex + 1}/{pages.length}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ToolButtons />
              <PageNav compact />
              <Button size="sm" variant="outline" className="border-white/20 bg-transparent text-white hover:bg-white/10" onClick={() => setIsFullscreen(false)}>
                <X className="size-4" />
                Thu nhỏ
              </Button>
            </div>
          </header>

          <div className="grid min-h-0 flex-1 grid-cols-[1fr_360px] gap-4 overflow-hidden p-4">
            <div className="flex items-center justify-center overflow-hidden">
              <CanvasBoard refEl={fsBoardRef} fs />
            </div>
            <div className="flex min-h-0 flex-col gap-3 overflow-hidden">
              <div className="min-h-0 flex-1 overflow-hidden">
                <NotesPanel inFullscreen />
              </div>
              <SendActionsBar compact />
            </div>
          </div>

          <div className="flex shrink-0 gap-2 overflow-x-auto border-t border-white/10 bg-zinc-900 p-2">
            {pages.map((pg, i) => (
              <button
                key={pg.id}
                type="button"
                onClick={() => { setPageIndex(i); setSelectedNoteId(null) }}
                title={pg.name}
                className={cn(
                  'shrink-0 overflow-hidden rounded border-2 transition-colors',
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
