# Business Rules — EB (Editor Board / 編集ボード)

> Tài liệu mô tả các quy tắc nghiệp vụ cốt lõi của vai trò **EB** trong hệ thống manga-wdp.
> Đối chiếu với mã nguồn thực tế tại:
> - `src/pages/User/Eb/Eb.jsx` (trang chính — hàng chờ + chấm điểm)
> - `src/pages/User/Eb/EbPublish.jsx` (xác nhận lịch phát hành)
> - `src/pages/User/Eb/EbSeriesDetail.jsx` (chi tiết series)
> - `src/pages/User/Eb/EbHistory.jsx`, `EbHistoryDetail.jsx` (lịch sử đánh giá)
> - `src/pages/User/Eb/EbPublicationSchedule.jsx` (lịch phát hành)
> - `src/utils/ebEvaluationMappers.js`, `src/utils/ebCouncilStorage.js` (helper/constants)
> - `src/api/ebEvaluations.service.js`, `ebScores.service.js` (API client)

---

## 1. Vai trò & phạm vi

| Thuộc tính | Giá trị |
|---|---|
| Tên tiếng Nhật | 編集 (へんしゅう) — Editor Board |
| Tên tiếng Việt | Ban Biên tập / Hội đồng Biên tập |
| Ký hiệu vai trò | `EB` (xem `LABEL_EDITOR_BOARD`) |
| Đường dẫn | `/eb`, `/eb/series/:id`, `/eb/chapter/:id`, `/eb/publish/:chapterId`, `/eb/history`, `/eb/schedule` |
| Nhiệm vụ chính | Đánh giá chất lượng chapter do **Mangaka → Tantou** chuyển lên; quyết định xuất bản & lịch phát hành |

EB là **tầng quyết định cuối cùng** trong workflow:
```
Mangaka gửi bản thảo → Tantou review → EB chấm điểm Hội đồng → confirmPublish → Publish
```

---

## 2. Hằng số nghiệp vụ quan trọng

```js
// ebEvaluationMappers.js
EB_SCORE_MAX       = 5      // Điểm tối đa cho mỗi tiêu chí
EB_SCORE_STEP      = 0.5    // Bước nhảy điểm (0, 0.5, 1.0, ..., 5.0)
EB_COUNCIL_SIZE    = 5      // Số thành viên HĐ mặc định (mặc định localStorage)
EB_COUNCIL_MIN_FOR_PUBLISH = 3  // Tối thiểu thành viên HĐ để được mở bước xác nhận lịch phát hành
EB_PUBLISH_TIMEZONE = 'Asia/Ho_Chi_Minh'  // Múi giờ chuẩn cho mọi thao tác publish
```

| Constant | Ý nghĩa | Hậu quả nếu sai |
|----------|----------|------------------|
| `EB_SCORE_STEP = 0.5` | Điểm chỉ nhận bước 0.5 (`validateEbScore` sẽ reject 3.7, 4.2, …) | Form bị disable, không cho submit |
| `EB_COUNCIL_MIN_FOR_PUBLISH = 3` | Cần tối thiểu 3 TV HĐ đã nhập đủ điểm + draft đã lưu mới được `confirm-publish` | Toast lỗi "Bước 1: Lưu nháp đủ tất cả thành viên hội đồng" |
| `EB_PUBLISH_TIMEZONE` | Mọi tính toán `now()`, so sánh quá khứ, format ngày đều theo giờ VN (UTC+7) | Có thể cho phép publish thời điểm đã qua |

---

## 3. Tiêu chí chấm điểm (council scoring criteria)

Hội đồng chấm **5 tiêu chí**, mỗi tiêu chí điểm từ **0 → 5**, bước **0.5**:

| Key (BE) | Label FE | Hint | ShortLabel |
|---|---|---|---|
| `story_dialogue` | Cốt truyện & Lời thoại | Story & Dialogue | Cốt truyện |
| `art_design` | Nét vẽ & Tạo hình nhân vật | Art & Design | Nét vẽ |
| `panel_camera` | Phân khung | Panel | Phân khung |
| `pacing_climax` | Nhịp độ & Cao trào | Pacing & Climax | Nhịp độ |
| `color` | Đổ màu & Phối màu | Color | Màu sắc |

