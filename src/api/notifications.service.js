import { http } from './http.js'

function unwrap(res) {
  if (res && typeof res === 'object' && res.success !== undefined && res.data !== undefined) {
    return unwrap(res.data)
  }
  return res
}

export const notificationsService = {
  list(params = {}) {
    return http.get('/notifications', { params }).then(res => ({
      items: unwrap(res) ?? [],
      pagination: res?.pagination ?? null,
      unreadCount: res?.unreadCount ?? 0,
    }))
  },

  markRead(id) {
    return http.patch(`/notifications/${id}/read`)
  },

  markAllRead() {
    return http.patch('/notifications/read-all')
  },

  dismiss(id) {
    return http.delete(`/notifications/${id}`)
  },
}
