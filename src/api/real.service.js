import { http as instance } from './http.js'

function unwrap(res) {
  if (res && typeof res === 'object' && res.success !== undefined && res.data !== undefined) {
    return unwrap(res.data)
  }
  return res
}

function formatReads(n) {
  const num = Number(n) || 0
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`
  return String(num)
}

function formatDate(value) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString('vi-VN')
  } catch {
    return '—'
  }
}

function formatActivityTime(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('vi-VN')
  } catch {
    return '—'
  }
}

function mapMangaListItem(s, index = 0) {
  const title = s.title ?? s.name ?? '—'
  const tags = Array.isArray(s.tags)
    ? s.tags
    : Array.isArray(s.genre)
      ? s.genre
      : []
  const deletedAt = s.deleted_at ?? s.deletedAt ?? null
  return {
    id: s.id ?? s._id,
    title,
    author: s.author ?? '',
    genre: tags,
    status: s.status ?? 'ongoing',
    publicationStatus:
      s.publication_status !== undefined
        ? s.publication_status
        : (s.publicationStatus ?? null),
    chapters: s.chapters ?? s.chapterCount ?? 0,
    reads: s.views ?? s.reads ?? 0,
    updatedAt: formatDate(s.updatedAt ?? s.createdAt),
    createdAt: formatDate(s.createdAt),
    initials: title.slice(0, 2).toUpperCase(),
    bg: `hsl(${((title.charCodeAt(0) || index) * 37) % 360} 55% 42%)`,
    thumbnail: s.thumbnail ?? s.cover_image_url ?? '',
    category: s.category ?? '',
    deletedAt,
    isDeleted: Boolean(deletedAt),
  }
}

function mapMangaList(raw) {
  if (Array.isArray(raw)) return raw.map(mapMangaListItem)
  const items = raw?.data ?? raw?.items ?? []
  return Array.isArray(items) ? items.map(mapMangaListItem) : []
}

/**
 * GET /admin/manga/:id — tách reader_rating (reader vote) và eb_evaluation (HĐ EB).
 * Breaking: không còn total_votes / average_score flat ở root.
 */
function mapEbCouncilMemberScores(members) {
  if (!Array.isArray(members)) return []
  return members.map((m) => {
    const scores = m.scores && typeof m.scores === 'object' ? m.scores : {}
    const scoreValues = [
      'story_dialogue',
      'art_design',
      'panel_camera',
      'pacing_climax',
      'color',
    ]
      .map((key) => Number(scores[key]))
      .filter((n) => Number.isFinite(n))
    const computedAvg = scoreValues.length
      ? scoreValues.reduce((sum, n) => sum + n, 0) / scoreValues.length
      : null
    const rawAvg = m.average != null ? Number(m.average) : null
    const average =
      rawAvg != null && Number.isFinite(rawAvg) && rawAvg > 0
        ? rawAvg
        : computedAvg

    // Chỉ nhận string — tránh Boolean/number từ bug short-circuit BE (String(true) → "true")
    const rawCandidate = m.member_name ?? m.memberName ?? m.name ?? ''
    const rawName =
      typeof rawCandidate === 'string' ? rawCandidate.trim() : ''
    const looksLikeLocalId = /^member-\d+-[a-z0-9]+$/i.test(rawName)
    const populatedFromId =
      m.member_id && typeof m.member_id === 'object'
        ? String(
            m.member_id.full_name
              ?? m.member_id.fullName
              ?? m.member_id.username
              ?? '',
          ).trim()
        : ''
    const populatedName = [
      populatedFromId,
      typeof m.full_name === 'string' ? m.full_name.trim() : '',
      typeof m.fullName === 'string' ? m.fullName.trim() : '',
      typeof m.username === 'string' ? m.username.trim() : '',
    ].find(Boolean) || ''

    const memberName =
      rawName && !looksLikeLocalId
        ? rawName
        : (populatedName || 'Thành viên HĐ')

    return {
      memberName,
      scores,
      average,
      totalScore:
        m.total_score != null
          ? Number(m.total_score)
          : (m.totalScore != null ? Number(m.totalScore) : null),
      overallComment: m.overall_comment ?? m.overallComment ?? '',
      savedAt: m.saved_at ?? m.savedAt ?? null,
    }
  })
}

/** Chuẩn hóa EBEvaluation / council summary từ BE (eb_evaluation & chapter_evaluation). */
function mapEbCouncilSummary(ebRaw) {
  if (!ebRaw || typeof ebRaw !== 'object') return null

  const members = Array.isArray(ebRaw.member_scores)
    ? ebRaw.member_scores
    : (Array.isArray(ebRaw.memberScores) ? ebRaw.memberScores : [])

  const chapterRaw = ebRaw.chapter
  const chapter = chapterRaw && typeof chapterRaw === 'object'
    ? {
        id: chapterRaw.id ?? chapterRaw._id ?? null,
        chapterNumber:
          chapterRaw.chapter_number != null
            ? Number(chapterRaw.chapter_number)
            : (chapterRaw.chapterNumber != null
              ? Number(chapterRaw.chapterNumber)
              : null),
        title: chapterRaw.title ?? '',
      }
    : null

  return {
    ...(chapter ? { chapter } : {}),
    totalMembers: Number(ebRaw.total_members ?? ebRaw.totalMembers ?? 0) || 0,
    councilAverage:
      ebRaw.council_average != null
        ? Number(ebRaw.council_average)
        : (ebRaw.councilAverage != null ? Number(ebRaw.councilAverage) : null),
    result: ebRaw.result ?? null,
    status: ebRaw.status ?? null,
    firstReview: Boolean(ebRaw.first_review ?? ebRaw.firstReview),
    scheduledPublishAt:
      ebRaw.scheduled_publish_at ?? ebRaw.scheduledPublishAt ?? null,
    evaluatedAt: ebRaw.evaluated_at ?? ebRaw.evaluatedAt ?? null,
    evaluatedBy: ebRaw.evaluated_by ?? ebRaw.evaluatedBy ?? null,
    lastSavedBy: ebRaw.last_saved_by ?? ebRaw.lastSavedBy ?? null,
    lastSavedAt: ebRaw.last_saved_at ?? ebRaw.lastSavedAt ?? null,
    memberScores: mapEbCouncilMemberScores(members),
  }
}

function mapAdminMangaDetail(raw) {
  if (!raw || typeof raw !== 'object') return raw

  const readerRaw = raw.reader_rating ?? raw.readerRating ?? null
  const averageScore = Number(
    readerRaw?.average_score
      ?? readerRaw?.averageScore
      ?? raw.average_score
      ?? raw.averageRating
      ?? 0,
  ) || 0
  const totalVotes = Number(
    readerRaw?.total_votes
      ?? readerRaw?.totalVotes
      ?? raw.total_votes
      ?? raw.votesCount
      ?? 0,
  ) || 0
  const formatted =
    readerRaw?.average_score_formatted
    ?? readerRaw?.averageScoreFormatted
    ?? `${averageScore.toFixed(1)} / 5`

  const ebEvaluation = mapEbCouncilSummary(
    raw.eb_evaluation ?? raw.ebEvaluation ?? null,
  )
  const chapterEvaluation = mapEbCouncilSummary(
    raw.chapter_evaluation ?? raw.chapterEvaluation ?? null,
  )

  const title = raw.title ?? raw.name ?? '—'
  const tags = Array.isArray(raw.tags)
    ? raw.tags
    : (Array.isArray(raw.genre) ? raw.genre : [])

  return {
    id: raw.id ?? raw._id,
    title,
    author: raw.author ?? '',
    description: raw.description ?? raw.synopsis ?? '',
    thumbnail: raw.thumbnail ?? raw.cover_image_url ?? '',
    status: raw.status ?? 'draft',
    category: raw.category ?? '',
    tags,
    genre: tags,
    ageRating: raw.age_rating ?? raw.ageRating ?? null,
    views: raw.views ?? raw.reads ?? 0,
    createdAt: raw.createdAt ?? raw.created_at ?? null,
    publicationStatus:
      raw.publication_status !== undefined
        ? raw.publication_status
        : (raw.publicationStatus ?? null),
    chapters: Array.isArray(raw.chapters) ? raw.chapters : (raw.chapterCount ?? 0),
    readerRating: {
      totalVotes,
      averageScore,
      averageScoreFormatted: formatted,
    },
    ebEvaluation,
    chapterEvaluation,
    // aliases dùng UI cũ / fallback
    averageRating: averageScore,
    votesCount: totalVotes,
    bg: `linear-gradient(135deg, hsl(${(title.charCodeAt(0) || 0) * 37 % 360} 60% 45%), hsl(${(title.charCodeAt(0) || 0) * 17 % 360} 70% 55%))`,
    raw,
  }
}

function mapChapterList(raw) {
  const items = Array.isArray(raw) ? raw : raw?.data ?? []
  if (!Array.isArray(items)) return []
  return items.map((c) => ({
    id: c.id ?? c._id,
    number: c.number ?? c.chapter_number,
    title: c.title ?? '',
    pages: c.pages ?? 0,
    status: c.status ?? 'draft',
    uploadedBy: c.createdBy?.name ?? c.uploadedBy ?? '—',
    uploadedAt: formatDate(c.createdAt ?? c.uploadedAt),
  }))
}

function mapChapterLegacyList(raw) {
  const items = Array.isArray(raw) ? raw : raw?.data ?? []
  if (!Array.isArray(items)) return []
  return items.map((c) => ({
    id: c._id ?? c.id,
    number: c.chapter_number,
    title: c.title ?? '',
    status: c.status ?? 'draft',
    seriesName: c.series_id?.name ?? '—',
    seriesId: c.series_id?._id ?? c.series_id,
    submittedBy: c.submitted_by?.full_name || c.submitted_by?.username || '—',
    createdAt: formatDate(c.createdAt),
  }))
}

function mapRoleStats(raw) {
  const items = Array.isArray(raw) ? raw : []
  const colors = ['#f43f5e', '#8b5cf6', '#0ea5e9', '#10b981', '#f59e0b', '#64748b']
  const total = items.reduce((sum, row) => sum + (row.count ?? 0), 0) || 1
  return items.map((row, index) => ({
    name: row._id ?? row.role ?? 'Khác',
    pct: Math.round(((row.count ?? 0) / total) * 100),
    color: colors[index % colors.length],
  }))
}

function mapGenresStats(raw) {
  const items = Array.isArray(raw) ? raw : raw?.data ?? []
  const colors = ['#8b5cf6', '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#06b6d4', '#84cc16', '#f97316']
  return items.map((row, index) => ({
    name: row._id ?? row.name ?? 'Khác',
    count: row.count ?? 0,
    color: colors[index % colors.length],
  }))
}

function mapNotifications(raw) {
  const items = Array.isArray(raw) ? raw : raw?.data ?? []
  if (!Array.isArray(items)) return []
  return items.map((n) => ({
    id: n._id ?? n.id,
    icon: n.is_read ? '✓' : '🔔',
    text: n.title || n.message || 'Thông báo',
    time: formatActivityTime(n.createdAt),
    isRead: n.is_read ?? false,
  }))
}

function mapStatsResponse(raw) {
  const data = raw?.data ?? raw ?? {}
  return {
    users: data.users ?? { total: 0, byRole: [] },
    series: data.series ?? { total: 0, byStatus: [] },
    chapters: data.chapters ?? { total: 0 },
    votes: data.votes ?? { total: 0 },
    recentUsers: data.recentUsers ?? [],
  }
}

function mapActivityItems(items) {
  return (items ?? []).map((a) => ({
    id: a.id ?? a._id,
    type: a.type ?? 'chapter',
    icon: '📌',
    text: a.message ?? a.title ?? 'Hoạt động mới',
    bold: [],
    time: formatActivityTime(a.time ?? a.createdAt),
  }))
}

function mapRecentActivitiesResponse(raw) {
  const payload = raw?.data ?? raw ?? {}
  const pagination = payload.activityPagination ?? {}
  return {
    activities: mapActivityItems(payload.recentActivity),
    page: pagination.page ?? 1,
    pages: pagination.pages ?? 1,
    total: pagination.total ?? 0,
  }
}

function mapDashboardResponse(raw) {
  const payload = raw?.data ?? raw ?? {}
  const stats = payload.stats ?? {}

  const chartData = (payload.viewsPerDay ?? []).map((row) => ({
    day: row.date
      ? new Date(row.date).toLocaleDateString('vi-VN', { weekday: 'short' })
      : '—',
    reads: row.views ?? 0,
    newCh: 0,
  }))

  return {
    stats: [
      { label: 'Tổng lượt xem', value: formatReads(stats.totalViews), delta: '—', dir: 'up' },
      { label: 'Tổng chương', value: formatReads(stats.totalReads), delta: '—', dir: 'up' },
      { label: 'Người dùng', value: formatReads(stats.totalUsers), delta: '—', dir: 'up' },
      { label: 'Bình luận', value: formatReads(stats.totalComments), delta: '—', dir: 'up' },
    ],
    chartData: chartData.length ? chartData : [{ day: '—', reads: 0, newCh: 0 }],
    genres: [],
    topManga: (payload.topManga ?? []).map((m, index) => ({
      title: m.title ?? m.name ?? '—',
      genre: m.genre ?? '—',
      chapters: m.chapters ?? '—',
      reads: formatReads(m.views ?? m.views_count ?? 0),
      status: m.status ?? 'ongoing',
      initials: String(m.title ?? m.name ?? '?').slice(0, 2).toUpperCase(),
      bg: `hsl(${(index * 67) % 360} 55% 42%)`,
      thumbnail: m.cover_image_url ?? m.thumbnail ?? '',
    })),
    activities: mapActivityItems(payload.recentActivity),
  }
}

export const realService = {
  getDashboard: () =>
    instance.get('/admin/dashboard').then((res) => mapDashboardResponse(res)),

  getRecentActivities: (page = 1, limit = 5) =>
    instance
      .get('/admin/dashboard', { params: { activityPage: page, activityLimit: limit } })
      .then((res) => mapRecentActivitiesResponse(res?.data ?? res)),

  getMangaList: (params = {}) =>
    instance
      .get('/admin/manga', {
        params: {
          ...(params.includeDeleted ? { include_deleted: true } : {}),
        },
      })
      .then(unwrap)
      .then(mapMangaList),

  getMangaById: (id) =>
    instance.get(`/admin/manga/${id}`).then(unwrap).then(mapAdminMangaDetail),

  createManga: (data) => instance.post('/admin/manga', data).then(unwrap),

  updateManga: (id, data) => instance.put(`/admin/manga/${id}`, data).then(unwrap),

  /** Force soft-delete — mọi status; cascade chapters soft + pages/tasks hard. */
  deleteManga: (id) => instance.delete(`/admin/manga/${id}`).then(unwrap),

  getChaptersByManga: (mangaId) =>
    instance.get(`/admin/manga/${mangaId}/chapters`).then(unwrap).then(mapChapterList),

  createChapter: (data) => {
    const payload = {
      mangaId: data.mangaId,
      number: Number(data.number),
      title: data.title || '',
      pages: Array.isArray(data.pages) ? data.pages : [],
    }
    return instance.post('/admin/chapters', payload).then(unwrap)
  },

  deleteChapter: (id) => instance.delete(`/admin/chapters/${id}`).then(unwrap),

  getChaptersLegacy: (params) =>
    instance.get('/admin/chapters-legacy', { params }).then(unwrap).then(mapChapterLegacyList),

  updateChapterStatus: (id, status) =>
    instance.patch(`/admin/manga/chapters/${id}/status`, { status }).then(unwrap),

  updateSeriesStatus: (id, status) =>
    instance.patch(`/admin/manga/series/${id}/status`, { status }).then(unwrap),

  /**
   * PATCH /admin/manga/series/:id/publication-status
   * Đổi publication_status (reader): upcoming|ongoing|hiatus|completed|dropped|null
   * Khác với status workflow (draft/approved/published/...).
   */
  updateSeriesPublicationStatus: (id, { publication_status, note } = {}) => {
    const body = { publication_status }
    const trimmedNote = note != null ? String(note).trim() : ''
    if (trimmedNote) body.note = trimmedNote
    return instance
      .patch(`/admin/manga/series/${id}/publication-status`, body)
      .then(unwrap)
  },

  getUsers: () => instance.get('/admin/users').then(unwrap),

  getUserById: (id) => instance.get(`/admin/users/${id}`).then(unwrap),

  updateUserStatus: (id, status) =>
    instance.put(`/admin/users/${id}/status`, { status }).then(unwrap),

  createUser: (data) => instance.post('/admin/users-legacy', data).then(unwrap),

  updateUser: (id, data) => instance.patch(`/admin/users-legacy/${id}`, data).then(unwrap),

  changeUserRole: (id, role) =>
    instance.patch(`/admin/users-legacy/${id}/role`, { role }).then(unwrap),

  deleteUser: (id) => instance.delete(`/admin/users-legacy/${id}`).then(unwrap),

  getStats: () => instance.get('/admin/stats').then(unwrap).then(mapStatsResponse),

  getRoles: () => instance.get('/admin/roles').then(unwrap).then(mapRoleStats),

  getGenresStats: () => instance.get('/admin/stats/genres').then(unwrap).then(mapGenresStats),

  getEbCandidates: () => instance.get('/admin/eb-representative/candidates').then(unwrap),

  setEbRepresentative: (userId) =>
    instance.patch(`/admin/eb-representative/${userId}`).then(unwrap),

  clearEbRepresentative: () => instance.delete('/admin/eb-representative').then(unwrap),

  /**
   * GET /admin/publication-calendar
   * Lịch xuất bản toàn hệ thống: overview + upcoming + days.
   * Query: from_date, to_date, schedule=weekly|monthly, include_published, series_id
   */
  getPublicationCalendar: (params = {}) => {
    const query = {}
    if (params.from_date) query.from_date = params.from_date
    if (params.to_date) query.to_date = params.to_date
    if (params.schedule) query.schedule = params.schedule
    if (params.series_id) query.series_id = params.series_id
    if (params.include_published != null) {
      query.include_published = params.include_published ? 'true' : 'false'
    }
    return instance.get('/admin/publication-calendar', { params: query }).then(unwrap)
  },

  getNotifications: (params) =>
    instance.get('/notifications', { params }).then((res) => mapNotifications(res?.data ?? res)),

  getProfile: () => instance.get('/admin/profile').then(unwrap),

  updateProfile: (data) => instance.put('/admin/profile', data).then(unwrap),

  // ===== Rankings =====
  getRankingsStats: () => instance.get('/admin/rankings/stats').then(unwrap),

  getRankingsList: (params = {}) => {
    const { type = 'views', period = 'weekly', page = 1, limit = 10, search = '' } = params
    return instance
      .get('/admin/rankings/list', {
        params: { type, period, page, limit: Number(limit), search },
      })
      .then(res => {
        const data = unwrap(res)
        return {
          items: Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [],
          total: data?.total ?? 0,
        }
      })
  },

  getRankingsSeriesDetail: (id) => instance.get(`/admin/rankings/series/${id}`).then(unwrap),

  // ===== Comments =====
  getCommentsByManga: (mangaId) =>
    instance.get(`/admin/manga/${mangaId}/comments`).then(unwrap),

  deleteComment: (commentId) =>
    instance.delete(`/admin/comments/${commentId}`).then(unwrap),
}