### Legacy key mapping (cho dữ liệu cũ trong localStorage / BE response)
`plotDialogue`, `artDesign`, `panelingCamera`, `pacingHook`, `coloring`, `toneShading`, `story`, `art`, `content_script`, `characters`, `commercial_potential`, `publisher_fit`, `character`, `overall` → map về 1 trong 5 key mới. (`LEGACY_SCORE_KEYS`)

> ⚠️ Mọi payload gửi lên BE phải dùng đúng 5 key mới. Hàm `normalizeMemberScoreMap` sẽ tự động map key cũ → key mới trước khi gửi.

---

## 4. Phân loại series theo điểm TB Hội đồng

Hàm `getClassification(average)` trong `Eb.jsx` — **classification buckets** dựa trên `council_average`:

| Khoảng điểm TB | Label | Class (CSS) | Hành động gợi ý |
|---|---|---|---|
| `null` / `NaN` | **CHƯA CHẤM** | `border-amber-300/80 bg-amber-500/15` | Chưa có đủ điểm để phân loại |
| `< 2.5` | **KHÔNG ĐẠT** | `border-rose-200 bg-rose-50` | Cần chỉnh sửa lớn trước khi xét lại |
| `2.5 → < 3.5` | **ĐẠT** | `border-amber-200 bg-amber-50` | Có thể thông qua, cần cải thiện theo ghi chú |
| `3.5 → < 4.25` | **TỐT** | `border-sky-200 bg-sky-50` | Ổn định, phù hợp duyệt nhanh |
| `≥ 4.25` | **XUẤT SẮC** | `border-emerald-200 bg-emerald-50` | Chất lượng cao, phù hợp đẩy banner |

Label song ngữ EN/JP mapping (`EB_CLASSIFICATION_LABELS`):
- `khong_dat` → `KHÔNG ĐẠT`
- `dat` → `ĐẠT`
- `tot` → `TỐT`
- `xuat_sac` → `XUẤT SẮC`
- `FAIL`/`GOOD`/`EXCELLENT` → alias tương ứng

---

## 5. Quy tắc Hội đồng (Council)

### 5.1. Thành viên

- **Mặc định**: 5 thành viên có sẵn trong `EB_COUNCIL_MEMBERS` (chair + 4 thành viên có title).
- **Thêm mới**: EB đại diện có thể thêm TV HĐ vào roster qua `addCouncilMember(seriesKey, name)`. Tên bị trùng (case-insensitive) → reject (`null`).
- **Mỗi chapter có roster riêng** lưu trong `localStorage[EB_COUNCIL_SCORES_KEY][chapterId].roster`.

### 5.2. Điều kiện publish (bắt buộc)

Để nút **"Xác nhận lịch phát hành"** được enable, **TẤT CẢ** điều kiện sau phải thoả mãn:

1. **Roster** có ít nhất `EB_COUNCIL_MIN_FOR_PUBLISH = 3` thành viên.
2. **Mỗi thành viên trong roster** đã nhập **đầy đủ 5 tiêu chí** với điểm hợp lệ (0 → 5, bước 0.5).
3. **Draft của tất cả thành viên** đã được `saveCouncilMemberAssessment` (lưu nháp vào localStorage).
4. **Đã nộp kết quả** bằng cách gọi `POST /eb-evaluations/chapter/:id/evaluate` (gửi `member_scores[]`).

### 5.3. Validation payload (`validateMemberScoresPayload`)

Khi gửi `evaluateChapter`, FE validate:

| Rule | Lỗi trả về |
|---|---|
| Số row `member_scores` ≥ `min(rosterCount, EB_COUNCIL_MIN_FOR_PUBLISH)` | `"Cần đủ N thành viên Hội đồng trước khi gửi đánh giá."` |
| `member_name` không được rỗng | `"Mỗi thành viên cần có member_name (tên hiển thị)."` |
| `member_name` không được trùng pattern `member-\d+-[a-z0-9]+` | `"<name>: member_name không hợp lệ (đang trùng member_id)."` |
| Mỗi score phải qua `validateEbScore` | `"<name>: <criteria_label> — <reason>"` |

### 5.4. Score validation (`validateEbScore`)

| Input | Kết quả |
|---|---|
| Rỗng / `null` | `"Vui lòng nhập điểm."` |
| Không phải số | `"Điểm phải là số."` |
| `< 0` hoặc `> 5` | `"Điểm phải trong khoảng 0 - 5."` |
| Không bội số 0.5 (vd `3.7`) | `"Điểm chỉ nhận bước 0.5 (ví dụ: 3.5, 4.0, 4.5)."` |
| Hợp lệ | `""` (chuỗi rỗng = pass) |

