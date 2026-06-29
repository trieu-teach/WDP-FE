import { resolveMediaUrl } from '@/api/http.js'
import { resolveTePreviewPage, resolveTePageImageUrl } from '@/api/teReviews.service.js'
import { phaseToPipeline } from '@/utils/teReviewPhase.js'

const EMPTY_SECTION = {
  label: '',
  description: '',
  count: 0,
  series: [],
}

function resolveEntityId(entity) {
  if (entity == null) return ''
  if (typeof entity === 'string' || typeof entity === 'number') {
    return String(entity).trim()
  }
  if (typeof entity === 'object') {
    const id = entity._id ?? entity.id
    return id != null ? String(id).trim() : ''
  }
  return ''
}

function countSectionChapters(block) {
  const seriesList = Array.isArray(block?.series) ? block.series : []
  let total = 0
  for (const series of seriesList) {
    const chapters = Array.isArray(series?.chapters) ? series.chapters : []
    total += chapters.filter((ch) => resolveEntityId(ch)).length
  }
  return total
}

/**
 * Chuẩn hoá GET /te-reviews/pending:
 * { series_level: { label, description, count, series[] }, chapter_level: {...}, meta }
 */
export function parseTePendingResponse(raw) {
  if (Array.isArray(raw)) {
    return legacyFlatPendingToSections(raw)
  }

  const data = raw?.data && typeof raw.data === 'object' ? raw.data : raw
  if (!data || typeof data !== 'object') {
    return {
      seriesLevel: { ...EMPTY_SECTION },
      chapterLevel: { ...EMPTY_SECTION },
      meta: { total_chapters: 0, total_series: 0 },
    }
  }

  if (data.series_level || data.chapter_level) {
    return {
      seriesLevel: normalizePendingSection(data.series_level, 'series_level'),
      chapterLevel: normalizePendingSection(data.chapter_level, 'chapter_level'),
      meta: {
        total_chapters: Number(data.meta?.total_chapters ?? 0) || 0,
        total_series: Number(data.meta?.total_series ?? 0) || 0,
      },
    }
  }

  return legacyFlatPendingToSections(
    Array.isArray(data.chapters) ? data.chapters : [],
  )
}

function normalizePendingSection(section, tabType) {
  const block = section && typeof section === 'object' ? section : {}
  const chapterTotal = countSectionChapters(block)
  const seriesCount = Array.isArray(block.series) ? block.series.length : 0
  return {
    label:
      block.label
      ?? (tabType === 'series_level'
        ? 'Series chưa được duyệt'
        : 'Series đã được duyệt'),
    description: String(block.description ?? ''),
    count: chapterTotal || Number(block.count ?? 0) || seriesCount,
    series: Array.isArray(block.series) ? block.series : [],
  }
}

