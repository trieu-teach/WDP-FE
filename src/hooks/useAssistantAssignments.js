import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { tasksService } from '@/api/tasks.service.js'
import { chaptersService } from '@/api/chapters.service.js'
import { resolveMediaUrl } from '@/api/http.js'
import { apiTaskToUi, apiPageToUi, apiNoteToUi, parsePageNotesResponse } from '@/utils/apiMappers.js'

function rawPageToUi(p) {
  const rawUrl =
    (p.original_image_url && p.original_image_url !== '' ? p.original_image_url : null)
    ?? (p.result_image_url && p.result_image_url !== '' ? p.result_image_url : null)
    ?? p.image_url
    ?? (p.url && p.url !== '' ? p.url : null)
    ?? p.src
    ?? p.imageUrl
    ?? p.image
    ?? p.secure_url
    ?? null
  return {
    id: p._id ?? p.id ?? null,
    url: resolveMediaUrl(rawUrl),
    name: p.name ?? p.filename ?? p.original_filename ?? '',
    width: p.width ?? p.w ?? 800,
    height: p.height ?? p.h ?? 1100,
    pageNumber: p.page_number ?? p.pageNumber ?? p.index ?? 0,
    tasks: Array.isArray(p.tasks) ? p.tasks : [],
  }
}

/**
 * Parse revision_notes (string) thành structured notes array.
 * Hỗ trợ format:
 *   "Trang 1: [background] mắt thâm\nTrang 2: [color] tô màu đỏ"
 *   "[background] mắt thâm\n[color] tô màu đỏ"
 *   "background: mắt thâm"
 * Nếu revision_annotations (array) có data thì dùng nó, bỏ qua string.
 */
function parseRevisionNotes(revisionNotes, revisionAnnotations, pageCount) {
  // Helper: convert object {page_0: [...], page_1: [...]} → flat array với pageIndex
  function flattenAnnotationMap(map) {
    const out = []
    for (const [k, v] of Object.entries(map ?? {})) {
      if (!Array.isArray(v)) continue
      // key là "page_N" hoặc "N"
      const m = String(k).match(/(?:page_)?(\d+)/i)
      const pageIndex = m ? Math.max(0, parseInt(m[1], 10)) : 0
      for (const n of v) {
        out.push({
          id: n.id ?? n._id ?? `${k}-${out.length}`,
          pageIndex,
          taskType: n.taskType ?? 'paint',
          text: n.text ?? '',
          x: Number(n.x) || 0,
          y: Number(n.y) || 0,
          w: Number(n.w) || 0,
          h: Number(n.h) || 0,
          status: n.status ?? 'open',
        })
      }
    }
    return out
  }

  // Ưu tiên structured annotations
  if (Array.isArray(revisionAnnotations) && revisionAnnotations.length > 0) {
    // Shape mới từ BE: [{ _id, page_id, region: {x, y, width, height}, content, error_type }]
    // → convert sang UI shape mà LayerEditor đọc được (x, y, w, h, text, taskType)
    const mapped = revisionAnnotations.map((n, idx) => {
      const region = n.region ?? {}
      const w = Number(region.width ?? n.w ?? n.width ?? 0)
      const h = Number(region.height ?? n.h ?? n.height ?? 0)
      const x = Number(region.x ?? n.x ?? 0)
      const y = Number(region.y ?? n.y ?? 0)
      return {
        id: n._id ?? n.id ?? `ra-${idx}`,
        pageId: n.page_id ?? n.pageId ?? null,
        taskType: n.error_type ?? n.taskType ?? 'paint',
        text: n.content ?? n.text ?? '',
        x,
        y,
        w,
        h,
        status: n.status ?? 'open',
        // pageIndex sẽ được resolve sau bằng cách match page_id với pages
        pageIndex: 0,
      }
    })
    return mapped
  }

  // Nếu revision_annotations là object {page_0: [...], page_1: [...]} → flat ra
  if (revisionAnnotations && typeof revisionAnnotations === 'object') {
    const flat = flattenAnnotationMap(revisionAnnotations)
    if (flat.length > 0) return flat
  }

  if (!revisionNotes || typeof revisionNotes !== 'string') return []

  const lines = revisionNotes.split('\n').map(l => l.trim()).filter(Boolean)
  const notes = []

  for (const line of lines) {
    // "Trang N: [taskType] content" hoặc "Trang N: content"
    const pageMatch = line.match(/^Trang\s+(\d+)[:\s]+(\[[^\]]+\])?\s*(.+)/i)
    if (pageMatch) {
      const pageNum = parseInt(pageMatch[1], 10) - 1  // 0-indexed
      const taskType = pageMatch[2] ? pageMatch[2].slice(1, -1) : 'paint'
      const text = (pageMatch[3] ?? '').trim()
      if (!text) continue
      notes.push({
        id: `rn-page-${pageNum}`,
        pageIndex: pageNum,
        taskType,
        text,
        x: 0, y: 0, w: 100, h: 100,
        status: 'open',
      })
      continue
    }

    // "[taskType] content"
    const tagMatch = line.match(/^\[([^\]]+)\]\s*(.+)/)
    if (tagMatch) {
      const taskType = tagMatch[1].trim()
      const text = tagMatch[2].trim()
      if (!text) continue
      // Áp dụng cho tất cả pages
      for (let i = 0; i < (pageCount ?? 1); i++) {
        notes.push({
          id: `rn-all-${i}-${taskType}`,
          pageIndex: i,
          taskType,
          text,
          x: 0, y: 0, w: 100, h: 100,
          status: 'open',
        })
      }
      continue
    }

    // "taskType: content" hoặc plain text — áp dụng cho tất cả pages
    const text = line.replace(/^[^:]+:\s*/, '').trim()
    if (text && text !== line) {
      for (let i = 0; i < (pageCount ?? 1); i++) {
        notes.push({
          id: `rn-colon-${i}`,
          pageIndex: i,
          taskType: 'paint',
          text,
          x: 0, y: 0, w: 100, h: 100,
          status: 'open',
        })
      }
    } else if (text) {
      for (let i = 0; i < (pageCount ?? 1); i++) {
        notes.push({
          id: `rn-plain-${i}`,
          pageIndex: i,
          taskType: 'paint',
          text,
          x: 0, y: 0, w: 100, h: 100,
          status: 'open',
        })
      }
    }
  }

  return notes
}

