import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSession } from '@/lib/auth.js'

const PUBLIC_PATHS = new Set(['/', '/login', '/register/verify-otp'])

export function isProtectedHomePath(path) {
  if (!path || typeof path !== 'string') return false
  if (path.startsWith('#')) return false
  const base = path.split('?')[0]
  return !PUBLIC_PATHS.has(base)
}

export function useLoginRequired() {
  const navigate = useNavigate()
  const user = getSession()
  const [open, setOpen] = useState(false)
  const [pendingPath, setPendingPath] = useState(null)

  const requireLogin = useCallback((path = null) => {
    setPendingPath(path)
    setOpen(true)
  }, [])

  const guardClick = useCallback((path, event) => {
    if (user) return false
    if (!isProtectedHomePath(path)) return false
    event?.preventDefault()
    requireLogin(path)
    return true
  }, [user, requireLogin])

  const guardButton = useCallback(() => {
    if (user) return false
    requireLogin(null)
    return true
  }, [user, requireLogin])

  const goLogin = useCallback(() => {
    setOpen(false)
    navigate('/login', pendingPath ? { state: { from: pendingPath } } : undefined)
  }, [navigate, pendingPath])

  return {
    user,
    open,
    setOpen,
    pendingPath,
    requireLogin,
    guardClick,
    guardButton,
    goLogin,
  }
}