/** Legacy: mảng chapter phẳng (series_id populate + phase). */
function legacyFlatPendingToSections(items) {
  const seriesLevelMap = new Map()
  const chapterLevelMap = new Map()

  for (const item of items ?? []) {
    const series =
      item?.series_id && typeof item.series_id === 'object'
        ? item.series_id
        : { _id: item?.series_id, name: 'Series' }
    const seriesId = resolveEntityId(series) || resolveEntityId(item?.series_id)
    if (!seriesId) continue

    const phase = String(item?.phase ?? '').toLowerCase()
    const tabType =
      phase === 'chapter_level' ? 'chapter_level' : 'series_level'
    const targetMap =
      tabType === 'chapter_level' ? chapterLevelMap : seriesLevelMap

    if (!targetMap.has(seriesId)) {
      targetMap.set(seriesId, {
        _id: seriesId,
        name: series?.name ?? 'Series',
        status: series?.status ?? null,
        cover_image_url: series?.cover_image_url ?? null,
        genre: series?.genre ?? series?.genres ?? [],
        tags: series?.tags ?? [],
        synopsis: series?.synopsis ?? series?.description ?? '',
        author: series?.author_id ?? series?.author ?? null,
        publication_schedule: series?.publication_schedule ?? null,
        chapter_count: 0,
        chapters: [],
      })
    }

    const bucket = targetMap.get(seriesId)
    bucket.chapters.push({
      _id: item._id ?? item.id,
      chapter_number: item.chapter_number,
      title: item.title,
      status: item.status,
      te_id: item.te_id ?? null,
      te_assigned_at: item.te_assigned_at,
      updatedAt: item.updatedAt ?? item.createdAt,
      submitted_by: item.submitted_by,
      te_review_id: item.te_review_id ?? null,
    })
    bucket.chapter_count = bucket.chapters.length
  }

  const seriesLevelSeries = [...seriesLevelMap.values()]
  const chapterLevelSeries = [...chapterLevelMap.values()]

  return {
    seriesLevel: {
      label: 'Series chưa được duyệt',
      description: 'TE cần review toàn Series + Chapter trước khi gửi EB',
      count: seriesLevelSeries.reduce((n, s) => n + (s.chapters?.length ?? 0), 0),
      series: seriesLevelSeries,
    },
    chapterLevel: {
      label: 'Series đã được duyệt',
      description: 'TE chỉ cần review và publish Chapter',
      count: chapterLevelSeries.reduce((n, s) => n + (s.chapters?.length ?? 0), 0),
      series: chapterLevelSeries,
    },
    meta: {
      total_chapters:
        seriesLevelSeries.reduce((n, s) => n + (s.chapters?.length ?? 0), 0)
        + chapterLevelSeries.reduce((n, s) => n + (s.chapters?.length ?? 0), 0),
      total_series: seriesLevelMap.size + chapterLevelMap.size,
    },
  }
}

/** { chapter, series, tabType }[] — series object ở ngoài, chapter không cần series_id. */
export function flattenTePendingSections(parsed) {
  const out = []
  for (const tabType of ['series_level', 'chapter_level']) {
    const section =
      tabType === 'series_level' ? parsed.seriesLevel : parsed.chapterLevel
    for (const series of section?.series ?? []) {
      const chapters = Array.isArray(series?.chapters) ? series.chapters : []
      for (const chapter of chapters) {
        const chapterId = resolveEntityId(chapter)
        if (!chapterId) continue
        out.push({
          chapter: { ...chapter, _id: chapter._id ?? chapter.id ?? chapterId },
          series,
          tabType,
        })
      }
    }
  }
  return out
}

function parseSeriesGenres(series) {
  const genreRaw = series?.genre ?? series?.genres
  if (Array.isArray(genreRaw)) return genreRaw.filter(Boolean)
  if (genreRaw) {
    return String(genreRaw)
      .split(/[,;|]/)
      .map((g) => g.trim())
      .filter(Boolean)
  }
  return []
}

function mapTeChapterStatus(status) {
  const value = String(status ?? '').toLowerCase().replace(/\s+/g, '_')
  if (value === 'pending_eb' || value === 'forwarded_eb') return 'forwarded_eb'
  if (value === 'pending_te' || value === 'te_pending') return 'pending'
  if (value.includes('revision') || value === 'rejected' || value === 'reject') {
    return 'revision'
  }
  if (value === 'published' || value === 'approved_publish') return 'approved_publish'
  if (value.includes('publish') && value !== 'pending_te') return 'approved_publish'
  return 'pending'
}

export function resolveTeEntityId(entity) {
  return resolveEntityId(entity)
}

/** chapter.te_id — TE đang được gán review chapter này. */
export function resolveTeChapterTeId(chapter) {
  if (!chapter || typeof chapter !== 'object') return ''
  const raw = chapter.te_id ?? chapter.teId
  return resolveEntityId(raw)
}

/**
 * TE hiện tại có được review chapter không?
 * - te_id null → được (BE auto gán khi review)
 * - te_id = TE hiện tại → được
 * - te_id = TE khác → không (403)
 */
export function canTeUserReviewChapter(teId, currentTeId) {
  const assigned = resolveEntityId(teId)
  const current = resolveEntityId(currentTeId)
  if (!assigned) return true
  if (!current) return true
  return assigned === current
}

