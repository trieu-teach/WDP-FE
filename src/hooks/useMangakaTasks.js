import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { tasksService } from '@/api/tasks.service.js'
import { submissionsService } from '@/api/submissions.service.js'
import {
  apiSubmissionChapterToUi,
  apiTaskToUi,
  canMangakaSendToTe,
} from '@/utils/apiMappers.js'
import {
  dedupeTasksByPage,
  getTasksForMangakaRevision,
} from '@/utils/chapterTaskFlow.js'

/**
 * LUỒNG 2 (task + pages):
 *  - Mangaka: POST /chapters (pages[i].image + task metadata)
 *  - Assistant: start → upload-result → submit-all-by-assistant
 *  - Chapter.status = submitted_by_assistant sau Bước 7
 *  - Mangaka: acknowledge → approve từng task → approve-by-mangaka
 */
export function useMangakaTasks(chapterRows) {
  const [pendingReviews, setPendingReviews] = useState([])
  const [teReadyChapters, setTeReadyChapters] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(false)
  const chapterRowsRef = useRef(chapterRows)
  chapterRowsRef.current = chapterRows

  const chapterIdKey = useMemo(
    () => (chapterRows ?? []).map(r => r.id).sort().join('|'),
    [chapterRows],
  )

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      let rawSubs = []
      try {
        const subs = await submissionsService.getMangakaSubmissions()
        rawSubs = Array.isArray(subs) ? subs : []
      } catch {
        rawSubs = []
      }
      const subList = rawSubs.map(apiSubmissionChapterToUi)
      setSubmissions(subList)

      const rowMap = new Map()
      for (const row of chapterRowsRef.current ?? []) {
        if (row?.id) rowMap.set(String(row.id), row)
      }

      const pendingSubs = subList.filter((s) => s?.status === 'submitted_by_assistant')
      const reviews = await Promise.all(
        pendingSubs.map(async (submission) => {
          const row = rowMap.get(String(submission.id)) ?? {
            id: submission.id,
            seriesId: submission.seriesId,
            series: submission.seriesName,
            num: submission.chapterNumber,
            title: submission.title ?? '',
            apiStatus: submission.status,
          }
          let tasks = []
          try {
            const raw = await tasksService.getByChapter(submission.id)
            tasks = dedupeTasksByPage(
              (Array.isArray(raw) ? raw : []).map(apiTaskToUi),
            )
          } catch {
            tasks = []
          }
          return { chapter: row, submission, tasks }
        }),
      )
      setPendingReviews(reviews)

      const teReady = subList
        .filter((s) => canMangakaSendToTe(s.status))
        .map((submission) => {
          const row = rowMap.get(String(submission.id)) ?? {
            id: submission.id,
            seriesId: submission.seriesId,
            series: submission.seriesName,
            num: submission.chapterNumber,
            title: submission.title ?? '',
            apiStatus: submission.status,
          }
          return {
            chapter: { ...row, apiStatus: submission.status },
            submission,
          }
        })
      setTeReadyChapters(teReady)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [chapterIdKey, refresh])

  const requestRevision = useCallback(async (reviews, note = '') => {
    const list = Array.isArray(reviews) ? reviews : [reviews].filter(Boolean)
    const trimmedNote = String(note ?? '').trim()

    for (const review of list) {
      const chapterId = review?.submission?.id ?? review?.chapter?.id
      let tasks = getTasksForMangakaRevision(review?.tasks ?? [])

      if (!tasks.length && chapterId) {
        const raw = await tasksService.getByChapter(chapterId)
        tasks = getTasksForMangakaRevision(
          dedupeTasksByPage((Array.isArray(raw) ? raw : []).map(apiTaskToUi)),
        )
      }

      if (!tasks.length) {
        throw new Error('Không có task nào đủ điều kiện để yêu cầu sửa.')
      }

      await Promise.all(
        tasks.map((t) => tasksService.requestRevision(t.id, trimmedNote)),
      )
    }

    await refresh()
  }, [refresh])

  const acknowledgeTask = useCallback(async (taskId) => {
    await tasksService.acknowledge(taskId)
    await refresh()
  }, [refresh])

  const approveTask = useCallback(async (taskId) => {
    await tasksService.approve(taskId)
    await refresh()
  }, [refresh])

  const approveChapterByMangaka = useCallback(async (chapterId) => {
    const res = await submissionsService.approveChapterByMangaka(chapterId)
    await refresh()
    return res
  }, [refresh])

  return {
    pendingReviews,
    teReadyChapters,
    submissions,
    loading,
    refresh,
    requestRevision,
    acknowledgeTask,
    approveTask,
    approveChapterByMangaka,
  }
}
