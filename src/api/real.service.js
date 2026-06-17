import { http as instance } from './http.js'

export const realService = {
    getDashboard:       () => instance.get('/dashboard'),
    getMangaList:       () => instance.get('/manga'),
    getMangaById:       (id) => instance.get(`/manga/${id}`),
    createManga:        (data) => instance.post('/manga', data),
    updateManga:        (id, data) => instance.put(`/manga/${id}`, data),
    deleteManga:        (id) => instance.delete(`/manga/${id}`),
    getChaptersByManga: (mangaId) => instance.get(`/manga/${mangaId}/chapters`),
    createChapter:      (data) => instance.post('/chapters', data),
    deleteChapter:      (id) => instance.delete(`/chapters/${id}`),
    getUsers:           () => instance.get('/users'),
    getUserById:        (id) => instance.get(`/users/${id}`),
    updateUserStatus:   (id, status) => instance.put(`/users/${id}/status`, { status }),
    getProfile:         () => instance.get('/profile'),
    updateProfile:      (data) => instance.put('/profile', data),
}