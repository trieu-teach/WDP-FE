/** Chuẩn hóa id từ string, ObjectId populate, hoặc object lồng nhau. */
export function resolveEntityId(value) {
  if (value == null) return null
  if (typeof value === 'object') {
    const id = value._id ?? value.id
    return id != null ? String(id).trim() || null : null
  }
  const text = String(value).trim()
  if (!text || text === '[object Object]') return null
  return text
}

function readMetaBag(notification) {
  const raw = notification?.raw ?? {}
  return {
    ...(typeof raw.data === 'object' && raw.data ? raw.data : {}),
    ...(typeof raw.meta === 'object' && raw.meta ? raw.meta : {}),
    ...(typeof notification?.meta === 'object' && notification.meta ? notification.meta : {}),
  }
}

function chapterIdFromLink(link) {
  if (!link) return null
  const text = String(link).trim()
  const match = text.match(/\/mangaka\/chapter\/([^/?#]+)\/te-revision/i)
  return match?.[1] ? decodeURIComponent(match[1]) : null
}

/** Lấy chapterId từ notification TE revision (nhiều shape BE). */
export function resolveChapterIdFromNotification(notification) {
  if (!notification) return null

  const meta = readMetaBag(notification)
  const raw = notification.raw ?? {}
  const relatedType = String(
    notification.relatedEntityType ?? raw.related_entity_type ?? '',
  ).toLowerCase()

  const metaChapterId = resolveEntityId(
    meta.chapterId
    ?? meta.chapter_id
    ?? raw.chapterId
    ?? raw.chapter_id,
  )
  if (metaChapterId) return metaChapterId

  const fromLink = chapterIdFromLink(notification.link ?? raw.link ?? raw.url)
  if (fromLink) return fromLink

  if (relatedType === 'chapter') {
    return resolveEntityId(notification.relatedEntityId ?? raw.related_entity_id)
  }

  // te_review: related_entity_id thường là mã review, không phải chapter
  if (relatedType === 'te_review') return null

  return resolveEntityId(notification.relatedEntityId ?? raw.related_entity_id)
}

export function getMangakaTeRevisionPath(chapterId) {
  const id = resolveEntityId(chapterId)
  return id ? `/mangaka/chapter/${encodeURIComponent(id)}/te-revision` : null
}

export function isTeRevisionNotification(notification) {
  if (!notification) return false

  const title = String(notification.title ?? '').toLowerCase()
  const message = String(notification.message ?? '').toLowerCase()
  const type = String(notification.type ?? '').toLowerCase()
  const meta = readMetaBag(notification)
  const status = String(meta.status ?? '').toLowerCase()

  return (
    type === 'te_review'
    || type === 'review'
    || type === 'warning'
    || status.includes('te_revision')
    || title.includes('te yêu cầu')
    || title.includes('yêu cầu chỉnh')
    || message.includes('góp ý của te')
    || message.includes('cần chỉnh sửa theo')
  )
}

export function isSafeNotificationLink(link) {
  if (!link) return false
  const path = String(link).trim()
  return path !== '/' && path !== '' && path !== '#'
}

export function isEbApprovedNotification(notification) {
  if (!notification) return false
  const type = String(notification.type ?? '').toLowerCase()
  return (
    type === 'chapter_approved_by_eb'
    || type === 'eb_approved'
    || String(notification.title ?? '').toLowerCase().includes('eb duyệt')
  )
}

export function readEbApprovalMeta(notification) {
  const meta = readMetaBag(notification)
  return {
    chapterId: resolveEntityId(meta.chapter_id ?? meta.chapterId),
    seriesId: resolveEntityId(meta.series_id ?? meta.seriesId),
    councilAverage: meta.council_average ?? meta.councilAverage ?? null,
    classification: meta.classification ?? null,
    classificationText: meta.classification_text ?? meta.classificationText ?? '',
  }
}