### 5.5. Trung bình Hội đồng (`council_average`)

- BE tự tính; FE **không gửi** `average` / `total_score`.
- FE dùng `buildCouncilAggregate` để hiển thị realtime từ localStorage:
  - `memberAverage = sum(scores)/scoreFieldCount`
  - `councilAverage = mean(memberAverage)` (chỉ tính các TV đã chấm đủ)
  - `criterionAverages[key] = mean(member.scores[key])` trên các TV đã chấm đủ

---

## 6. Quy trình xác nhận lịch phát hành (`EbPublish.jsx`)

### 6.1. API

`POST /eb-evaluations/series/:seriesId/confirm-publish`

Body (chỉ gửi khi có):
```json
{
  "publication_schedule": "weekly" | "monthly",      // optional
  "scheduled_publish_at": "2026-07-30T09:00:00+07:00"  // ISO 8601, optional
}
```

### 6.2. Điều kiện chặn submit (toast lỗi)

| Điều kiện | Hành động |
|---|---|
| **Không có** `publication_schedule` **và không có** `scheduled_publish_at` | `toast.error("Chọn tần suất phát hành hoặc ngày + giờ phát hành cụ thể.")` → return |
| `scheduled_publish_at` < hiện tại (giờ VN) | Silent return (không toast) |
| `roster < EB_COUNCIL_MIN_FOR_PUBLISH` hoặc có TV chưa chấm đủ | `toast.error("Cần ít nhất 3 thành viên Hội đồng, tất cả nhập đủ điểm và nộp kết quả trước khi xác nhận lịch phát hành.")` → return |

### 6.3. Ngày + giờ phát hành

- FE dùng giờ VN (`EB_PUBLISH_TIMEZONE = 'Asia/Ho_Chi_Minh'`).
- Khi gộp ngày + giờ → convert sang ISO có offset `+07:00` rồi `.toISOString()`.
- BE job quét **mỗi phút** để chuyển series từ `scheduled` → `publishing` khi tới giờ — vì vậy **bắt buộc phải có hour + minute**, không chỉ ngày.
- BE không cho phép `scheduled_publish_at` ở quá khứ (FE cũng check).
- Nếu là **ngày hôm nay (giờ VN)** và giờ đã chọn < giờ hiện tại → silent return.

### 6.4. Tần suất (`publication_schedule`)

| Value | Label |
|---|---|
| `weekly` | Hàng tuần |
| `monthly` | Hàng tháng |

Không bắt buộc — chỉ cần khi không chọn `scheduled_publish_at` cụ thể.

### 6.5. Kết quả trả về

```jsonc
{
  "message": "...",
  "series": { "name": "...", "publication_status": "..." },
  "council_average": 4.3   // optional
}
```

→ `navigate('/eb')` và toast hiển thị thời điểm dự kiến (nếu có) hoặc `council_average`.

---

## 7. Phân biệt chapter-pending vs series-pending

API `/eb-evaluations/pending` có thể trả **2 shape**:

### Shape 1 — Series pending (mặc định)
```jsonc
{
  "_id": "seriesId",
  "name": "Series name",
  "author_id": { ... },
  "first_pending_chapter": { "_id": "ch1", "chapter_number": 1, "title": "..." },
  "cover_image_url": "...",
  "council_average": null,
  "evaluation_id": null,
  "evaluation_locked": false
}
```

### Shape 2 — Chapter pending (legacy)
```jsonc
{
  "_id": "evaluationId",
  "chapter": { "_id": "ch1", "chapter_number": 1, "title": "..." },
  "series": { "_id": "seriesId", "name": "..." },
  "council_average": null,
  "submitted_by": { ... },
  "preview_images": [...]
}
```

Hàm `isSeriesPendingShape(item)` phân biệt bằng:
- Có `first_pending_chapter` → series shape
- Có `name + author_id` mà **không** `chapter_number/chapter_id` → series shape
- Còn lại → chapter shape

→ Tương ứng route sang `mapEbSeriesPendingItem` hoặc `mapEbChapterPendingItem`.

---

## 8. Hàng chờ duyệt (`Eb.jsx`)

### 8.1. Các nguồn dữ liệu

