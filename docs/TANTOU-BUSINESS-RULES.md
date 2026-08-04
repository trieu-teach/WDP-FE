# Business Rules — Tantou (担当者 - Editor phụ trách)

> Tài liệu mô tả các quy tắc nghiệp vụ cốt lõi của vai trò **Tantou** trong hệ thống manga-wdp.
> Đối chiếu với mã nguồn thực tế tại:
> - `src/pages/User/Tantou/TantouHub.jsx` (trang hub - entry point)
> - `src/pages/User/Tantou/TantouEditor.jsx` (workspace chính với 4 sections)
> - `src/pages/User/Tantou/TantouPageReview.jsx` (entry review dashboard)
> - `src/constants/tantouSections.js` (config các section)
> - `src/utils/teReviewPhase.js`, `teReviewPending.js`, `teReviewHistoryMappers.js` (helpers)
> - `src/utils/tantouWorkspaceStorage.js` (localStorage Tantou ↔ EB ↔ Mangaka)
> - `src/api/teReviews.service.js` (API client)

---

## 1. Vai trò & phạm vi

| Thuộc tính | Giá trị |
|---|---|
| Tên tiếng Nhật | 担当者 — Tantou (Người chịu trách nhiệm / Editor phụ trách) |
| Tên tiếng Việt | Phụ trách / Biên tập viên |
| Ký hiệu vai trò | `TE` / `TANTOU_EDITOR` |
| Đường dẫn | `/tantou`, `/tantou/:sectionId` |
| Nhiệm vụ chính | Tiếp nhận bản thảo từ **Mangaka**, viết nhận xét + annotation, **chuyển EB** (giai đoạn 1) hoặc **tự duyệt + phát hành** (giai đoạn 2) |

Tantou đóng vai trò **"cầu nối"** trong workflow:
```
Mangaka → [submit] → Tantou → {GĐ1: Tantou gửi EB → EB chấm} | {GĐ2: Tantou duyệt → publish}
```

---

## 2. Hai giai đoạn (Phase)

Hệ thống TE/EB phân biệt **2 giai đoạn** xử lý series. Quy tắc này là **cốt lõi** — quyết định flow API nào được gọi.

### 2.1. Giai đoạn 1 — Duyệt series (series_level / debut)

| Đặc điểm | Giá trị |
|---|---|
| Phase | `series_level` (BE) / `debut` (legacy FE) |
| Series status | `draft`, `submitted`, `rejected`, `cancelled` |
| **Ai duyệt** | Tantou gửi nhận xét → **EB** chấm điểm HĐ → EB confirm publish |
| Section hiển thị | `series-pending` (Tantou) |
| API dùng | `POST /te-reviews/series-review/:seriesId/review-chapter` |
| Tham chiếu | `resolveTePhase()` trong `teReviewPhase.js` |

### 2.2. Giai đoạn 2 — Duyệt chapter (chapter_level / recurring)

| Đặc điểm | Giá trị |
|---|---|
| Phase | `chapter_level` (BE) / `recurring` (legacy FE) |
| Series status | `approved_by_eb`, `approved`, `published` |
| **Ai duyệt** | **Chỉ Tantou** duyệt → publish (EB không tham gia) |
| Section hiển thị | `series-approved` (Tantou) |
| API dùng | `POST /te-reviews/chapter/:chapterId/te-action` + `POST .../publish` |

### 2.3. Quy tắc xác định phase (`resolveTePhase`)

```js
function resolveTePhase({ phase, seriesStatus } = {}) {
  // Ưu tiên field `phase` từ BE nếu có
  if (phase === 'series_level' || phase === 'chapter_level') return phase

  // Suy từ series status
  if (SERIES_LEVEL_STATUSES.includes(seriesStatus))   return 'series_level'
  if (CHAPTER_LEVEL_STATUSES.includes(seriesStatus))  return 'chapter_level'

  // Mặc định an toàn: series_level (chưa EB-approved)
  return 'series_level'
}
```

→ Legacy alias: `debut = series_level`, `recurring = chapter_level` (`phaseToPipeline`).

---

## 3. 5 Sections làm việc

Từ `src/constants/tantouSections.js`, Tantou có **5 khu vực** làm việc (4 chính + 1 calendar):

