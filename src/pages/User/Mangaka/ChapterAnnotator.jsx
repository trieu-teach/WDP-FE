import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
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
import { NOTE_TASK_TYPES, noteTaskLabel } from '@/constants/workspaceTasks.js'
import { fileToStorableDataUrl } from '@/utils/mangakaWorkspaceStorage.js'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { getApiErrorMessage } from '@/api/http.js'
import {
  getAnnotatorPageDisplayUrl,
  shouldHideLegacyAnnotatorNotes,
  shouldShowAssistantEditedOnAnnotate,
  canShowQuickRevision,
  QUICK_REVISION_MAX_PAGES,
} from '@/utils/apiMappers.js'
import {
  isAssistantPageApproved,
  isChapterFullyAssistantApproved,
} from '@/utils/assistantApprovedPages.js'
import {
  CHAPTER_COVER_ACCEPT,
  getPage1OriginalUrl,
  isChapterCoverLocked,
  resolveChapterCoverDisplay,
  validateChapterCoverFile,
} from '@/utils/chapterCover.js'

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
  onSendRevision,
  workspaceApi = null,
  pendingReviewCount = 0,
  revisionMode = false,
  seriesStatus = null,
  onQuickRevision = null,
  quickRevisionFocus = false,
}) {
  const fileRef = useRef(null)
  const coverFileRef = useRef(null)
  const quickReplaceFileRef = useRef(null)
  const boardRef = useRef(null)
  const fsBoardRef = useRef(null)
  const noteSaveTimersRef = useRef({})
  const loadedNoteKeysRef = useRef(new Set())
  /** Đã xóa note vòng cũ (1 lần) sau duyệt — không xóa note mới tạo. */
  const legacyNotesClearedRef = useRef(new Set())
  const draftTextRef = useRef(new Map())
  const noteTextareaRefs = useRef(new Map())
  const revisionDraftKeysRef = useRef(new Set())

  const [drawStart, setDrawStart] = useState(null)
  const [drawCurrent, setDrawCurrent] = useState(null)
  const [selectedNoteId, setSelectedNoteId] = useState(null)
  const [tool, setTool] = useState('draw')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [uploadUi, setUploadUi] = useState(null)
  const [uploadRejectMessage, setUploadRejectMessage] = useState(null)
  const [coverBusy, setCoverBusy] = useState(false)
  const [sendAssistantId, setSendAssistantId] = useState('')
  const [sendingToAssistant, setSendingToAssistant] = useState(false)
  const [quickRevisionDrafts, setQuickRevisionDrafts] = useState({})
  const [quickRevisionBusy, setQuickRevisionBusy] = useState(false)
  const [quickReplaceInputKey, setQuickReplaceInputKey] = useState(0)
  const [quickRevisionNewPages, setQuickRevisionNewPages] = useState([])
  const [quickRevisionDeletedPageIds, setQuickRevisionDeletedPageIds] = useState({})

  const activeChapter = chapters.find(c => c.id === activeChapterId)
  const quickNewPagesFileRef = useRef(null)
  const resolvedSeriesStatus = useMemo(() => {
    if (seriesStatus) return seriesStatus
    return seriesOptions.find((s) => s.title === selectedSeriesTitle)?.status ?? null
  }, [seriesStatus, seriesOptions, selectedSeriesTitle])

  const quickRevisionEligible = useMemo(
    () => canShowQuickRevision(activeChapter?.apiStatus, resolvedSeriesStatus),
    [activeChapter?.apiStatus, resolvedSeriesStatus],
  )
  const quickRevisionUi = quickRevisionFocus && quickRevisionEligible && !revisionMode
  const chapterPages = activeChapter?.pages ?? []
  const pages = useMemo(() => {
    const apiStatus = activeChapter?.apiStatus ?? null
    const showEdited =
      shouldShowAssistantEditedOnAnnotate(apiStatus)
      || isChapterFullyAssistantApproved(activeChapterId)
    return chapterPages.map((p) => {
      const stamped =
        showEdited
        || p.assistantApproved
        || isAssistantPageApproved(activeChapterId, p.pageNumber)
        || Boolean(p.resultUrl && p.assistantApproved)
      // Có resultUrl từ task đã duyệt → luôn ưu tiên ảnh mới
      const preferResult =
        revisionMode
        || stamped
        || (Boolean(p.resultUrl) && (
          p.assistantApproved
          || isAssistantPageApproved(activeChapterId, p.pageNumber)
          || showEdited
        ))
      const page = (stamped || preferResult)
        ? { ...p, assistantApproved: true }
        : p
      return {
        ...page,
        url: getAnnotatorPageDisplayUrl(page, apiStatus, { preferResult }),
      }
    }).map((page) => {
      const pageId = page?.id ?? page?._id
      const draft = pageId ? quickRevisionDrafts[String(pageId)] : null
      if (!draft?.previewUrl) return page
      return { ...page, url: draft.previewUrl, quickRevisionDraft: true }
    })
  }, [
    chapterPages,
    activeChapter?.apiStatus,
    activeChapterId,
    revisionMode,
    quickRevisionDrafts,
  ])
  const pageKey = activeChapter ? `${activeChapterId}-${pageIndex}` : ''
  const currentPageId = pages[pageIndex]?.id ?? pages[pageIndex]?._id ?? null
  const currentPageMarkedDeleted = Boolean(
    currentPageId && quickRevisionDeletedPageIds[String(currentPageId)],
  )
  const isValidObjectId = (id) => typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id)
  const hideLegacyNotes =
    shouldHideLegacyAnnotatorNotes(
      activeChapter?.apiStatus,
      pages[pageIndex],
    )
    || isChapterFullyAssistantApproved(activeChapterId)
    || shouldShowAssistantEditedOnAnnotate(activeChapter?.apiStatus)
    || Boolean(pages[pageIndex]?.assistantApproved)
    || Boolean(pages[pageIndex]?.resultUrl && (
      isAssistantPageApproved(activeChapterId, pages[pageIndex]?.pageNumber)
      || pages[pageIndex]?.assistantApproved
    ))
  // Luôn hiện note trong state — cho phép tạo note mới sau khi duyệt
  const pageNotes = notes[pageKey] ?? []

  useEffect(() => {
    revisionDraftKeysRef.current.clear()
  }, [revisionMode, activeChapterId])

  useEffect(() => {
    setQuickRevisionDrafts((prev) => {
      Object.values(prev).forEach((d) => {
        if (d?.previewUrl) URL.revokeObjectURL(d.previewUrl)
      })
      return {}
    })
    setQuickRevisionNewPages((prev) => {
      prev.forEach((d) => {
        if (d?.previewUrl) URL.revokeObjectURL(d.previewUrl)
      })
      return []
    })
    setQuickRevisionDeletedPageIds({})
  }, [activeChapterId])

  useEffect(() => {
    legacyNotesClearedRef.current.clear()
  }, [activeChapterId])

  // Chỉ xóa note vòng cũ MỘT LẦN khi chuyển sang chế độ ảnh đã duyệt — không chặn note mới
  useEffect(() => {
    if (!hideLegacyNotes || !pageKey || !setNotes) return
    if (legacyNotesClearedRef.current.has(pageKey)) return
    legacyNotesClearedRef.current.add(pageKey)
    loadedNoteKeysRef.current.add(pageKey) // đánh dấu đã xử lý — không nạp lại note cũ từ BE
    setNotes((prev) => {
      if (!prev[pageKey]?.length) return prev
      return { ...prev, [pageKey]: [] }
    })
  }, [hideLegacyNotes, pageKey, setNotes])

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
  const coverLocked = isChapterCoverLocked(uploadTargetChapter?.apiStatus)
  const coverInteractive = Boolean(uploadTargetChapter) && !coverLocked && !coverBusy

  useEffect(() => {
    if (hiredAssistants.length === 1 && !sendAssistantId) {
      setSendAssistantId(String(hiredAssistants[0].assistantId))
    }
  }, [hiredAssistants, sendAssistantId])

  const persistNoteById = useCallback(async (stableKey, noteOverride = null) => {
    const page = pages[pageIndex]
    if (!workspaceApi?.savePageNote || !page?.id || !pageKey || !stableKey) return null

    const draftValue = draftTextRef.current.get(stableKey)
    let noteSnapshot = noteOverride

    if (!noteSnapshot) {
      setNotes((prev) => {
        const list = prev[pageKey] ?? []
        const found = list.find((n) => noteStableKey(n) === stableKey) ?? null
        if (!found) {
          noteSnapshot = null
          return prev
        }
        noteSnapshot =
          draftValue !== undefined ? { ...found, text: draftValue } : { ...found }
        if (draftValue === undefined) return prev
        return {
          ...prev,
          [pageKey]: list.map((n) =>
            noteStableKey(n) === stableKey ? { ...n, text: draftValue } : n,
          ),
        }
      })
    } else if (draftValue !== undefined && noteOverride) {
      noteSnapshot = { ...noteOverride, text: draftValue }
    }

    if (draftValue !== undefined) {
      draftTextRef.current.delete(stableKey)
    }

    if (!noteSnapshot) return null

    const text = String(noteSnapshot.text ?? '').trim()
    const hasServerId =
      noteSnapshot.id
      && !String(noteSnapshot.id).startsWith('note-')
    // BE yêu cầu text — ô mới chưa gõ thì chỉ giữ local, không POST
    if (!text && !hasServerId) return noteSnapshot

    const toSave = text
      ? noteSnapshot
      : { ...noteSnapshot, text: 'Cần xử lý.' }

    try {
      await workspaceApi.savePageNote(page.id, pageKey, toSave)
    } catch {
      /* giữ bản local, thử lại lần sau */
    }
    return toSave
  }, [pageIndex, pageKey, pages, workspaceApi, setNotes])

  const flushNotesBeforeSend = useCallback(async () => {
    for (const timerId of Object.values(noteSaveTimersRef.current)) {
      window.clearTimeout(timerId)
    }
    noteSaveTimersRef.current = {}

    // Đọc chữ đang gõ trên DOM (defaultValue không luôn đồng bộ notes state)
    for (const [stableKey, el] of noteTextareaRefs.current.entries()) {
      if (el && typeof el.value === 'string') {
        draftTextRef.current.set(String(stableKey), el.value)
      }
    }

    // 1) Gộp draft text vào snapshot TRƯỚC (tránh race setState)
    const snapshot = {}
    for (const [pk, list] of Object.entries(notes)) {
      snapshot[pk] = (list ?? []).map((n) => {
        const key = noteStableKey(n)
        const draft = draftTextRef.current.get(key)
        return draft !== undefined ? { ...n, text: draft } : n
      })
    }

    // 2) Đồng bộ UI state + xóa draft đã merge
    setNotes((prev) => {
      const next = { ...prev }
      for (const [pk, list] of Object.entries(snapshot)) {
        next[pk] = list
      }
      return next
    })
    draftTextRef.current.clear()

    // 3) Persist từng note đã có chữ (hoặc đã có id BE)
    for (const [pk, list] of Object.entries(snapshot)) {
      for (const note of list ?? []) {
        const key = noteStableKey(note)
        const text = String(note.text ?? '').trim()
        const hasServerId = note.id && !String(note.id).startsWith('note-')
        if (!text && !hasServerId) continue
        if (pk === pageKey) {
          await persistNoteById(key, note)
        } else if (workspaceApi?.savePageNote) {
          const pageIdx = Number(String(pk).split('-').pop())
          const chapterPage = pages[pageIdx]
          if (!chapterPage?.id) continue
          try {
            await workspaceApi.savePageNote(
              chapterPage.id,
              pk,
              text ? note : { ...note, text: 'Cần xử lý.' },
            )
          } catch {
            /* syncChapterNotes sẽ thử lại */
          }
        }
      }
    }

    return snapshot
  }, [
    notes,
    persistNoteById,
    pageKey,
    pages,
    workspaceApi,
    setNotes,
  ])

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
    const assistantId = sendAssistantId
      ? String(sendAssistantId)
      : (hiredAssistants.length === 1 ? String(hiredAssistants[0].assistantId) : null)
    if (workspaceApi?.createChapter && seriesMeta?.id) {
      if (!assistantId) {
        setUploadRejectMessage('Chọn Assistant trước khi tạo chapter.')
        return
      }
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
    hiredAssistants, sendAssistantId,
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
    const assistantId = sendAssistantId
      ? String(sendAssistantId)
      : (hiredAssistants.length === 1 ? String(hiredAssistants[0].assistantId) : null)

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
          if (!assistantId) {
            setUploadRejectMessage('Chọn Assistant trước khi tạo chapter.')
            setUploadUi(null)
            if (hasProgress) onUploadProgress(trimmedSeries, 0)
            return
          }
          try {
            if (hasProgress) {
              onUploadProgress(trimmedSeries, 70)
              setUploadUi({
                series: trimmedSeries,
                chapter: target.num,
                pct: 70,
              })
            }
            const ch = await workspaceApi.createChapterWithPages(
              seriesMeta.id,
              trimmedSeries,
              target.num,
              assistantId,
              filesToAdd,
              { coverFile: target.cover?.file ?? null },
            )
            setChapters(prev => prev.map(c => (c.id !== targetId ? c : ch)))
            setActiveChapterId(ch.id)
            setPageIndex(0)
            setUploadRejectMessage(null)
            if (hasProgress) onUploadProgress(trimmedSeries, 100)
            setUploadUi(null)
            if (target.cover?.file && !ch.cover?.url) {
              toast.warning('Chapter đã tạo nhưng chưa lưu được ảnh bìa — bạn có thể đặt lại sau.')
            }
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
    onUploadProgress, workspaceApi, seriesOptions, hiredAssistants, sendAssistantId,
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
    const validation = validateChapterCoverFile(file)
    if (!validation.ok) {
      setUploadRejectMessage(validation.message)
      return
    }

    const target = chapters.find((c) => c.id === activeChapterId)
    if (!target) return
    if (isChapterCoverLocked(target.apiStatus)) {
      setUploadRejectMessage('Chapter đã published — không đổi ảnh bìa được.')
      return
    }

    const isServerChapter = /^[0-9a-f]{24}$/i.test(String(activeChapterId))

    try {
      const url = await fileToStorableDataUrl(file)
      // Preview local trước; giữ File để upload khi tạo chapter / PATCH cover
      setChapters((prev) =>
        prev.map((c) =>
          c.id === activeChapterId
            ? { ...c, cover: { url, name: file.name, file } }
            : c,
        ),
      )
      setUploadRejectMessage(null)

      if (isServerChapter && workspaceApi?.updateChapterCover) {
        setCoverBusy(true)
        try {
          await workspaceApi.updateChapterCover(activeChapterId, file)
          toast.success('Đã cập nhật ảnh bìa chapter.')
        } catch (err) {
          setUploadRejectMessage(
            getApiErrorMessage(err, 'Không lưu được ảnh bìa lên server.'),
          )
        } finally {
          setCoverBusy(false)
        }
      }
    } catch {
      setUploadRejectMessage('Không đọc được ảnh bìa — thử lại.')
    }
  }, [activeChapterId, chapters, setChapters, workspaceApi])

  function onCoverChange(e) {
    void handleCoverFile(e.target.files?.[0])
    e.target.value = ''
  }

  function onCoverDrop(e) {
    e.preventDefault()
    void handleCoverFile(e.dataTransfer.files?.[0])
  }

  const handleQuickReplaceFile = useCallback((file) => {
    if (!file) return
    if (!quickRevisionEligible) return
    if (!currentPageId) {
      toast.error('Không tìm thấy page_id hợp lệ để thay ảnh trang này.')
      return
    }
    const validation = validateChapterCoverFile(file)
    if (!validation.ok) {
      toast.error(validation.message)
      return
    }
    const pageId = String(currentPageId)
    setQuickRevisionDeletedPageIds((prev) => {
      if (!prev[pageId]) return prev
      const next = { ...prev }
      delete next[pageId]
      return next
    })
    const previewUrl = URL.createObjectURL(file)
    setQuickRevisionDrafts((prev) => {
      const next = { ...prev }
      const old = next[pageId]
      if (old?.previewUrl) URL.revokeObjectURL(old.previewUrl)
      next[pageId] = {
        file,
        previewUrl,
        pageNumber: pageIndex + 1,
      }
      return next
    })
    toast.success(`Đã chọn ảnh thay thế cho trang ${pageIndex + 1}.`)
  }, [currentPageId, pageIndex, quickRevisionEligible])

  function onQuickReplaceChange(e) {
    const file = e.target.files?.[0]
    if (!file) {
      e.target.value = ''
      // Edge/Chromium đôi khi giữ state input sau Cancel; remount input để click lại luôn mở picker.
      setQuickReplaceInputKey((k) => k + 1)
      return
    }
    handleQuickReplaceFile(file)
    e.target.value = ''
    setQuickReplaceInputKey((k) => k + 1)
  }

  const openQuickReplacePicker = useCallback(() => {
    if (!quickRevisionEligible) {
      toast.error('Chapter/series hiện tại chưa đủ điều kiện Quick Revision.')
      return
    }
    if (!currentPageId) {
      toast.error('Không tìm thấy page_id hợp lệ để thay ảnh trang này.')
      return
    }
    const totalChanges =
      Object.keys(quickRevisionDrafts).length
      + quickRevisionNewPages.length
      + Object.keys(quickRevisionDeletedPageIds).length
    const atLimit =
      totalChanges >= QUICK_REVISION_MAX_PAGES
      && !quickRevisionDrafts[String(currentPageId)]
    if (atLimit) {
      toast.error(`Quick revision tối đa ${QUICK_REVISION_MAX_PAGES} trang mỗi lần.`)
      return
    }
    const input = quickReplaceFileRef.current
    if (!input) {
      toast.error('Không mở được hộp chọn ảnh. Vui lòng tải lại trang.')
      return
    }
    input.value = ''
    input.click()
  }, [currentPageId, quickRevisionDeletedPageIds, quickRevisionDrafts, quickRevisionEligible, quickRevisionNewPages.length])

  const onQuickNewPagesChange = useCallback((e) => {
    const picked = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!picked.length) return
    if (!quickRevisionEligible) {
      toast.error('Chapter/series hiện tại chưa đủ điều kiện Quick Revision.')
      return
    }
    const existing =
      Object.keys(quickRevisionDrafts).length
      + quickRevisionNewPages.length
      + Object.keys(quickRevisionDeletedPageIds).length
    const room = Math.max(0, QUICK_REVISION_MAX_PAGES - existing)
    if (room <= 0) {
      toast.error(`Quick revision tối đa ${QUICK_REVISION_MAX_PAGES} thay đổi mỗi lần.`)
      return
    }
    const accepted = []
    for (const file of picked.slice(0, room)) {
      const validation = validateChapterCoverFile(file)
      if (!validation.ok) {
        toast.error(validation.message)
        continue
      }
      accepted.push({
        id: `quick-new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        previewUrl: URL.createObjectURL(file),
      })
    }
    if (!accepted.length) return
    setQuickRevisionNewPages((prev) => [...prev, ...accepted])
    toast.success(`Đã thêm ${accepted.length} trang mới cho quick revision.`)
  }, [quickRevisionDeletedPageIds, quickRevisionDrafts, quickRevisionEligible, quickRevisionNewPages.length])

  const clearQuickRevisionDraft = useCallback((pageId) => {
    const key = String(pageId ?? '')
    if (!key) return
    setQuickRevisionDrafts((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      if (next[key]?.previewUrl) URL.revokeObjectURL(next[key].previewUrl)
      delete next[key]
      return next
    })
  }, [])

  const removeCover = useCallback(async () => {
    if (!activeChapterId) return
    const target = chapters.find((c) => c.id === activeChapterId)
    if (!target) return
    if (isChapterCoverLocked(target.apiStatus)) {
      setUploadRejectMessage('Chapter đã published — không xóa ảnh bìa được.')
      return
    }

    const isServerChapter = /^[0-9a-f]{24}$/i.test(String(activeChapterId))
    if (isServerChapter && workspaceApi?.removeChapterCover) {
      setCoverBusy(true)
      try {
        await workspaceApi.removeChapterCover(activeChapterId)
        toast.success('Đã gỡ ảnh bìa chapter.')
      } catch (err) {
        setUploadRejectMessage(
          getApiErrorMessage(err, 'Không gỡ được ảnh bìa trên server.'),
        )
        setCoverBusy(false)
        return
      } finally {
        setCoverBusy(false)
      }
    }

    setChapters((prev) =>
      prev.map((c) => (c.id === activeChapterId ? { ...c, cover: null } : c)),
    )
  }, [activeChapterId, chapters, setChapters, workspaceApi])

  const deleteChapter = useCallback(async (chapterId) => {
    if (!chapterId) return
    const target = chapters.find((c) => c.id === chapterId)
    if (!target) return

    const apiStatus = String(target.apiStatus ?? '').toLowerCase()
    const isServerChapter = /^[0-9a-f]{24}$/i.test(String(chapterId))
    const pageCount = Array.isArray(target.pages) ? target.pages.length : 0
    const deletableStatuses = new Set(['draft', 'pending_assistant', ''])

    if (isServerChapter && pageCount > 0) {
      toast.error('Chỉ xóa được chapter chưa có trang nào.')
      return
    }
    if (isServerChapter && apiStatus && !deletableStatuses.has(apiStatus)) {
      toast.error(
        `Chỉ xóa được chapter bản nháp hoặc đang chờ Assistant (hiện tại: "${apiStatus}").`,
      )
      return
    }

    const label = `Ch. ${target.num}`
    const isPendingAssistant = apiStatus === 'pending_assistant'
    const confirmMsg = isPendingAssistant
      ? `Xóa ${label}?\n\nChapter đang chờ Assistant nhưng chưa có trang. Xóa sẽ gỡ khỏi hàng chờ Assistant. Không hoàn tác được.`
      : `Xóa ${label}? Chapter chưa có trang. Hành động không thể hoàn tác.`

    if (typeof window !== 'undefined' && !window.confirm(confirmMsg)) {
      return
    }

    if (isServerChapter && workspaceApi?.deleteChapter) {
      try {
        await workspaceApi.deleteChapter(chapterId)
        toast.success(`Đã xóa ${label}.`)
      } catch (err) {
        toast.error(getApiErrorMessage(err, 'Không xóa được chapter.'))
        return
      }
    }

    setChapters((prev) => prev.filter((c) => c.id !== chapterId))
    setNotes((prev) => {
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
  }, [
    chapters,
    activeChapterId,
    setChapters,
    setNotes,
    setActiveChapterId,
    setPageIndex,
    workspaceApi,
  ])

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
    if (revisionMode) revisionDraftKeysRef.current.add(String(clientKey))
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
    // Luôn force khi mở annotate — tránh cache ảnh gốc thiếu result_image_url
    void workspaceApi.loadChapterPages(activeChapterId, { force: true })
  }, [activeChapterId, workspaceApi?.loadChapterPages])

  useEffect(() => {
    // Sau duyệt Assistant / revision: không nạp note cũ từ BE (đã xóa 1 lần ở effect trên)
    if (revisionMode || hideLegacyNotes) return
    if (!workspaceApi?.loadPageNotes || !currentPageId || !pageKey) return
    if (!isValidObjectId(currentPageId)) return
    if (loadedNoteKeysRef.current.has(pageKey)) return
    loadedNoteKeysRef.current.add(pageKey)
    void workspaceApi.loadPageNotes(currentPageId, pageKey)
  }, [
    currentPageId,
    pageKey,
    workspaceApi?.loadPageNotes,
    isValidObjectId,
    revisionMode,
    hideLegacyNotes,
  ])

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
    const removedId = String(removed?.id ?? removed?._id ?? '')
    const canDeleteViaQuickRevision =
      quickRevisionEligible
      && /^[0-9a-f]{24}$/i.test(removedId)
      && !String(removedId).startsWith('quick-new-')
    if (canDeleteViaQuickRevision) {
      setQuickRevisionDeletedPageIds((prev) => {
        const next = { ...prev }
        if (next[removedId]) {
          delete next[removedId]
          toast.success(`Đã bỏ đánh dấu xóa trang ${idx + 1}.`)
        } else {
          next[removedId] = true
          toast.success(`Đã đánh dấu xóa trang ${idx + 1}.`)
        }
        return next
      })
      setQuickRevisionDrafts((prev) => {
        const next = { ...prev }
        if (next[removedId]?.previewUrl) URL.revokeObjectURL(next[removedId].previewUrl)
        delete next[removedId]
        return next
      })
      return
    }
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
  }, [activeChapter, activeChapterId, pageIndex, chapters, quickRevisionEligible, setChapters, setNotes, setActiveChapterId, setPageIndex, workspaceApi])

  const draftRect = drawStart && drawCurrent ? {
    x: Math.min(drawStart.x, drawCurrent.x),
    y: Math.min(drawStart.y, drawCurrent.y),
    w: Math.abs(drawCurrent.x - drawStart.x),
    h: Math.abs(drawCurrent.y - drawStart.y),
  } : null

  const totalNotes = activeChapter
    ? pages.reduce((sum, _, i) => sum + (notes[`${activeChapterId}-${i}`]?.length ?? 0), 0)
    : 0

  const needsAssistantForUpload = !quickRevisionEligible
  const canUpload = seriesOptions.length > 0
    && selectedSeriesTitle.trim().length > 0
    && !!uploadTargetChapter
    && (!needsAssistantForUpload || hiredAssistants.length === 0 || !!sendAssistantId)
    && !coverBusy
    && !uploadUi
    && !quickRevisionEligible

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
            {quickRevisionEligible
              ? (compact ? (currentPageMarkedDeleted ? 'Bỏ xóa' : 'Xóa') : (currentPageMarkedDeleted ? 'Bỏ đánh dấu xóa' : 'Đánh dấu xóa'))
              : (compact ? 'Gỡ' : 'Gỡ trang')}
          </Button>
        ) : null}
        {quickRevisionEligible && currentPageId && /^[0-9a-f]{24}$/i.test(String(currentPageId)) ? (
          <>
            <input
              key={quickReplaceInputKey}
              ref={quickReplaceFileRef}
              type="file"
              accept={CHAPTER_COVER_ACCEPT}
              className="sr-only"
              onChange={onQuickReplaceChange}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={navBtnCls}
              disabled={currentPageMarkedDeleted}
              onClick={openQuickReplacePicker}
              title="Chọn ảnh thay thế cho trang đang xem"
            >
              <Upload className="size-3.5" />
              {compact ? 'Thay ảnh' : 'Thay ảnh trang'}
            </Button>
            {quickRevisionDrafts[String(currentPageId)] ? (
              <Button
                size="sm"
                variant="ghost"
                className={cn(
                  onDark
                    ? 'text-zinc-400 hover:text-zinc-200'
                    : 'text-muted-foreground',
                )}
                onClick={() => clearQuickRevisionDraft(currentPageId)}
                title="Huỷ ảnh thay thế"
              >
                <X className="size-3.5" />
              </Button>
            ) : null}
          </>
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
          const pgId = String(pg?.id ?? pg?._id ?? '')
          const markedDeleted = Boolean(quickRevisionDeletedPageIds[pgId])
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
              {pg.quickRevisionDraft ? (
                <Badge className="absolute bottom-0 left-0 h-3 rounded-none rounded-tr px-0.5 text-[8px]" variant="secondary">
                  thay
                </Badge>
              ) : null}
              {markedDeleted ? (
                <Badge className="absolute bottom-0 right-0 h-3 rounded-none rounded-tl px-0.5 text-[8px]" variant="destructive">
                  xóa
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

  function QuickRevisionBar({ compact = false, embedded = false }) {
    const draftEntries = Object.entries(quickRevisionDrafts)
    const deletedIds = Object.keys(quickRevisionDeletedPageIds)
    const totalChanges = draftEntries.length + quickRevisionNewPages.length + deletedIds.length
    const atLimit = totalChanges >= QUICK_REVISION_MAX_PAGES
    const canSubmit =
      totalChanges > 0
      && totalChanges <= QUICK_REVISION_MAX_PAGES
      && activeChapter
      && onQuickRevision
      && /^[0-9a-f]{24}$/i.test(String(activeChapter.id))

    const handleSubmit = async () => {
      if (!canSubmit || quickRevisionBusy) return
      setQuickRevisionBusy(true)
      try {
        const items = draftEntries
          .filter(([pageId]) => !quickRevisionDeletedPageIds[pageId])
          .map(([pageId, draft]) => ({
            pageId,
            file: draft.file,
            pageNumber: draft.pageNumber ?? 0,
          }))
          .sort((a, b) => a.pageNumber - b.pageNumber)
        const submitted = await onQuickRevision({
          chapter: activeChapter,
          items,
          newPages: quickRevisionNewPages.map((d) => d.file),
          deletedPageIds: deletedIds,
        })
        if (submitted === false) return
        Object.values(quickRevisionDrafts).forEach((d) => {
          if (d?.previewUrl) URL.revokeObjectURL(d.previewUrl)
        })
        quickRevisionNewPages.forEach((d) => {
          if (d?.previewUrl) URL.revokeObjectURL(d.previewUrl)
        })
        setQuickRevisionDrafts({})
        setQuickRevisionNewPages([])
        setQuickRevisionDeletedPageIds({})
      } catch {
        // Parent shows toast
      } finally {
        setQuickRevisionBusy(false)
      }
    }

    return (
      <div className={cn(
        'rounded-xl border border-sky-200/90 bg-sky-50/90 p-3 dark:border-sky-500/30 dark:bg-sky-500/10',
        compact && 'p-2',
        embedded && !compact && 'border-sky-500/25 bg-zinc-900/90',
      )}>
        <p className={cn(
          'text-xs font-semibold text-sky-800 dark:text-sky-200',
          embedded && 'text-sky-300',
        )}>
          Sửa nhanh & gửi TE
        </p>
        <p className={cn(
          'mt-1 text-[11px] leading-relaxed text-sky-900/80 dark:text-sky-100/80',
          embedded && 'text-zinc-400',
        )}>
          Có thể thay, thêm mới, hoặc xóa trang (tối đa {QUICK_REVISION_MAX_PAGES} thay đổi/lần), rồi gửi thẳng cho TE.
        </p>
        {totalChanges > 0 ? (
          <p className={cn(
            'mt-2 text-[11px] font-medium text-sky-800 dark:text-sky-200',
            embedded && 'text-zinc-300',
          )}>
            Thay: {draftEntries
              .map(([, d]) => d.pageNumber)
              .sort((a, b) => a - b)
              .join(', ') || '0'} ·
            Thêm: {quickRevisionNewPages.length} ·
            Xóa: {deletedIds.length}
          </p>
        ) : (
          <p className={cn(
            'mt-2 text-[11px] text-muted-foreground',
            embedded && 'text-zinc-500',
          )}>
            Bấm &quot;Thay ảnh trang&quot;, &quot;Gỡ trang&quot; hoặc thêm trang mới.
          </p>
        )}
        <input
          ref={quickNewPagesFileRef}
          type="file"
          accept={CHAPTER_COVER_ACCEPT}
          className="sr-only"
          multiple
          onChange={onQuickNewPagesChange}
        />
        <Button
          size="sm"
          variant="outline"
          className="mt-2 h-8 w-full text-xs"
          disabled={atLimit}
          onClick={() => quickNewPagesFileRef.current?.click()}
        >
          <Plus className="size-3 shrink-0" />
          Thêm trang mới
        </Button>
        <Button
          size="sm"
          className="mt-2 h-8 w-full bg-sky-600 text-xs text-white hover:bg-sky-700"
          disabled={!canSubmit || quickRevisionBusy}
          onClick={() => { void handleSubmit() }}
        >
          <Send className="size-3 shrink-0" />
          {quickRevisionBusy ? 'Đang gửi…' : 'Sửa nhanh & gửi TE'}
        </Button>
        {atLimit ? (
          <p className="mt-1.5 text-[10px] text-amber-700 dark:text-amber-300">
            Đã đạt giới hạn {QUICK_REVISION_MAX_PAGES} thay đổi — gửi lần này hoặc giảm thao tác.
          </p>
        ) : null}
      </div>
    )
  }

  function SendActionsBar({ compact = false, embedded = false, inline = false }) {
    const handleAssistant = async () => {
      const sendHandler = revisionMode ? onSendRevision : onSendToAssistant
      if (!activeChapter || !sendHandler || sendingToAssistant) return
      setSendingToAssistant(true)
      try {
        const syncedNotes = await flushNotesBeforeSend()
        const notesForSend = revisionMode
          ? Object.fromEntries(
              Object.entries(syncedNotes).map(([key, list]) => [
                key,
                (list ?? []).filter((n) =>
                  revisionDraftKeysRef.current.has(String(noteStableKey(n))),
                ),
              ]),
            )
          : syncedNotes
        await sendHandler({
          chapter: activeChapter,
          pages,
          assistantId: sendAssistantId,
          notesByPage: notesForSend,
        })
      } finally {
        setSendingToAssistant(false)
      }
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
          <Button
            size="sm"
            disabled={
              !activeChapter
              || pages.length === 0
              || (!revisionMode && !sendAssistantId)
              || sendingToAssistant
            }
            onClick={() => { void handleAssistant() }}
            className="h-8 w-full min-w-0 text-xs"
          >
            <Send className="size-3 shrink-0" />
            {sendingToAssistant
              ? 'Đang gửi…'
              : (revisionMode ? 'Gửi yêu cầu sửa cho Assistant' : 'Gửi Assistant')}
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
      <div className="space-y-1.5 rounded-xl border border-gray-200/80 bg-white p-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
          Assistant
        </p>
        {assistantReady ? (
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-sm font-semibold text-gray-900">
              {hiredAssistants.find(a => String(a.assistantId) === String(sendAssistantId))?.label ?? sendAssistantId}
            </p>
            <button
              type="button"
              onClick={() => setSendAssistantId('')}
              className="shrink-0 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-100"
            >
              Đổi
            </button>
          </div>
        ) : hiredAssistants.length > 0 ? (
          <Select
            value={sendAssistantId ? String(sendAssistantId) : undefined}
            onValueChange={setSendAssistantId}
          >
            <SelectTrigger className="h-9 w-full min-w-0 rounded-lg border border-gray-200 bg-gray-50/50 text-sm shadow-none">
              <SelectValue placeholder="— Chọn Assistant —" />
            </SelectTrigger>
            <SelectContent>
              {hiredAssistants.map(a => (
                <SelectItem key={a.assistantId} value={String(a.assistantId)}>
                  {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p className="text-[11px] leading-relaxed text-gray-500">
            Chưa có Assistant — {onOpenAssistantsTab ? (
              <button type="button" className="font-medium text-red-600 underline-offset-2 hover:underline" onClick={onOpenAssistantsTab}>
                thuê ngay
              </button>
            ) : (
              <span>thuê ở tab Thuê Assistant</span>
            )}.
          </p>
        )}
      </div>
    )
  }

  const uploadStepActive = quickRevisionUi
    ? (Object.keys(quickRevisionDrafts).length > 0 ? 2 : 1)
    : (Boolean(sendAssistantId)
      ? (activeChapterId ? 3 : 2)
      : 1)

  const uploadSteps = quickRevisionUi
    ? [
        { id: 1, label: '1 · Chọn trang' },
        { id: 2, label: '2 · Thay ảnh & gửi TE' },
      ]
    : quickRevisionEligible
      ? [
          { id: 1, label: '1 · Thay ảnh trang' },
          { id: 2, label: '2 · Ghi chú & gửi TE' },
        ]
      : [
          { id: 1, label: '1 · Assistant' },
          { id: 2, label: '2 · Upload' },
          { id: 3, label: '3 · Ghi chú' },
        ]

  return (
    <div className="mk-annotate mx-auto max-w-5xl space-y-5 bg-gray-50/50 px-4 py-6">
      {revisionMode ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <strong>Yêu cầu Assistant sửa lại:</strong>{' '}
          khoanh vùng trên bản Assistant đã gửi, nhập ghi chú rồi bấm
          {' '}“Gửi yêu cầu sửa cho Assistant”.
        </div>
      ) : null}
      {quickRevisionEligible && !revisionMode ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-xs text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100">
          <strong>{quickRevisionUi ? 'Sửa nhanh & gửi TE' : 'Quick Revision'}:</strong>{' '}
          thay / thêm mới / xóa trang (tối đa {QUICK_REVISION_MAX_PAGES} thay đổi/lần) rồi gửi thẳng cho TE.
          Nhiều hơn {QUICK_REVISION_MAX_PAGES} thay đổi → dùng luồng Assistant.
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        {pendingReviewCount > 0 ? (
          <div className="flex shrink-0 items-center gap-2 rounded-xl border border-gray-200/80 bg-white px-3 py-2">
            <p className="text-xs text-gray-700">
              <strong>{pendingReviewCount}</strong> chờ duyệt
            </p>
            <Button size="xs" asChild className="h-7 bg-red-600 px-2.5 text-[11px] text-white hover:bg-red-700">
              <Link to="/mangaka/review">Duyệt</Link>
            </Button>
          </div>
        ) : null}
        <div className={cn(
          'grid min-w-0 flex-1 gap-1 rounded-xl bg-gray-200/60 p-1 text-center text-xs font-medium',
          quickRevisionUi || quickRevisionEligible ? 'grid-cols-2' : 'grid-cols-3',
        )}>
          {uploadSteps.map((step) => {
            const isActive = uploadStepActive === step.id
            return (
              <span
                key={step.id}
                className={cn(
                  'rounded-lg py-2',
                  isActive
                    ? 'bg-white font-semibold text-gray-900 shadow-xs'
                    : 'text-gray-500',
                )}
              >
                {step.label}
              </span>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-[260px_1fr]">
        <aside className="space-y-3">
          {!quickRevisionUi && !quickRevisionEligible ? <AssistantPicker /> : null}

          <div className="space-y-3 rounded-xl border border-gray-200/80 bg-white p-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                Series
              </Label>
              <Select
                value={seriesOptions.some(s => s.title === selectedSeriesTitle) ? selectedSeriesTitle : ''}
                onValueChange={(v) => onSelectedSeriesTitleChange(v)}
                disabled={seriesOptions.length === 0}
              >
                <SelectTrigger className="h-9 rounded-lg border border-gray-200 bg-gray-50/50 text-sm shadow-none">
                  <SelectValue placeholder="— Chọn series —" />
                </SelectTrigger>
                <SelectContent>
                  {seriesOptions.map(s => (
                    <SelectItem key={s.id} value={s.title}>{s.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <button
              type="button"
              disabled={!selectedSeriesTitle.trim()}
              onClick={createNewChapter}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-red-600 py-2.5 text-xs font-medium text-white shadow-xs transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="size-3.5" />
              Tạo Chapter {nextChapterNum}
            </button>

            {seriesChapters.length === 0 ? (
              <p className="text-[11px] text-gray-400">Chưa có chapter — tạo Ch. {nextChapterNum}.</p>
            ) : (
              <ul className="max-h-[350px] space-y-2 overflow-y-auto">
                {seriesChapters.map(ch => {
                  const isPick = ch.id === activeChapterId
                  const noteCount = countChapterNotes(ch.id, ch.pages, notes)
                  const seriesMeta = seriesOptions.find((s) => s.title === ch.series)
                  const thumb = resolveChapterCoverDisplay({
                    coverImageUrl: ch.cover?.url,
                    page1OriginalUrl: getPage1OriginalUrl(ch.pages),
                    seriesCoverUrl: seriesMeta?.coverImage,
                  })
                  const status = String(ch.apiStatus ?? '').toLowerCase()
                  const isLocalId = !/^[0-9a-f]{24}$/i.test(String(ch.id))
                  const pageCount = Array.isArray(ch.pages) ? ch.pages.length : 0
                  // Khớp BE: draft | pending_assistant + 0 page (hoặc chapter local chưa sync)
                  const canDelete =
                    isLocalId
                    || (
                      pageCount === 0
                      && (!status || status === 'draft' || status === 'pending_assistant')
                    )
                  const deleteTitle =
                    status === 'pending_assistant'
                      ? `Xóa Ch. ${ch.num} (đang chờ Assistant, chưa có trang)`
                      : `Xóa Ch. ${ch.num}`
                  return (
                    <li
                      key={ch.id}
                      className={cn(
                        'group flex items-center gap-2 rounded-lg border px-2 py-1.5 transition-colors',
                        isPick
                          ? 'border-red-200 bg-red-50'
                          : 'border-gray-100 bg-gray-50/40 hover:border-gray-200 hover:bg-white',
                      )}
                    >
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
                        onClick={() => activateChapter(ch, 0)}
                      >
                        <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-gray-100 bg-white">
                          {thumb ? (
                            <img src={thumb} alt="" className="size-full object-cover" />
                          ) : (
                            <ImageIcon className="size-3.5 text-gray-400" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-gray-900">Ch. {ch.num}</p>
                          <p className="text-[10px] text-gray-500">
                            {ch.pages.length} trang{ch.cover ? ' · bìa' : ''}
                            {noteCount > 0 ? ` · ${noteCount} ô` : ''}
                          </p>
                        </div>
                      </button>
                      {canDelete ? (
                        <Button
                          type="button"
                          size="xs"
                          variant="ghost"
                          className="size-7 shrink-0 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          title={deleteTitle}
                          aria-label={deleteTitle}
                          onClick={(e) => {
                            e.stopPropagation()
                            void deleteChapter(ch.id)
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </aside>

        <section className="space-y-5 rounded-2xl border border-gray-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-gray-900">
              Upload{uploadTargetChapter ? <> — <strong>Ch. {uploadTargetChapter.num}</strong></> : null}
            </h3>
            {uploadTargetChapter ? (
              <Badge variant="outline" className="border-gray-200 text-[10px] text-gray-600">
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
            accept={CHAPTER_COVER_ACCEPT}
            hidden
            disabled={!coverInteractive}
            onChange={onCoverChange}
          />

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-gray-600">
                Ảnh bìa <span className="font-normal text-gray-400">(tuỳ chọn)</span>
              </p>
              {uploadTargetChapter?.cover && coverInteractive ? (
                <Button
                  size="xs"
                  variant="ghost"
                  className="h-7 text-destructive"
                  disabled={coverBusy}
                  onClick={() => { void removeCover() }}
                >
                  <Trash2 className="size-3" />
                  Gỡ
                </Button>
              ) : null}
            </div>
            {coverBusy ? (
              <p className="text-[11px] text-gray-500">Đang lưu ảnh bìa...</p>
            ) : null}
            {coverLocked ? (
              <p className="text-[11px] text-amber-700 dark:text-amber-300">
                Chapter đã published — không đổi / xóa ảnh bìa.
              </p>
            ) : null}
            {uploadTargetChapter?.cover ? (
              <div className="flex h-24 items-center gap-3 rounded-xl border border-gray-200 bg-gray-50/50 px-3">
                <button
                  type="button"
                  disabled={!coverInteractive}
                  onClick={() => coverInteractive && coverFileRef.current?.click()}
                  className="group relative h-16 w-12 shrink-0 overflow-hidden rounded-md border border-gray-100 bg-white disabled:cursor-not-allowed disabled:opacity-70"
                  title="Bấm để đổi ảnh bìa"
                >
                  <img src={uploadTargetChapter.cover.url} alt="Ảnh bìa" className="size-full object-cover transition-transform group-hover:scale-105" />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">{uploadTargetChapter.cover.name || 'cover.png'}</p>
                  {coverInteractive ? (
                    <button
                      type="button"
                      disabled={coverBusy}
                      onClick={() => coverFileRef.current?.click()}
                      className="mt-1 text-[11px] font-medium text-red-600 hover:underline disabled:opacity-50"
                    >
                      Đổi ảnh
                    </button>
                  ) : (
                    <p className="text-[11px] text-gray-500">Không thể chỉnh sửa.</p>
                  )}
                </div>
              </div>
            ) : (
              <div
                className={cn(
                  'flex h-24 cursor-pointer items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 transition-colors',
                  coverInteractive
                    ? 'hover:border-red-400'
                    : 'cursor-not-allowed opacity-60',
                )}
                onDrop={coverInteractive ? onCoverDrop : e => e.preventDefault()}
                onDragOver={e => e.preventDefault()}
                onClick={() => { if (coverInteractive) coverFileRef.current?.click() }}
                role={coverInteractive ? 'button' : undefined}
              >
                <ImageIcon className="size-5 text-gray-400" />
                <div className="text-left">
                  <p className="text-xs font-medium text-gray-700">Chọn ảnh bìa</p>
                  <p className="text-[11px] text-gray-400">
                    {!uploadTargetChapter
                      ? 'Tạo / chọn chapter trước'
                      : coverLocked
                        ? 'Chapter đã published'
                        : 'JPEG/PNG/WEBP · tối đa 10MB'}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div
            className={cn(
              'flex min-h-[220px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/30 p-6 text-center transition-all',
              canUpload
                ? 'hover:border-red-400 hover:bg-red-50/10'
                : 'cursor-not-allowed opacity-60',
              uploadUi && 'border-red-400 bg-red-50/20',
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
            <div className="flex size-11 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <Upload className="size-5" />
            </div>
            <p className="text-sm font-medium text-gray-900">
              {quickRevisionEligible
                ? 'Quick Revision — thay ảnh trang đã có'
                : 'Kéo thả ảnh trang hoặc bấm để chọn'}
            </p>
            {uploadUi ? (
              <p className="text-xs text-red-600">
                Đang tải <strong>{uploadUi.series}</strong> · Ch. <strong>{uploadUi.chapter}</strong> · {uploadUi.pct}%
              </p>
            ) : quickRevisionEligible ? (
              <p className="text-xs text-sky-700">
                Quick Revision hỗ trợ thay, thêm mới, xóa trang — thao tác ở phần Ghi chú bên dưới.
              </p>
            ) : (
              <p className="text-xs text-gray-500">
                {!selectedSeriesTitle.trim()
                  ? 'Chọn series bên trái'
                  : !uploadTargetChapter
                    ? 'Tạo hoặc chọn chapter bên trái'
                    : (needsAssistantForUpload && hiredAssistants.length > 0 && !sendAssistantId)
                      ? 'Chọn Assistant trước khi upload'
                      : `Thêm ảnh vào Ch. ${uploadTargetChapter.num} (${uploadTargetChapter.pages.length} trang đã có)`}
              </p>
            )}
            {!quickRevisionEligible ? (
              <p className="text-[11px] text-gray-400">
                Tối đa 20MB/ảnh • Hỗ trợ kéo thả nhiều trang cùng lúc
              </p>
            ) : null}
          </div>
        </section>
      </div>

      {activeChapter ? (
        <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="flex size-5 items-center justify-center rounded-md bg-gray-900 text-[10px] font-bold text-white">
                3
              </span>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Ghi chú trên trang</h3>
                <p className="text-[11px] text-gray-500">
                  <strong className="font-medium text-gray-700">{activeChapter.series}</strong> · Ch. <strong className="font-medium text-gray-700">{activeChapter.num}</strong>
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ToolButtons />
              <Button size="sm" variant="outline" className="h-8 border-gray-200" onClick={() => setIsFullscreen(true)}>
                <Maximize2 className="size-3.5" />
                Phóng to
              </Button>
              <Badge variant="secondary" className="text-[10px]">
                {totalNotes} ô · {pages.length} trang
              </Badge>
            </div>
          </div>
          <div className="space-y-3 p-4">
            <div className="flex items-center gap-3">
              <PageNav />
              <div className="min-w-0 flex-1 overflow-x-auto">
                <PageThumbs />
              </div>
            </div>
            <div
              className="flex h-[min(640px,calc(100vh-260px))] min-h-[420px] gap-3 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 p-3"
            >
              <div className="mk-board-stage-scroll min-h-0 min-w-0 flex-1 overflow-auto">
                <div className="flex justify-center p-1">
                  <CanvasBoard refEl={boardRef} />
                </div>
              </div>
              <aside className="flex h-full w-[min(280px,100%)] min-w-[240px] max-w-[280px] shrink-0 flex-col gap-3 overflow-hidden">
                <div className="min-h-0 flex-1 overflow-hidden">
                  {NotesPanel({ embedded: true })}
                </div>
                <div className="shrink-0 space-y-2">
                  {quickRevisionEligible ? (
                    <QuickRevisionBar embedded />
                  ) : null}
                  {revisionMode || !quickRevisionEligible ? (
                    SendActionsBar({ embedded: true })
                  ) : null}
                </div>
              </aside>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200/50 bg-gray-100/70 p-3 text-center text-xs font-medium text-gray-500">
          3 · Ghi chú & gửi — chọn hoặc tạo chapter để bắt đầu ghi chú và gửi Assistant.
        </div>
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
                <div className="shrink-0 space-y-2">
                  {quickRevisionEligible ? (
                    <QuickRevisionBar compact embedded />
                  ) : null}
                  {revisionMode || !quickRevisionEligible ? (
                    SendActionsBar({ compact: true })
                  ) : null}
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
