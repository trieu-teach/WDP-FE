import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { chaptersService } from '@/api/chapters.service.js'
import { getApiErrorMessage } from '@/api/http.js'
import {
  apiAssignmentToUi,
  apiNoteToUi,
  apiPageToUi,
} from '@/utils/apiMappers.js'

export function useAssistantAssignments() {
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await chaptersService.getMyAssignments()
      const list = Array.isArray(data) ? data : (data?.data ?? [])
      const enriched = await Promise.all(
        list.map(async (item) => {
          const base = apiAssignmentToUi(item)
          try {
            const pages = await chaptersService.getPages(base.chapterId)
            base.pages = (Array.isArray(pages) ? pages : []).map(apiPageToUi)
            base.pageCount = base.pages.length
          } catch {
            base.pages = []
          }
          return base
        }),
      )
      setAssignments(enriched)
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Không tải được danh sách việc được giao.')
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const loadPageDetail = useCallback(async (pageId) => {
    const detail = await chaptersService.getPage(pageId)
    const notes = await chaptersService.getPageNotes(pageId).catch(() => [])
    return {
      page: apiPageToUi(detail),
      tasks: detail?.tasks ?? [],
      notes: (Array.isArray(notes) ? notes : []).map(apiNoteToUi),
    }
  }, [])

  return { assignments, loading, error, refresh, loadPageDetail }
}