| ID | Path | Mô tả | Icon |
|---|---|---|---|
| `series-pending` | `/tantou/series-pending` | Duyệt series chưa EB-approved, gom theo Mangaka | Sparkles |
| `series-approved` | `/tantou/series-approved` | Series đã EB-approved — duyệt từng chapter để publish | FileText |
| `publication-status` | `/tantou/publication-status` | Cập nhật đang phát hành / tạm ngưng / hoàn thành / dropped | BookOpen |
| `history` | `/tantou/history` | Lịch sử duyệt | History |
| `schedule` | `/tantou/schedule` | Lịch phát hành | Calendar |

**Quy tắc routing**:
- Path không hợp lệ → `<Navigate to="/tantou" replace />`
- Khi mở review → render `TantouPageReview` (full-page) thay vì dashboard
- Section có 2 flag tải dữ liệu:
  - `needsQueue` = `series-pending` | `series-approved`
  - `needsPublication` = `publication-status`

---

## 4. Hằng số & ánh xạ trạng thái

### 4.1. Phase UI status (đồng bộ với EB)

Mapping từ BE status → UI status (`resolveTeUiChapterStatus`):

| API status | UI status | Badge color |
|---|---|---|
| `published` / `approved_publish` | `approved_publish` | green (emerald) |
| `approved_by_eb` + có `scheduled_publish_at` | `scheduled` | sky blue |
| `approved_by_eb` (chưa lịch) | `awaiting_publish` | violet |
| `pending_eb` / `forwarded_eb` | `forwarded_eb` | emerald |
| `pending` (chưa gửi) | `pending` | amber |
| `revision` / `rejected` | `revision` | rose |

Hằng số export:
- `TE_CHAPTER_APPROVED_STATUS = 'approved_by_EB'`
- `TE_UI_AWAITING_PUBLISH = 'awaiting_publish'`
- `TE_UI_SCHEDULED = 'scheduled'`

### 4.2. Status label mapping (`statusLabel` trong TantouEditor)

| UI status | Label tiếng Việt |
|---|---|
| `pending` | Chờ duyệt |
| `revision` | Đã gửi chỉnh |
| `forwarded_eb` | Đã chuyển Editor Board |
| `awaiting_publish` | Chờ phát hành |
| `scheduled` | Đã lên lịch |
| `approved_publish` | Đã phát hành |

### 4.3. Assignment status (`teAssignmentStatus`)

| Status | Ý nghĩa | Badge |
|---|---|---|
| `unassigned` | Chưa gán TE — auto-claim khi approve | sky blue |
| `mine` | Đang review của TE hiện tại | violet |
| `other` | Đã gán TE khác → 403 khi review | rose |

### 4.4. Publication status (5 trạng thái)

Từ `SERIES_PUBLICATION_STATUSES`:

| Value | Label | Badge class |
|---|---|---|
| `upcoming` | Chuẩn bị phát hành | slate |
| `ongoing` | Đang phát hành | green |
| `hiatus` | Tạm ngưng | amber |
| `completed` | Hoàn thành | blue |
| `dropped` | Bị drop | red |

### 4.5. Publication transitions (TE được phép)

| From | Allowed next |
|---|---|
| `ongoing` | `hiatus`, `completed`, `dropped` |
| `hiatus` | `ongoing` |
| `dropped` | `ongoing` |
| `completed` | 🚫 **read-only** (block mọi thay đổi) |
| `upcoming` | 🚫 **auto bởi job** (TE không được sửa) |

```js
TE_PUBLICATION_TRANSITIONS = {
  ongoing: ['hiatus', 'completed', 'dropped'],
  hiatus: ['ongoing'],
  dropped: ['ongoing'],
  // completed: undefined (read-only)
  // upcoming: undefined (auto by job)
}
```

---

## 5. Quy tắc phân công TE (auto-claim)

### 5.1. Logic `canTeUserReviewChapter`

| `chapter.te_id` | TE hiện tại | Được review? |
|---|---|---|
| `null` / rỗng | bất kỳ | ✅ Có (BE sẽ auto-claim) |
| = TE hiện tại | TE hiện tại | ✅ Có |
| = TE khác | TE khác | ❌ Không (BE trả 403) |

### 5.2. Auto-claim behavior

- Khi TE bấm **Phê duyệt** một chapter có `te_id = null`, BE sẽ tự động gán chapter đó cho TE hiện tại.
- FE không chặn hành động này — chỉ hiển thị label `"Chưa ai nhận"` và hướng dẫn.
- Sau khi approve thành công: chapter chuyển sang `awaiting_publish`, `teAssignmentStatus = 'mine'`.

### 5.3. Block review

