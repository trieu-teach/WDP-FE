import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { tasksService } from '@/api/tasks.service.js'
import { submissionsService } from '@/api/submissions.service.js'
import { apiSubmissionChapterToUi, apiTaskToUi } from '@/utils/apiMappers.js'

/**
 * Luồng mới (1 task = 1 chapter, submission-driven):
 *  - Assistant nộp chapter → BE tạo Submission có `status: 'submitted_by_assistant'`.
 *  - Mangaka mở `/api/submissions/mangaka` → lọc ra các submission đang chờ duyệt.
 *  - Card "Chờ duyệt" dùng submission làm đơn vị, không quét tasks nữa.
 */
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
    setLoading(true)
    try {
      // 1) Lấy toàn bộ submissions của Mangaka
      let rawSubs = []
      try {
        const subs = await submissionsService.getMangakaSubmissions()
        rawSubs = Array.isArray(subs) ? subs : []
      } catch {
        rawSubs = []
      }
      const subList = rawSubs.map(apiSubmissionChapterToUi)
      setSubmissions(subList)

      // 2) Map chapterId → chapterRow để tra nhanh trong UI
      const rowMap = new Map()
      for (const row of chapterRowsRef.current ?? []) {
        if (row?.id) rowMap.set(String(row.id), row)
      }

      // 3) Lọc ra các submission chờ Mangaka duyệt
      const reviews = subList
        .filter((s) => s?.status === 'submitted_by_assistant')
        .map((submission) => {
          const row = rowMap.get(String(submission.id)) ?? {
            id: submission.id,
            seriesId: submission.seriesId,
            series: submission.seriesName,
            num: submission.chapterNumber,
            title: '',
          }
          return {
            chapter: row,
            submission,
            tasks: [],
          }
        })

      setPendingReviews(reviews)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [chapterIdKey, refresh])

  /**
   * Request revision: gửi note tổng hợp xuống submission endpoint.
   */
  const requestRevision = useCallback(async (reviews, note = '') => {
    const list = Array.isArray(reviews) ? reviews : [reviews].filter(Boolean)
    await Promise.all(
      list.map((r) =>
        submissionsService.requestRevision(r?.submission?.id ?? r?.chapter?.id, note),
      ),
    )
    await refresh()
  }, [refresh])

  /**
   * Giữ lại để tương thích ngược, dù mới không còn flow acknowledge.
   */
  const acknowledgeTask = useCallback(async () => {
    await refresh()
  }, [refresh])

  return {
    pendingReviews,
    submissions,
    loading,
    refresh,
    requestRevision,
    acknowledgeTask,
  }
}
