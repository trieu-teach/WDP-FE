import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { tasksService } from '@/api/tasks.service.js'
import { chaptersService } from '@/api/chapters.service.js'
import { resolveMediaUrl } from '@/api/http.js'
import { apiTaskToUi, apiPageToUi } from '@/utils/apiMappers.js'

function rawPageToUi(p) {
  const rawUrl =
    p.original_image_url
    ?? p.image_url
    ?? p.url
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
      const res = await tasksService.getMyAssignments({ limit: 100 })
      const rawItems = res?.data ?? res?.items ?? []
      const list = Array.isArray(rawItems) ? rawItems : []
      // seriesName nằm ở response root (cùng cấp data), không phải trong từng task
      const seriesNameRoot = res?.seriesName ?? null
      console.debug('[useAssistantAssignments] raw items:', list, 'seriesNameRoot=', seriesNameRoot)
      const tasks = list.map(apiTaskToUi)
      console.debug('[useAssistantAssignments] mapped tasks:', tasks.map(t => ({ id: t.id, chapterId: t.chapterId, pageId: t.pageId, status: t.status })))

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
      const results = []
      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i]
        if (seen.has(task.chapterId)) continue
        seen.add(task.chapterId)

        const chapter = chapterMap[task.chapterId] ?? null

        results.push({
          id: task.chapterId,
          chapterId: task.chapterId,
          taskId: task.id,
          seriesTitle:
            seriesNameRoot ??
            task.seriesName ??
            chapter?.seriesName ??
            chapter?.series_name ??
            chapter?.series?.name ??
            chapter?.data?.seriesName ??
            chapter?.data?.series?.name ??
            chapter?.data?.title ??
            chapter?.title ??
            '(Không tìm thấy series)',
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
          _task: task,
        })
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
    console.debug('[loadChapterPages] raw chapter=', chapter, 'pagesRes=', pagesRes)

    // Ưu tiên: lấy pages trực tiếp từ GET /chapters/:id (BE populate sẵn).
    // Fallback: gọi riêng GET /chapters/:id/pages.
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
    if (pagesArray?.length > 0) {
      pages = pagesArray.map(rawPageToUi)
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

    // Chuẩn hóa chapter object
    const safeChapter = {
      _id: chapter?._id ?? chapter?.id ?? chapterId,
      series_id: chapter?.series_id ?? chapter?.series?._id ?? chapter?.data?.series_id ?? null,
      series_name: seriesName,
      seriesTitle: seriesName,
      chapter_number: chapter?.chapter_number ?? chapter?.data?.chapter_number ?? 0,
      title: chapter?.title ?? chapter?.data?.title ?? '',
      status: chapter?.status ?? 'pending_assistant',
    }

    if (pages.length > 0) {
      console.debug('[loadChapterPages] chapterId=', chapterId, 'pageCount=', pages.length, 'chapterHasData=', !!chapter?.data, 'chapterDataKeys=', Object.keys(chapter?.data ?? {}), 'chapterKeys=', Object.keys(chapter ?? {}), 'firstPageUrl=', pages[0]?.url, 'taskNotes=', taskNotes?.length ?? 0)
    } else {
      console.warn('[loadChapterPages] NO PAGES for chapterId=', chapterId, 'chapter=', chapter, 'pagesRes=', pagesRes)
    }

    return { chapter: safeChapter, pages, taskNotes }
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
    const resolvedNotes = Array.isArray(notes) ? notes.map(n =>
      typeof n === 'object' && n !== null ? n : { id: n },
    ) : []
    const tasks = detail?.tasks ?? []
    return { page: detail, tasks, notes: resolvedNotes }
  }, [])

  return { assignments, loading, error, refresh, loadChapterPages, loadPageDetail }
}
