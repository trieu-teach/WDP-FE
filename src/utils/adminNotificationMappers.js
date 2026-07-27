import { resolveEntityId } from '@/utils/notificationTarget.js'

/** Nhãn hiển thị cho type notification (admin). */
export const ADMIN_NOTIFICATION_TYPE_LABELS = {
  info: 'Thông báo',
  success: 'Thành công',
  warning: 'Cảnh báo',
  error: 'Lỗi',
  assignment: 'Giao việc',
  review: 'Duyệt bản',
  cooperation: 'Hợp tác',
  te_review: 'TE review',
  eb_evaluation: 'EB đánh giá',
  chapter: 'Chapter',
  chapter_to_te: 'Chapter → TE',
  series: 'Series',
  page: 'Trang',
  task: 'Task',
  vote: 'Biểu quyết',
  series_end_request_submitted: 'Yêu cầu kết thúc (gửi)',
  series_end_approved: 'Duyệt kết thúc',
  series_end_final_chapter_pending: 'Chờ chapter cuối',
  series_end_rejected: 'Từ chối kết thúc',
  series_end_auto_cancelled: 'Hủy yêu cầu kết thúc',
  series_end_notify_readers: 'Series kết thúc (reader)',
  series_end_notify_assistant: 'Series kết thúc (assistant)',
}

export const ADMIN_RELATED_ENTITY_LABELS = {
  series: 'Series',
  chapter: 'Chapter',
  page: 'Trang',
  task: 'Task',
  cooperation_request: 'Yêu cầu hợp tác',
  cooperation: 'Hợp tác',
  te_review: 'TE review',
  eb_evaluation: 'EB đánh giá',
  vote: 'Biểu quyết',
  series_end_request: 'Yêu cầu kết thúc',
}

export function adminNotificationTypeLabel(type) {
  const key = String(type ?? '').toLowerCase()
  return ADMIN_NOTIFICATION_TYPE_LABELS[key] ?? (key || '—')
}

export function adminRelatedEntityLabel(type) {
  const key = String(type ?? '').toLowerCase()
  return ADMIN_RELATED_ENTITY_LABELS[key] ?? (key || '—')
}

/** Chuẩn hoá 1 notification từ BE admin/user list. */
export function mapAdminNotificationItem(raw = {}) {
  if (!raw || typeof raw !== 'object') return null
  const id = String(raw._id ?? raw.id ?? raw.notificationId ?? '').trim()
  if (!id) return null
  const relatedType = raw.related_entity_type ?? raw.relatedEntityType ?? null
  const dataBag = typeof raw.data === 'object' && raw.data ? raw.data : {}
  const metaBag = typeof raw.meta === 'object' && raw.meta ? raw.meta : {}
  return {
    id,
    title: raw.title ?? raw.subject ?? 'Thông báo',
    message: raw.message ?? raw.body ?? raw.content ?? '',
    type: String(raw.type ?? raw.category ?? 'info').toLowerCase(),
    isRead: Boolean(raw.isRead ?? raw.is_read ?? raw.read ?? raw.read_at),
    createdAt: raw.createdAt ?? raw.created_at ?? null,
    link: raw.link ?? raw.url ?? raw.actionUrl ?? null,
    relatedEntityType: relatedType,
    relatedEntityId: resolveEntityId(raw.related_entity_id ?? raw.relatedEntityId),
    meta: { ...dataBag, ...metaBag },
    raw,
  }
}

function extractItems(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.data)) return payload.data
  if (payload?.data && Array.isArray(payload.data.items)) return payload.data.items
  return []
}

export function mapAdminNotificationListResponse(res = {}) {
  const body = res && typeof res === 'object' ? res : {}
  const inner = body.data !== undefined && !Array.isArray(body.data) ? body.data : body
  const rawItems = extractItems(inner).length
    ? extractItems(inner)
    : extractItems(body)
  const items = rawItems.map(mapAdminNotificationItem).filter(Boolean)
  return {
    items,
    total: Number(body.total ?? inner?.total ?? items.length) || 0,
    page: Number(body.page ?? inner?.page ?? 1) || 1,
    limit: Number(body.limit ?? inner?.limit ?? 20) || 20,
    unreadCount: Number(
      body.unreadCount
      ?? body.unread_count
      ?? inner?.unreadCount
      ?? inner?.unread_count
      ?? 0,
    ) || 0,
  }
}

export function mapAdminNotificationStats(raw = {}) {
  const data = raw?.data !== undefined ? raw.data : raw
  const byTypeRaw =
    data?.byType
    ?? data?.by_type
    ?? data?.typeStats
    ?? data?.type_stats
    ?? data?.statsByType
    ?? {}
  let byType = []
  if (Array.isArray(byTypeRaw)) {
    byType = byTypeRaw.map((row) => ({
      type: String(row.type ?? row._id ?? ''),
      count: Number(row.count ?? 0) || 0,
    }))
  } else if (byTypeRaw && typeof byTypeRaw === 'object') {
    byType = Object.entries(byTypeRaw).map(([type, count]) => ({
      type,
      count: Number(count) || 0,
    }))
  }
  const unread = Number(
    data?.unread ?? data?.unreadCount ?? data?.unread_count ?? 0,
  ) || 0
  const read = Number(
    data?.read ?? data?.readCount ?? data?.read_count ?? 0,
  ) || 0
  const total = Number(
    data?.total ?? data?.totalCount ?? data?.total_count ?? unread + read,
  ) || unread + read
  return { total, unread, read, byType }
}

export function mapAdminNotificationHistoryResponse(res = {}) {
  const list = mapAdminNotificationListResponse(res)
  const body = res && typeof res === 'object' ? res : {}
  const inner = body.data !== undefined && !Array.isArray(body.data) ? body.data : body
  const dateStatsRaw =
    inner?.dateStats
    ?? inner?.date_stats
    ?? body?.dateStats
    ?? body?.date_stats
    ?? []
  const dateStats = (Array.isArray(dateStatsRaw) ? dateStatsRaw : []).map((row) => ({
    date: String(row.date ?? row._id ?? row.day ?? ''),
    count: Number(row.count ?? row.total ?? 0) || 0,
  })).filter((row) => row.date)
  return { ...list, dateStats }
}

export function formatAdminNotificationDateTime(value) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

export function formatAdminNotificationTimeAgo(iso) {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const diff = Date.now() - t
  if (diff < 60_000) return 'vừa xong'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} phút`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} giờ`
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)} ngày`
  return new Date(iso).toLocaleDateString('vi-VN')
}

/** Gộp nhiều type filter thành chuỗi BE (comma-separated). */
export function joinNotificationTypes(types) {
  if (!types) return undefined
  if (Array.isArray(types)) {
    const joined = types.map((t) => String(t).trim()).filter(Boolean).join(',')
    return joined || undefined
  }
  const s = String(types).trim()
  return s || undefined
}