| API | Endpoint | Vai trò |
|---|---|---|
| `getChapterPending` | `GET /eb-evaluations/pending` (fallback `/chapter-pending`) | Lấy danh sách chapter chờ EB |
| `getChapterPreview` | `GET /eb-scores/chapter/:id/preview` | Lấy pages preview + chapter info |
| `getSeriesDetail` | `GET /eb-evaluations/series/:seriesId/detail` | Lấy series + first_chapter + pending_chapters |
| `getChapterDetail` | (compose preview + seriesDetail) | Wrapper build context chấm |

> **BE không có `GET /eb-evaluations/chapter/:id`** — FE phải compose từ 2 API trên (`buildEbChapterDetailPayload`).

### 8.2. Sắp xếp & phân nhóm

- Pending list được **group theo Mangaka** (key = `mangakaUserId` nếu có, fallback `mangakaName.toLowerCase()`).
- Mỗi Mangaka hiển thị **EbMangakaSelectCard** — click vào để mở danh sách chapter của Mangaka đó.
- Avatar Mangaka được **hydrate** qua `mangakaProfileService.getPublicProfile(id)` — lỗi thì giữ fallback initials.

### 8.3. Trạng thái chapter

Các status được BE trả về (xem `mapEbChapterPendingItem`):

| Status | Ý nghĩa |
|---|---|
| `pending_EB` | Chờ EB chấm (mặc định) |
| `published` | Đã publish (chỉ hiển thị lịch sử) |
| `rejected` | Bị từ chối |
| `revision` | Yêu cầu chỉnh sửa |

Chapter đã chấm (`councilAverage != null` hoặc đủ member_scores) **bị ẩn** khỏi hàng chờ (`isEbChapterFullyScored`).

---

## 9. Lịch sử đánh giá (`EbHistory.jsx` + `EbHistoryDetail.jsx`)

### 9.1. Filter

| Filter | Query param | Ý nghĩa |
|---|---|---|
| Scope | `scope` | `series` / `chapter` / `all` |
| Result | `result` | `approved` / `rejected` / `revision` |
| Status | `status` | `scoring` / `saved` / `locked` |
| Series | `series_id` | Lọc theo series cụ thể |
| Search | `q` | Tìm theo tên series |
| Pagination | `page`, `limit` | Default 1, 20 |

### 9.2. Result label mapping

| API value | Label |
|---|---|
| `approved` | Đã duyệt |
| `revision` | Yêu cầu chỉnh |
| `rejected` | Từ chối |
| khác | nguyên giá trị |

### 9.3. Status label mapping

| API value | Label |
|---|---|
| `scoring` | Đang chấm |
| `saved` | Đã lưu |
| `locked` | Đã khóa |
| khác | nguyên giá trị |

### 9.4. History detail

`GET /eb-evaluations/:evaluationId/history-detail` trả về:

- `evaluation`: thông tin evaluation
- `member_scores[]`: chi tiết điểm từng TV (FE tự tính lại average nếu BE trả average = 0)
- `council_breakdown`: DTB theo từng tiêu chí
- `related_evaluations[]`: các evaluation khác cùng series/chapter
- `classification` + `classification_text`
- `scheduled_publish_at` (nếu có)
- `evaluated_by`, `last_saved_by`, `last_saved_at`

> Quy tắc hiển thị tên TV: Nếu `member_name` khớp pattern `member-\d+-[a-z0-9]+` (auto-gen ID) thì fallback sang `full_name` → `fullName` → `username` → cuối cùng là `"Thành viên HĐ"`.

---

## 10. Lịch phát hành (`EbPublicationSchedule.jsx`)

### 10.1. API

`GET /eb-evaluations/publication-schedule?from=YYYY-MM-DD&to=YYYY-MM-DD&publication_schedule=&view=&include_overdue=`

### 10.2. Default range

```js
from = today - 30 days
to   = today + 90 days
```

(so với `getEbDefaultPublicationScheduleRange`)

### 10.3. View modes

| View | Ý nghĩa |
|---|---|
| `calendar` (mặc định) | Grid ngày với events |
| `list` | Danh sách group theo series |

### 10.4. Event types

- `series`: sự kiện cả series (publish/release định kỳ) → link `/eb/series/:id`
- `chapter`: chapter cụ thể → link `/eb/chapter/:chapterId`

Cờ `isOverdue` được set khi `scheduled_publish_at` < now (FE hiển thị warning).

---

