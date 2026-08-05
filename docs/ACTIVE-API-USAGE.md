# API đang được sử dụng — TE / EB / Admin

> **Mục đích:** Liệt kê các API mà frontend **thực sự đang gọi** trong code (không liệt kê API có trong service nhưng chưa được page nào dùng).
>
> **Cập nhật:** scan ngày 2026-07-29.
>
> **Cách đọc:** mỗi API được ghi theo format `METHOD /path` + **method của service** + **page/component gọi**.

---

## 1. TE (Tantou)

TE pages nằm ở `src/pages/User/Tantou/` + components `src/components/Tantou/`.
Service chính: `teReviewsService` (@/api/teReviews.service.js).
Service phụ: `seriesService` (@/api/series.service.js), `mangakaProfileService` (@/api/mangakaProfile.service.js).

### 1.1. Review chapter

| API | Service method | Gọi từ |
|---|---|---|
| `GET /te-reviews/pending` | `teReviewsService.getPending()` | `TantouHub.jsx`, `TantouEditor.jsx` |
| `GET /te-reviews/history` | `teReviewsService.getHistory(params)` | `TantouHub.jsx`, `TantouReviewHistory.jsx` |
| `GET /te-reviews/series/:seriesId/profile` | `teReviewsService.getSeriesProfile(seriesId)` | `TantouEditor.jsx`, `TantouChapterReviewDashboard.tsx` |
| `GET /te-reviews/series-review/:seriesId` | `teReviewsService.getSeriesReview(seriesId)` | `TantouChapterReviewDashboard.tsx` |
| `POST /te-reviews/series-review/:seriesId` | `teReviewsService.saveSeriesReviewDraft(...)` | `TantouEditor.jsx` |
| `POST /te-reviews/series-review/:seriesId/submit` | `teReviewsService.submitSeriesReview(...)` | `TantouEditor.jsx` |
| `POST /te-reviews/series-review/:seriesId/review-chapter` | `teReviewsService.reviewChapter(...)` | `TantouEditor.jsx` |

### 1.2. Chapter pages & annotations

| API | Service method | Gọi từ |
|---|---|---|
| `GET /te-reviews/chapter/:chapterId/pages?all=true` | `teReviewsService.getAllChapterPages(chapterId)` | `TantouEditor.jsx`, `TantouChapterReviewDashboard.tsx` |
| `GET /te-reviews/chapter/:chapterId/pages?page=N` | `teReviewsService.getChapterPage(chapterId, page)` | `TantouChapterReviewDashboard.tsx` |
| `GET /te-reviews/chapter/:chapterId/annotations` | `teReviewsService.getAnnotations(chapterId, pageId?)` | `TantouEditor.jsx`, `TantouChapterReviewDashboard.tsx` |
| `POST /te-reviews/chapter/:chapterId/annotations` | `teReviewsService.createAnnotation(...)` | `TantouEditor.jsx` |
| `PATCH /te-reviews/chapter/:chapterId/annotations/:id` | `teReviewsService.updateAnnotation(...)` | `TantouEditor.jsx` |
| `DELETE /te-reviews/chapter/:chapterId/annotations/:id` | `teReviewsService.deleteAnnotation(...)` | `TantouEditor.jsx` |

### 1.3. TE-action (phase 2)

| API | Service method | Gọi từ |
|---|---|---|
| `POST /te-reviews/chapter/:chapterId/te-action` | `teReviewsService.teAction(...)` | `TantouEditor.jsx` |
| `POST /te-reviews/chapter/:chapterId/publish` | `teReviewsService.publishChapter(...)` | `TantouEditor.jsx` |

### 1.4. Calendar

| API | Service method | Gọi từ |
|---|---|---|
| `GET /te-reviews/calendar` | `teReviewsService.getCalendar(params)` | `TantouPublicationCalendar.jsx` |

### 1.5. Publication status

| API | Service method | Gọi từ |
|---|---|---|
| `PATCH /te-reviews/series/:seriesId/publication-status` | `teReviewsService.updatePublicationStatus(...)` | `TantouEditor.jsx` |

### 1.6. Service phụ (read-only)

