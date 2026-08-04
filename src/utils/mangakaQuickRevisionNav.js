/** State navigate → tab Upload & Ghi chú (Quick Revision). */
export function buildMangakaQuickRevisionState({ series, chapterId }) {
  const title = String(series ?? '').trim()
  const id = chapterId != null ? String(chapterId).trim() : ''
  if (!title || !id) return null
  return {
    tab: 'annotate',
    series: title,
    chapterId: id,
    quickRevision: true,
  }
}

/** Redirect sau quick-revision thành công. */
export function buildMangakaChapterDetailPath(slug, chapterId) {
  const s = String(slug ?? '').trim()
  const c = String(chapterId ?? '').trim()
  if (!s || !c) return '/mangaka'
  return `/mangaka/series/${encodeURIComponent(s)}/chapter/${encodeURIComponent(c)}`
}