## 11. Quy tắc `member_name` (BE yêu cầu)

Khi gửi `evaluateChapter`, mỗi row `member_scores` **BẮT BUỘC** phải có:

```js
{
  member_id: "chair" | "member-1" | "..." | "<custom-id>",   // ID trong roster
  member_name: "PGS.TS. Trần Minh Khoa",  // Tên hiển thị — REQUIRED
  scores: {
    story_dialogue: 4.5,
    art_design: 4.0,
    panel_camera: 4.0,
    pacing_climax: 4.5,
    color: 4.0
  }
}
```

**Lưu ý quan trọng**:
- `member_name` KHÔNG ĐƯỢC trùng pattern `member-\d+-[a-z0-9]+` (đó là ID, không phải tên).
- Nếu roster có TV tên `"member-123-abc"`, FE phải fallback về `full_name`/`username`.
- Tên được lấy từ `EB_COUNCIL_MEMBERS` (default) hoặc `addCouncilMember(seriesKey, name)` (custom).

---

## 12. Đại diện EB (`Admin/EbRepresentative`)

### Quy tắc

- Hệ thống cho phép **CHỈ 1 user duy nhất** có role EB được chỉ định làm `is_eb_representative`.
- Đại diện là user **được phép nhập điểm cho tất cả TV HĐ** (vì họ thay mặt cả HĐ chấm).
- API:
  - `GET /admin/eb-candidates` — danh sách user role EB
  - `POST /admin/eb-representative/:userId` — chỉ định
  - `DELETE /admin/eb-representative` — bỏ chỉ định
- Chapter **KHÔNG có đại diện** thì:
  - Roster mặc định (`EB_COUNCIL_MEMBERS`) vẫn được dùng
  - Nhưng **không thể lưu điểm hội đồng** lên BE (vì không ai có quyền)
- Cờ `enteredBy` trong draft = **id của đại diện EB** đã nhập (audit trail).

---

## 13. Timezone & Date handling

| Tình huống | Quy tắc |
|---|---|
| Hiển thị ngày UI | `vi-VN` locale, timezone `Asia/Ho_Chi_Minh` |
| Lưu `scheduled_publish_at` lên BE | ISO 8601 với offset `+07:00` → `.toISOString()` (UTC) |
| So sánh "đã qua" | So sánh giờ VN hiện tại với giờ đã chọn |
| Format `Intl.DateTimeFormat` | Dùng `en-CA` cho `YYYY-MM-DD`, `en-GB` cho `HH:mm` |
| Date input | `<input type="date">` chỉ trả `YYYY-MM-DD` — FE tự gộp với giờ |

---

## 14. API endpoints tổng hợp

| Method | Endpoint | Mục đích |
|---|---|---|
| `GET` | `/eb-evaluations/pending` | Hàng chờ (fallback `/chapter-pending`) |
| `GET` | `/eb-evaluations/series/:id/detail` | Chi tiết series + first_chapter.pages + pending_chapters |
| `POST` | `/eb-evaluations/chapter/:id/evaluate` | Nộp điểm HĐ cho chapter |
| `POST` | `/eb-evaluations/series/:id/confirm-publish` | Xác nhận lịch phát hành |
| `GET` | `/eb-evaluations/publication-schedule` | Lịch phát hành (calendar/list) |
| `GET` | `/eb-evaluations/history` | Lịch sử đánh giá |
| `GET` | `/eb-evaluations/:id/history-detail` | Chi tiết 1 evaluation |
| `GET` | `/eb-scores/chapter/:id/preview` | Preview pages + chapter info |
| `GET` | `/admin/eb-candidates` | List EB users (chỉ Admin) |
| `POST` | `/admin/eb-representative/:userId` | Chỉ định đại diện |
| `DELETE` | `/admin/eb-representative` | Bỏ chỉ định đại diện |

---

## 15. Edge cases & Quy tắc phụ

