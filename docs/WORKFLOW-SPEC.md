# WDP — Luồng Pipeline & API Specification

> Hướng dẫn đầy đủ FE + BE cho tất cả luồng trong hệ thống WDP.
> Chỉ cần prompt 1 câu: "Áp dụng luồng X cho role Y" — FE và BE tự hiểu theo spec này.

---

## Mục lục

1. [Tổng quan pipeline](#1-tổng-quan-pipeline)
2. [Luồng A — Mangaka → Assistant → Mangaka → TE → EB → Publish](#2-luồng-a--mangaka--assistant--mangaka--te--eb--publish)
3. [Luồng B — Mangaka → Assistant → Mangaka → Từ chối → Assistant → Mangaka (Revision)](#3-luồng-b--mangaka--assistant--mangaka--từ-chối--assistant--mangaka-revision)
4. [Luồng C — Mangaka → TE → EB → Publish (không qua Assistant)](#4-luồng-c--mangaka--te--eb--publish-không-qua-assistant)
5. [Data model — Backend](#5-data-model--backend)
6. [API endpoints — Backend](#6-api-endpoints--backend)
7. [FE state & component mapping](#7-fe-state--component-mapping)
8. [Hướng dẫn implement BE](#8-hướng-dẫn-implement-be)
9. [Hướng dẫn implement FE](#9-hướng-dẫn-implement-fe)
10. [Quick reference — Prompt template](#10-quick-reference--prompt-template)

---

## 1. Tổng quan pipeline

```
┌─────────────────────────────────────────────────────────────┐
│  DEBUT PIPELINE (series mới, chưa EB-approved)              │
│                                                             │
│  Mangaka ──► Assistant ──► Mangaka ──► TE ──► EB ──► Pub  │
│  (gửi)   (xử lý)  (duyệt/từ chối)  (nhận xét)  (duyệt)  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  RECURRING PIPELINE (series đã EB-approved)                 │
│                                                             │
│  Mangaka ──► TE ──► EB ──► Publish                         │
│  (gửi)   (nhận xét) (duyệt)                               │
└─────────────────────────────────────────────────────────────┘
```

### Vai trò

| Role | Mô tả |
|------|-------|
| **Mangaka** | Tạo series, upload ảnh gốc, giao việc cho Assistant, duyệt kết quả, gửi sang TE |
| **Assistant** | Nhận ảnh gốc + ghi chú, upload layers, gộp ảnh, gửi lại Mangaka |
| **TE (Tantou Editor)** | Nhận xét chất lượng chapter (điền text/annotation), gửi EB hoặc yêu cầu sửa lại |
| **EB (Editor-in-Chief)** | Duyệt cuối, phê duyệt xuất bản |

### Trạng thái Chapter

| Status | Ý nghĩa | Ai thấy |
|--------|---------|---------|
| `draft` | Đang draft | Mangaka |
| `assistant` | Đã gửi cho Assistant | Mangaka, Assistant |
| `submitted` | Assistant đã gửi, chờ Mangaka duyệt | Mangaka |
| `in_review` | Mangaka đang xem | Mangaka |
| `pending_TE` | Đã gửi sang TE | Mangaka, TE |
| `TE_revision` | TE yêu cầu sửa lại | Mangaka |
| `pending_EB` | TE đã gửi EB | TE, EB |
| `EB_revision` | EB yêu cầu sửa lại | TE |
| `approved` | Đã duyệt | Mọi người |
| `published` | Đã xuất bản | Mọi người |

### Trạng thái Task

| Status | Ý nghĩa |
|--------|---------|
| `pending` | Chờ Assistant nhận |
| `in_progress` | Assistant đang làm |
| `submitted` | Assistant đã gửi, chờ Mangaka duyệt |
| `revision` | Mangaka từ chối, gửi lại Assistant |
| `approved` | Mangaka đã duyệt |

---

## 2. Luồng A — Mangaka → Assistant → Mangaka → TE → EB → Publish

### 2.1 Bước 1: Mangaka tạo series + upload ảnh gốc

**FE — Mangaka:**

1. Tạo series mới (nếu chưa có)
2. Upload ảnh gốc từng trang cho chapter (Annotator)

**BE:**

```
1. POST /chapters
   Body: { series_id, chapter_number, title }
   → Tạo Chapter record

2. POST /chapters/:id/pages (multipart)
   Body: [File ảnh gốc]
   → Lưu original_image_url cho mỗi Page

3. POST /pages/:id/notes (tùy chọn)
   Body: { x, y, w, h, text, taskType }
   → Tạo PageNote (ghi chú vùng cần xử lý)
```

---

### 2.2 Bước 2: Mangaka gửi cho Assistant

**FE — Mangaka:**

1. Mở tab "Chapter"
2. Chọn chapter → Annotator
3. (Tùy chọn) Vẽ ô ghi chú trên từng trang → ghi chú việc cần làm
4. Bấm **"Gửi Assistant"**
   - Hệ thống gom tất cả ghi chú từng trang → `revision_notes` text
   - Gán assistant cho chapter
   - Gọi `PATCH /chapters/:id { action: 'submit' }`
   - Chapter status → `assistant`

**FE code reference:**

```20:30:src/pages/User/Mangaka/ChapterAnnotator.jsx
Chọn tab Assistant → Bấm nút "Gửi cả chapter"
→ gọi onSendToAssistant → handleSendToAssistant trong Mangaka.jsx
```

```771:818:src/pages/User/Mangaka/Mangaka.jsx
async function handleSendToAssistant({ chapter, pages, assistantId }) {
  // Bước 1: Gom ghi chú từng trang → revision_notes text
  const allNotes = []
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex]
    if (!page?.id) continue
    const pageKey = `${chapter.id}-${pageIndex}`
    const pageNotes = annotatorNotes[pageKey]?.length
      ? annotatorNotes[pageKey]
      : await loadPageNotes(page.id, pageKey)
    for (const note of pageNotes) {
      allNotes.push({ pageNum: pageIndex + 1, note })
    }
  }
  const revisionNotes = allNotes.map(...).join('\n')

  // Bước 2: Gán assistant
  await assignChapter(chapter.id, targetAssistantId)

  // Bước 3: Gửi chapter
  await chaptersService.update(chapter.id, {
    action: 'submit',
    revision_notes: revisionNotes,
  })

  // Bước 4: Cập nhật UI
  await updateChapterStatus(chapter.id, 'assistant')
}
```

**BE:**

```
PATCH /chapters/:id
Body: { action: 'submit', revision_notes: string }

→ Tạo Task cho mỗi Page (1 Task = 1 Page hoặc 1 Task = 1 Chapter)
→ Gắn PageNote vào Task.note_ids
→ Chapter status → 'assistant'
→ Gửi notification cho Assistant
```

---

### 2.3 Bước 3: Assistant nhận và xử lý

**FE — Assistant:**

1. Login → vào `/assistant`
2. Thấy chapter trong danh sách bên trái (filter: "Đã nhận")
3. Bấm chọn chapter → **LayerEditor** mở ra
4. Tải ảnh gốc từng trang về
5. Trong Photoshop/CSP: vẽ layers, xử lý
6. Upload layers theo thứ tự (0, 1, 2...) qua LayerEditor
7. Bấm **"Gộp layer"** → ảnh gộp (final image) được tạo server-side
8. Bấm **"Gửi Mangaka"** → ảnh gộp được gửi

**FE code reference:**

```160:177:src/components/layer/LayerEditor.jsx
async function handleAddLayer(file) {
  // Auto-chuyển task: pending → in_progress khi upload layer đầu tiên
  if (layers.length === 0 && task?.status === 'pending') {
    await tasksService.start(task.id)
    toast.success('Đã bắt đầu làm.')
  }
  await addLayer({ file, index: layers.length })
}
```

```193:220:src/components/layer/LayerEditor.jsx
async function handleSubmitChapter({ chapterId }) {
  // Không truyền files → BE tự dùng result_image_url đã gộp
  await tasksService.submitChapter(chapterId, null)
  toast.success(`Đã gửi ${pages.length} trang cho Mangaka.`)
  onSubmitted?.(newTask)
}
```

**BE:**

```
POST /tasks/:id/submit
Body: { result_image_url: string }
→ Task status → 'submitted'
→ Chapter status → 'submitted'
→ Tạo Submission record
→ Gửi notification cho Mangaka
```

---

### 2.4 Bước 4: Mangaka duyệt kết quả

**FE — Mangaka:**

1. Vào `/mangaka` → thấy notification "Có chapter chờ duyệt"
2. Mở chapter → xem ảnh gộp (result image) từng trang
3. **Hai lựa chọn:**

   **Duyệt:** Bấm **"Phê duyệt chapter"**
   → `approveChapterTasks([review])`
   → `PATCH /submissions/chapters/:id/approve`
   → Chapter status → `in_review`

   **Từ chối:** Bấm **"Yêu cầu sửa lại"**
   → Mở dialog revision → nhập ghi chú
   → Đi đến **Luồng B** (bên dưới)

**FE code reference:**

```884:897:src/pages/User/Mangaka/Mangaka.jsx
async function handleApproveChapter() {
  await approveChapterTasks([pendingReview])
  setLastApprovedChapter(approvedChapter)
  toast.success(`Đã duyệt chapter ${approvedChapter.num} — ${approvedChapter.series}.`)
}
```

---

### 2.5 Bước 5: Mangaka gửi sang TE

**FE — Mangaka:**

1. Sau khi duyệt → thấy banner **"Đã duyệt chapter X"**
2. Bấm **"Chọn TE"** → mở dialog
3. Chọn TE từ danh sách
4. Bấm **"Gán và gửi sang TE"**

**FE code reference:**

```468:499:src/pages/User/Mangaka/Mangaka.jsx
async function handleAssignTeAndSend(teId) {
  // Bước 1: Gán TE cho chapter
  await submissionsService.assignTe(chapterId, teId)

  // Bước 2: Gửi sang TE
  await submissionsService.submitChapterToTe(chapterId)
  toast.success(`Đã gửi Ch. ${chapter.num} sang ${LABEL_TANTOU_EDITOR}.`)
}
```

```15:21:src/api/submissions.service.js
submitChapterToTe(chapterId) {
  return http.post(`/submissions/chapters/${chapterId}/submit-to-te`)
},
```

**BE:**

```
POST /submissions/chapters/:id/submit-to-te
→ Tạo Submission (type: 'te_review')
→ Chapter status → 'pending_TE'
→ Gửi notification cho TE
```

---

### 2.6 Bước 6: TE nhận xét chapter

**FE — TE (TantouEditor):**

1. Login → vào `/tantou`
2. Thấy chapter trong danh sách (debut queue / recurring queue)
3. Bấm **"Mở & nhận xét"** → **TantouPageReview** mở ra
4. Xem từng trang, tạo annotation (vùng + text)
5. Đánh giá series: pacing, visual art, layout, localization
6. **Ba lựa chọn:**

   **Gửi EB (approve):** Bấm **"Gửi EB"** → chuyển `forwarded_eb`
   **Yêu cầu sửa lại (revision):** Bấm **"Yêu cầu sửa"** → gửi về Mangaka
   **Gỡ TE:** Bấm **"Gỡ TE"** → xóa assignment

**FE code reference:**

```246:263:src/pages/User/Tantou/TantouEditor.jsx
async function syncChapterAnnotations(chapter) {
  // Xóa annotation cũ trước khi tạo mới
  const existing = await teReviewsService.getPageAnnotations(chapter.chapterId, page._id)
  await Promise.all(existing.map(a => teReviewsService.deleteAnnotation(...)))
}
```

```266:300:src/pages/User/Tantou/TantouEditor.jsx
async function createChapterAnnotations(chapter, editorialNotesByPage) {
  // Tạo annotation mới cho mỗi trang
  pages.forEach((page, pageIndex) => {
    const notes = notesMap[pageIndex] ?? []
    notes.forEach(note => {
      teReviewsService.createAnnotation(chapter.chapterId, {
        page_id: page._id,
        x: note.x,
        y: note.y,
        w: note.w,
        h: note.h,
        content: note.text ?? '',
        annotation_type: note.type ?? 'editorial',
      })
    })
  })
}
```

**BE:**

```
POST /te-reviews/chapter/:id/annotations
Body: { page_id, x, y, w, h, content, annotation_type }

PATCH /submissions/chapters/:id/te-review-action
Body: { action: 'forward_eb' | 'request_revision', notes: [] }
→ action='forward_eb': Chapter status → 'pending_EB'
→ action='request_revision': Chapter status → 'TE_revision', gửi notification Mangaka
```

---

### 2.7 Bước 7: EB duyệt → Publish

**FE — EB:**

1. Login → vào `/eb`
2. Thấy chapter trong queue
3. Xem, nhận xét (nếu cần)
4. Bấm **"Phê duyệt"** → chuyển `approved` → `published`

---

## 3. Luồng B — Mangaka → Assistant → Mangaka → Từ chối → Assistant → Mangaka (Revision)

### Luồng chi tiết

```
Assistant gửi ảnh gộp
    ↓
Mangaka xem ảnh gộp → phát hiện lỗi
    ↓
Vẽ ô ghi chú MỚI trên chính ẢNH GỘP đó
    ↓
Bấm "Yêu cầu sửa lại"
    ↓
Điền ghi chú (hoặc để trống → text mặc định)
    ↓
BE tạo PageNote MỚI cho từng trang, gắn vào Task
    ↓
Task status → 'revision'
Chapter status → 'assistant'
    ↓
Assistant nhận → thấy trong filter "Bị từ chối"
    ↓
Assistant bấm chapter → thấy:
  - ẢNH GỘP mới nhất (result image) làm nền
  - Ghi chú MỚI của Mangaka hiện trên ảnh
  - KHÔNG thấy ảnh gốc, KHÔNG thấy layers cũ
    ↓
Assistant sửa → upload layer mới → gộp → gửi lại
    ↓
Mangaka nhận → duyệt hoặc từ chối tiếp
```

### 3.1 Mangaka vẽ ghi chú revision trên ảnh gộp

**FE — Mangaka (ChapterAnnotator):**

- Khi đang ở trạng thái `submitted` / `in_review`, ảnh hiển thị là **ảnh gộp** (result image) của Assistant
- Mangaka bật tool **"Tạo ô"** → kéo vùng cần sửa trên ảnh
- Nhập text ghi chú: "Sửa layer 2, chỗ bóng đổ sai"
- Các ghi chú này được lưu vào `annotatorNotes[pageKey]` (FE state)

**FE code reference:**

```174:198:src/pages/User/Mangaka/ChapterAnnotator.jsx
const persistNoteById = useCallback(async (stableKey) => {
  const page = pages[pageIndex]
  await workspaceApi.savePageNote(page.id, pageKey, noteSnapshot)
}, [])
```

### 3.2 Mangaka bấm "Yêu cầu sửa lại"

**FE — Mangaka:**

1. Bấm **"Yêu cầu sửa lại"** → dialog mở ra
2. Ghi chú text tổng hợp (từ các ô đã vẽ + text tùy chỉnh)
3. Bấm **"Gửi lại"**

**FE code reference:**

```915:931:src/pages/User/Mangaka/Mangaka.jsx
async function handleConfirmChapterRevision() {
  const note = revisionNote.trim()
    || "Mangaka yêu cầu chỉnh sửa — xem ghi chú trên từng trang."
  await requestRevision([pendingReview], note)
  await updateChapterStatus(pendingReview.chapter.id, "assistant")
  setRevisionOpen(false)
  toast.success("Đã trả chapter cho Assistant...")
  openAnnotate(pendingReview.chapter.series, pendingReview.chapter.id)
}
```

### 3.3 BE xử lý requestRevision

**BE — cần implement:**

```
POST /submissions/chapters/:id/request-revision
Body: {
  revision_note: string,      // ghi chú tổng (text)
  page_notes: [               // MỚI: ghi chú theo từng trang
    {
      page_id: ObjectId,
      notes: [
        { x, y, w, h, text, taskType: 'revision' }
      ]
    }
  ]
}

Logic:
1. Tạo PageNote mới cho mỗi page (taskType = 'revision')
2. Gán các PageNote đó vào Task.note_ids (gắn vào Task hiện tại)
3. Lưu revision_note vào Task.revision_history
4. Task status → 'revision'
5. Chapter status → 'assistant'
6. Gửi notification cho Assistant
```

### 3.4 Assistant nhận chapter revision

**FE — Assistant:**

1. Vào `/assistant` → thấy banner đỏ **"X chapter bị từ chối"**
2. Filter: "Bị từ chối" → chọn chapter
3. **LayerEditor hiển thị:**
   - **Ảnh nền**: `final_image_url` / `result_image_url` (ảnh gộp gần nhất)
   - **Ghi chú**: `task.noteIds` — hiện ô vẽ trên ảnh tại đúng vị trí

**FE — cần sửa LayerEditor:**

```src/components/layer/LayerEditor.jsx
// Ưu tiên hiển thị ảnh gộp làm nền khi đang revision
const baseImage = task?.status === 'revision'
  ? (safePage?.result_image_url ?? safePage?.final_image_url ?? safePage?.url)
  : (safePage?.url ?? originalImage ?? null)

// Load notes từ task.noteIds (BE populate khi revision)
const taskNotes = task?.noteIds ?? []
```

**FE — cần implement (LayerCanvas hiển thị notes trên ảnh gốc):**

```src/components/layer/LayerCanvas.jsx
// Notes từ task.noteIds → vẽ overlay rectangle + label
// Khi revision: notes được vẽ trên ảnh gộp, không phải ảnh gốc
// → Cần scale coords từ % (0-100) → pixel coordinates
// → Cần hiển thị text box popover khi click vào note region
```

### 3.5 Assistant sửa và gửi lại

- Upload layer mới (sửa layer cũ hoặc thêm layer mới)
- Gộp layer → ảnh gộp mới
- Bấm **"Gửi Mangaka"**
- Chapter status → `submitted`

---

## 4. Luồng C — Mangaka → TE → EB → Publish (không qua Assistant)

### Áp dụng cho

- Series **recurring** (đã EB-approved)
- Chapter không cần xử lý layer phức tạp

### Luồng chi tiết

```
Mangaka tạo chapter + upload ảnh
    ↓
Bấm "Gửi TE" (không qua Assistant)
    ↓
Chapter status → 'pending_TE'
    ↓
TE nhận xét → approve hoặc revision
    ↓
Nếu revision → TE tạo annotation → Chapter status → 'TE_revision'
    ↓
Mangaka nhận → sửa theo ghi chú → gửi lại TE
    ↓
TE approve → Chapter status → 'pending_EB'
    ↓
EB duyệt → published
```

---

## 5. Data model — Backend

### Chapter

```javascript
{
  _id: ObjectId,
  series_id: ObjectId,
  chapter_number: Number,
  title: String,
  status: String,           // draft | assistant | submitted | pending_TE | pending_EB | approved | published
  assistant_id: ObjectId | null,
  te_id: ObjectId | null,
  pages: [Page],
  createdAt: Date,
  updatedAt: Date,
}
```

### Page

```javascript
{
  _id: ObjectId,
  chapter_id: ObjectId,
  page_number: Number,
  original_image_url: String,    // Ảnh gốc của Mangaka
  result_image_url: String,      // Ảnh gộp của Assistant (khi đã submit)
  final_image_url: String,       // Ảnh gộp mới nhất (sau revision)
  createdAt: Date,
}
```

### Task

```javascript
{
  _id: ObjectId,
  chapter_id: ObjectId,
  page_id: ObjectId | null,     // null khi 1 task = 1 chapter
  assigned_to: ObjectId,        // Assistant user ID
  status: String,               // pending | in_progress | submitted | revision | approved
  note_ids: [PageNote],         // Ghi chú revision từ Mangaka
  revision_note: String,        // Ghi chú text tổng
  revision_history: [{
    at: Date,
    by: ObjectId,
    note: String,
    request_revision_count: Number,
  }],
  result_image_url: String,     // Ảnh gộp đã submit
  createdAt: Date,
  updatedAt: Date,
}
```

### PageNote

```javascript
{
  _id: ObjectId,
  page_id: ObjectId,
  chapter_id: ObjectId,
  task_id: ObjectId | null,
  x: Number,          // 0-100 (%)
  y: Number,          // 0-100 (%)
  w: Number,          // 0-100 (%)
  h: Number,          // 0-100 (%)
  text: String,
  taskType: String,   // 'normal' | 'revision'
  status: String,     // 'open' | 'resolved'
  created_by: ObjectId,
  createdAt: Date,
}
```

### Submission

```javascript
{
  _id: ObjectId,
  chapter_id: ObjectId,
  type: String,      // 'assistant_review' | 'te_review' | 'eb_review'
  status: String,    // 'pending' | 'approved' | 'revision' | 'forwarded'
  te_id: ObjectId | null,
  eb_id: ObjectId | null,
  editorial_notes: [{
    page_id: ObjectId,
    x: Number, y: Number, w: Number, h: Number,
    content: String,
    annotation_type: String,
    createdAt: Date,
  }],
  createdAt: Date,
  updatedAt: Date,
}
```

---

## 6. API endpoints — Backend

### Authentication

| Method | Endpoint | Mô tả |
|--------|----------|--------|
| POST | `/auth/register` | Đăng ký |
| POST | `/auth/login` | Đăng nhập |
| POST | `/auth/verify-otp` | Xác thực OTP |
| GET | `/auth/me` | Lấy thông tin user hiện tại |

### Chapters

| Method | Endpoint | Mô tả |
|--------|----------|--------|
| POST | `/chapters` | Tạo chapter mới |
| GET | `/chapters/:id` | Lấy chapter |
| PATCH | `/chapters/:id` | Cập nhật chapter (action: submit) |
| DELETE | `/chapters/:id` | Xóa chapter |
| GET | `/chapters/:id/pages` | Lấy danh sách pages |
| POST | `/chapters/:id/pages` | Upload pages (multipart) |
| DELETE | `/chapters/:id/pages/:pageId` | Xóa page |

### Pages

| Method | Endpoint | Mô tả |
|--------|----------|--------|
| GET | `/pages/:id` | Lấy page detail |
| GET | `/pages/:id/notes` | Lấy notes của page |
| POST | `/pages/:id/notes` | Tạo note |
| PATCH | `/pages/:id/notes/:noteId` | Cập nhật note |
| DELETE | `/pages/:id/notes/:noteId` | Xóa note |

### Tasks

| Method | Endpoint | Mô tả |
|--------|----------|--------|
| GET | `/tasks/my-assignments` | Lấy tasks của Assistant đang login |
| GET | `/tasks/pending-review` | Lấy tasks chờ Mangaka duyệt |
| PATCH | `/tasks/:id/start` | Assistant bắt đầu làm |
| PATCH | `/tasks/:id/submit` | Assistant nộp kết quả |
| PATCH | `/tasks/:id/revision` | Yêu cầu revision |
| PATCH | `/tasks/:id/acknowledge` | Mangaka nhận task đã submitted |
| PATCH | `/tasks/:id/approve` | Mangaka duyệt task |

### Submissions

| Method | Endpoint | Mô tả |
|--------|----------|--------|
| GET | `/submissions/mangaka` | Lấy submissions của Mangaka |
| GET | `/submissions/te` | Lấy queue của TE |
| GET | `/submissions/eb` | Lấy queue của EB |
| PATCH | `/submissions/chapters/:id/approve` | Mangaka duyệt chapter |
| POST | `/submissions/chapters/:id/request-revision` | Mangaka yêu cầu revision |
| POST | `/submissions/chapters/:id/submit-to-te` | Mangaka gửi TE |
| GET | `/submissions/te-users` | Lấy danh sách TE |
| POST | `/submissions/chapters/:id/assign-te` | Gán TE cho chapter |
| PATCH | `/submissions/chapters/:id/assign-te` | Gỡ TE khỏi chapter |

### TE Reviews

| Method | Endpoint | Mô tả |
|--------|----------|--------|
| GET | `/te-reviews/pending` | Lấy chapters chờ TE review |
| GET | `/te-reviews/chapter/:id/pages` | Lấy pages của chapter để review |
| GET | `/te-reviews/chapter/:id/page/:pageId/annotations` | Lấy annotations của page |
| POST | `/te-reviews/chapter/:id/annotations` | Tạo annotation |
| DELETE | `/te-reviews/chapter/:id/annotations/:annotationId` | Xóa annotation |
| POST | `/te-reviews/chapter/:id/te-action` | TE gửi EB hoặc yêu cầu revision |
| GET | `/te-reviews/series-review/:seriesId` | Lấy review của series |
| POST | `/te-reviews/series-review/:seriesId` | Tạo series review |
| POST | `/te-reviews/series-review/:seriesId/submit` | TE gửi series review |

### Layers

| Method | Endpoint | Mô tả |
|--------|----------|--------|
| GET | `/pages/:pageId/layers` | Lấy danh sách layers |
| POST | `/pages/:pageId/layers` | Upload layer mới |
| PATCH | `/layers/:id` | Cập nhật layer (reorder, rename) |
| DELETE | `/layers/:id` | Xóa layer |
| POST | `/layers/:id/versions` | Upload version mới của layer |
| GET | `/layers/:id/versions` | Lấy versions của layer |
| PATCH | `/layers/:id/rollback/:versionId` | Rollback layer về version cũ |
| POST | `/pages/:pageId/finalize` | Gộp tất cả layers → final image |

### Notifications

| Method | Endpoint | Mô tả |
|--------|----------|--------|
| GET | `/notifications` | Lấy notifications |
| PATCH | `/notifications/:id/read` | Đánh dấu đã đọc |
| PATCH | `/notifications/read-all` | Đánh dấu đã đọc tất cả |

---

## 7. FE state & component mapping

### Mangaka workspace

| Component | State | Data source |
|-----------|-------|------------|
| `Mangaka.jsx` | `chapterRows`, `annotatorChapters` | `useMangakaWorkspace` |
| `ChapterAnnotator.jsx` | `pages`, `notes[pageKey]` | `loadChapterPages`, `loadPageNotes`, `savePageNote` |
| `Mangaka.jsx` | `pendingReviews` | `useMangakaTasks` |

**Key hooks:**

```javascript
useMangakaWorkspace(user)
  → seriesList, chapterRows, annotatorChapters, annotatorNotes
  → loadChapterPages(chapterId), loadPageNotes(pageId, pageKey)
  → savePageNote(pageId, pageKey, note)
  → createChapter(seriesId, num, files), uploadChapterPages(chapterId, files)
  → updateChapterStatus(chapterId, status), assignChapter(chapterId, assistantId)

useMangakaTasks(user)
  → pendingReviews, approveChapterTasks(reviews), requestRevision(reviews, note)
```

### Assistant workspace

| Component | State | Data source |
|-----------|-------|------------|
| `Assistant.jsx` | `assignments` | `useAssistantAssignments` |
| `LayerEditor.jsx` | `layers`, `pageNotes`, `finalImage` | `usePageLayers(pageId)` |

**Key hooks:**

```javascript
useAssistantAssignments()
  → assignments (chapter list + task info)
  → loadChapterPages(chapterId, task)
  → refresh()

usePageLayers(pageId)
  → layers, versions, originalImage, finalImage
  → addLayer(file), uploadNewVersion(layerId, file), deleteLayer(id)
  → finalize() → tạo ảnh gộp server-side
  → submitChapter(chapterId, files)

useAssistantTasks()
  → allTasks, startTask(id), submitTask(id, file), submitChapterTask(chapterId, files)
```

### TE workspace

| Component | State | Data source |
|-----------|-------|------------|
| `TantouEditor.jsx` | `submissions` | `submissionsService.getTeQueue()` |
| `TantouPageReview.jsx` | `annotations` | `teReviewsService.getPageAnnotations()` |

---

## 8. Hướng dẫn implement BE

### 8.1 Cài đặt project (giả sử dùng Express/Mongoose)

```bash
npm init
npm install express mongoose cors dotenv jsonwebtoken
```

### 8.2 Models

```javascript
// models/Chapter.js
const chapterSchema = new mongoose.Schema({
  series_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Series' },
  chapter_number: Number,
  title: String,
  status: {
    type: String,
    enum: ['draft', 'assistant', 'submitted', 'in_review', 'pending_TE', 'pending_EB', 'approved', 'published'],
    default: 'draft',
  },
  assistant_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  te_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  pages: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Page' }],
}, { timestamps: true })

// models/Page.js
const pageSchema = new mongoose.Schema({
  chapter_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' },
  page_number: Number,
  original_image_url: String,
  result_image_url: String,   // Ảnh gộp của Assistant
  final_image_url: String,    // Ảnh gộp mới nhất (sau revision)
}, { timestamps: true })

// models/Task.js
const taskSchema = new mongoose.Schema({
  chapter_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' },
  page_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Page', default: null },
  assigned_to: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'submitted', 'revision', 'approved'],
    default: 'pending',
  },
  note_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'PageNote' }],
  revision_note: String,
  revision_history: [{
    at: Date,
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    note: String,
    request_revision_count: Number,
  }],
  result_image_url: String,
}, { timestamps: true })

// models/PageNote.js
const pageNoteSchema = new mongoose.Schema({
  page_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Page' },
  chapter_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' },
  task_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null },
  x: Number, y: Number, w: Number, h: Number,   // 0-100 (%)
  text: String,
  taskType: { type: String, enum: ['normal', 'revision'], default: 'normal' },
  status: { type: String, enum: ['open', 'resolved'], default: 'open' },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true })

// models/Submission.js
const submissionSchema = new mongoose.Schema({
  chapter_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' },
  type: { type: String, enum: ['assistant_review', 'te_review', 'eb_review'] },
  status: { type: String, enum: ['pending', 'approved', 'revision', 'forwarded'] },
  te_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  editorial_notes: [{
    page_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Page' },
    x: Number, y: Number, w: Number, h: Number,
    content: String,
    annotation_type: String,
  }],
}, { timestamps: true })
```

### 8.3 Route: requestRevision (revision flow — Luồng B)

```javascript
// routes/submissions.js
router.post('/chapters/:id/request-revision', auth, async (req, res) => {
  const { id } = req.params
  const { revision_note = '', page_notes = [] } = req.body
  const mangakaId = req.user._id

  // 1. Tìm task đang submitted của chapter này
  const task = await Task.findOne({
    chapter_id: id,
    status: 'submitted',
  }).populate('note_ids')

  if (!task) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy task để revision.' })
  }

  // 2. Tạo PageNote mới cho từng trang (taskType = 'revision')
  const createdNoteIds = []
  for (const pageNote of page_notes) {
    const { page_id, notes = [] } = pageNote
    for (const note of notes) {
      const newNote = await PageNote.create({
        page_id,
        chapter_id: id,
        task_id: task._id,
        x: note.x,
        y: note.y,
        w: note.w,
        h: note.h,
        text: note.text || '',
        taskType: 'revision',
        status: 'open',
        created_by: mangakaId,
      })
      createdNoteIds.push(newNote._id)
    }
  }

  // 3. Gắn PageNote vào Task
  task.note_ids = [...(task.note_ids || []), ...createdNoteIds]
  task.revision_note = revision_note
  task.revision_history.push({
    at: new Date(),
    by: mangakaId,
    note: revision_note,
    request_revision_count: task.revision_history.length + 1,
  })
  task.status = 'revision'
  await task.save()

  // 4. Cập nhật Chapter status
  await Chapter.findByIdAndUpdate(id, { status: 'assistant' })

  // 5. Gửi notification cho Assistant
  const notification = await Notification.create({
    user_id: task.assigned_to,
    type: 'task_revision',
    title: 'Có chapter cần sửa lại',
    body: `Chapter đã được Mangaka yêu cầu chỉnh sửa.`,
    data: { chapterId: id, taskId: task._id },
  })
  io.to(`user:${task.assigned_to}`).emit('notification', notification)

  res.json({ success: true, data: { taskId: task._id, noteIds: createdNoteIds } })
})
```

### 8.4 Route: submitChapter (lần đầu — gửi Assistant)

```javascript
// routes/chapters.js
router.patch('/:id', auth, async (req, res) => {
  const { id } = req.params
  const { action, revision_notes = '' } = req.body

  if (action === 'submit') {
    const chapter = await Chapter.findById(id)
    const assistantId = chapter.assistant_id

    if (!assistantId) {
      return res.status(400).json({ success: false, message: 'Chưa gán Assistant.' })
    }

    // Tạo 1 Task = 1 Chapter (theo spec mới)
    const task = await Task.create({
      chapter_id: id,
      assigned_to: assistantId,
      status: 'pending',
    })

    // Lấy PageNotes đã có từ lúc upload → gắn vào Task
    const pages = await Page.find({ chapter_id: id })
    const allNotes = []
    for (const page of pages) {
      const pageNotes = await PageNote.find({ page_id: page._id })
      for (const note of pageNotes) {
        note.task_id = task._id
        await note.save()
        allNotes.push(note._id)
      }
    }
    task.note_ids = allNotes
    task.revision_note = revision_notes
    await task.save()

    chapter.status = 'assistant'
    await chapter.save()

    // Notification
    await Notification.create({
      user_id: assistantId,
      type: 'new_task',
      title: 'Có chapter mới',
      body: `Chapter ${chapter.chapter_number} cần xử lý.`,
      data: { chapterId: id, taskId: task._id },
    })

    return res.json({ success: true, data: { chapterId: id, taskId: task._id } })
  }

  res.status(400).json({ success: false, message: 'Unknown action.' })
})
```

### 8.5 Route: getMyAssignments (lấy task cho Assistant — kèm notes)

```javascript
// routes/tasks.js
router.get('/my-assignments', auth, async (req, res) => {
  const { limit = 100 } = req.query
  const userId = req.user._id

  const tasks = await Task.find({ assigned_to: userId })
    .sort({ createdAt: -1 })
    .limit(Number(limit))
    .populate('note_ids')         // ← Quan trọng: populate notes để FE hiển thị revision
    .populate('chapter_id', 'series_name chapter_number status te_id')

  const result = tasks.map(task => ({
    ...task.toObject(),
    // Ưu tiên ảnh gộp mới nhất (final) > result > original
    chapter: task.chapter_id,
    seriesName: task.chapter_id?.series_name || '',
  }))

  res.json({ success: true, data: result })
})
```

### 8.6 Route: submit-to-te (gửi TE)

```javascript
// routes/submissions.js
router.post('/chapters/:id/submit-to-te', auth, async (req, res) => {
  const { id } = req.params
  const mangakaId = req.user._id

  const chapter = await Chapter.findById(id)
  if (!chapter) return res.status(404).json({ success: false, message: 'Không tìm thấy chapter.' })

  // Lấy pages
  const pages = await Page.find({ chapter_id: id })

  // Tạo Submission cho TE review
  const submission = await Submission.create({
    chapter_id: id,
    type: 'te_review',
    status: 'pending',
    te_id: chapter.te_id,
  })

  // Cập nhật Chapter status
  chapter.status = 'pending_TE'
  await chapter.save()

  // Notification cho TE
  if (chapter.te_id) {
    await Notification.create({
      user_id: chapter.te_id,
      type: 'te_review',
      title: 'Có chapter mới cần review',
      body: `Chapter ${chapter.chapter_number} chờ bạn nhận xét.`,
      data: { chapterId: id, submissionId: submission._id },
    })
  }

  res.json({
    success: true,
    data: { chapterId: id, submissionId: submission._id },
    seriesName: chapter.series_name,
  })
})
```

---

## 9. Hướng dẫn implement FE

### 9.1 LayerEditor — hiển thị ảnh gốc vs ảnh gộp theo task status

Trong `src/components/layer/LayerEditor.jsx`:

```jsx
// Dòng 158 — sửa để ưu tiên ảnh gộp khi revision
const baseImage = useMemo(() => {
  if (task?.status === 'revision') {
    // Ưu tiên: ảnh gộp mới nhất (final) > result > original
    return (
      safePage?.final_image_url
      ?? safePage?.result_image_url
      ?? safePage?.url
      ?? originalImage
      ?? null
    )
  }
  // Lần đầu: dùng ảnh gốc
  return (safePage?.url ?? originalImage ?? null)
}, [task?.status, safePage, originalImage])

// Dòng 60 — đảm bảo taskNotes từ task.noteIds được populate
const taskNotes = task?.noteIds ?? []
```

### 9.2 LayerCanvas — vẽ revision notes overlay

Trong `src/components/layer/LayerCanvas.jsx`:

```jsx
// Nhận prop: notes (từ task.noteIds)
// Khi task.status === 'revision':
//   - Vẽ rectangle tại (x%, y%) với kích thước (w%, h%) trên canvas
//   - Mỗi rectangle có màu nền amber semi-transparent
//   - Click vào rectangle → hiện tooltip với text ghi chú
//   - Scale: x% * canvas.width, y% * canvas.height

// Cần hàm:
function drawRevisionNotesOverlay(ctx, notes, canvasW, canvasH) {
  notes.forEach(note => {
    const x = (note.x / 100) * canvasW
    const y = (note.y / 100) * canvasH
    const w = (note.w / 100) * canvasW
    const h = (note.h / 100) * canvasH

    // Vẽ rectangle
    ctx.fillStyle = 'rgba(251, 191, 36, 0.2)'   // amber 20%
    ctx.fillRect(x, y, w, h)
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.8)'  // amber border
    ctx.lineWidth = 2
    ctx.strokeRect(x, y, w, h)

    // Text label
    if (note.text) {
      ctx.fillStyle = 'rgba(251, 191, 36, 1)'
      ctx.font = 'bold 12px sans-serif'
      const label = note.text.slice(0, 30) + (note.text.length > 30 ? '…' : '')
      ctx.fillText(label, x + 4, y + 16)
    }
  })
}
```

### 9.3 Mangaka — gửi page_notes cùng requestRevision

Trong `src/pages/User/Mangaka/Mangaka.jsx`:

```javascript
// Dòng 915 — sửa handleConfirmChapterRevision
// Để gửi page_notes array thay vì chỉ revision_note text

async function handleConfirmChapterRevision() {
  // Gom page_notes từ annotatorNotes state
  const pageNotesPayload = []
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex]
    if (!page?.id) continue
    const pageKey = `${pendingReview.chapter.id}-${pageIndex}`
    const notes = annotatorNotes[pageKey] ?? []
    if (notes.length > 0) {
      pageNotesPayload.push({
        page_id: page.id,
        notes: notes.map(n => ({
          x: n.x, y: n.y, w: n.w, h: n.h,
          text: n.text ?? '',
          taskType: 'revision',
        })),
      })
    }
  }

  await submissionsService.requestRevision(pendingReview.chapter.id, {
    revision_note: note,
    page_notes: pageNotesPayload,
  })
}
```

### 9.4 submissions.service.js — mở rộng requestRevision

```javascript
// src/api/submissions.service.js
requestRevision(chapterId, noteOrPayload = '') {
  // Hỗ trợ cả 2 cách gọi:
  // 1. requestRevision(chapterId, 'text note') — backward compatible
  // 2. requestRevision(chapterId, { revision_note, page_notes }) — luồng mới
  const payload = typeof noteOrPayload === 'string'
    ? { revision_note: noteOrPayload }
    : noteOrPayload
  return http.post(`/submissions/chapters/${chapterId}/request-revision`, payload).then(unwrap)
},
```

---

## 10. Quick reference — Prompt template

Khi cần implement một luồng mới, chỉ cần prompt BE/FE với cấu trúc:

```
Implement luồng [TÊN LUỒNG] cho role [MANGAKA | ASSISTANT | TE | EB]:
- Bước 1: [Mô tả action]
- Bước 2: [Mô tả API call]
- ...

Tham khảo SPEC.md:
- Luồng A: Mangaka → Assistant → Mangaka → TE → EB
- Luồng B: Revision (Mangaka từ chối → gửi lại Assistant với notes theo từng trang)
- Luồng C: Mangaka → TE → EB (không qua Assistant)
- Data model: Chapter, Page, Task, PageNote, Submission
```

### Các trường hợp dùng nhanh

| Tình huống | Prompt ngắn |
|-----------|------------|
| TE muốn gửi EB | "TE approve: PATCH /submissions/chapters/:id/te-action { action: 'forward_eb' }" |
| TE yêu cầu sửa | "TE revision: Tạo annotation + PATCH status → 'TE_revision'" |
| EB duyệt | "EB approve: Chapter status → 'published'" |
| Mangaka revision | "POST /submissions/chapters/:id/request-revision { revision_note, page_notes }" |
| Assistant submit | "POST /tasks/:id/submit { result_image_url }" |

---

## Change Log

| Ngày | Phiên bản | Thay đổi |
|------|----------|-----------|
| 2026-06-23 | 1.0 | Tạo document — ghi nhận Luồng A (TE), Luồng B (Revision), Luồng C (không Assistant) |
