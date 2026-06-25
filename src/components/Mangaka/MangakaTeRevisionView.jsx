import { useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { TantouPageAnnotator } from '@/components/Tantou/TantouPageAnnotator'
import { useMangakaTeRevisionChapter } from '@/hooks/useMangakaTeRevisionChapter.js'
import { Button } from '@/components/ui/button'

export function MangakaTeRevisionView({
  chapterId,
  seriesTitle: seriesTitleProp,
  chapterNum: chapterNumProp,
  onClose,
  className = '',
}) {
  const [pageIndex, setPageIndex] = useState(0)
  const {
    loading,
    error,
    pages,
    notesByPage,
    chapterMeta,
    revisionNotes,
    revisionSource,
  } = useMangakaTeRevisionChapter(chapterId, { enabled: Boolean(chapterId) })

  const submission = useMemo(() => {
    const seriesTitle =
      seriesTitleProp
      ?? chapterMeta?.seriesName
      ?? chapterMeta?.series_id?.name
      ?? chapterMeta?.series?.name
      ?? 'Series'
    const chapterNum =
      chapterNumProp
      ?? chapterMeta?.chapter_number
      ?? '?'

    return {
      id: chapterId,
      chapterId,
      seriesTitle,
      chapterNum: String(chapterNum),
      pageLabel: `Trang ${pageIndex + 1}`,
      pageIndex,
      mangakaImageUrl: pages[pageIndex]?.url,
    }
  }, [chapterId, chapterMeta, chapterNumProp, pageIndex, pages, seriesTitleProp])

  const storyPages = useMemo(
    () =>
      pages.map((page, index) => ({
        pageIndex: index,
        pageLabel: page.name || `Trang ${index + 1}`,
        imageUrl: page.url,
      })),
    [pages],
  )

  const currentNotes = notesByPage[pageIndex] ?? []

  if (loading) {
    return (
      <div className={`flex min-h-[420px] flex-col items-center justify-center gap-3 text-muted-foreground ${className}`}>
        <Loader2 className="size-8 animate-spin text-sky-500" />
        <p className="text-sm">Đang tải chapter và nhận xét TE...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`flex min-h-[320px] flex-col items-center justify-center gap-4 p-8 text-center ${className}`}>
        <p className="text-sm text-destructive">{error}</p>
        {onClose ? (
          <Button variant="outline" onClick={onClose}>
            Quay lại
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <div className={`flex min-h-0 flex-1 flex-col gap-4 ${className}`}>
      {revisionNotes ? (
        <div className="shrink-0 rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 dark:border-amber-500/30 dark:bg-amber-500/10">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
            Ghi chú từ TE{revisionSource ? ` · ${revisionSource}` : ''}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-foreground">
            {revisionNotes}
          </p>
        </div>
      ) : null}

      <div className="min-h-[min(72vh,780px)] flex-1">
        <TantouPageAnnotator
          submission={submission}
          storyPages={storyPages}
          currentPageIndex={pageIndex}
          onPageIndexChange={setPageIndex}
          pageImageUrl={pages[pageIndex]?.url}
          editorialNotes={currentNotes}
          readOnly
          viewerMode="mangaka"
          onClose={onClose}
        />
      </div>
    </div>
  )
}

export default MangakaTeRevisionView