Nếu `canReview === false`:
- Nút **"Mở & nhận xét"** bị disable (opacity 75%).
- Nếu vẫn click → `toast.error("Chapter này đã được gán cho TE khác.")`.
- Lưu nháp thì **không bị chặn** (chỉ chặn khi submit action).

---

## 6. Annotation system

### 6.1. Annotation là gì?

- Mỗi note Tantou viết gắn với **một page cụ thể** + **tọa độ vùng (region)** + **error_type**.
- Lưu trên BE qua `POST /te-reviews/chapter/:chapterId/annotations`.

### 6.2. Cấu trúc payload

```js
{
  page_id: String,
  region: {
    x: Number,        // 0-100 (% trang)
    y: Number,
    width: Number,
    height: Number,
  },
  content: String,    // Nội dung note
  error_type: 'dialogue' | 'script' | 'art' | 'content' | 'other',
}
```

### 6.3. Mapping error_type (`mapTaskTypeToErrorType`)

| taskType (FE) | error_type (BE) |
|---|---|
| có chứa "dialog" | `dialogue` |
| có chứa "script" | `script` |
| có chứa "art" | `art` |
| có chứa "content" | `content` |
| còn lại | `other` |

### 6.4. Đồng bộ annotation (`syncChapterAnnotations`)

Trước mỗi lần submit review:
1. **GET** danh sách annotations hiện tại của chapter
2. **DELETE** từng annotation cũ
3. **CREATE** lại annotation mới từ `editorialNotesByPage` user vừa nhập

→ Tránh tình trạng annotation cũ "treo" lại sau khi user chỉnh sửa.

### 6.5. Rules

- `content` rỗng → fallback `'No detail'`.
- Thiếu `page_id` → bỏ qua note đó (`buildTeAnnotationCreatePayload` trả `null`).
- Không có pages nào → `toast.error("Thiếu danh sách page để lưu annotation.")`.

### 6.6. CRUD operations

| Method | Endpoint | Mục đích |
|---|---|---|
| `GET` | `/te-reviews/chapter/:id/annotations` | List (filter `?page_id=`) |
| `POST` | `/te-reviews/chapter/:id/annotations` | Tạo mới |
| `PATCH` | `/te-reviews/chapter/:id/annotations/:id` | Cập nhật |
| `DELETE` | `/te-reviews/chapter/:id/annotations/:id` | Xóa |

---

## 7. Workflow submit review (`handleSaveReview`)

### 7.1. 3 nhánh hành động

```
                    handleSaveReview(reviewData, options)
                                  │
              ┌───────────────────┼───────────────────┐
              ▼                   ▼                   ▼
      options.saveDraftOnly    nextStatus ===     nextStatus ===     nextStatus ===     nextStatus ===
                              "publish"           "reject"           "release"          (khác)
              │                   │                   │                   │
              ▼                   ▼                   ▼                   ▼
        saveSeriesReviewDraft  (decide series      (decide series      publishChapter
        (lưu nháp series)      level vs chapter    level vs chapter   (POST .../publish)
                              level → te-action    level → te-action
                              hoặc review-chapter) hoặc review-chapter)
```

### 7.2. Nhánh 1 — Lưu nháp (saveDraftOnly)

**Áp dụng**: Cấp series (chưa EB-approved).

| Bước | Hành động |
|---|---|
| 1 | Validate `nextSeriesId` (bắt buộc) |
| 2 | `POST /te-reviews/series-review/:seriesId` với `{ feedback, quick_notes }` |
| 3 | Toast `"Đã lưu nháp đánh giá series."` |

⚠️ Lưu nháp **chỉ validate `canReview`** vì là bản nháp — chapter đã gán TE khác vẫn cho lưu local.

### 7.3. Nhánh 2 — Phát hành (release / publishOnly)

**Áp dụng**: Chapter đã ở trạng thái `approved_by_EB`.

| Bước | Hành động |
|---|---|
| 1 | Đồng bộ annotation (xóa cũ + tạo mới) |
| 2 | `POST /te-reviews/chapter/:id/publish` |
|   | • Chapter đầu series: gửi `{ scheduled_publish_at }` |
|   | • Chapter 2+: body rỗng (BE job theo cadence) |
| 3 | Toast thành công theo `formatTePublishSuccessMessage` |
| 4 | Nếu buffer chưa đủ → toast warning `formatTePublishBufferWarning` (Policy B) |
| 5 | Update state local: chapter → `awaiting_publish` / `scheduled` / `published` |
| 6 | Push history local qua `pushTantouReviewHistory` |

