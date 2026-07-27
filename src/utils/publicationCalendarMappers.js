import { resolveMediaUrl } from '@/api/http.js'
import { getEbVietnamDateNow } from '@/utils/ebEvaluationMappers.js'

/** Mặc định BE TE calendar: hôm nay → +30 ngày (giờ VN). */
export function getPublicationCalendarDefaultRange(referenceDate = new Date()) {
  const from = getEbVietnamDateNow(referenceDate)
  const toRef = new Date(referenceDate)
  toRef.setDate(toRef.getDate() + 30)
  return {
    from_date: from,
    to_date: getEbVietnamDateNow(toRef),
  }
}

function resolveId(value) {
  if (value == null) return ''
  if (typeof value === 'object') {
    return String(value._id ?? value.id ?? '').trim()
  }
  return String(value).trim()
}

function mapPerson(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    id: resolveId(raw),
    name: raw.full_name ?? raw.fullName ?? raw.username ?? raw.name ?? '',
    username: raw.username ?? '',
    email: raw.email ?? '',
  }
}

function mapSeriesBrief(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    id: resolveId(raw),
    name: raw.name ?? 'Series',
    coverUrl: resolveMediaUrl(raw.cover_image_url ?? raw.coverImageUrl ?? null),
    status: raw.status ?? null,
    publicationSchedule:
      raw.publication_schedule ?? raw.publicationSchedule ?? null,
    publicationStatus:
      raw.publication_status ?? raw.publicationStatus ?? null,
  }
}

export function mapPublicationCalendarChapter(raw = {}) {
  const series = mapSeriesBrief(raw.series ?? raw.series_id)
  return {
    id: resolveId(raw),
    chapterNumber: raw.chapter_number ?? raw.chapterNumber ?? null,
    title: raw.title ?? '',
    status: raw.status ?? '',
    isPublished: Boolean(raw.is_published ?? raw.isPublished),
    publishedAt: raw.published_at ?? raw.publishedAt ?? null,
    scheduledPublishAt:
      raw.scheduled_publish_at ?? raw.scheduledPublishAt ?? null,
    publicationSchedule:
      raw.publication_schedule
      ?? raw.publicationSchedule
      ?? series?.publicationSchedule
      ?? null,
    te: mapPerson(raw.te ?? raw.te_id),
    submittedBy: mapPerson(raw.submitted_by ?? raw.submittedBy),
    series,
    raw,
  }
}

export function mapPublicationCalendarSeriesLaunch(raw = {}) {
  const series = mapSeriesBrief(raw.series ?? raw)
  return {
    id: series?.id || resolveId(raw),
    name: series?.name ?? raw.name ?? 'Series',
    coverUrl: series?.coverUrl ?? null,
    status: series?.status ?? raw.status ?? null,
    publicationSchedule:
      series?.publicationSchedule
      ?? raw.publication_schedule
      ?? raw.publicationSchedule
      ?? null,
    publicationStatus:
      series?.publicationStatus
      ?? raw.publication_status
      ?? raw.publicationStatus
      ?? null,
    scheduledPublishAt:
      raw.scheduled_publish_at ?? raw.scheduledPublishAt ?? null,
    series,
    raw,
  }
}

export function mapPublicationCalendarDay(raw = {}) {
  const chapters = (
    Array.isArray(raw.chapters) ? raw.chapters : []
  ).map(mapPublicationCalendarChapter)
  const seriesLaunches = (
    Array.isArray(raw.series_launches)
      ? raw.series_launches
      : (Array.isArray(raw.seriesLaunches) ? raw.seriesLaunches : [])
  ).map(mapPublicationCalendarSeriesLaunch)

  return {
    date: String(raw.date ?? ''),
    weekday: raw.weekday ?? '',
    chapters,
    seriesLaunches,
    eventCount: chapters.length + seriesLaunches.length,
  }
}

