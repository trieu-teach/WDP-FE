import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { tasksService } from '@/api/tasks.service.js'
import { chaptersService } from '@/api/chapters.service.js'
import { apiTaskToUi } from '@/utils/apiMappers.js'

export function useAssistantAssignments() {
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await tasksService.getMyAssignments({ limit: 100 })
      const list = Array.isArray(res?.items) ? res.items : []
      const tasks = list.map(apiTaskToUi)

      // Gọi song song getById cho tất cả chapters (không gọi getPages vì 403)
      const chapterResults = await Promise.allSettled(
        tasks.map(t => chaptersService.getById(t.chapterId)),
      )

      // Filter trùng chapterId (BE có thể trả task trùng)
      const seen = new Set()
      const results = []
      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i]
        if (seen.has(task.chapterId)) continue
        seen.add(task.chapterId)

        const chapterResult = chapterResults[i]
        const chapter = chapterResult.status === 'fulfilled' ? chapterResult.value : null

        results.push({
          id: task.chapterId,
          chapterId: task.chapterId,
          taskId: task.id,
          seriesTitle:
            chapter?.seriesName ??
            chapter?.series_name ??
            chapter?.data?.seriesName ??
            chapter?.title ??
            '(Không tìm thấy series)',
          seriesId:
            chapter?.series_id?._id ??
            chapter?.series_id ??
            chapter?.data?.series_id ?? null,
          chapterNum: chapter?.chapter_number ?? chapter?.data?.chapter_number ?? 0,
          title: chapter?.title ?? chapter?.data?.title ?? '',
          status: task.status,
          // Pages sẽ được load khi user chọn chapter này (lazy load)
          pageCount: 0,
          pages: [],
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

  const loadChapterPages = useCallback(async (chapterId) => {
    const [chapter, pagesRes] = await Promise.all([
      chaptersService.getById(chapterId),
      chaptersService.getPages(chapterId).catch(err => {
        if (err?.response?.status === 403) {
          toast.error('Bạn chưa có quyền xem trang gốc. Liên hệ Mangaka để được cấp quyền.')
        }
        return null
      }),
    ])
    const pages = Array.isArray(pagesRes)
      ? pagesRes.map(p => ({
          id: p._id ?? p.id ?? null,
          url: p.original_image_url ?? p.image_url ?? p.url ?? null,
          name: p.name ?? p.filename ?? '',
          width: p.width ?? 800,
          height: p.height ?? 1100,
          pageNumber: p.page_number ?? 0,
        }))
      : []
    return { chapter, pages }
  }, [])

  const loadPageDetail = useCallback(async (pageId) => {
    const detail = await chaptersService.getPage(pageId)
    const notes = await chaptersService.getPageNotes(pageId).catch(() => [])
    return { page: detail, tasks: detail?.tasks ?? [], notes }
  }, [])

  return { assignments, loading, error, refresh, loadChapterPages, loadPageDetail }
}
