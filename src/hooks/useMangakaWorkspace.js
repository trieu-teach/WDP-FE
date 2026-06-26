import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { seriesService } from '@/api/series.service.js'
import { chaptersService } from '@/api/chapters.service.js'
import { getApiErrorMessage } from '@/api/http.js'
import {
  apiChapterToAnnotator,
  apiChapterToRow,
  apiNoteToUi,
  apiPageToUi,
  apiRankingToUi,
  apiSeriesToUi,
  uiChapterStatusToApi,
  uiNoteToApi,
  uiSeriesFormToApi,
} from '@/utils/apiMappers.js'
import {
  applySeriesFormUpdate,
  buildSeriesFromForm,
  normalizeSeriesList,
} from '@/utils/seriesModel.js'

export function useMangakaWorkspace(user) {
  const userId = user?.id ?? null
  const [seriesList, setSeriesList] = useState([])
  const [chapterRows, setChapterRows] = useState([])
  const [annotatorChapters, setAnnotatorChapters] = useState([])
  const [annotatorNotes, setAnnotatorNotes] = useState({})
  const [rankings, setRankings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const refreshInFlight = useRef(false)
  const chapterPagesFetchRef = useRef(new Set())
  const chapterPagesInflightRef = useRef(new Set())
  const chapterUploadTimeRef = useRef(new Map())
  const noteServerIdRef = useRef(new Map())

  const loadChaptersForSeries = useCallback(async (seriesItems) => {
    const rows = []
    const annotators = []

    await Promise.all(
      seriesItems.map(async (series) => {
        try {
          const { chapters, seriesName } = await seriesService.getChapters(series.id)
          const list = Array.isArray(chapters) ? chapters : []
          const title = seriesName || series.title
          for (const ch of list) {
            rows.push(apiChapterToRow(ch, title))
            annotators.push(apiChapterToAnnotator(ch, [], title))
          }
        } catch {
          // series chưa có chapter
        }
      }),
    )

    setChapterRows(rows)
    setAnnotatorChapters(annotators)
  }, [])

  const refresh = useCallback(async () => {
    if (refreshInFlight.current) return
    refreshInFlight.current = true
    setLoading(true)
    setError(null)
    try {
      const [mine, rankingRes] = await Promise.all([
        seriesService.getMine(),
        seriesService.getRanking().catch(() => []),
      ])
      const series = normalizeSeriesList(
        (Array.isArray(mine) ? mine : []).map((s, i) => apiSeriesToUi(s, i)),
      )
      setSeriesList(series)
      chapterPagesFetchRef.current.clear()
      chapterPagesInflightRef.current.clear()
      await loadChaptersForSeries(series)

      const rankingList = Array.isArray(rankingRes) ? rankingRes : (rankingRes?.data ?? [])
      setRankings(rankingList.map(apiRankingToUi))
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Không tải được workspace.')
      setError(msg)
      toast.error(msg)
    } finally {
      refreshInFlight.current = false
      setLoading(false)
    }
  }, [loadChaptersForSeries])

  useEffect(() => {
    if (!userId) {
      setSeriesList([])
      setChapterRows([])
      setAnnotatorChapters([])
      setRankings([])
      setLoading(false)
      return
    }
    void refresh()
  }, [userId, refresh])

  const loadChapterPages = useCallback(async (chapterId) => {
    let cached = []
    setAnnotatorChapters(prev => {
      const existing = prev.find(ch => ch.id === chapterId)
      if (existing?.pages?.length && existing.pages.every(p => p?.url)) {
        cached = existing.pages
      }
      return prev
    })
    if (cached.length) {
      chapterPagesFetchRef.current.add(chapterId)
      setAnnotatorChapters(prev => prev.map(ch =>
        ch.id === chapterId ? { ...ch, pages: cached } : ch,
      ))
      return cached
    }

    if (chapterPagesFetchRef.current.has(chapterId)) {
      let fromState = []
      setAnnotatorChapters(prev => {
        fromState = prev.find(ch => ch.id === chapterId)?.pages ?? []
        return prev
      })
      return fromState
    }

    const uploadTs = chapterUploadTimeRef.current.get(chapterId)
    if (uploadTs && Date.now() - uploadTs < 30_000) {
      chapterPagesFetchRef.current.add(chapterId)
      let fromState = []
      setAnnotatorChapters(prev => {
        fromState = prev.find(ch => ch.id === chapterId)?.pages ?? []
        return prev
      })
      return fromState
    }

    if (chapterPagesInflightRef.current.has(chapterId)) {
      return []
    }

    chapterPagesInflightRef.current.add(chapterId)
    try {
      const raw = await chaptersService.getPages(chapterId)
      const unwrapped = (() => {
        if (Array.isArray(raw)) return raw
        if (raw && typeof raw === 'object' && 'data' in raw) {
          const inner = raw.data
          if (Array.isArray(inner)) return inner
          if (inner && typeof inner === 'object' && 'data' in inner) return inner.data ?? []
          return [inner].filter(Boolean)
        }
        return []
      })()
      const pageList = unwrapped.map(apiPageToUi)
      chapterPagesFetchRef.current.add(chapterId)
      setAnnotatorChapters(prev => prev.map(ch =>
        ch.id === chapterId ? { ...ch, pages: pageList } : ch,
      ))
      return pageList
    } catch {
      chapterPagesFetchRef.current.add(chapterId)
      return []
    } finally {
      chapterPagesInflightRef.current.delete(chapterId)
    }
  }, [])

  const createSeries = useCallback(async (form) => {
    const { payload, coverFile } = uiSeriesFormToApi(form)
    const created = await seriesService.create(payload, coverFile)
    const ui = apiSeriesToUi(created, seriesList.length)
    setSeriesList(prev => [ui, ...prev])
    return ui
  }, [seriesList.length])

  const updateSeries = useCallback(async (existing, form) => {
    const { payload, coverFile } = uiSeriesFormToApi(form)
    const updated = await seriesService.update(existing.id, payload, coverFile)
    const ui = apiSeriesToUi({ ...existing, ...updated, _id: existing.id }, 0)
    const merged = applySeriesFormUpdate(existing, form)
    const next = { ...merged, ...ui, id: existing.id }
    setSeriesList(prev => prev.map(s => (s.id === existing.id ? next : s)))
    setChapterRows(prev => prev.map(r =>
      r.seriesId === existing.id || r.series === existing.title
        ? { ...r, series: next.title }
        : r,
    ))
    setAnnotatorChapters(prev => prev.map(ch =>
      ch.seriesId === existing.id || ch.series === existing.title
        ? { ...ch, series: next.title }
        : ch,
    ))
    return next
  }, [])

  const removeSeries = useCallback(async (seriesId) => {
    setSeriesList(prev => prev.filter(s => s.id !== seriesId))
    setChapterRows(prev => prev.filter(r => r.seriesId !== seriesId))
    setAnnotatorChapters(prev => prev.filter(ch => ch.seriesId !== seriesId))
  }, [])

  const createChapter = useCallback(async (seriesId, seriesTitle, chapterNumber, assistantId = null, files = []) => {
    let created, uploadedPages

    if (files.length > 0) {
      const fd = new FormData()
      fd.append('series_id', seriesId)
      fd.append('chapter_number', String(chapterNumber))
      fd.append('title', `Chapter ${chapterNumber}`)
      if (assistantId) fd.append('assistant_id', assistantId)
      Array.from(files).forEach(file => fd.append('pages', file))
      const result = await chaptersService.uploadChapterWithPages(fd)
      const raw = result ?? {}
      // created: ưu tiên chapter, rồi data, rồi chính nó
      created = raw.chapter ?? raw.data ?? raw
      // pages: có thể nested { data: page } hoặc flat
      const rawPages = Array.isArray(raw.pages) ? raw.pages : []
      uploadedPages = rawPages.map(p => apiPageToUi(p?.data ?? p))
    } else {
      created = await chaptersService.create({
        series_id: seriesId,
        chapter_number: chapterNumber,
        title: `Chapter ${chapterNumber}`,
        assistant_id: assistantId,
      })
      uploadedPages = []
    }

    const row = apiChapterToRow(created, seriesTitle)
    const annotator = apiChapterToAnnotator(created, uploadedPages, seriesTitle)
    setChapterRows(prev => [row, ...prev])
    setAnnotatorChapters(prev => [annotator, ...prev])
    setSeriesList(prev => prev.map(s =>
      s.id === seriesId ? { ...s, chapters: (s.chapters ?? 0) + 1 } : s,
    ))
    if (assistantId) {
      setChapterRows(prev => prev.map(r =>
        r.id === created.id ? { ...r, assistantId, status: 'assistant' } : r,
      ))
    }
    return annotator
  }, [])

  /** Gộp tạo chapter + upload pages trong 1 request multipart. */
  const createChapterWithPages = useCallback(
    async (seriesId, seriesTitle, chapterNumber, assistantId = null, files = []) => {
      return createChapter(seriesId, seriesTitle, chapterNumber, assistantId, files)
    },
    [createChapter],
  )

  const uploadChapterPages = useCallback(async (chapterId, files, pageNotes = []) => {
    const uploaded = await chaptersService.uploadPages(chapterId, files, pageNotes)
    const pageList = (Array.isArray(uploaded) ? uploaded : [uploaded])
      .filter(Boolean)
      .map(p => (Array.isArray(p) ? p[0] : p))
    const uiPages = pageList.map(apiPageToUi)
    setAnnotatorChapters(prev => prev.map(ch => {
      if (ch.id !== chapterId) return ch
      return { ...ch, pages: [...ch.pages, ...uiPages] }
    }))
    chapterPagesFetchRef.current.add(chapterId)
    chapterPagesInflightRef.current.delete(chapterId)
    chapterUploadTimeRef.current.set(chapterId, Date.now())
    return uiPages
    setChapterRows(prev => prev.map(r => {
      if (r.id !== chapterId) return r
      return { ...r, pages: (r.pages ?? 0) + pageList.length, date: new Date().toLocaleDateString('vi-VN') }
    }))
    return pageList
  }, [])

  const deleteChapterPage = useCallback(async (chapterId, pageId) => {
    if (!pageId || String(pageId).startsWith('note-')) return
    await chaptersService.deletePage(pageId)
  }, [])

  const updateChapterStatus = useCallback(async (chapterId, uiStatus) => {
    const apiStatus = uiChapterStatusToApi(uiStatus)
    await chaptersService.update(chapterId, { status: apiStatus }).catch(() => null)
    setChapterRows(prev => prev.map(r =>
      r.id === chapterId ? { ...r, status: uiStatus } : r,
    ))
  }, [])

  const assignChapter = useCallback(async (chapterId, assistantId) => {
    await chaptersService.assignAssistant(chapterId, assistantId)
    // BE tự đổi status → pending_assistant khi tạo Task
    setChapterRows(prev => prev.map(r =>
      r.id === chapterId ? { ...r, assistantId } : r,
    ))
  }, [])

  const unassignChapter = useCallback(async (chapterId) => {
    await chaptersService.unassignAssistant(chapterId)
    setChapterRows(prev => prev.map(r =>
      r.id === chapterId ? { ...r, assistantId: null, status: 'draft' } : r,
    ))
  }, [])

  const loadPageNotes = useCallback(async (pageId, pageKey) => {
    const notes = await chaptersService.getPageNotes(pageId)
    const unwrapped = (() => {
      if (Array.isArray(notes)) return notes
      if (notes && typeof notes === 'object' && 'data' in notes) {
        const inner = notes.data
        if (Array.isArray(inner)) return inner
        if (inner && typeof inner === 'object' && 'data' in inner) return inner.data ?? []
        return [inner].filter(Boolean)
      }
      return []
    })()
    const list = unwrapped.map(apiNoteToUi)
    // Deduplicate theo id/clientKey để tránh React key collision khi BE trả duplicate
    const seen = new Set()
    const deduped = list.filter(n => {
      const key = n.clientKey ?? n.id ?? String(n._id ?? '')
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
    setAnnotatorNotes(prev => ({ ...prev, [pageKey]: deduped }))
    return deduped
  }, [])

  const savePageNote = useCallback(async (pageId, pageKey, note) => {
    const payload = uiNoteToApi(note)
    const clientKey = String(note.clientKey ?? note.id ?? '')
    let serverId = noteServerIdRef.current.get(clientKey) ?? null
    if (!serverId && note.id && !String(note.id).startsWith('note-')) {
      serverId = String(note.id)
      noteServerIdRef.current.set(clientKey, serverId)
    }

    if (!serverId) {
      const created = await chaptersService.createPageNote(pageId, payload)
      const ui = apiNoteToUi(created)
      serverId = String(ui.id)
      noteServerIdRef.current.set(clientKey, serverId)
    } else {
      await chaptersService.updatePageNote(pageId, serverId, payload)
    }

    setAnnotatorNotes(prev => ({
      ...prev,
      [pageKey]: (prev[pageKey] ?? []).map(n => {
        const nKey = String(n.clientKey ?? n.id ?? '')
        if (nKey !== clientKey) return n
        return { ...n, id: serverId, clientKey: n.clientKey ?? clientKey }
      }),
    }))
    return { ...note, id: serverId, clientKey: note.clientKey ?? clientKey }
  }, [])

  const deletePageNote = useCallback(async (pageId, pageKey, noteId) => {
    if (!String(noteId).startsWith('note-')) {
      await chaptersService.deletePageNote(pageId, noteId)
    }
    setAnnotatorNotes(prev => ({
      ...prev,
      [pageKey]: (prev[pageKey] ?? []).filter(n => n.id !== noteId),
    }))
  }, [])

  return {
    seriesList,
    setSeriesList,
    chapterRows,
    setChapterRows,
    annotatorChapters,
    setAnnotatorChapters,
    annotatorNotes,
    setAnnotatorNotes,
    rankings,
    loading,
    error,
    refresh,
    loadChapterPages,
    createSeries,
    updateSeries,
    removeSeries,
    createChapter,
    createChapterWithPages,
    uploadChapterPages,
    deleteChapterPage,
    updateChapterStatus,
    assignChapter,
    unassignChapter,
    loadPageNotes,
    savePageNote,
    deletePageNote,
  }
}