/** GET /te-reviews/calendar */
export function mapTeReviewsCalendarResponse(body) {
  const data = body?.data ?? body ?? {}
  const days = (Array.isArray(data.days) ? data.days : []).map(
    mapPublicationCalendarDay,
  )
  const stats = data.stats ?? {}
  return {
    range: data.range ?? null,
    scope: data.scope === 'all' ? 'all' : 'mine',
    stats: {
      scheduledChapters: Number(stats.scheduled_chapters ?? 0),
      publishedInRange: Number(stats.published_in_range ?? 0),
      seriesLaunchesInRange: Number(stats.series_launches_in_range ?? 0),
    },
    days,
  }
}

/** GET /admin/publication-calendar */
export function mapAdminPublicationCalendarResponse(body) {
  const data = body?.data ?? body ?? {}
  const overview = data.overview ?? {}
  const days = (Array.isArray(data.days) ? data.days : []).map(
    mapPublicationCalendarDay,
  )

  return {
    range: data.range ?? null,
    overview: {
      totalSeries: Number(overview.total_series ?? 0),
      totalChaptersPublished: Number(overview.total_chapters_published ?? 0),
      seriesByStatus: overview.series_by_status ?? {},
      seriesByPublicationStatus: overview.series_by_publication_status ?? {},
    },
    upcomingSeries: (
      Array.isArray(data.upcoming_series) ? data.upcoming_series : []
    ).map(mapPublicationCalendarSeriesLaunch),
    upcomingChapters: (
      Array.isArray(data.upcoming_chapters) ? data.upcoming_chapters : []
    ).map(mapPublicationCalendarChapter),
    days,
    stats: {
      scheduledChapters: Number(
        data.stats?.scheduled_chapters
        ?? (Array.isArray(data.upcoming_chapters) ? data.upcoming_chapters.length : 0),
      ),
      publishedInRange: Number(data.stats?.published_in_range ?? 0),
      seriesLaunchesInRange: Number(
        data.stats?.series_launches_in_range
        ?? (Array.isArray(data.upcoming_series) ? data.upcoming_series.length : 0),
      ),
    },
  }
}

export function formatPublicationCalendarDateDisplay(dateText) {
  if (!dateText) return ''
  const raw = String(dateText).trim()
  const isoDay = /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : raw
  try {
    const date = new Date(`${isoDay}T12:00:00`)
    if (Number.isNaN(date.getTime())) return raw
    return new Intl.DateTimeFormat('vi-VN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Ho_Chi_Minh',
    }).format(date)
  } catch {
    return raw
  }
}

/** Ngày gọn cho sidebar (VD: 27/07). */
export function formatPublicationCalendarDateCompact(dateText) {
  if (!dateText) return ''
  const raw = String(dateText).trim()
  const isoDay = /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : raw
  const parts = isoDay.split('-')
  if (parts.length >= 3) {
    const [, month, day] = parts
    if (month && day) return `${day}/${month}`
  }
  try {
    const date = new Date(`${isoDay}T12:00:00`)
    if (Number.isNaN(date.getTime())) return raw
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      timeZone: 'Asia/Ho_Chi_Minh',
    }).format(date)
  } catch {
    return raw
  }
}

export function formatPublicationCalendarDayLabel(dateText, weekday) {
  const pretty = formatPublicationCalendarDateDisplay(dateText)
  if (!pretty) return ''
  if (weekday) return `${weekday} · ${pretty}`
  return pretty
}

/** Hiển thị tên chapter gọn — tránh "Ch. 1 — Chapter 1". */
export function formatPublicationCalendarChapterTitle(chapter) {
  const num = chapter?.chapterNumber
  const title = String(chapter?.title ?? '').trim()
  const generic =
    !title
    || /^chapter\s*\d+$/i.test(title)
    || /^ch\.?\s*\d+$/i.test(title)
  if (generic) {
    return num != null && num !== '' ? `Ch. ${num}` : (title || 'Chapter')
  }
  if (num != null && num !== '') return `Ch. ${num} — ${title}`
  return title
}