**Quy tắc publish**:

| Tình huống | Chapter đầu series | Chapter 2+ |
|---|---|---|
| **BE required** | `scheduled_publish_at` bắt buộc | BE auto theo cadence series |
| **FE required** | Phải chọn ngày + giờ | Không bắt buộc |
| **Trước hiện tại** | Toast lỗi 400 | Toast lỗi 400 |
| **Buffer < 2 chapter approved** | OK (chapter đầu miễn) | Schedule OK, BE job tạm giữ (Policy B) |

### 7.4. Nhánh 3 — Approve / Reject (publish / reject)

**Áp dụng**: Cho cả 2 phase.

**Quyết định series-level hay chapter-level**:

```js
const seriesLevel = submissionIsSeriesLevel(selected)
```

**Nếu `!seriesLevel`** (chapter_level → giai đoạn 2):
- **Approve** (`action: 'approve'`):
  - `POST /te-reviews/chapter/:id/te-action`
  - **Đồng thời** lưu draft series (best-effort) nếu có `feedback`/`quickNotes`
  - Update state: `awaiting_publish`, `teAssignmentStatus = 'mine'`
  - Toast: `"Đã phê duyệt ... Bấm Phát hành để lên lịch xuất bản."`
  - **Giữ workspace mở** để TE tiếp tục bấm Phát hành
- **Reject** (`action: 'reject'`):
  - `POST /te-reviews/chapter/:id/te-action`
  - Push history, toast `"Đã yêu cầu Mangaka sửa chapter."`
  - Đóng review + reload queue

**Nếu `seriesLevel`** (series_level → giai đoạn 1):
- Validate `nextSeriesId` (bắt buộc)
- Nếu có `feedback`/`quickNotes` + approve → `saveSeriesReviewDraft` (best-effort)
- `POST /te-reviews/series-review/:seriesId/review-chapter` với:
  ```js
  {
    chapter_id,
    action: 'approve' | 'reject',
    feedback?,              // nhận xét chung
    notes?: string[],       // gom từ feedback + revision_notes → split by \n
    revision_notes?,         // chỉ khi reject — lý do cụ thể để Mangaka sửa
  }
  ```
- Toast `"Đã phê duyệt và gửi EB ..."` hoặc `"Đã yêu cầu Mangaka sửa chapter."`

### 7.5. Chuẩn hóa action gửi lên BE

| TE UI action | BE action |
|---|---|
| `publish` | `approve` |
| `reject` | `reject` |
| `release` / `publishOnly` | (gọi riêng `/publish`, không phải te-action) |

### 7.6. Validation chung

| Rule | Lỗi |
|---|---|
| `options.saveDraftOnly = false` mà `selected.canReview === false` | `"Chapter này đã được gán cho TE khác."` |
| `nextStatus === 'reject'` mà cả `feedback` và `revisionFeedback` rỗng | `"Nhập lý do trước khi gửi Mangaka chỉnh."` |
| Thiếu `chapterId` | `"Thiếu chapter_id để gửi review."` |
| Series-level approve mà thiếu `seriesId` | `"Thiếu series_id để gửi review."` |
| `saveDraftOnly` mà thiếu `seriesId` | `"Thiếu series_id để lưu nháp."` |
| Annotation create với pages rỗng | `"Thiếu danh sách page để lưu annotation."` |

### 7.7. Gom notes → array (`noteLines`)

```js
const rejectNotes = [nextText, nextRevisionFeedback]
  .filter(Boolean)
  .flatMap((t) => t.split("\n").map((l) => l.trim()).filter(Boolean))

const noteLines = rejectNotes.length
  ? rejectNotes
  : (nextText ? [nextText] : [])
```

→ BE nhận `notes: string[]` (mỗi dòng là 1 note).

---

## 8. Quy tắc `publishChapter` (riêng)

### 8.1. Endpoint

`POST /te-reviews/chapter/:chapterId/publish`

**Điều kiện tiên quyết (BE)**:
- Chapter phải ở `approved_by_EB`.
- TE gọi phải là TE đã approve chapter (403 nếu khác).
- Chapter đầu series: bắt buộc `scheduled_publish_at`.

### 8.2. Body

```js
{
  scheduled_publish_at?: "2026-07-30T09:00:00+07:00",  // optional cho chapter 2+
}
```

### 8.3. Response thành công

