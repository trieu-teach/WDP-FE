# Backend API Requirements — Admin Panel

## 1. Tổng quan

Admin panel chỉ quản lý content (truyện, chương), không can thiệp user.

**Pages cần:**
- Dashboard
- Manga (quản lý bộ truyện)
- Chapters (quản lý chương)
- Users (quản lý tài khoản)
- Profile (hồ sơ admin)

---

## 2. Dashboard — `/dashboard`

**API:** `GET /dashboard`

**Response cần:**

```json
{
  "stats": {
    "totalViews": 125000,
    "totalReads": 89000,
    "totalUsers": 340,
    "totalComments": 1200
  },
  "viewsPerDay": [
    { "date": "2026-06-09", "views": 1200 },
    { "date": "2026-06-10", "views": 1450 }
  ],
  "topManga": [
    { "id": 1, "title": "One Piece", "views": 25000, "thumbnail": "..." }
  ],
  "recentActivity": [
    { "id": 1, "type": "comment", "message": "User abc bình luận", "time": "2026-06-15T10:00:00Z" }
  ]
}
```

---

## 3. Manga — `/manga`

### 3.1. Danh sách — `GET /manga`

**Query:** `q`, `status`, `page`, `limit`

**Response:**

```json
{
  "data": [
    {
      "id": 1,
      "title": "One Piece",
      "author": "Eiichiro Oda",
      "status": "publishing",
      "thumbnail": "https://...",
      "views": 25000,
      "createdAt": "2026-01-01T00:00:00Z"
    }
  ],
  "total": 50,
  "page": 1,
  "limit": 20
}
```

### 3.2. Tạo — `POST /manga`

**Body:**

```json
{
  "title": "string (required)",
  "author": "string",
  "description": "string",
  "thumbnail": "string (URL)"
}
```

### 3.3. Cập nhật — `PUT /manga/:id`

**Body:** tất cả trường optional

### 3.4. Xóa — `DELETE /manga/:id`

**Response:** `204 No Content`

### 3.5. Chi tiết — `GET /manga/:id`

```json
{
  "id": 1,
  "title": "One Piece",
  "author": "Eiichiro Oda",
  "description": "...",
  "thumbnail": "https://...",
  "status": "publishing",
  "views": 25000,
  "createdAt": "2026-01-01T00:00:00Z",
  "chapters": [
    { "id": 1, "number": 1, "title": "Romance Dawn", "createdAt": "2026-01-01T00:00:00Z" }
  ]
}
```

---

## 4. Chapters — `/chapters`

### 4.1. Theo manga — `GET /manga/:mangaId/chapters`

**Query:** `page`, `limit`

**Response:**

```json
{
  "data": [
    {
      "id": 1,
      "number": 1,
      "title": "Romance Dawn",
      "pages": 45,
      "createdBy": { "id": 1, "name": "Admin" },
      "createdAt": "2026-01-01T00:00:00Z"
    }
  ],
  "total": 10
}
```

### 4.2. Tạo — `POST /chapters`

**Body:**

```json
{
  "mangaId": 1,
  "number": 2,
  "title": "Chapter 2",
  "pages": [
    { "url": "https://..." }
  ]
}
```

### 4.3. Xóa — `DELETE /chapters/:id`

**Response:** `204 No Content`

---

## 5. Users — `/users`

### 5.1. Danh sách — `GET /users`

**Query:** `q`, `page`, `limit`

**Response:**

```json
{
  "data": [
    {
      "id": 1,
      "name": "Nguyen Van A",
      "email": "user@example.com",
      "role": "user",
      "status": "active",
      "createdAt": "2026-01-01T00:00:00Z"
    }
  ],
  "total": 50
}
```

### 5.2. Chi tiết — `GET /users/:id`

**Response:**

```json
{
  "id": 1,
  "name": "Nguyen Van A",
  "email": "user@example.com",
  "role": "user",
  "status": "active",
  "createdAt": "2026-01-01T00:00:00Z"
}
```

### 5.3. Cập nhật status — `PUT /users/:id/status`

**Body:**

```json
{
  "status": "active" | "banned"
}
```

**Response:** trả về user đã update

---

## 6. Profile — `/profile`

### 6.1. Lấy — `GET /profile`

**Response:**

```json
{
  "id": 1,
  "name": "Admin",
  "email": "admin@example.com",
  "role": "admin",
  "status": "active",
  "initials": "AD",
  "createdAt": "2026-01-01T00:00:00Z"
}
```

### 6.2. Cập nhật — `PUT /profile`

**Body:**

```json
{
  "name": "Admin Mới"
}
```

**Response:** trả về user đã update

---

## 7. Danh sách API cần triển khai

| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/dashboard` | Dashboard stats |
| GET | `/manga` | Danh sách manga |
| POST | `/manga` | Tạo manga |
| PUT | `/manga/:id` | Cập nhật manga |
| DELETE | `/manga/:id` | Xóa manga |
| GET | `/manga/:id` | Chi tiết manga |
| GET | `/manga/:mangaId/chapters` | Chapters theo manga |
| POST | `/chapters` | Tạo chapter |
| DELETE | `/chapters/:id` | Xóa chapter |
| GET | `/users` | Danh sách users |
| GET | `/users/:id` | Chi tiết user |
| PUT | `/users/:id/status` | Khóa/mở tài khoản |
| GET | `/profile` | Profile admin |
| PUT | `/profile` | Cập nhật profile |