export function teChapterAssignmentStatus(teId, currentTeId) {
  const assigned = resolveEntityId(teId)
  const current = resolveEntityId(currentTeId)
  if (!assigned) return 'unassigned'
  if (current && assigned === current) return 'mine'
  return 'other'
}

export function teChapterAssignmentLabel(status) {
  if (status === 'unassigned') {
    return 'Chưa ai nhận — review sẽ tự gán cho bạn'
  }
  if (status === 'mine') return 'Đang review chapter của bạn'
  return 'Chapter đã gán cho TE khác'
}

export function enrichTeSubmissionAssignment(submission, currentTeId) {
  const teId = submission?.teId ?? resolveTeChapterTeId(submission)
  const teAssignmentStatus = teChapterAssignmentStatus(teId, currentTeId)
  return {
    ...submission,
    teId: teId || null,
    teAssignmentStatus,
    canReview: canTeUserReviewChapter(teId, currentTeId),
    teAssignmentLabel: teChapterAssignmentLabel(teAssignmentStatus),
  }
}

export function mapTePendingChapterToSubmission(chapter, series, tabType, preview) {
  const chapterId = resolveEntityId(chapter)
  const seriesId = resolveEntityId(series) || null
  const seriesTitle = series?.name ?? 'Series'
  const submittedBy = chapter?.submitted_by ?? {}
  const previewPage = resolveTePreviewPage(preview, 0)
  const mangakaName = submittedBy.full_name ?? submittedBy.username ?? 'Mangaka'
  const authorRaw = series?.author
  const authorObj =
    authorRaw && typeof authorRaw === 'object' ? authorRaw : null

  return {
    id: chapterId,
    chapterId,
    seriesId,
    seriesTitle,
    chapterNum: String(chapter?.chapter_number ?? ''),
    chapterTitle: String(chapter?.title ?? ''),
    pageIndex: 0,
    pageLabel: previewPage?.page_number
      ? `Trang ${previewPage.page_number}`
      : 'Trang 1',
    mangakaImageUrl:
      resolveTePageImageUrl(previewPage)
      ?? resolveMediaUrl(series?.cover_image_url ?? null),
    mangakaName,
    tabType,
    phase: tabType,
    pipeline: phaseToPipeline(tabType),
    teReviewId: chapter?.te_review_id ?? null,
    teId: resolveTeChapterTeId(chapter) || null,
    teAssignedAt: chapter?.te_assigned_at ?? null,
    apiChapterStatus: String(chapter?.status ?? ''),
    status: mapTeChapterStatus(chapter?.status),
    sentAt: chapter?.updatedAt ?? chapter?.te_assigned_at ?? null,
    pagesMeta: Array.isArray(preview?.pages) ? preview.pages : [],
    seriesMeta: {
      genres: parseSeriesGenres(series),
      tags: Array.isArray(series?.tags) ? series.tags : [],
      synopsis: String(series?.synopsis ?? series?.description ?? '').trim(),
      coverImageUrl: resolveMediaUrl(series?.cover_image_url ?? null),
      authorId: authorObj?._id
        ? String(authorObj._id)
        : (series?.author ? String(series.author) : ''),
      authorName:
        authorObj?.full_name
        ?? authorObj?.username
        ?? mangakaName,
      seriesApiStatus: series?.status ?? null,
      ebApproved: tabType === 'chapter_level',
      publicationSchedule: series?.publication_schedule ?? null,
    },
  }
}

export function submissionTeTabType(submission) {
  if (submission?.tabType === 'series_level' || submission?.tabType === 'chapter_level') {
    return submission.tabType
  }
  if (submission?.phase === 'series_level' || submission?.phase === 'chapter_level') {
    return submission.phase
  }
  if (submission?.pipeline === 'recurring') return 'chapter_level'
  if (submission?.pipeline === 'debut') return 'series_level'
  return submission?.seriesMeta?.ebApproved ? 'chapter_level' : 'series_level'
}

export function isTeSeriesLevelSubmission(submission) {
  return submissionTeTabType(submission) === 'series_level'
}

export function isTeChapterLevelSubmission(submission) {
  return submissionTeTabType(submission) === 'chapter_level'
}
