import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { tasksService } from '@/api/tasks.service.js'
import { submissionsService } from '@/api/submissions.service.js'
import { apiSubmissionChapterToUi, apiTaskToUi } from '@/utils/apiMappers.js'

export function useMangakaTasks(chapterRows) {
  const [pendingReviews, setPendingReviews] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(false)
  const chapterRowsRef = useRef(chapterRows)
  chapterRowsRef.current = chapterRows

  const chapterIdKey = useMemo(
    () => (chapterRows ?? []).map(r => r.id).sort().join('|'),
    [chapterRows],
  )

  const refresh = useCallback(async () => {
    const rows = chapterRowsRef.current ?? []
    if (!rows.length) {
      setPendingReviews([])
      setSubmissions([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [reviews, subs] = await Promise.all([
        (async () => {
          const items = []
          const seen = new Set()
          await Promise.all(
            rows.map(async (row) => {
              try {
                const raw = await tasksService.getByChapter(row.id)
                const rawTasks = Array.isArray(raw) ? raw : []
                // Deduplicate by task ID within this chapter
                const uniqueTasks = []
                const localSeen = new Set()
                for (const t of rawTasks) {
                  const id = t._id ?? t.id
                  if (!id || localSeen.has(id)) continue
                  localSeen.add(id)
                  // Only include if not already in global seen (prevents cross-chapter duplicates)
                  if (!seen.has(id)) {
                    seen.add(id)
                    uniqueTasks.push(t)
                  }
                }
                const tasks = uniqueTasks.map(apiTaskToUi)
                if (tasks.length === 0) return
                /**
                 * Flow mới: 1 chapter = 1 task. Lấy task có status `submitted`
                 * (hoặc tất cả task ở `submitted` nếu BE vẫn trả theo ô note).
                 */
                const submittedTask = tasks.find(t => t.status === 'submitted')
                  ?? (tasks.every(t => t.status === 'submitted') ? tasks[0] : null)
                if (submittedTask) {
                  items.push({ chapter: row, task: submittedTask, tasks })
                }
              } catch {
                /* chapter chưa có task */
              }
            }),
          )
          return items
        })(),
        submissionsService.getMangakaSubmissions().catch(() => []),
      ])
      setPendingReviews(reviews)
      const subList = Array.isArray(subs) ? subs : []
      setSubmissions(subList.map(apiSubmissionChapterToUi))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [chapterIdKey, refresh])

  const approveChapterTasks = useCallback(async (tasks) => {
    const list = Array.isArray(tasks) ? tasks : []
    await Promise.all(list.map(t => tasksService.approve(t.id)))
    await refresh()
  }, [refresh])

  const requestRevision = useCallback(async (tasks, note = '') => {
    const list = Array.isArray(tasks) ? tasks : []
    await Promise.all(list.map(t => tasksService.requestRevision(t.id, note)))
    await refresh()
  }, [refresh])

  return {
    pendingReviews,
    submissions,
    loading,
    refresh,
    approveChapterTasks,
    requestRevision,
  }
}