```js
{
  success: true,
  message: "...",
  data: {
    chapter: {...},
    next_step: { action: 'publish', endpoint: 'POST .../publish' }
  },
  buffer: {
    ok: Boolean,
    warning: String,
    approved_unpublished_count: Number,
    min_required: Number,             // default 2
    is_first_chapter_of_series: Boolean,
    is_final_chapter: Boolean,
    series_completed: Boolean,
  }
}
```

### 8.4. Buffer policy (Policy B)

| Điều kiện buffer OK | Ý nghĩa |
|---|---|
| `is_first_chapter_of_series = true` | Chapter đầu series — luôn OK |
| `approved_unpublished_count >= min_required (=2)` | Đã duyệt ≥2 chapter chưa publish |
| `series_completed && is_final_chapter` | Chapter cuối của series đã completed |

→ Buffer không OK → **schedule vẫn được lưu**, **BE job tạm giữ** đến khi đủ điều kiện.
→ `formatTePublishBufferWarning` sinh toast warning cho user biết.

### 8.5. UI status sau publish

```js
nextUiStatus = resolveTeUiChapterStatus({
  apiStatus: apiChapterStatus || 'approved_by_EB',
  isScheduled: chapterResult.isScheduled,
  scheduledPublishAt: chapterResult.scheduledPublishAt,
})
```

| Tình huống | UI status cuối |
|---|---|
| Chapter published | `approved_publish` |
| Chapter có `is_scheduled=true` hoặc `scheduledPublishAt` | `scheduled` |
| Chapter đã approved chưa lên lịch | `awaiting_publish` |

### 8.6. Format toast thành công (`formatTePublishSuccessMessage`)

| Buffer | UI status | Toast message |
|---|---|---|
| OK | - | `"Đã lên lịch ... · 12:00 30/07/2026. Job sẽ publish khi tới hạn."` |
| `isFirstChapterOfSeries` | - | `"Đã lên lịch phát hành ... · ..."` |
| Buffer không OK | - | `"Đã lên lịch ... Job sẽ tạm giữ đến khi đủ buffer."` |
| `status === 'published'` | - | `"Đã phát hành ..."` |
| - | - | Dùng `res.message` nếu có |

### 8.7. Error mapping (`formatTeChapterPublishError`)

| HTTP | Message |
|---|---|
| `403` | `"Chỉ TE đã phê duyệt chapter mới được phát hành."` |
| `400` (chứa `scheduled_publish_at` hoặc "chapter đầu") | Trả nguyên message BE |
| `400` khác | `"Chapter chưa ở trạng thái approved_by_EB — hãy phê duyệt trước."` |
| Khác | Message BE hoặc fallback `"Không phát hành được chapter."` |

---

## 9. LocalStorage — Demo workspace

> ⚠️ Đây là demo state, BE đã thay thế phần lớn. Chỉ dùng cho demo local và history fallback.

### 9.1. Keys

| Key | Mục đích |
|---|---|
| `mk-tantou-submissions-v1` | Danh sách submission (giới hạn 100) |
| `mk-tantou-publish-schedule-v1` | Map series → schedule |
| `mk-tantou-review-history-v1` | Lịch sử review (giới hạn 50) |
| `mk-eb-council-scores-v2` | Shared với EB (điểm HĐ) |
| `mk-eb-debut-pending` | Series Tantou forward sang EB |
| `mk-eb-pending-update` (event) | Notify khi pending thay đổi |

### 9.2. Helpers

| Hàm | Mục đích |
|---|---|
| `pushTantouSubmissionFromMangaka(payload)` | Mangaka submit → tạo submission |
| `forwardSubmissionToEb(id)` | Tantou forward sang EB (lưu eb-debut-pending + update status) |
| `rejectSubmissionToMangaka(id, payload)` | Tantou reject → Mangaka sửa |
| `approveRecurringSubmission(id)` | Tantou approve (luồng đã EB) |
| `setPublishSchedule(title, schedule)` | Đặt lịch cho series |
| `pushTantouReviewHistory(entry)` | Push 1 entry vào lịch sử local |

### 9.3. `isSeriesEbApproved(seriesTitle)` — check local

Dùng trong `enrichTeQueueItemWithSeriesDetail` để quyết định `phase = chapter_level` thay vì gọi thêm API.

---

## 10. Hàng chờ review

### 10.1. Phân nhóm theo Mangaka

Trong section `series-pending`, các submission cấp series được **gom theo Mangaka** (MangakaSelectCard):

