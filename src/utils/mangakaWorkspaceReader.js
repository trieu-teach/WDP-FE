import {
  applySeriesFormUpdate,
  seriesToExternalSummary,
} from './seriesModel.js'
import { syncEbDebutPendingFromSeries } from './ebDebutStorage.js'
import { loadMangakaWorkspaceState, persistMangakaWorkspaceState } from './mangakaWorkspaceStorage.js'

export function getMangakaWorkspaceDefaults() {
  return {
    tab: 'series',
    annotateSeries: '',
    seriesList: [],
    chapterRows: [],
    annotatorChapters: [],
    annotatorNotes: {},
    annotatorActiveChapterId: null,
    annotatorPageIndex: 0,
    annotatorChapterNum: '1',
    annotatorPagesPerChapter: '',
    annotatorUploadPageBudget: '',
  }
}

export function readMangakaWorkspace() {
  return loadMangakaWorkspaceState(getMangakaWorkspaceDefaults())
}

/** Ghép dòng bảng chapter với phiên upload (ảnh blob / placeholder). */
export function resolveAnnotatorChapter(chapterRow, annotatorChapters) {
  if (!chapterRow || !Array.isArray(annotatorChapters)) return null
  const rowId = chapterRow.id != null ? String(chapterRow.id) : null
  if (rowId) {
    const byId = annotatorChapters.find((c) => String(c.id) === rowId)
    if (byId) return byId
  }
  return annotatorChapters.find(
    c => c.series === chapterRow.series && String(c.num) === String(chapterRow.num),
  ) ?? null
}

export function saveMangakaWorkspace(updater) {
  const current = readMangakaWorkspace()
  const next = typeof updater === 'function' ? updater(current) : { ...current, ...updater }
  persistMangakaWorkspaceState(next)
  window.dispatchEvent(new CustomEvent('mk-workspace-update'))
  return next
}

/** Lưu chỉnh sửa hồ sơ series — đồng bộ tên sang chapter nếu đổi title. */
export function updateSeriesInWorkspace(seriesId, form) {
  return saveMangakaWorkspace((ws) => {
    const idx = ws.seriesList.findIndex(s => s.id === seriesId)
    if (idx < 0) return ws

    const oldTitle = ws.seriesList[idx].title
    const updated = applySeriesFormUpdate(ws.seriesList[idx], form)
    const newTitle = updated.title

    let next = {
      ...ws,
      seriesList: ws.seriesList.map((s, i) => (i === idx ? updated : s)),
    }

    if (oldTitle !== newTitle) {
      next = {
        ...next,
        chapterRows: next.chapterRows.map(c => (
          c.series === oldTitle ? { ...c, series: newTitle } : c
        )),
        annotatorChapters: next.annotatorChapters.map(ch => (
          ch.series === oldTitle ? { ...ch, series: newTitle } : ch
        )),
        annotateSeries: next.annotateSeries === oldTitle ? newTitle : next.annotateSeries,
      }
    }

    const pending = next.seriesList
      .filter(s => s.needsFullDebutPipeline)
      .map(seriesToExternalSummary)
    syncEbDebutPendingFromSeries(pending)

    return next
  })
}

export function updateSeriesEbAssessmentInWorkspace(seriesTitle, ebAssessment) {
  const title = String(seriesTitle ?? '').trim()
  if (!title) return null

  return saveMangakaWorkspace((ws) => {
    const idx = ws.seriesList.findIndex(s => s.title === title)
    if (idx < 0) return ws

    return {
      ...ws,
      seriesList: ws.seriesList.map((s, i) => (
        i === idx
          ? {
            ...s,
            ebAssessment: ebAssessment ? JSON.parse(JSON.stringify(ebAssessment)) : null,
          }
          : s
      )),
    }
  })
}
