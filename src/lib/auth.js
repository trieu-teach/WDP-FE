import { authService, getApiErrorMessage } from '@/api/auth.service.js'

export const ROLES = { MANGAKA: 'mangaka', ASSISTANT: 'assistant' }

export const ROLE_OPTIONS = [
  { value: ROLES.MANGAKA, icon: 'mangaka', title: 'Mangaka', desc: 'Tạo series, upload chapter và giao việc cho Assistant.' },
  { value: ROLES.ASSISTANT, icon: 'assistant', title: 'Assistant', desc: 'Nhận draft từ Mangaka và bổ sung phần vẽ ngoại cảnh.' },
]

export const ROLE_LABELS = {
  [ROLES.MANGAKA]: 'Mangaka',
  [ROLES.ASSISTANT]: 'Assistant',
  admin: 'Admin',
  editor: 'Editor',
  eb: 'Editor Board',
  reader: 'Reader',
}

const API_ROLE_TO_APP = {
  Admin: 'admin',
  Mangaka: ROLES.MANGAKA,
  Assistant: ROLES.ASSISTANT,
  Editor: 'editor',
  EB: 'eb',
  Reader: 'reader',
}

const APP_ROLE_TO_API = {
  [ROLES.MANGAKA]: 'Mangaka',
  [ROLES.ASSISTANT]: 'Assistant',
}

const ROLE_PATH = {
  admin: '/admin/dashboard',
  [ROLES.MANGAKA]: '/mangaka',
  [ROLES.ASSISTANT]: '/assistant',
  editor: '/tantou',
  eb: '/eb',
  reader: '/',
}

export function getRolePath(role) {
  return ROLE_PATH[role] ?? '/login'
}

export function getSession() {
  try {
    const raw = sessionStorage.getItem('manga_user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveSession(user) {
  sessionStorage.setItem('manga_user', JSON.stringify(user))
}

function saveToken(token) {
  if (token) localStorage.setItem('token', token)
  else localStorage.removeItem('token')
}

export function logout() {
  sessionStorage.removeItem('manga_user')
  saveToken(null)
}

export function updateSession(updates) {
  const current = getSession()
  if (!current) return
  saveSession({ ...current, ...updates })
}

function normalizeUser(apiUser) {
  if (!apiUser) return null
  const fullName = apiUser.fullName ?? apiUser.full_name ?? apiUser.name
  const username = apiUser.username ?? ''
  const fallback = fullName || username || apiUser.email?.split('@')[0] || 'Người dùng'
  return {
    id: apiUser.userId ?? apiUser.accountId ?? apiUser._id ?? apiUser.id,
    name: fallback,
    email: apiUser.email ?? '',
    username,
    role: API_ROLE_TO_APP[apiUser.role] ?? apiUser.role?.toLowerCase?.() ?? apiUser.role,
    avatarUrl: apiUser.avatarUrl ?? apiUser.avatar_url ?? '',
    isProMember: Boolean(apiUser.isProMember),
  }
}

function unwrapAuthPayload(data) {
  if (data?.data && (data.data.token || data.data.user)) return data.data
  return data
}

async function fetchMeUser() {
  const data = unwrapAuthPayload(await authService.getMe())
  return normalizeUser(data?.user ?? data)
}

async function persistAuth({ token, user }) {
  saveToken(token)
  let sessionUser = normalizeUser(user)
  if (token) {
    try {
      const meUser = await fetchMeUser()
      if (meUser?.id) sessionUser = meUser
    } catch {
      /* giữ user từ login/verify nếu /auth/me lỗi tạm thời */
    }
  }
  saveSession(sessionUser)
  return sessionUser
}

export async function refreshSession() {
  const token = localStorage.getItem('token')
  if (!token) return getSession()
  try {
    const user = await fetchMeUser()
    if (user) {
      saveSession(user)
      return user
    }
  } catch {
    logout()
    return null
  }
  return getSession()
}

export async function login(usernameOrEmail, password) {
  const username = usernameOrEmail.trim()
  try {
    const data = unwrapAuthPayload(await authService.login(username, password))
    return await persistAuth(data)
  } catch (err) {
    throw { message: getApiErrorMessage(err, 'Đăng nhập thất bại.') }
  }
}

export function buildRegisterPayload({ username, name, email, password, role, phone }) {
  if (role !== ROLES.MANGAKA && role !== ROLES.ASSISTANT) {
    throw { message: 'Chỉ Mangaka và Assistant được phép đăng ký.' }
  }
  const normalizedEmail = email.trim().toLowerCase()
  const normalizedUsername = (username ?? normalizedEmail).trim()
  if (!normalizedUsername) {
    throw { message: 'Vui lòng nhập tên đăng nhập.' }
  }
  const payload = {
    username: normalizedUsername,
    password,
    full_name: name.trim(),
    email: normalizedEmail,
    role: APP_ROLE_TO_API[role],
  }
  const normalizedPhone = (phone ?? '').replace(/[\s.-]/g, '').trim()
  if (normalizedPhone) {
    payload.phoneNumber = normalizedPhone
  }
  return payload
}

export async function register({ username, name, email, password, role, phone }) {
  const payload = buildRegisterPayload({ username, name, email, password, role, phone })
  try {
    await authService.register(payload)
    return await login(payload.username, password)
  } catch (err) {
    throw { message: getApiErrorMessage(err, 'Đăng ký thất bại.') }
  }
}
