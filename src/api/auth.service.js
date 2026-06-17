import { getApiErrorMessage, http } from './http.js'

export const authService = {
  register(payload) {
    return http.post('/auth/register', payload)
  },

  login(username, password) {
    return http.post('/auth/login', { username, password })
  },

  getMe() {
    return http.get('/auth/me')
  },
}

export { getApiErrorMessage }