| API | Service method | Gọi từ |
|---|---|---|
| `GET /series?publication_status=...` | `seriesService.getAll({ publication_status })` | `TantouEditor.jsx` |
| `GET /series/:id` | `seriesService.getById(id)` | `TantouEditor.jsx`, `TantouChapterReviewDashboard.tsx` |
| `GET /series/:id/chapters` | `seriesService.getChapters(seriesId)` | `TantouChapterReviewDashboard.tsx` |
| `GET /mangaka/:id/profile` | `mangakaProfileService.getPublicProfile(id)` | `TantouEditor.jsx` |

---

## 2. EB (編集)

EB pages nằm ở `src/pages/User/Eb/`.
Service chính: `ebEvaluationsService`, `ebScoresService`.
Service phụ: `mangakaProfileService`.

### 2.1. Review chapter

| API | Service method | Gọi từ |
|---|---|---|
| `GET /eb-evaluations/chapter/pending` | `ebEvaluationsService.getChapterPending(params)` | `Eb.jsx`, `EbPublish.jsx` |
| `GET /eb-evaluations/chapter/:chapterId` | `ebEvaluationsService.getChapterDetail(chapterId)` | `Eb.jsx`, `EbPublish.jsx` |
| `POST /eb-evaluations/chapter/:chapterId/evaluate` | `ebEvaluationsService.evaluateChapter(...)` | `Eb.jsx` |
| `GET /eb-scores/chapter/:chapterId/preview` | `ebScoresService.getChapterPreview(chapterId)` | `Eb.jsx`, `EbSeriesDetail.jsx` |

### 2.2. Series detail

| API | Service method | Gọi từ |
|---|---|---|
| `GET /eb-evaluations/series/:seriesId` | `ebEvaluationsService.getSeriesDetail(seriesId)` | `EbSeriesDetail.jsx` |

### 2.3. Publish (confirm publish)

| API | Service method | Gọi từ |
|---|---|---|
| `POST /eb-evaluations/series/:seriesId/confirm-publish` | `ebEvaluationsService.confirmPublish(seriesId, ...)` | `EbPublish.jsx` |

### 2.4. Publication schedule

| API | Service method | Gọi từ |
|---|---|---|
| `GET /eb-evaluations/publication-schedule` | `ebEvaluationsService.getPublicationSchedule(params)` | `EbPublicationSchedule.jsx` |

### 2.5. History

| API | Service method | Gọi từ |
|---|---|---|
| `GET /eb-evaluations/history` | `ebEvaluationsService.getHistory(params)` | `EbHistory.jsx` |
| `GET /eb-evaluations/history/:evaluationId` | `ebEvaluationsService.getHistoryDetail(evaluationId)` | `EbHistoryDetail.jsx` |

### 2.6. Service phụ (read-only)

| API | Service method | Gọi từ |
|---|---|---|
| `GET /mangaka/:id/profile` | `mangakaProfileService.getPublicProfile(id)` | `Eb.jsx` |

> **Lưu ý:** `Eb/TantouPageReview.jsx` là wrapper chỉ render `TantouChapterReviewDashboard` — không gọi API riêng.

---

## 3. Admin

Admin pages nằm ở `src/pages/Admin/`.
Service chính cho end-request: `seriesEndRequestsService`.
Service chính cho phần còn lại: `realService` (= `api` từ `@/api/index.js`).
Service notification: `notificationsService`.

### 3.1. End-series (nghiệp vụ mới)

| API | Service method | Gọi từ |
|---|---|---|
| `GET /series-end-requests/admin/list` | `seriesEndRequestsService.adminList(params)` | `EndRequests.jsx` |
| `GET /series-end-requests/admin/:id` | `seriesEndRequestsService.adminGetById(id)` | `EndRequests.jsx` |
| `POST /series-end-requests/admin/:id/decide` | `seriesEndRequestsService.adminDecide(id, body)` | `EndRequests.jsx` |

### 3.2. Notification

| API | Service method | Gọi từ |
|---|---|---|
| `GET /admin/notifications/stats` | `notificationsService.adminStats()` | `AdminNotifications.jsx` |
| `GET /admin/notifications/list` | `notificationsService.adminList(params)` | `AdminNotifications.jsx` |
| `GET /admin/notifications/history` | `notificationsService.adminHistory(params)` | `AdminNotifications.jsx` |
| `POST /admin/notifications/mark-all-read` | `notificationsService.adminMarkAllRead()` | `AdminNotifications.jsx` |
| `POST /notifications/:id/read` | `notificationsService.markRead(id)` | `AdminNotifications.jsx` |