const TASK_STATUS_RANK = {
  revision: 50,
  in_progress: 40,
  submitted: 30,
  pending: 20,
  approved: 10,
}

function pickPrimaryTaskForChapter(tasks, chapterId) {
  const cid = String(chapterId ?? '')
  if (!cid) return null
  let best = null
  let bestRank = -1
  for (const t of tasks) {
    if (String(t.chapterId) !== cid) continue
    const rank = TASK_STATUS_RANK[t.status] ?? 0
    if (rank > bestRank) {
      best = t
      bestRank = rank
    }
  }
  return best
}

function resolveChapterCoverUrl(c) {
  const fromField = resolveMediaUrl(c?.cover_url ?? c?.coverUrl)
  if (fromField) return fromField

  const series = c?.series_id ?? c?.series
  if (series && typeof series === 'object') {
    const seriesCover = resolveMediaUrl(series.cover_image_url ?? series.coverUrl)
    if (seriesCover) return seriesCover
  }

  return null
}

function chapterAssignmentToUi(chapter) {
  const c = chapter ?? {}
  const series = c.series_id ?? {}
  const seriesName =
    typeof series === 'string'
      ? ''
      : (series.name ?? series.title ?? c.seriesName ?? c.series_name ?? '')
  const seriesId =
    typeof series === 'string'
      ? series
      : (series._id ?? series.id ?? c.series_id ?? null)

  return {
    id: c._id ?? c.id,
    chapterId: c._id ?? c.id,
    taskId: null,
    seriesTitle: seriesName || '(Không tìm thấy series)',
    seriesId,
    chapterNum: c.chapter_number ?? c.chapterNum ?? 0,
    title: c.title ?? '',
    status: c.status ?? 'pending_assistant',
    pageCount: c.page_count ?? c.pages?.length ?? 0,
    pages: Array.isArray(c.pages) ? c.pages.map(rawPageToUi) : [],
    coverUrl: resolveChapterCoverUrl(c),
    taskStats: c.tasks ?? null,
    _task: null,
  }
}

