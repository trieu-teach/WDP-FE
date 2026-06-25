import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { notificationsService } from '@/api/notifications.service.js'
import { getApiErrorMessage } from '@/api/http.js'
import { resolveEntityId } from '@/utils/notificationTarget.js'

const POLL_INTERVAL_MS = 45_000

function normalize(raw) {
  if (!raw) return null
  const relatedType = raw.related_entity_type ?? raw.relatedEntityType ?? null
  const relatedId = resolveEntityId(raw.related_entity_id ?? raw.relatedEntityId)
  const dataBag = typeof raw.data === 'object' && raw.data ? raw.data : {}
  const metaBag = typeof raw.meta === 'object' && raw.meta ? raw.meta : {}
  return {
    id: String(raw._id ?? raw.id ?? raw.notificationId ?? ''),
    title: raw.title ?? raw.subject ?? 'Thông báo',
    message: raw.message ?? raw.body ?? raw.content ?? '',
    type: raw.type ?? raw.category ?? 'info',
    isRead: Boolean(raw.isRead ?? raw.is_read ?? raw.read ?? raw.read_at),
    createdAt: raw.createdAt ?? raw.created_at ?? null,
    link: raw.link ?? raw.url ?? raw.actionUrl ?? null,
    relatedEntityType: relatedType,
    relatedEntityId: relatedId,
    meta: { ...dataBag, ...metaBag },
    raw,
  }
}

export function useNotifications({ pollInterval = POLL_INTERVAL_MS, enabled = true, onNew } = {}) {
  const [items, setItems] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const timerRef = useRef(null)
  const seenIdsRef = useRef(new Set())
  const onNewRef = useRef(onNew)
  onNewRef.current = onNew

  const refresh = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    try {
      const res = await notificationsService.list({ limit: 20 })
      const list = (Array.isArray(res.items) ? res.items : []).map(normalize).filter(n => n.id)
      // Phát hiện notification mới (chưa thấy id lần nào)
      const seen = seenIdsRef.current
      const fresh = list.filter(n => !seen.has(n.id))
      for (const n of list) seen.add(n.id)
      setItems(list)
      setUnreadCount(Number(res.unreadCount ?? list.filter(n => !n.isRead).length))
      if (fresh.length) {
        const handler = onNewRef.current
        if (typeof handler === 'function') {
          for (const n of fresh) handler(n)
        }
      }
    } catch (err) {
      // Không hiện toast mỗi lần poll, chỉ log
      console.warn('[notifications] refresh failed', err?.message ?? err)
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return undefined
    void refresh()
    timerRef.current = window.setInterval(() => { void refresh() }, pollInterval)
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current)
    }
  }, [enabled, pollInterval, refresh])

  const markRead = useCallback(async (id) => {
    setItems(prev => prev.map(n => (n.id === id ? { ...n, isRead: true } : n)))
    setUnreadCount(prev => Math.max(0, prev - 1))
    try {
      await notificationsService.markRead(id)
    } catch (err) {
      // Revert nếu lỗi
      setItems(prev => prev.map(n => (n.id === id ? { ...n, isRead: false } : n)))
      setUnreadCount(prev => prev + 1)
      toast.error(getApiErrorMessage(err, 'Không đánh dấu được đã đọc.'))
    }
  }, [])

  const markAllRead = useCallback(async () => {
    const prevItems = items
    const prevCount = unreadCount
    setItems(prev => prev.map(n => ({ ...n, isRead: true })))
    setUnreadCount(0)
    try {
      await notificationsService.markAllRead()
    } catch (err) {
      setItems(prevItems)
      setUnreadCount(prevCount)
      toast.error(getApiErrorMessage(err, 'Không đánh dấu được tất cả đã đọc.'))
    }
  }, [items, unreadCount])

  const dismiss = useCallback(async (id) => {
    const target = items.find(n => n.id === id)
    setItems(prev => prev.filter(n => n.id !== id))
    if (target && !target.isRead) setUnreadCount(prev => Math.max(0, prev - 1))
    try {
      await notificationsService.dismiss(id)
    } catch (err) {
      // Revert
      if (target) {
        setItems(prev => [target, ...prev])
        if (!target.isRead) setUnreadCount(prev => prev + 1)
      }
      toast.error(getApiErrorMessage(err, 'Không xoá được thông báo.'))
    }
  }, [items])

  return {
    items,
    unreadCount,
    loading,
    refresh,
    markRead,
    markAllRead,
    dismiss,
  }
}
