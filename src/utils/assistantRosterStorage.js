import {
  ASSISTANT_CATALOG,
  getAssistantById,
  getAssistantByUserId,
} from '@/constants/assistantCatalog.js'

const REQUESTS_KEY = 'mk-assistant-hire-requests-v1'
const EMPLOYMENT_KEY = 'mk-assistant-employment-v1'
const ROSTER_KEY = 'mk-mangaka-roster-v1'

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
  dispatchRosterUpdate()
}

export function dispatchRosterUpdate() {
  window.dispatchEvent(new CustomEvent('mk-assistant-roster-update'))
}

function uid(prefix = 'hire') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function readEmploymentMap() {
  return readJson(EMPLOYMENT_KEY, {})
}

function readRosterMap() {
  return readJson(ROSTER_KEY, {})
}

function readRequests() {
  return readJson(REQUESTS_KEY, [])
}

function writeEmploymentMap(map) {
  writeJson(EMPLOYMENT_KEY, map)
}

function writeRosterMap(map) {
  writeJson(ROSTER_KEY, map)
}

function writeRequests(list) {
  writeJson(REQUESTS_KEY, list)
}

/** Chuẩn hóa dữ liệu cũ (1 Mangaka) → mảng nhiều Mangaka. */
function normalizeMangakaIds(value) {
  if (value == null) return []
  if (Array.isArray(value)) return value.map(String)
  return [String(value)]
}

export function getEmployedMangakaIds(assistantId) {
  const map = readEmploymentMap()
  return normalizeMangakaIds(map[assistantId])
}

/** @deprecated — dùng getEmployedMangakaIds */
export function getEmployedMangakaId(assistantId) {
  const ids = getEmployedMangakaIds(assistantId)
  return ids[0] ?? null
}

export function isAssistantEmployedBy(assistantId, mangakaId) {
  return getMangakaRoster(mangakaId).some(
    r => r.assistantId === assistantId && r.status === 'active',
  )
}

export function listCatalogForMangaka(mangakaId) {
  const requests = readRequests()
  const roster = getMangakaRoster(mangakaId)

  return ASSISTANT_CATALOG.map(profile => {
    const pending = requests.find(
      r => r.assistantId === profile.id
        && String(r.mangakaId) === String(mangakaId)
        && r.status === 'pending',
    )
    const hired = roster.find(r => r.assistantId === profile.id && r.status === 'active')

    let availability = 'available'
    if (hired) availability = 'mine'
    else if (pending) availability = 'pending'

    return {
      ...profile,
      availability,
      employedMangakaIds: getEmployedMangakaIds(profile.id),
      pendingRequest: pending ?? null,
      rosterEntry: hired ?? null,
    }
  })
}

export function getMangakaRoster(mangakaId) {
  if (!mangakaId) return []
  const map = readRosterMap()
  const list = map[String(mangakaId)] ?? []
  return list.filter(entry => entry.status === 'active')
}

export function getActiveAssigneesForMangaka(mangakaId) {
  return getMangakaRoster(mangakaId).map(r => ({
    value: r.name,
    label: r.name,
    assistantId: r.assistantId,
  }))
}

export function listPendingRequestsForAssistantUser(userId) {
  const profile = getAssistantByUserId(userId)
  if (!profile) return []
  return readRequests().filter(
    r => r.assistantId === profile.id && r.status === 'pending',
  )
}

export function listRequestsForMangaka(mangakaId) {
  return readRequests().filter(r => String(r.mangakaId) === String(mangakaId))
}

export function createHireRequest({
  mangakaId,
  mangakaName,
  assistantId,
  note = '',
}) {
  const profile = getAssistantById(assistantId)
  if (!profile) throw new Error('Không tìm thấy Assistant.')

  if (isAssistantEmployedBy(assistantId, mangakaId)) {
    throw new Error('Assistant đã nằm trong đội của bạn.')
  }

  const requests = readRequests()
  const dup = requests.find(
    r => r.assistantId === assistantId
      && String(r.mangakaId) === String(mangakaId)
      && r.status === 'pending',
  )
  if (dup) throw new Error('Đã gửi yêu cầu — đang chờ Assistant phản hồi.')

  const req = {
    id: uid(),
    mangakaId,
    mangakaName: mangakaName || 'Mangaka',
    assistantId,
    assistantName: profile.name,
    note: String(note ?? '').trim(),
    status: 'pending',
    createdAt: Date.now(),
    respondedAt: null,
  }

  writeRequests([req, ...requests])
  return req
}

export function respondToHireRequest(requestId, accept, assistantUserId) {
  const profile = getAssistantByUserId(assistantUserId)
  if (!profile) throw new Error('Tài khoản không gắn hồ sơ Assistant.')

  const requests = readRequests()
  const idx = requests.findIndex(r => r.id === requestId)
  if (idx < 0) throw new Error('Yêu cầu không tồn tại.')

  const req = requests[idx]
  if (req.assistantId !== profile.id) throw new Error('Không phải yêu cầu gửi cho bạn.')
  if (req.status !== 'pending') throw new Error('Yêu cầu đã được xử lý.')

  if (accept) {
    const employment = readEmploymentMap()
    const prev = normalizeMangakaIds(employment[profile.id])
    const mangakaKey = String(req.mangakaId)
    if (!prev.includes(mangakaKey)) {
      employment[profile.id] = [...prev, mangakaKey]
      writeEmploymentMap(employment)
    }

    const rosterMap = readRosterMap()
    const key = mangakaKey
    const prevRoster = rosterMap[key] ?? []
    const filtered = prevRoster.filter(r => r.assistantId !== profile.id)
    rosterMap[key] = [
      {
        assistantId: profile.id,
        name: profile.name,
        handle: profile.handle,
        avatarColor: profile.avatarColor,
        hiredAt: Date.now(),
        status: 'active',
      },
      ...filtered,
    ]
    writeRosterMap(rosterMap)

    requests[idx] = {
      ...req,
      status: 'accepted',
      respondedAt: Date.now(),
    }
  } else {
    requests[idx] = {
      ...req,
      status: 'declined',
      respondedAt: Date.now(),
    }
  }

  writeRequests(requests)
  return requests[idx]
}
