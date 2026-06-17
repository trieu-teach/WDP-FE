function pickUserId(ref) {
  if (!ref) return null
  if (typeof ref === 'string') return ref
  return ref._id ?? ref.userId ?? ref.id ?? null
}

function pickUserName(ref, fallback = '') {
  if (!ref || typeof ref === 'string') return fallback
  return ref.full_name ?? ref.fullName ?? ref.username ?? ref.email ?? fallback
}

const AVATAR_COLORS = ['#8b5cf6', '#0ea5e9', '#f97316', '#ec4899', '#10b981', '#6366f1']

function initialsFromName(name) {
  const parts = String(name).trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase()
  }
  return String(name).slice(0, 2).toUpperCase() || 'AS'
}

function colorFromId(id) {
  const key = String(id ?? '')
  let hash = 0
  for (let i = 0; i < key.length; i += 1) hash = (hash + key.charCodeAt(i)) % AVATAR_COLORS.length
  return AVATAR_COLORS[hash] ?? AVATAR_COLORS[0]
}

export function apiAssistantToCatalog(user) {
  const u = user ?? {}
  const accountId = pickUserId(u)
  const name = pickUserName(u, 'Assistant')
  const username = u.username ?? ''
  return {
    id: accountId ?? username ?? name,
    accountId,
    name,
    email: u.email ?? '',
    handle: username ? `@${username}` : (u.email ? `@${String(u.email).split('@')[0]}` : '@assistant'),
    avatarColor: colorFromId(accountId ?? name),
    initials: initialsFromName(name),
    bio: u.bio ?? u.description ?? 'Assistant đã đăng ký trên hệ thống.',
    specialties: Array.isArray(u.specialties) ? u.specialties : [],
    style: u.style ?? 'manga',
    rating: Number(u.rating ?? 0) || 0,
    completedPages: u.completed_pages ?? u.completedPages ?? 0,
    responseTime: u.response_time ?? u.responseTime ?? '—',
    languages: Array.isArray(u.languages) && u.languages.length ? u.languages : ['VI'],
    timezone: u.timezone ?? 'GMT+7',
  }
}

export function apiAssistantCooperationToUi(item) {
  const c = item ?? {}
  const mangaka = c.mangaka_id ?? {}
  return {
    id: c._id ?? c.id,
    mangakaId: pickUserId(mangaka),
    mangakaName: pickUserName(mangaka, 'Mangaka'),
    seriesId: pickUserId(c.series_id),
    agreedAt: c.agreed_at ?? c.createdAt,
  }
}

export function apiCooperationToRosterEntry(item) {
  const c = item ?? {}
  const assistant = c.assistant_id ?? {}
  const assistantId = pickUserId(assistant)
  const name = pickUserName(assistant, 'Assistant')
  return {
    assistantId,
    name,
    handle: assistant.username ? `@${String(assistant.username).split('@')[0]}` : '',
    avatarColor: '#8b5cf6',
    hiredAt: c.agreed_at ?? c.createdAt,
    status: 'active',
    cooperationId: c._id ?? c.id,
  }
}

export function apiRequestToUi(item) {
  const r = item ?? {}
  const mangaka = r.mangaka_id ?? {}
  const assistant = r.assistant_id ?? {}
  return {
    id: r._id ?? r.id,
    mangakaId: pickUserId(mangaka),
    mangakaName: pickUserName(mangaka, 'Mangaka'),
    assistantId: pickUserId(assistant),
    assistantName: pickUserName(assistant, 'Assistant'),
    seriesId: pickUserId(r.series_id),
    note: r.message ?? '',
    status: r.status ?? 'pending',
    createdAt: r.createdAt ? new Date(r.createdAt).getTime() : Date.now(),
    respondedAt: r.responded_at ? new Date(r.responded_at).getTime() : null,
  }
}

export function isPendingRequest(status) {
  return status === 'pending'
}

export function isMeetingPhase(status) {
  return status === 'accepted_meet'
}

export function isTerminalRequest(status) {
  return ['accepted', 'rejected', 'declined'].includes(status)
}

export function requestStatusLabel(status) {
  const map = {
    pending: 'Chờ Assistant phản hồi',
    accepted_meet: 'Đã đồng ý gặp — chờ chốt hợp tác',
    accepted: 'Đã hợp tác',
    rejected: 'Đã từ chối',
    declined: 'Đã từ chối hợp tác',
  }
  return map[status] ?? status
}
