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
  return {
    id: s.id ?? s._id,
    title,
    author: s.author ?? '',
    genre: tags,
    status: s.status ?? 'ongoing',
    chapters: s.chapters ?? s.chapterCount ?? 0,
    reads: s.views ?? s.reads ?? 0,
    updatedAt: formatDate(s.updatedAt ?? s.createdAt),
    createdAt: formatDate(s.createdAt),
    initials: title.slice(0, 2).toUpperCase(),
    bg: `hsl(${((title.charCodeAt(0) || index) * 37) % 360} 55% 42%)`,
    thumbnail: s.thumbnail ?? '',
    category: s.category ?? '',
  }
}

function mapMangaList(raw) {
  if (Array.isArray(raw)) return raw.map(mapMangaListItem)
  const items = raw?.data ?? raw?.items ?? []
  return Array.isArray(items) ? items.map(mapMangaListItem) : []
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

  getMangaList: () => instance.get('/admin/manga').then(unwrap).then(mapMangaList),

  getMangaById: (id) => instance.get(`/admin/manga/${id}`).then(unwrap),

  createManga: (data) => instance.post('/admin/manga', data).then(unwrap),

  updateManga: (id, data) => instance.put(`/admin/manga/${id}`, data).then(unwrap),

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

  getEbCandidates: () => instance.get('/admin/eb-representative/candidates').then(unwrap),

  setEbRepresentative: (userId) =>
    instance.patch(`/admin/eb-representative/${userId}`).then(unwrap),

  clearEbRepresentative: () => instance.delete('/admin/eb-representative').then(unwrap),

  getNotifications: (params) =>
    instance.get('/notifications', { params }).then((res) => mapNotifications(res?.data ?? res)),

  getProfile: () => instance.get('/admin/profile').then(unwrap),

  updateProfile: (data) => instance.put('/admin/profile', data).then(unwrap),
}