export function useAssistantAssignments() {
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let results = []

      const [chapterSettled, taskSettled] = await Promise.allSettled([
        // Không truyền status — BE trả mọi chapter của assistant (is_current_round: true).
        chaptersService.getMyAssignments({ limit: 100 }),
        tasksService.getMyAssignments({ limit: 100 }),
      ])

      const taskList = taskSettled.status === 'fulfilled'
        ? (() => {
            const res = taskSettled.value
            const rawItems = res?.data ?? res?.items ?? []
            return Array.isArray(rawItems) ? rawItems.map(apiTaskToUi) : []
          })()
        : []

      if (chapterSettled.status === 'fulfilled') {
        const chapterItems = chapterSettled.value?.items ?? []
        if (chapterItems.length > 0) {
          results = chapterItems.map((ch) => {
            const ui = chapterAssignmentToUi(ch)
            const task = pickPrimaryTaskForChapter(taskList, ui.chapterId)
            if (!task) return ui
            return { ...ui, taskId: task.id, _task: task }
          })
        }
      }

      if (results.length === 0) {
        let tasks = taskList
        let seriesNameRoot = null

        if (tasks.length === 0) {
          const res = await tasksService.getMyAssignments({ limit: 100 })
          const rawItems = res?.data ?? res?.items ?? []
          const list = Array.isArray(rawItems) ? rawItems : []
          seriesNameRoot = res?.seriesName ?? null
          tasks = list.map(apiTaskToUi)
        } else if (taskSettled.status === 'fulfilled') {
          seriesNameRoot = taskSettled.value?.seriesName ?? null
        }

      // Gọi song song getById cho tất cả chapters
      const chapterResults = await Promise.allSettled(
        tasks.map(t => chaptersService.getById(t.chapterId)),
      )

      // Build map chapterId → chapter result để lookup đúng khi skip trùng
      const chapterMap = {}
      for (let i = 0; i < tasks.length; i++) {
        const cid = tasks[i].chapterId
        if (!chapterMap[cid] && chapterResults[i]?.status === 'fulfilled') {
          chapterMap[cid] = chapterResults[i].value
        }
      }

      // Filter trùng chapterId
      const seen = new Set()
      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i]
        if (seen.has(task.chapterId)) continue
        seen.add(task.chapterId)

        const chapter = chapterMap[task.chapterId] ?? null

        const seriesTitle =
            seriesNameRoot ??
            task.seriesName ??
            chapter?.seriesName ??
            chapter?.series_name ??
            chapter?.series?.name ??
            chapter?.data?.seriesName ??
            chapter?.data?.series?.name ??
            chapter?.data?.title ??
            chapter?.title ??
            null

        results.push({
          id: task.chapterId,
          chapterId: task.chapterId,
          taskId: task.id,
          seriesTitle: seriesTitle ?? '(Không tìm thấy series)',
          seriesId:
            chapter?.series_id?._id ??
            chapter?.series_id ??
            chapter?.data?.series_id ??
            null,
          chapterNum: chapter?.chapter_number ?? chapter?.data?.chapter_number ?? 0,
          title: chapter?.title ?? chapter?.data?.title ?? '',
          status: task.status,
          // Nếu BE populate pages vào chapter response thì dùng luôn, để hiện thumbnail trong list
          pageCount:
            chapter?.page_count ??
            chapter?.pages?.length ??
            chapter?.data?.page_count ??
            chapter?.data?.pages?.length ??
            0,
          pages:
            chapter?.pages?.length > 0
              ? chapter.pages.map(rawPageToUi)
              : chapter?.data?.pages?.length > 0
                ? chapter.data.pages.map(rawPageToUi)
                : [],
          coverUrl: resolveChapterCoverUrl(chapter) ?? resolveChapterCoverUrl(chapter?.data),
          _task: task,
        })
      }
      }

      setAssignments(results)
    } catch (err) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Không tải được danh sách được giao.'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const loadChapterPages = useCallback(async (chapterId, task = null) => {
    const [chapter, pagesRes] = await Promise.all([
      chaptersService.getById(chapterId),
      chaptersService.getPages(chapterId).catch(err => {
        if (err?.response?.status === 403) {
          toast.error('Bạn chưa có quyền xem trang gốc. Liên hệ Mangaka để được cấp quyền.')
        }
        return null
      }),
    ])

    // Ưu tiên: lấy pages trực tiếp từ GET /chapters/:id (BE populate sẵn).
    let pages = []
    if (chapter?.pages && Array.isArray(chapter.pages) && chapter.pages.length > 0) {
      pages = chapter.pages.map(rawPageToUi)
    } else if (chapter?.data?.pages && Array.isArray(chapter.data.pages) && chapter.data.pages.length > 0) {
      pages = chapter.data.pages.map(rawPageToUi)
    }

    // unwrap trả về { success, data: [...] } vì check res.success đúng cho cả 2 endpoint.
    // pagesRes.data là array pages thực sự.
    const pagesArray = Array.isArray(pagesRes)
      ? pagesRes
      : (pagesRes?.data && Array.isArray(pagesRes.data) ? pagesRes.data : null)

    const chapterPagesRaw = chapter?.pages ?? chapter?.data?.pages ?? []
    const chapterPageById = new Map(
      (Array.isArray(chapterPagesRaw) ? chapterPagesRaw : []).map((p) => [
        String(p._id ?? p.id ?? ''),
        p,
      ]),
    )

    if (pagesArray?.length > 0) {
      pages = pagesArray.map((p) => {
        const rich = chapterPageById.get(String(p._id ?? p.id ?? ''))
        return rawPageToUi(rich ? { ...p, tasks: rich.tasks ?? p.tasks } : p)
      })
    }

    // Lấy notes từ task.noteIds (BE populate vào task object)
    const taskNotes = task?.noteIds ?? []

    const seriesName =
      chapter?.seriesName ??
      chapter?.series_name ??
      chapter?.series?.name ??
      chapter?.data?.seriesName ??
      chapter?.data?.series?.name ??
      chapter?.data?.title ??
      chapter?.title ??
      ''

    // Parse revision_notes string → structured notes (dùng revision_annotations array nếu có)
    // Ưu tiên annotation gắn task (round hiện tại từ BE), rồi mới tới chapter-level.
    const annotationsSource =
      (Array.isArray(task?.revisionAnnotations) && task.revisionAnnotations.length
        ? task.revisionAnnotations
        : null)
      ?? chapter?.revision_annotations_by_page
      ?? chapter?.data?.revision_annotations_by_page
      ?? chapter?.revision_annotations
      ?? chapter?.data?.revision_annotations
      ?? null

    const revisionNotesParsed = parseRevisionNotes(
      task?.revisionNote
        ?? chapter?.revision_notes
        ?? chapter?.data?.revision_notes
        ?? null,
      annotationsSource,
      pages.length,
    )

    // Resolve pageIndex cho từng note dựa trên pageId ↔ pages[i].id
    const resolvedNotes = revisionNotesParsed.map(n => {
      if (n.pageId) {
        const idx = pages.findIndex(p => p?.id === n.pageId)
        if (idx >= 0) return { ...n, pageIndex: idx }
      }
      return n
    })

    // Chuẩn hóa chapter object
    const safeChapter = {
      _id: chapter?._id ?? chapter?.id ?? chapterId,
      series_id: chapter?.series_id ?? chapter?.series?._id ?? chapter?.data?.series_id ?? null,
      series_name: seriesName,
      seriesTitle: seriesName,
      chapter_number: chapter?.chapter_number ?? chapter?.data?.chapter_number ?? 0,
      title: chapter?.title ?? chapter?.data?.title ?? '',
      status: chapter?.status ?? 'pending_assistant',
      revision_annotations: chapter?.revision_annotations ?? chapter?.data?.revision_annotations ?? null,
      revision_annotations_by_page:
        chapter?.revision_annotations_by_page
        ?? chapter?.data?.revision_annotations_by_page
        ?? null,
      revision_notes: chapter?.revision_notes ?? chapter?.data?.revision_notes ?? null,
      revision_notes_parsed: revisionNotesParsed,
      pages: chapter?.pages ?? chapter?.data?.pages ?? pages,
    }

    return { chapter: safeChapter, pages, taskNotes, revisionNotesParsed: resolvedNotes }
  }, [])

  const loadPageDetail = useCallback(async (pageId, taskNotes = null) => {
    const [detail, notes] = await Promise.all([
      chaptersService.getPage(pageId),
      // Nếu caller đã có task.noteIds (từ BE spec mới), dùng luôn — không gọi riêng.
      // Nếu chưa có, fallback về gọi GET /pages/:id/notes (luồng cũ).
      taskNotes !== null
        ? Promise.resolve(taskNotes)
        : chaptersService.getPageNotes(pageId).catch(() => []),
    ])
    const resolvedNotes = parsePageNotesResponse(notes).notes
    const tasks = detail?.tasks ?? []
    return { page: detail, tasks, notes: resolvedNotes }
  }, [])

  return { assignments, loading, error, refresh, loadChapterPages, loadPageDetail }
}
