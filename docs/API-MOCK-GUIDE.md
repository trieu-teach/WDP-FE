# Luồng Gửi Chapter — API Mock Guide cho Frontend

> Cập nhật: 19/06/2026 — theo spec BE mới, Mangaka gửi 1 request `multipart/form-data` duy nhất → BE tự tạo Chapter + Page(s) + Task(s) + PageNote(s).

---

## Mục lục

1. [Tổng quan luồng mới](#1-tổng-quan-luồng-mới)
2. [API Mangaka gửi Chapter (POST /chapters)](#2-api-mangaka-gửi-chapter-post-chapters)
3. [API Assistant nhận việc (GET /tasks/my-assignments)](#3-api-assistant-nhận-việc-get-tasksmy-assignments)
4. [API Assistant xem chi tiết task (GET /tasks/:id)](#4-api-assistant-xem-chi-tiết-task-get-tasksid)
5. [API Mangaka xem Chapter với tasks + notes (GET /chapters/:id)](#5-api-mangaka-xem-chapter-với-tasks--notes-get-chaptersid)
6. [Code mẫu React](#6-code-mẫu-react)
7. [Mapping FE ↔ BE](#7-mapping-fe--be)
8. [Giải thích cấu trúc dữ liệu](#8-giải-thích-cấu-trúc-dữ-liệu)

---

## 1. Tổng quan luồng mới

### Luồng cũ (nhiều bước)

```
Mangaka gọi POST /chapters           → tạo chapter rỗng
Mangaka gọi POST /chapters/:id/pages  → upload ảnh
Mangaka vẽ note → POST /notes         → tạo note rời
Mangaka chọn assistant → POST /tasks   → tạo task riêng
```

### Luồng mới (1 bước)

```
Mangaka gọi POST /chapters (multipart: ảnh + note + region + assigned_to)
    ↓
    BE tự động tạo:
    ├── Chapter
    ├── Page(s) + upload ảnh Cloudinary
    ├── PageNote(s) (note text + tọa độ region)
    └── Task(s) (region + assigned_to)
```

**Assistant chỉ cần gọi `GET /tasks/my-assignments` là nhận đủ ảnh + region + note.**

### Sơ đồ luồng

```
Mangaka                         BE                              Assistant
  │                              │                                  │
  │ POST /chapters               │                                  │
  │ (multipart: ảnh+note+         │                                  │
  │  region+assigned_to)          │                                  │
  │─────────────────────────────>│                                  │
  │                              │ 1. Upload ảnh → Cloudinary       │
  │                              │ 2. Tạo Chapter + Page            │
  │                              │ 3. Tạo PageNote (note+coord)    │
  │                              │ 4. Tạo Task (region+ref note)   │
  │ 201 {chapter,pages,tasks}    │                                  │
  │<─────────────────────────────│                                  │
  │                              │                                  │
  │                              │              GET /tasks/my-assignments
  │                              │            (populate: ảnh+region+note)
  │                              │<──────────────────────────────────────────│
  │                              │              200 [{task đầy đủ}]         │
  │                              │──────────────────────────────────────────>│
  │                              │              → Hiển thị ảnh gốc          │
  │                              │              → Vẽ region overlay (từ %)   │
  │                              │              → Đọc note_ids[].text        │
```

---

## 2. API Mangaka gửi Chapter (POST /chapters)

### Headers

```
Authorization: Bearer <mangaka_token>
Content-Type: multipart/form-data
```

### Body (FormData)

| Field | Type | Required | Description |
|---|---|---|---|
| `series_id` | text | ✅ | ID của series |
| `chapter_number` | text | ✅ | Số chapter (VD: "1") |
| `title` | text | | Tiêu đề chapter |
| `pages` | file[] | ✅ | Ảnh page — mỗi file = 1 page. Gửi nhiều file để tạo nhiều page |
| `pages[<i>].note` | text | | Ghi chú cho page i (VD: "tô shading khuôn mặt") |
| `pages[<i>].work_type` | text | | `background` \| `shading` \| `effects` \| `details` \| `other` |
| `pages[<i>].assigned_to` | text | | User ID của Assistant được giao |
| `pages[<i>].x` | text | | Tọa độ X vùng làm việc (% ảnh, 0–100) |
| `pages[<i>].y` | text | | Tọa độ Y vùng làm việc (% ảnh, 0–100) |
| `pages[<i>].w` | text | | Chiều rộng vùng làm việc (% ảnh, 0–100) |
| `pages[<i>].h` | text | | Chiều cao vùng làm việc (% ảnh, 0–100) |

> `i` = index của page trong mảng files, bắt đầu từ 0. Thứ tự file = thứ tự page.

### Response 201

```json
{
  "success": true,
  "data": {
    "_id": "64f1a2b3c4d5e6f7a8b9c0d2",
    "series_id": "64f1a2b3c4d5e6f7a8b9c0d1",
    "chapter_number": 5,
    "title": "Chương 5 - Cuộc chiến",
    "status": "pending_assistant"
  },
  "pages": [
    {
      "_id": "64f1a2b3c4d5e6f7a8b9c0d3",
      "page_number": 1,
      "original_image_url": "https://res.cloudinary.com/.../page1.png",
      "status": "has_task"
    },
    {
      "_id": "64f1a2b3c4d5e6f7a8b9c0d4",
      "page_number": 2,
      "original_image_url": "https://res.cloudinary.com/.../page2.png",
      "status": "has_task"
    }
  ],
  "tasks": [
    {
      "_id": "64f1a2b3c4d5e6f7a8b9c0d5",
      "page_id": "64f1a2b3c4d5e6f7a8b9c0d3",
      "work_type": "shading",
      "region": { "x": 15, "y": 20, "width": 30, "height": 40 }
    },
    {
      "_id": "64f1a2b3c4d5e6f7a8b9c0d6",
      "page_id": "64f1a2b3c4d5e6f7a8b9c0d4",
      "work_type": "background",
      "region": { "x": 0, "y": 0, "width": 100, "height": 100 }
    }
  ]
}
```

### Giải thích response

| Trường | Ý nghĩa |
|---|---|
| `data` | Chapter vừa tạo |
| `pages` | Mảng Page đã tạo, mỗi page chứa `original_image_url` từ Cloudinary |
| `tasks` | Mảng Task đã tạo, mỗi task chứa `region` (%, tọa độ vùng làm việc) |

---

## 3. API Assistant nhận việc (GET /tasks/my-assignments)

### Headers

```
Authorization: Bearer <assistant_token>
```

### Query params (optional)

| Param | Type | Description |
|---|---|---|
| `status` | string | `pending` \| `in_progress` \| `submitted` \| `approved` \| `revision` |
| `chapter_id` | string | Lọc theo chapter |
| `page` | number | Trang (default: 1) |
| `limit` | number | Items/trang (default: 20) |

### Response 200

```json
{
  "success": true,
  "data": [
    {
      "_id": "64f1a2b3c4d5e6f7a8b9c0d5",
      "status": "pending",
      "work_type": "shading",
      "region": {
        "x": 15,
        "y": 20,
        "width": 30,
        "height": 40
      },
      "description": "Tô shading khuôn mặt nhân vật chính",
      "note_ids": [
        {
          "_id": "64f1a2b3c4d5e6f7a8b9c0d7",
          "text": "Tô shading khuôn mặt nhân vật chính",
          "x": 15,
          "y": 20,
          "w": 30,
          "h": 40,
          "taskType": "shading"
        }
      ],
      "page_id": {
        "_id": "64f1a2b3c4d5e6f7a8b9c0d3",
        "page_number": 1,
        "original_image_url": "https://res.cloudinary.com/.../page1.png"
      },
      "chapter_id": {
        "_id": "64f1a2b3c4d5e6f7a8b9c0d2",
        "chapter_number": 5,
        "title": "Chương 5 - Cuộc chiến",
        "series_id": "64f1a2b3c4d5e6f7a8b9c0d1"
      }
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "limit": 20
  }
}
```

### Giải thích response

| Trường | Ý nghĩa |
|---|---|
| `region` | `%` tọa độ vùng làm việc trên ảnh. Nhân với kích thước thực của ảnh để vẽ overlay. |
| `note_ids` | Mảng PageNote liên kết với task. Mỗi note có `text`, `x`, `y`, `w`, `h` (%). |
| `page_id.original_image_url` | Ảnh gốc để hiển thị cho Assistant |
| `chapter_id` | Thông tin chapter để hiển thị tên series + số chapter |

---

## 4. API Assistant xem chi tiết task (GET /tasks/:id)

### Headers

```
Authorization: Bearer <assistant_token>
```

### Response 200

```json
{
  "success": true,
  "data": {
    "_id": "64f1a2b3c4d5e6f7a8b9c0d5",
    "status": "pending",
    "work_type": "shading",
    "region": { "x": 15, "y": 20, "width": 30, "height": 40 },
    "description": "Tô shading khuôn mặt nhân vật chính",
    "note_ids": [
      {
        "_id": "64f1a2b3c4d5e6f7a8b9c0d7",
        "text": "Tô shading khuôn mặt nhân vật chính",
        "x": 15, "y": 20, "w": 30, "h": 40,
        "taskType": "shading",
        "status": "used_in_task",
        "createdAt": "2026-06-19T..."
      }
    ],
    "page_id": {
      "_id": "64f1a2b3c4d5e6f7a8b9c0d3",
      "page_number": 1,
      "original_image_url": "https://res.cloudinary.com/...",
      "result_image_url": ""
    },
    "chapter_id": {
      "_id": "...",
      "chapter_number": 5,
      "title": "Chương 5 - Cuộc chiến"
    },
    "assigned_by": {
      "username": "mangaka_hello",
      "full_name": "Mangaka Hello"
    },
    "assigned_to": {
      "username": "assistant_001",
      "full_name": "Assistant One"
    }
  }
}
```

---

## 5. API Mangaka xem Chapter với tasks + notes (GET /chapters/:id)

### Headers

```
Authorization: Bearer <token> (Mangaka hoặc Assistant)
```

### Response 200

```json
{
  "success": true,
  "data": {
    "_id": "64f1a2b3c4d5e6f7a8b9c0d2",
    "chapter_number": 5,
    "title": "Chương 5 - Cuộc chiến",
    "status": "pending_assistant",
    "pages": [
      {
        "_id": "64f1a2b3c4d5e6f7a8b9c0d3",
        "page_number": 1,
        "original_image_url": "https://res.cloudinary.com/...",
        "status": "has_task",
        "tasks": [
          {
            "_id": "64f1a2b3c4d5e6f7a8b9c0d5",
            "work_type": "shading",
            "region": { "x": 15, "y": 20, "width": 30, "height": 40 },
            "status": "pending",
            "assigned_to": { "username": "assistant_001" },
            "note_ids": [
              {
                "_id": "64f1a2b3c4d5e6f7a8b9c0d7",
                "text": "Tô shading khuôn mặt nhân vật chính",
                "x": 15, "y": 20, "w": 30, "h": 40
              }
            ]
          }
        ]
      }
    ]
  },
  "seriesName": "Series A"
}
```

---

## 6. Code mẫu React

### 6.1 Mangaka gửi Chapter (React + Axios)

```javascript
// MangakaWorkspace.jsx
const formData = new FormData();
formData.append("series_id", "64f1a2b3c4d5e6f7a8b9c0d1");
formData.append("chapter_number", "5");
formData.append("title", "Chương 5 - Cuộc chiến");

// Page 1: có note + region + assigned
formData.append("pages", fileObjectPage1);   // File object
formData.append("pages[0].note", "Tô shading khuôn mặt nhân vật chính");
formData.append("pages[0].work_type", "shading");
formData.append("pages[0].assigned_to", "64f1a2b3c4d5e6f7a8b9c0e5");
formData.append("pages[0].x", "15");
formData.append("pages[0].y", "20");
formData.append("pages[0].w", "30");
formData.append("pages[0].h", "40");

// Page 2: không có note, background toàn ảnh
formData.append("pages", fileObjectPage2);
formData.append("pages[1].work_type", "background");
formData.append("pages[1].x", "0");
formData.append("pages[1].y", "0");
formData.append("pages[1].w", "100");
formData.append("pages[1].h", "100");

const res = await axios.post("/chapters", formData, {
  headers: {
    Authorization: `Bearer ${token}`,
    // KHÔNG set Content-Type — browser tự set multipart/form-data + boundary
  },
});

// res.data.data  → chapter object
// res.data.pages → [{_id, original_image_url, ...}]
// res.data.tasks → [{_id, region, ...}]
```

### 6.2 Assistant nhận việc

```javascript
// useAssistantAssignments.js
const res = await tasksService.getMyAssignments({ limit: 100 });

// Mỗi task chứa đầy đủ thông tin:
res.items.forEach(task => {
  // Ảnh gốc để hiển thị
  const imgUrl = task.page_id.original_image_url;

  // Vẽ vùng làm việc overlay
  const { x, y, width, height } = task.region;  // đây là % (0–100)

  // Nếu ảnh thực tế là 1920×1080:
  const pxX = img.naturalWidth * (x / 100);
  const pxY = img.naturalHeight * (y / 100);
  const pxW = img.naturalWidth * (width / 100);
  const pxH = img.naturalHeight * (height / 100);

  // Hiển thị note
  task.note_ids.forEach(note => {
    console.log(`Note: ${note.text} at (${note.x}%, ${note.y}%)`);
  });
});
```

---

## 7. Mapping FE ↔ BE

### 7.1 Mangaka gửi — FE → BE

| FE (FormData) | BE nhận | Ghi chú |
|---|---|---|
| `pages` (file) | `pages` | File ảnh page |
| `pages[i].note` | `pages[i].note` | Text ghi chú |
| `pages[i].work_type` | `pages[i].work_type` | `background\|shading\|effects\|details\|other` |
| `pages[i].assigned_to` | `pages[i].assigned_to` | ObjectId string |
| `pages[i].x` | `pages[i].x` | % ảnh, 0–100 |
| `pages[i].y` | `pages[i].y` | % ảnh, 0–100 |
| `pages[i].w` | `pages[i].w` | % ảnh, 0–100 |
| `pages[i].h` | `pages[i].h` | % ảnh, 0–100 |

### 7.2 Assistant nhận — BE → FE UI

| BE response | FE nhận | Ghi chú |
|---|---|---|
| `region.x` | px = imgWidth × region.x / 100 | Tọa độ X pixel |
| `region.y` | px = imgHeight × region.y / 100 | Tọa độ Y pixel |
| `region.width` | px = imgWidth × region.width / 100 | Chiều rộng pixel |
| `region.height` | px = imgHeight × region.height / 100 | Chiều cao pixel |
| `note_ids[].text` | Hiển thị tooltip/label | Ghi chú cho Assistant |
| `note_ids[].x/w/h/y` | Vẽ bounding box overlay | % → pixel tương tự region |
| `page_id.original_image_url` | `<img src>` | Ảnh gốc từ Cloudinary |

### 7.3 Mapper functions cần cập nhật

| File | Hàm | Cần thay đổi |
|---|---|---|
| `chapters.service.js` | `create()` | Thêm `uploadChapterPages()` mới với FormData |
| `apiMappers.js` | `apiTaskToUi()` | Thêm `noteIds`, `region` từ response |
| `useAssistantAssignments.js` | `loadPageDetail()` | Nhận `note_ids` từ task thay vì gọi riêng |

---

## 8. Giải thích cấu trúc dữ liệu

### 8.1 Region (tọa độ vùng làm việc)

Region luôn là **% (0–100)** của ảnh gốc. Để vẽ overlay hoặc bounding box:

```javascript
// Chuyển % → pixel
function regionToPixels(region, imgWidth, imgHeight) {
  return {
    x: Math.round(imgWidth * (region.x / 100)),
    y: Math.round(imgHeight * (region.y / 100)),
    width: Math.round(imgWidth * (region.width / 100)),
    height: Math.round(imgHeight * (region.height / 100)),
  }
}
```

### 8.2 Note (ghi chú cho Assistant)

Mỗi PageNote chứa:
- `text`: nội dung ghi chú
- `x, y, w, h`: tọa độ bounding box (% ảnh)
- `taskType`: loại công việc (`background`, `shading`, `effects`, `details`, `other`)
- `status`: `open` | `used_in_task` | `resolved`

**FE nên dùng `note_ids` từ task response thay vì gọi riêng `GET /pages/:id/notes`** vì:
1. Giảm số API call (1 thay vì 2)
2. `note_ids` đã được BE populate đầy đủ thông tin
3. Đảm bảo note gắn đúng với task

### 8.3 Work types

| work_type | Tiếng Việt | Mô tả |
|---|---|---|
| `background` | Background | Vẽ phông, cảnh nền |
| `shading` | Shading | Tô bóng, tạo chiều sâu |
| `effects` / `fx` | Effects | Hiệu ứng, ánh sáng, wind |
| `details` | Details | Chi tiết nhỏ, đường nét |
| `other` | Khác | Công việc không xác định |

---

## 9. Checklist triển khai FE

- [ ] `chapters.service.js`: thêm `uploadChapterWithPages()` nhận FormData
- [ ] `apiMappers.js`: cập nhật `apiTaskToUi()` đọc `note_ids` từ task
- [ ] `useAssistantAssignments.js`: dùng `task.note_ids` thay vì gọi `getPageNotes()` riêng
- [ ] `LayerEditor.jsx`: vẽ region overlay từ `task.region` (%)
- [ ] `LayerCanvas.jsx` (hoặc wrapper): hiển thị note bounding boxes từ `note_ids`
- [ ] `Mangaka.jsx` (`handleSendToAssistant`): gọi `POST /chapters` mới 1 bước thay vì nhiều bước
