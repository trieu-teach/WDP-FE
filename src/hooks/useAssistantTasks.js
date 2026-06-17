import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { tasksService } from '@/api/tasks.service.js'
import { getApiErrorMessage } from '@/api/http.js'
import { apiTaskToUi } from '@/utils/apiMappers.js'

export function useAssistantTasks({ chapterId, pageId } = {}) {
  const [allTasks, setAllTasks] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [assignmentsRes, statsRes] = await Promise.all([
        tasksService.getMyAssignments({ limit: 100 }),
        tasksService.getStats().catch(() => null),
      ])
      const list = Array.isArray(assignmentsRes?.items)
        ? assignmentsRes.items
        : (Array.isArray(assignmentsRes) ? assignmentsRes : [])
      setAllTasks(list.map(apiTaskToUi))
      setStats(statsRes ?? null)
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Không tải được danh sách task.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const chapterTasks = useMemo(() => {
    if (!chapterId) return allTasks
    return allTasks.filter(t => String(t.chapterId) === String(chapterId))
  }, [allTasks, chapterId])

  const pageTasks = useMemo(() => {
    if (!pageId) return chapterTasks
    return chapterTasks.filter(t => String(t.pageId) === String(pageId))
  }, [chapterTasks, pageId])

  const startTask = useCallback(async (taskId) => {
    const updated = await tasksService.start(taskId)
    const ui = apiTaskToUi(updated)
    setAllTasks(prev => prev.map(t => (t.id === taskId ? ui : t)))
    return ui
  }, [])

  const submitTask = useCallback(async (taskId, resultFile) => {
    const updated = await tasksService.submit(taskId, resultFile)
    const ui = apiTaskToUi(updated)
    setAllTasks(prev => prev.map(t => (t.id === taskId ? ui : t)))
    return ui
  }, [])

  /**
   * Flow mới (1 task = 1 chapter): Assistant nộp nhiều ảnh kết quả cho 1 task.
   * Số lượng ảnh = số trang của chapter.
   */
  const submitChapterTask = useCallback(async (taskId, resultFiles) => {
    const list = Array.isArray(resultFiles) ? resultFiles : [resultFiles]
    let updated
    if (list.length > 1) {
      updated = await tasksService.submitChapter(taskId, list)
    } else {
      updated = await tasksService.submit(taskId, list[0])
    }
    const ui = apiTaskToUi(updated)
    setAllTasks(prev => prev.map(t => (t.id === taskId ? ui : t)))
    return ui
  }, [])

  return {
    allTasks,
    chapterTasks,
    pageTasks,
    stats,
    loading,
    refresh,
    startTask,
    submitTask,
    submitChapterTask,
  }
}