| Tình huống | Xử lý |
|---|---|
| API `/eb-evaluations/chapter/:id` trả 404 | FE fallback compose từ `/eb-scores/chapter/:id/preview` + `/eb-evaluations/series/:seriesId/detail` |
| Series có `first_chapter.pages` không có | `EbSeriesDetail.jsx` dùng `placeholderPageDataUrl` |
| `scheduled_publish_at` chỉ có ngày | FE append `T09:00:00+07:00` mặc định |
| Nhiều member_scores bị trùng ID | BE reject, FE filter unique |
| Council member `member_name` rỗng | Loại bỏ khỏi payload (`memberEntryToApiRow` trả `null`) |
| User chưa đăng nhập | `getSession()` → `null` → không hiển thị nút logout, vẫn cho xem |
| Council roster chỉ có 2 TV | Nút "Xác nhận lịch phát hành" bị disable, hiện "Bước 1: Lưu nháp đủ tất cả TV hội đồng" |
| Chapter thuộc series có `isOverdue` | Hiển thị badge warning đỏ trên lịch phát hành |
| Member_name auto-generated (`member-123-abc`) | Validation FE reject + history detail fallback sang `full_name` |
| `council_average` = 0 từ BE | History detail tự tính lại từ `scores[]` |

---

## 16. Workflow tổng thể (end-to-end)

```
┌─────────────────────────────────────────────────────────────────┐
│  1. Mangaka submit chapter  →  status: pending_EB               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  2. EB mở /eb → thấy chapter trong hàng chờ                      │
│     - Group theo Mangaka (EbMangakaSelectCard)                    │
│     - Click vào card → mở danh sách chapter của Mangaka đó       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  3. Click vào chapter → /eb/chapter/:id                           │
│     - Load preview pages + series context (compose 2 API)         │
│     - Hiển thị council roster (mặc định 5 TV từ localStorage)    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  4. EB đại diện nhập điểm cho từng TV HĐ                         │
│     - Per-member: 5 tiêu chí × 0-5 (bước 0.5) + ghi chú          │
│     - Auto-save vào localStorage (mk-eb-council-scores-v2)        │
│     - Validate realtime qua validateEbScore                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  5. Submit điểm → POST /eb-evaluations/chapter/:id/evaluate       │
│     - Validate: ≥3 TV đã nhập đủ điểm, member_name hợp lệ        │
│     - BE tính council_average + classification                   │
│     - Response trả về classification + council_average           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  6. Click "Xác nhận lịch phát hành" → /eb/publish/:chapterId      │
│     - Chọn publication_schedule (weekly/monthly)                  │
│     - HOẶC chọn scheduled_publish_at (date + time picker)         │
│     - Validate: scheduled ≥ now (giờ VN)                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  7. POST /eb-evaluations/series/:id/confirm-publish                │
│     - Series chuyển status: scheduled → publishing (BE job)        │
│     - Hiển thị trên /eb/schedule                                  │
│     - Toast thông báo + navigate về /eb                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  8. Xem lịch sử: /eb/history (filter + search + pagination)       │
│     - Click vào evaluation → /eb/history/:id (chi tiết)          │
│       • Xem điểm từng TV + council_breakdown + related           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 17. Glossary (Thuật ngữ)

| Thuật ngữ | Nghĩa |
|---|---|
| **EB** | Editor Board — Ban biên tập (編集) |
| **Tantou** | Người chịu trách nhiệm (担当者) — review trước khi gửi EB |
| **Mangaka** | Tác giả truyện (漫画家) — người submit chapter |
| **Council / HĐ** | Hội đồng biên tập chấm điểm (gồm nhiều TV) |
| **Roster** | Danh sách thành viên HĐ của 1 chapter cụ thể |
| **Council Average** | Điểm TB của cả HĐ = mean(điểm TB các TV đã chấm) |
| **Classification** | Phân loại series theo điểm TB (KHÔNG ĐẠT / ĐẠT / TỐT / XUẤT SẮC) |
| **Member Scores** | Mảng điểm từng TV trong HĐ |
| **Pending** | Trạng thái chờ xử lý |
| **Scheduled publish** | Lịch phát hành đã lên kế hoạch (BE job quét mỗi phút) |
| **Overdue** | Lịch phát hành đã qua thời điểm dự kiến |
| **Representative** | 1 user EB duy nhất được Admin chỉ định (lưu điểm HĐ) |

---

## 18. Liên hệ với Workflow tổng thể

Xem thêm:
- `docs/WORKFLOW-SPEC.md` (nếu có) — workflow chi tiết giữa Mangaka → Tantou → EB
- `docs/TE-ASSIGNMENT-BE-SPEC.md` (nếu có) — spec API BE cho TE/EB
- `docs/system-architecture.html` — sơ đồ kiến trúc hệ thống

---

*Cập nhật lần cuối: 2026-07-26 — Dựa trên source code hiện tại tại branch `main`.*