import { http } from './http.js'

function unwrap(res) {
  if (res && typeof res === 'object' && res.success !== undefined && res.data !== undefined) {
    return unwrap(res.data)
  }
  return res
}

function asBody(res) {
  return res && typeof res === 'object' ? res : {}
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

  /**
   * Admin — GET /admin/notifications
   * @param {{ is_read?: boolean, type?: string, related_entity_type?: string, page?: number, limit?: number }} params
   */
  adminList(params = {}) {
    return http.get('/admin/notifications', { params }).then((res) => asBody(res))
  },

  /** Admin — PATCH /admin/notifications/read-all */
  adminMarkAllRead() {
    return http.patch('/admin/notifications/read-all').then((res) => asBody(res))
  },

  /** Admin — GET /admin/notifications/stats */
  adminStats() {
    return http.get('/admin/notifications/stats').then((res) => asBody(res))
  },

  /**
   * Admin — GET /admin/notifications/history
   * @param {{ type?: string, from_date?: string, to_date?: string, search?: string, page?: number, limit?: number }} params
   */
  adminHistory(params = {}) {
    return http.get('/admin/notifications/history', { params }).then((res) => asBody(res))
  },
}