```js
function mangakaGroupKey(sub) {
  // Ưu tiên id, fallback tên
  const authorId = String(sub?.mangakaUserId ?? sub?.seriesMeta?.authorId).trim()
  if (authorId) return `id:${authorId}`
  const name = String(sub?.seriesMeta?.authorName || sub?.mangakaName || 'Mangaka').trim()
  return `name:${name.toLowerCase()}`
}
```

→ Sort: **nhiều chapter trước**, sau đó theo tên (localeCompare vi).

### 10.2. Drill-down

- Click Mangaka card → list chapter của Mangaka đó (filtered).
- Click chapter → `openReview(sub)` → full-page `TantouPageReview`.

### 10.3. Sort newest first

`sortTePendingSubmissionsNewestFirst`:
1. Sắp theo `seriesLastActivity` (max `sentAt` trong series) — DESC
2. Trong cùng series → theo `sentAt` DESC
3. Fallback → theo `chapterNum` DESC

→ Series / chapter mới hoặc vừa cập nhật lên đầu.

### 10.4. Hydrate avatar

Nếu submission không có `mangakaAvatarUrl` → gọi `mangakaProfileService.getPublicProfile(id)` cho mỗi Mangaka duy nhất (Promise.all).

---

## 11. Pull API choices

### 11.1. `flattenTePendingSections`

```js
for (tabType of ['series_level', 'chapter_level']) {
  for (series of section.series) {
    for (chapter of series.chapters) {
      push({ chapter, series, tabType })
    }
  }
}
```

→ Trả về flat array dùng cho `mapTePendingChapterToSubmission`.

### 11.2. `enrichTeSubmissionAssignment`

Sau khi map → `currentTeId` được truyền vào:
- `teId = resolveTeChapterTeId(chapter)` (lấy `te_id` từ chapter)
- `teAssignmentStatus = teChapterAssignmentStatus(teId, currentTeId)`
- `canReview = canTeUserReviewChapter(teId, currentTeId)`
- `teAssignmentLabel = teChapterAssignmentLabel(status)`

### 11.3. Pipeline (legacy alias)

| UI | BE | Legacy |
|---|---|---|
| `series_level` (phase) | `series_level` | `debut` |
| `chapter_level` (phase) | `chapter_level` | `recurring` |

`phaseToPipeline(phase)` → dùng cho adapter code cũ.

---

## 12. Quy trình update publication status

### 12.1. API

`PATCH /te-reviews/series/:seriesId/publication-status`

Body: `{ publication_status: 'ongoing' | 'hiatus' | 'completed' | 'dropped' | 'upcoming' }`

### 12.2. Ràng buộc

| From | Allowed | Blocked |
|---|---|---|
| `upcoming` | (chỉ auto bởi job) | Mọi thay đổi từ TE |
| `ongoing` | `hiatus`, `completed`, `dropped` | Quay lại `upcoming` |
| `hiatus` | `ongoing` | `completed`, `dropped` |
| `dropped` | `ongoing` | `hiatus`, `completed` |
| `completed` | — | (read-only) |

### 12.3. Flow FE

```
[Bảng publication-status]
  → User chọn status mới (Select)
    → requestPublicationStatusChange(row, nextStatus)
      → Validate (nextStatus khác current)
        → Set publicationConfirm { seriesId, title, fromStatus, toStatus }
          → [Dialog xác nhận] "Thay đổi từ X → Y?"
            → Bấm Đồng ý → handlePublicationStatusChange(...)
              → PATCH API
                → Update local + toast
```

### 12.4. Toast message

```js
toast.success(
  res?.message
    ?? `Đã cập nhật trạng thái phát hành → ${getPublicationStatusLabel(updated)}.`
)
```

---

## 13. Edge cases & Quy tắc phụ

### 13.1. Annotation edge cases

| Tình huống | Xử lý |
|---|---|
| Note không có `page_id` | Skip (buildTeAnnotationCreatePayload → null) |
| Note content rỗng | `'No detail'` |
| Pages rỗng khi save | Toast `"Thiếu danh sách page để lưu annotation."` |
| Chapter không có preview | Lưu annotation skip, các bước khác vẫn chạy |

### 13.2. Review flow edge cases

