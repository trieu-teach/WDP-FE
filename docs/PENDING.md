# TODO — Chức năng còn thiếu / chưa hoàn thiện

Tổng hợp các chức năng UI, tích hợp API, hay cải tiến còn **dang dở** trong workspace Mangaka & Assistant. Mục đích: tra cứu nhanh khi quay lại làm tiếp.

> Cập nhật lần cuối: 14/06/2026 (sau khi đối chiếu `swagger-init.js` ↔ `Mangaka.jsx` ↔ `Assistant.jsx`).

---

## A. Notifications — chưa nối

| # | Chỗ | API cần gọi | Ghi chú |
|---|-----|-------------|---------|
| A1 | Header **Mangaka** workspace | `GET /notifications` + `GET /notifications/unread-count` (nếu có) | Hiện header chưa có chuông; số badge sẽ lấy từ unread count. |
| A2 | Header **Assistant** workspace | `GET /notifications` | Như trên, cần thêm chuông + dropdown danh sách. |
| A3 | Click 1 thông báo | `PATCH /notifications/{id}/read` | Đánh dấu đã đọc. |
| A4 | "Đọc tất cả" | `PATCH /notifications/read-all` | Reset badge về 0. |

Swagger: `/notifications`, `/notifications/{id}/read`, `/notifications/read-all`, `/notifications/{id}` (DELETE).

---

## B. EB Council — đang dùng local, cần nối API

| # | Chỗ | API cần gọi | Ghi chú |
|---|-----|-------------|---------|
| B1 | Lưu "EB đã duyệt debut" của series | `POST /eb-evaluations/series/{seriesId}/decision` | Hiện dùng `ebCouncilStorage.js` (localStorage). Cần thay bằng API. |
| B2 | Hiển thị "EB đánh giá" trên Series card | `GET /eb-evaluations/series/{seriesId}` | Hiện đang đọc từ local — số `ebAssessment.average` / `classification` sẽ trả từ backend. |
| B3 | Tab "Chờ EB" từ phía Mangaka | `GET /eb-evaluations/pending` | Lọc series đang chờ EB chấm. |

---

## C. Upload layer từ Assistant — lưu local, chưa có endpoint

| # | Chỗ | Vấn đề | Đề xuất |
|---|-----|--------|---------|
| C1 | `assistantLayerBlobs.js` (IndexedDB) | Layer PNG/WebP tải lên chỉ lưu trong browser của Assistant. | Cần API `POST /uploads/layer` để Mangaka xem được. Hiện chưa có trong swagger. |
| C2 | `handleSubmitChapterToMangaka` | Đang composite layer local → `dataURL` → `POST /tasks/{id}/submit`. | Nếu backend cần URL ảnh upload sẵn, phải tách thành 2 bước. Cần xác nhận với backend. |

---

## D. Mangaka UI — thiếu / chưa đẹp

| # | Vị trí | Vấn đề | Ghi chú |
|---|--------|--------|---------|
| D1 | Bảng `chapterRows` | Status đang hard-code (`draft`/`assistant`/`review`/`tantou`/`done`). Khi backend đổi status chuẩn cần map lại. | Hiện đang dùng enum UI, chưa đối chiếu với `chapter.status` từ API. |
| D2 | Sidebar phải — "Bản tổng hợp từ Assistant" | `pendingPageResults` chỉ lấy `task.resultImageUrl` từ 1 chapter. Chưa có thumbnail gallery cho nhiều task. | UI hiện flatten theo `pageId` — mất task context. |
| D3 | Tab `annotate` — panel ghi chú | Chưa có badge tổng số ghi chú chưa gửi cho Assistant (đếm realtime). | Có thể thêm `Badge` cạnh tiêu đề panel. |
| D4 | "Bắt đầu ghi chú" quick action | Mở tab `annotate` cho series đầu tiên, không tự chọn chapter cụ thể. | Có thể gợi ý chapter mới nhất. |

---

## E. Assistant UI — thiếu / chưa đẹp

| # | Vị trí | Vấn đề | Ghi chú |
|---|--------|--------|---------|
| E1 | Card "Thu nhập tháng này" | Đang dùng `taskStats?.earningsThisMonth` — cần xác nhận backend `GET /tasks/stats` trả field này. | Nếu backend không trả, hiển thị fallback "—". |
| E2 | Stats card "Việc được giao" | Đang đếm `allTasks.length`, nhưng `allTasks` chỉ load 100 item (`limit: 100`). Số có thể lệch khi Assistant có nhiều việc. | Cần thêm `pagination.total` vào UI. |
| E3 | Layer list — chưa có ảnh preview từ server | Layer lưu IndexedDB local → reload tab mất. | Phụ thuộc C1. |
| E4 | "Mangaka đang hợp tác" badges | Card chỉ hiện tên, không click được để xem series nào đang hợp tác. | Có thể thêm dropdown series + tab mở Annotate của Mangaka. |
| E5 | Trang tổng hợp chapter | Chưa có preview composite từ tất cả layer trước khi bấm "Nộp". | Cần component render canvas tổng hợp. |

---

## F. Notes & tasks — edge case chưa xử lý

| # | Vấn đề | Mô tả |
|---|--------|-------|
| F1 | Note `text` rỗng | Note không có mô tả vẫn lưu; backend có thể reject (cần test). |
| F2 | Drag vùng ghi chú quá nhỏ | `if (w < 2 || h < 2) return` — không có tooltip báo lý do cho user. |
| F3 | Reassign Assistant | Hiện tự gỡ + gán lại khi chọn khác. Cần confirm dialog hỏi user. |
| F4 | Race condition debounce | 2 thay đổi liên tiếp trong 600ms có thể ghi đè nhau. Cần queue tuần tự trong `savePageNote`. |

---

## G. Backend cần bổ sung (chưa có swagger)

| # | Endpoint dự kiến | Dùng cho |
|---|------------------|----------|
| G1 | `POST /uploads/layer` (multipart) | Assistant upload layer PNG/WebP lên server (xem C1). |
| G2 | `GET /uploads/layer/{key}` (hoặc CDN URL) | Mangaka tải layer của Assistant. |
| G3 | `GET /notifications/unread-count` | Badge header (A1, A2). |
| G4 | `POST /chapters/{id}/reassign` (hoặc xác nhận `DELETE assign` + `POST assign` là đủ) | Hợp nhất reassign trong 1 call (F3). |
| G5 | `PATCH /tasks/{id}/revision` — thêm field `note` (đã có body `{note}`) | Xác nhận backend đọc field `note`. |
| G6 | `GET /series/{id}` — xác nhận trả `cover_image` (full URL hay path) | Mangaka detail page chưa có. |

---

## H. Quick wins — sửa trong ngày nếu cần

| # | Việc | File |
|---|------|------|
| H1 | Thêm nút chuông + badge ở Header cho cả 2 workspace (A1, A2) | `src/components/User/Header/Header.jsx` |
| H2 | Gọi `GET /eb-evaluations/series/{id}` cho Series card (B2) | `src/pages/User/Mangaka/Mangaka.jsx` |
| H3 | Đếm tổng ghi chú chưa gửi (D3) | `src/pages/User/Mangaka/ChapterAnnotator.jsx` |
| H4 | Xác nhận `earningsThisMonth` từ `GET /tasks/stats` (E1) | test thủ công |