### 3.3. Dashboard

| API | Service method | Gọi từ |
|---|---|---|
| `GET /admin/dashboard` | `api.getDashboard()` (= `realService.getDashboard`) | `Dashboard.jsx` |
| `GET /admin/dashboard?activityPage=&activityLimit=` | `api.getRecentActivities(page, limit)` | `Dashboard.jsx` |
| `GET /admin/roles` | `api.getRoles()` | `Dashboard.jsx` |
| `GET /admin/stats/genres` | `api.getGenresStats()` | `Dashboard.jsx` |
| `GET /admin/stats` | `api.getStats()` | `Dashboard.jsx`, `Users.jsx` |
| `GET /admin/rankings/list?type=views&period=weekly&limit=5` | `api.getRankingsList(params)` | `Dashboard.jsx` |

### 3.4. Manga (series)

| API | Service method | Gọi từ |
|---|---|---|
| `GET /admin/manga?includeDeleted=...` | `api.getMangaList(params)` | `Manga.jsx` |
| `DELETE /admin/manga/:id` | `api.deleteManga(id)` | `Manga.jsx` |
| `PATCH /admin/manga/series/:id/publication-status` | `api.updateSeriesPublicationStatus(id, body)` | `Manga.jsx` |

### 3.5. Chapters

| API | Service method | Gọi từ |
|---|---|---|
| `GET /admin/manga/:id` | `api.getMangaById(id)` | `Chapters.jsx` |
| `GET /admin/manga/:id/chapters` | `api.getChaptersByManga(id)` | `Chapters.jsx` |
| `GET /admin/manga/:id/comments` | `api.getCommentsByManga(id)` | `Chapters.jsx` |

### 3.6. Users

| API | Service method | Gọi từ |
|---|---|---|
| `GET /admin/users` | `api.getUsers()` | `Users.jsx` |
| `GET /admin/users/:id` | `api.getUserById(id)` | `Users.jsx` |
| `POST /admin/users-legacy` | `api.createUser(data)` | `Users.jsx` |
| `PATCH /admin/users-legacy/:id` | `api.updateUser(id, data)` | `Users.jsx` |
| `PATCH /admin/users-legacy/:id/role` | `api.changeUserRole(id, role)` | `Users.jsx` |
| `PUT /admin/users/:id/status` | `api.updateUserStatus(id, status)` | `Users.jsx` |
| `DELETE /admin/users-legacy/:id` | `api.deleteUser(id)` | `Users.jsx` |

### 3.7. Publication calendar

| API | Service method | Gọi từ |
|---|---|---|
| `GET /admin/publication-calendar` | `api.getPublicationCalendar(params)` | `PublicationCalendar.jsx` |

### 3.8. EB Representative

| API | Service method | Gọi từ |
|---|---|---|
| `GET /admin/eb-representative/candidates` | `api.getEbCandidates()` | `EbRepresentative.jsx` |
| `PATCH /admin/eb-representative/:userId` | `api.setEbRepresentative(userId)` | `EbRepresentative.jsx` |
| `DELETE /admin/eb-representative` | `api.clearEbRepresentative()` | `EbRepresentative.jsx` |

### 3.9. Profile (admin)

| API | Service method | Gọi từ |
|---|---|---|
| `PUT /admin/profile` | `api.updateProfile(data)` | `Profile.jsx` |

---

## 4. Tóm tắt số lượng

| Role | Số API đang dùng |
|---|---|
| TE | 16 (chính: 13 + phụ: 3 service) |
| EB | 9 (chính: 8 + phụ: 1) |
| Admin | 27 (end-series: 3 + notification: 5 + còn lại: 19) |

---

## 5. Service có method nhưng KHÔNG được page nào dùng

Các service method sau **không xuất hiện** trong code của TE/EB/Admin pages:

- `teReviewsService.getCalendar` — chỉ dùng ở TE ✅
- (Kiểm tra thêm bằng grep nếu cần exhaustive list)