| Tình huống | Xử lý |
|---|---|
| Chapter `te_id = TE khác` | Nút bị disable + opacity 75% + toast error |
| Save nháp với chapter của TE khác | VẪN CHO (best-effort) |
| Approve giai đoạn 2 → muốn publish | Approve xong → state `awaiting_publish` → user bấm Phát hành riêng |
| Approve giai đoạn 1 → chapter chuyển EB | Status: `forwarded_eb` → EB xử lý tiếp |
| Annotations cũ chưa xóa | Auto delete hết rồi create mới |
| Series không trả về status | Phase fallback `series_level` (an toàn hơn) |
| User chưa đăng nhập | `getSession()` → null, vẫn cho xem, không hiện nút logout |
| Section không hợp lệ | `<Navigate to="/tantou" replace />` |

### 13.3. `isSeriesApprovedByEb`

```js
function isSeriesApprovedByEb(series, seriesTitle) {
  const apiStatus = String(series?.status ?? '').toLowerCase()
  if (
    apiStatus === 'approved_by_eb'
    || apiStatus === 'approved'
    || apiStatus === 'published'
    || series?.is_public === true
  ) {
    return true
  }
  return isSeriesEbApproved(seriesTitle)  // localStorage check
}
```

→ Phase chapter_level chỉ khi series đã EB-approved ở 1 trong các dạng trên.

### 13.4. `parseSeriesGenres`

```js
function parseSeriesGenres(series) {
  const genreRaw = series?.genre ?? series?.genres
  if (Array.isArray(genreRaw)) return genreRaw.filter(Boolean)
  if (genreRaw) {
    return String(genreRaw).split(/[,;|]/).map(g => g.trim()).filter(Boolean)
  }
  return []
}
```

→ Hỗ trợ nhiều format: array / comma-separated / semicolon / pipe.

### 13.5. Hero slideshow

- 3 ảnh `editor1/2/3.png`, đổi mỗi **5 giây**.
- `<2 ảnh thì không slide.
- Cleanup interval khi unmount.

---

## 14. Timezone & Date handling

| Tình huống | Quy tắc |
|---|---|
| Hiển thị scheduled publish | `vi-VN` locale, timezone `Asia/Ho_Chi_Minh` |
| So sánh "past" | So với giờ hiện tại + offset `+07:00` |
| Time picker | User chọn `HH:mm`, gộp với date → ISO `+07:00` → `.toISOString()` |
| Chapter đầu series | Bắt buộc full date+time picker |

---

## 15. API endpoints tổng hợp

| Method | Endpoint | Mục đích |
|---|---|---|
| `GET` | `/te-reviews/pending` | Hàng chờ TE |
| `GET` | `/te-reviews/history` | Lịch sử review |
| `GET` | `/te-reviews/series/:id/profile` | Profile series (gđ 1) |
| `GET` | `/te-reviews/series-review/:id` | Draft series review |
| `POST` | `/te-reviews/series-review/:id` | Lưu nháp series review |
| `GET` | `/te-reviews/chapter/:id/pages?all=true` | Toàn bộ pages |
| `GET` | `/te-reviews/chapter/:id/pages?page=N` | 1 page + annotations |
| `GET` | `/te-reviews/chapter/:id/annotations` | List annotations |
| `POST` | `/te-reviews/chapter/:id/annotations` | Tạo annotation |
| `PATCH` | `/te-reviews/chapter/:id/annotations/:id` | Update |
| `DELETE` | `/te-reviews/chapter/:id/annotations/:id` | Delete |
| `POST` | `/te-reviews/series-review/:id/review-chapter` | Review gđ 1 |
| `POST` | `/te-reviews/chapter/:id/te-action` | Review gđ 2 |
| `POST` | `/te-reviews/chapter/:id/publish` | Publish chapter |
| `POST` | `/te-reviews/series-review/:id/submit` | Submit series review |
| `GET` | `/te-reviews/calendar` | Lịch publish |
| `PATCH` | `/te-reviews/series/:id/publication-status` | Đổi publication status |

---

## 16. Workflow tổng thể (end-to-end)

```
┌─────────────────────────────────────────────────────────────────┐
│  1. Mangaka submit chapter (qua Assistant)                       │
│     → status: pending_TE                                         │
│     → te_id: null                                                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  2. Tantou mở /tantou/series-pending                              │
│     - Xem hàng chờ gom theo Mangaka                              │
│     - Phase: series_level (chưa EB-approved)                     │
│     - teAssignmentStatus: 'unassigned' / 'mine' / 'other'        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  3. Click chapter → TantouPageReview                              │
│     - Load pages + annotations                                   │
│     - Hiển thị preview + form đánh giá                           │
│     - Có thể vẽ annotation trên page (region + error_type)       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
       ┌──────────────────────┴──────────────────────┐
       ▼                                             ▼
