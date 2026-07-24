import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { clearWelcomeBack, peekWelcomeBack } from '@/utils/welcomeBackStorage.js'
import { cn } from '@/lib/utils'
import './WelcomeBackPill.css'

function getInitials(name = '') {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(-2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || 'M'
  )
}

/**
 * Toast treo mép trên giữa trang chủ — “WELCOME BACK + tên + avatar”.
 * Hiện 1 lần sau login (queue ở Login, peek trên Home).
 */
export function WelcomeBackPill({ className }) {
  const [payload, setPayload] = useState(() => peekWelcomeBack())
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const data = peekWelcomeBack()
    if (!data) return undefined

    setPayload(data)

    const hideT = window.setTimeout(() => setLeaving(true), 3200)
    const clearT = window.setTimeout(() => {
      clearWelcomeBack()
      setPayload(null)
      setLeaving(false)
    }, 3800)

    return () => {
      // Strict Mode: chỉ hủy timer, KHÔNG clear payload — remount vẫn hiện được
      window.clearTimeout(hideT)
      window.clearTimeout(clearT)
    }
  }, [])

  const initials = useMemo(
    () => getInitials(payload?.name ?? ''),
    [payload?.name],
  )

  if (!payload) return null

  return createPortal(
    <div
      className={cn(
        'welcome-back-pill',
        leaving && 'welcome-back-pill--leave',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <Avatar className="welcome-back-pill__avatar size-10 border-2 border-white/15">
        {payload.avatarUrl ? (
          <AvatarImage src={payload.avatarUrl} alt="" />
        ) : null}
        <AvatarFallback className="bg-zinc-700 text-sm font-semibold text-white">
          {initials}
        </AvatarFallback>
      </Avatar>
      <p className="welcome-back-pill__text">
        <span className="welcome-back-pill__label">WELCOME BACK</span>
        <span className="welcome-back-pill__name">{payload.name}</span>
      </p>
    </div>,
    document.body,
  )
}

export default WelcomeBackPill
