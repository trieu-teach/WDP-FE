import { http } from './http.js'

function unwrap(res) {
  return res?.data !== undefined && res?.success !== undefined ? res.data : res
}

export const cooperationService = {
  sendRequest({ assistant_id, series_id, message }) {
    return http.post('/cooperation-requests/requests', {
      assistant_id,
      ...(series_id ? { series_id } : {}),
      ...(message ? { message } : {}),
    }).then(unwrap)
  },

  getSentRequests() {
    return http.get('/cooperation-requests/requests/mine').then(unwrap)
  },

  getIncomingRequests() {
    return http.get('/cooperation-requests/requests/incoming').then(unwrap)
  },

  acceptMeet(requestId) {
    return http.post(`/cooperation-requests/requests/${requestId}/accept-meet`).then(unwrap)
  },

  rejectRequest(requestId) {
    return http.post(`/cooperation-requests/requests/${requestId}/reject`).then(unwrap)
  },

  acceptCooperation(requestId) {
    return http.post(`/cooperation-requests/requests/${requestId}/accept-cooperation`).then(unwrap)
  },

  declineCooperation(requestId) {
    return http.post(`/cooperation-requests/requests/${requestId}/decline-cooperation`).then(unwrap)
  },

  getMangakaCooperations() {
    return http.get('/cooperation-requests/mine').then(unwrap)
  },

  getAssistantCooperations() {
    return http.get('/cooperation-requests/assistant/mine').then(unwrap)
  },

  getAllAssistants() {
    return http.get('/cooperation-requests/assistants').then(unwrap)
  },
}