┌──────────────────────┐                  ┌──────────────────────┐
│  4a. REJECT          │                  │  4b. APPROVE          │
│  - Bắt buộc feedback │                  │  - Lưu nháp (opt)    │
│  - POST review-      │                  │  - POST review-      │
│    chapter + reject  │                  │    chapter + approve │
│  - status: revision │                  │  - status: pending_EB│
│  - Mangaka sửa lại  │                  │    (forwarded_eb)    │
└──────────────────────┘                  └──────────────────────┘
                                                     ↓
                                          ┌──────────────────────┐
                                          │  5. EB chấm HĐ       │
                                          │  - council_average   │
                                          │  - classification    │
                                          │  - status: approved_ │
                                          │    by_eb             │
                                          └──────────────────────┘
                                                     ↓
                                          ┌──────────────────────┐
                                          │  6. EB confirm-      │
                                          │    publish           │
                                          │  - publication_      │
                                          │    schedule / date   │
                                          └──────────────────────┘
                                                     ↓
┌─────────────────────────────────────────────────────────────────┐
│  7. Sau khi EB publish → series → approved_by_eb / published     │
│     - Tantou vào /tantou/series-approved                          │
│     - Phase: chapter_level                                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  8. Tantou APPROVE chapter (te-action)                           │
│     - Chapter 1: lưu feedback → series                            │
│     - status: approved_by_EB                                     │
│     - TE auto-claim                                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  9. Tantou bấm PHÁT HÀNH (publishChapter)                         │
│     - Chapter 1: scheduled_publish_at bắt buộc                   │
│     - Chapter 2+: body rỗng (BE cadence)                         │
│     - Buffer check: ≥2 chapter approved chưa publish             │
│     - OK → status: scheduled / published                         │
│     - Buffer fail → schedule lưu nhưng BE job tạm giữ           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  10. Tantou đổi publication status khi cần                       │
│      - /tantou/publication-status                                 │
│      - Chỉ các transition được phép                              │
│      - Dialog xác nhận trước khi PATCH                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  11. Xem lịch sử: /tantou/history                                │
│      - Filter: decision, from_date, to_date, series_id          │
│      - Pagination: page, limit                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  12. Lịch phát hành: /tantou/schedule                            │
│      - GET /te-reviews/calendar                                  │
│      - scope: mine (mặc định TE) | all (Admin)                   │
│      - TE + scope=all → 403                                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 17. Glossary

| Thuật ngữ | Nghĩa |
|---|---|
| **Tantou** | Editor phụ trách (担当者) |
| **TE** | Tantou Editor — ký hiệu vai trò |
| **Phase** | Giai đoạn xử lý: `series_level` (gđ 1) hoặc `chapter_level` (gđ 2) |
| **Pipeline** | Legacy alias: `debut` = series_level, `recurring` = chapter_level |
| **Submission** | Một chapter đang chờ TE review trong hàng chờ |
| **Annotation** | Note TE vẽ trên 1 page cụ thể (region + content + error_type) |
| **Auto-claim** | BE tự gán TE hiện tại cho chapter khi `te_id = null` |
| **TE-action** | API approve/reject chapter (gđ 2) |
| **Review-chapter** | API approve/reject chapter (gđ 1 — kèm forward EB) |
| **Publish** | API riêng để phát hành chapter (sau approve) |
| **Buffer** | Số chapter approved chưa publish (cần ≥2 trước khi publish chapter thường) |
| **Policy B** | Schedule OK nhưng BE job tạm giữ nếu buffer chưa đủ |
| **Auto-schedule** | Chapter 2+ tự động lên lịch theo cadence series |
| **forwarded_eb** | Status: chapter đã Tantou approve + chuyển EB |
| **awaiting_publish** | UI status: chapter approved by EB, chờ Tantou bấm Phát hành |
| **scheduled** | UI status: chapter đã có lịch (sau publish) |

---

## 18. Liên hệ với workflow tổng thể

Xem thêm:
- `docs/EB-BUSINESS-RULES.md` — Business rule EB (tầng tiếp theo sau khi TE forward)
- `docs/WORKFLOW-SPEC.md` (nếu có) — Workflow tổng thể
- `docs/TE-ASSIGNMENT-BE-SPEC.md` (nếu có) — Spec API BE cho TE
- `docs/system-architecture.html` — Sơ đồ kiến trúc

---

*Cập nhật lần cuối: 2026-07-26 — Dựa trên source code hiện tại tại branch `main`.*
