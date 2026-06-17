import { useEffect } from 'react'
import { refreshSession } from '@/lib/auth.js'

/** Gọi GET /auth/me khi app load nếu đã có JWT. */
export default function SessionBootstrap() {
  useEffect(() => {
    void refreshSession()
  }, [])
  return null
}
