import { useEffect, useState } from 'react'
import { chaptersService } from '@/api/chapters.service.js'
import { getApiErrorMessage } from '@/api/http.js'
import { mapChapterRevisionAnnotationsToNotesByPage } from '@/components/Tantou/reviewUtils'
import { apiPageToUi } from '@/utils/apiMappers.js'

function extractPagesList(chapter, pagesRes) {
  if (Array.isArray(chapter?.pages) && chapter.pages.length) {
    return chapter.pages
  }
  if (Array.isArray(pagesRes)) return pagesRes
  if (Array.isArray(pagesRes?.pages)) return pagesRes.pages
  if (Array.isArray(pagesRes?.data)) return pagesRes.data
  return []
}

export function useMangakaTeRevisionChapter(chapterId, { enabled = true } = {}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pages, setPages] = useState([])
  const [notesByPage, setNotesByPage] = useState({})
  const [chapterMeta, setChapterMeta] = useState(null)
  const [revisionNotes, setRevisionNotes] = useState('')
  const [revisionSource, setRevisionSource] = useState('')

  useEffect(() => {
    if (!enabled || !chapterId) return undefined

    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')
      setPages([])
      setNotesByPage({})
      setRevisionNotes('')
      setRevisionSource('')
      setChapterMeta(null)

      try {
        const chapter = await chaptersService.getById(chapterId)
        if (cancelled) return

        let pagesRes = null
        if (!Array.isArray(chapter?.pages) || !chapter.pages.length) {
          pagesRes = await chaptersService.getPages(chapterId).catch(() => null)
        }

        const rawPages = extractPagesList(chapter, pagesRes)
        if (!rawPages.length) {
          setError('Không tìm thấy trang nào trong chapter này.')
          return
        }

        const uiPages = rawPages.map((page, index) => apiPageToUi(page, index))
        const pagesMeta = rawPages.map((page, index) => ({
          _id: page._id ?? page.id ?? uiPages[index]?.id,
          id: page.id ?? page._id ?? uiPages[index]?.id,
          page_number: page.page_number ?? uiPages[index]?.pageNumber ?? index + 1,
          width: page.width ?? uiPages[index]?.width ?? 728,
          height: page.height ?? uiPages[index]?.height ?? 1030,
        }))

        const revisionAnnotations = Array.isArray(chapter?.revision_annotations)
          ? chapter.revision_annotations
          : []
        const notes = mapChapterRevisionAnnotationsToNotesByPage(
          revisionAnnotations,
          pagesMeta,
        )

        for (let index = 0; index < uiPages.length; index += 1) {
          if (notes[index] === undefined) notes[index] = []
        }

        if (cancelled) return

        setPages(uiPages)
        setNotesByPage(notes)
        setRevisionNotes(String(chapter?.revision_notes ?? '').trim())
        setRevisionSource(String(chapter?.revision_source ?? '').trim())
        setChapterMeta(chapter)
      } catch (err) {
        if (!cancelled) {
          setError(getApiErrorMessage(err, 'Không tải được nhận xét từ TE.'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [chapterId, enabled])

  return {
    loading,
    error,
    pages,
    notesByPage,
    chapterMeta,
    revisionNotes,
    revisionSource,
  }
}
