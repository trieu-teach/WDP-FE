# Business Rules — Admin

> Tài liệu mô tả các quy tắc nghiệp vụ cốt lõi của vai trò **Admin** trong hệ thống manga-wdp.
> Đối chiếu với mã nguồn thực tế tại:
> - `src/pages/Admin/Dashboard/Dashboard.jsx` (tổng quan hệ thống)
> - `src/pages/Admin/Users/Users.jsx` (quản lý user)
> - `src/pages/Admin/Manga/Manga.jsx` (quản lý series)
> - `src/pages/Admin/Chapters/Chapters.jsx` (quản lý chapter)
> - `src/pages/Admin/EbRepresentative/EbRepresentative.jsx` (chỉ định đại diện EB)
> - `src/pages/Admin/Rankings/Rankings.jsx` (xếp hạng)
> - `src/pages/Admin/PublicationCalendar/PublicationCalendar.jsx` (lịch phát hành)
> - `src/pages/Admin/Profile/Profile.jsx` (profile admin)
> - `src/api/index.js`, `src/api/*.service.js` (API client)

---

## 1. Vai trò & phạm vi

| Thuộc tính | Giá trị |
|---|---|
| Tên tiếng Việt | Quản trị viên / Admin |
| Ký hiệu vai trò | `Admin` |
| Đường dẫn | `/admin/*` (Dashboard, Users, Manga, Chapters, EB Representative, Rankings, Publication Calendar, Profile) |
| Nhiệm vụ chính | Quản lý toàn hệ thống: user, series, chapter, role, xếp hạng, lịch phát hành, chỉ định EB representative |

Admin có **full quyền** trong toàn hệ thống, bao gồm cả các thao tác mà Editor/Mangaka/Tantou/EB không có.

---

## 2. Các trang quản lý

| Trang | Path | Chức năng chính |
|---|---|---|
| Dashboard | `/admin/dashboard` | Tổng quan: stats, charts, role/genres distribution, recent activities, top rankings |
| Users | `/admin/users` | CRUD user + đổi role + khoá/mở tài khoản |
| Manga | `/admin/manga` | CRUD series + soft delete + đổi publication_status |
| Chapters | `/admin/chapters` | Quản lý chapter toàn hệ thống (filter theo series) |
| EB Representative | `/admin/eb-representative` | Chỉ định 1 user duy nhất làm đại diện EB |
| Rankings | `/admin/rankings` | Xếp hạng series theo views/votes/rating, lọc theo period |
| Publication Calendar | `/admin/publication-calendar` | Lịch phát hành toàn hệ thống (calendar/list view) |
| Profile | `/admin/profile` | Profile admin |

---

## 3. Hằng số & Vai trò

### 3.1. Danh sách role

Từ `Users.jsx`:

```js
const ROLE_OPTIONS = ['Admin', 'Mangaka', 'Assistant', 'Editor', 'EB', 'Reader']
```

| Role | Ý nghĩa |
|---|---|
| `Admin` | Quản trị viên (full quyền) |
| `Mangaka` | Tác giả truyện |
| `Assistant` | Trợ lý (hỗ trợ Mangaka) |
| `Editor` | Biên tập viên |
| `EB` | Editor Board (Hội đồng biên tập) |
| `Reader` | Người đọc (mặc định khi tạo user) |

> **Lưu ý**: Khi đổi role của chính Admin hiện tại → có thể gây mất quyền truy cập. Thường BE có rule chặn đổi role của Admin cuối cùng.

### 3.2. Dashboard stats API

Từ `Dashboard.jsx`:

```js
Promise.all([
  api.getDashboard(),
  api.getRecentActivities(1, 50),
  api.getRoles(),
  api.getGenresStats(),
  api.getStats(),
  api.getRankingsList({ type: 'views', period: 'weekly', limit: 5 }),
])
```

| API | Mục đích |
|---|---|
| `getDashboard()` | Stats tổng quan |
| `getRecentActivities(page, limit)` | Activity feed |
| `getRoles()` | Phân bố vai trò |
| `getGenresStats()` | Phân bố thể loại |
| `getStats()` | System stats (users/chapters theo status) |
| `getRankingsList(...)` | Top 5 rankings tuần |

---

## 4. Quản lý User (`Users.jsx`)

### 4.1. CRUD User

| API | Endpoint | Mục đích |
|---|---|---|
| `GET /admin/users-legacy` | list users + filter | |
| `POST /admin/users-legacy` | tạo user mới | (xem dialog `CreateUserDialog`) |
| `GET /admin/users-legacy/:id` | chi tiết user | |
| `PATCH /admin/users-legacy/:id` | update full_name, email | |
| `POST /admin/users-legacy/:id/role` | đổi role | |
| `DELETE /admin/users-legacy/:id` | xoá user | có confirm |
| `POST /admin/users-legacy/:id/lock` | khoá tài khoản | |
| `POST /admin/users-legacy/:id/unlock` | mở khoá | |

### 4.2. Form tạo user

```js
{
  username: '',      // required
  password: '',      // required
  full_name: '',     // required
  email: '',         // required, type email
  role: 'Reader',    // default Reader
}
```

### 4.3. Update flow

```js
async function handleSave() {
  // 1. Update basic info (full_name, email)
  await api.updateUser(userId, { full_name, email })

  // 2. Chỉ gọi API đổi role khi role thực sự thay đổi
  if (form.role && form.role !== detail?.role) {
    await api.changeUserRole(userId, form.role)
  }
}
```

### 4.4. Filter & Search

- Tìm theo **tên** hoặc **email**.
- Lọc theo **role**.
- Phân trang (page/limit) với nút điều hướng.

### 4.5. Lock/Unlock

| Action | Icon | Toast |
|---|---|---|
| Lock | `Ban` | Tạm khoá tài khoản |
| Unlock | `CheckCircle` | Mở khoá tài khoản |
| View detail | `Eye` | Mở dialog quản lý |
| Delete | `Trash2` | Có confirm + reload |

### 4.6. Stats API

`GET /admin/stats` trả:

```js
{
  users: { total: Number, byRole: Array<{ name, pct, color }> },
  chapters: { total: Number, byStatus: Array<{ _id, count }> }
}
```

→ Dùng cho Dashboard và Users page header.

---

## 5. Quản lý Series (`Manga.jsx`)

### 5.1. Workflow duyệt nội bộ (Series.status vs publication_status)

Hệ thống có **2 loại status** trên 1 series, phân biệt rõ ràng:

| Trường | Mục đích | Values | UI |
|---|---|---|---|
| `status` | Workflow duyệt nội bộ giữa Editor → Tantou → EB | `draft`, `submitted`, `approved`, `rejected`, `published`, `cancelled` | `STATUS_CONFIG` (Admin view) |
| `publication_status` | Trạng thái hiển thị cho reader | `upcoming`, `ongoing`, `hiatus`, `completed`, `dropped` | `PUBLICATION_STATUS_CONFIG` |

**Khác nhau**:
- `status = 'published'` mới là "đã xuất bản" (chỉ khi EB confirm-publish xong)
- `publication_status = 'ongoing'` nghĩa là "đang trong quá trình phát hành cho độc giả"
- Một series có thể ở `status = 'published'` nhưng `publication_status = 'hiatus'` (tạm ngưng đọc)

### 5.2. Status config (workflow nội bộ)

| Status | Label | Color |
|---|---|---|
| `draft` | Nháp | slate |
| `submitted` | Đã gửi | amber |
| `approved` | Đã duyệt | emerald |
| `rejected` | Từ chối | rose |
| `published` | Đã xuất bản | primary (in đậm) |
| `cancelled` | Đã huỷ | gray |

### 5.3. Publication status config

| Status | Label | Color |
|---|---|---|
| `upcoming` | Sắp ra | slate |
| `ongoing` | Đang phát hành | green |
| `hiatus` | Tạm ngưng | amber |
| `completed` | Hoàn thành | blue |
| `dropped` | Đã huỷ | red |

### 5.4. Filter & Search

```js
SERIES_STATUS_VALUES = ['draft', 'submitted', 'approved', 'rejected', 'published', 'cancelled']
const PUB_STATUS_NONE = '__none__'  // sentinel rỗng
```

Filter hỗ trợ:
- Theo `status` (workflow)
- Theo `publication_status`
- Search theo tên
- Phân trang (page/limit)
- View mode: Grid / List

### 5.5. CRUD Operations

| Action | Endpoint | Note |
|---|---|---|
| List | `GET /admin/manga` | Filter + pagination |
| Detail | `GET /admin/manga/:id` | |
| Create | `POST /admin/manga` | Qua MangaEditDialog |
| Edit | `PATCH /admin/manga/:id` | Qua MangaEditDialog |
| Soft delete | `DELETE /admin/manga/:id` | `isDeleted = true` |
| Force delete | (force variant) | Chỉ khi `!isDeleted` |
| Đổi publication_status quick action | `PATCH ...` | 6 options: upcoming/ongoing/hiatus/completed/dropped/reset |

### 5.6. `canForceDeleteManga`

```js
function canForceDeleteManga(manga) {
  return Boolean(manga && !manga.isDeleted)
}
```

→ Chỉ manga chưa bị ẩn mới force delete được (sau khi đã restore hoặc chưa từng xoá).

### 5.7. Publication Quick Actions

```js
const PUBLICATION_QUICK_ACTIONS = [
  { value: 'upcoming', label: 'Sắp ra' },
  { value: 'ongoing', label: 'Đang phát hành' },
  { value: 'hiatus', label: 'Tạm ngưng' },
  { value: 'completed', label: 'Hoàn thành' },
  { value: 'dropped', label: 'Đã huỷ' },
  { value: '__none__', label: 'Đặt lại' },  // reset publication_status
]
```

→ "Đặt lại" = set `publication_status = null` (xoá publication_status).

### 5.8. MangaEditDialog

- Component chung dùng cho cả Admin/Manga và Admin/Chapters.
- Form: title, author_id, description, synopsis, genre, tags, cover_url, status, publication_status, publication_schedule, age_rating, category.
- Validate required fields → toast lỗi.

---

## 6. Quản lý Chapter (`Chapters.jsx`)

### 6.1. 7 trạng thái chapter

```js
const CHAPTER_STATUSES = [
  'draft',
  'pending_assistant',  // chờ Assistant review
  'pending_TE',         // chờ Tantou review
  'TE_revision',        // Mangaka đang sửa theo Tantou
  'pending_EB',         // chờ EB review
  'EB_revision',        // đang sửa theo EB
  'published',          // đã xuất bản
]
```

### 6.2. Status config

| Status | Label | Color | Viền |
|---|---|---|---|
| `draft` | Nháp | slate | slate |
| `pending_assistant` | Chờ Assistant | amber | amber |
| `pending_TE` | Chờ Tantou | orange | orange |
| `TE_revision` | TE sửa | blue | blue |
| `pending_EB` | Chờ EB | purple | purple |
| `EB_revision` | EB sửa | violet | violet |
| `published` | Đã xuất bản | emerald | emerald |

### 6.3. Workflow End-to-End

```
draft → Mangaka submit → pending_assistant
  → Assistant duyệt → pending_TE
    → Tantou duyệt → pending_EB (forwarded EB)
      → EB chấm → approved by EB
        → EB confirm-publish → published
```

**revision loop**:
- `pending_assistant` → reject → trở về `draft` (Mangaka sửa lại)
- `pending_TE` → Tantou reject → `TE_revision` → Mangaka sửa → lại `pending_TE`
- `pending_EB` → EB reject → `EB_revision` → Mangaka sửa → lại `pending_EB`

> ⚠️ `TE_revision` / `EB_revision` là **status trung gian** — chapter đang ở tay Mangaka để chỉnh sửa.

### 6.4. Filter theo Series

- Chapters page có **search series** trên header → chọn series → list chapters của series đó.
- URL params (`?series=...`) → tự động filter.

### 6.5. Chapter detail dialog

- Form: title, chapter_number, status, pages[], scheduled_publish_at.
- Có thể edit via MangaEditDialog (chuẩn bị hoặc override).

### 6.6. Chapter page structure

Mỗi chapter có:
- `pages[]` (mảng image_url hoặc object)
- `chapter_number` (số chapter)
- `status` (1 trong 7 ở trên)
- `scheduled_publish_at` (nếu đã lên lịch)
- `submitted_by` (user id của người submit)
- `submitted_at` (timestamp)
- `published_at` (timestamp sau publish)

---

## 7. EB Representative (`EbRepresentative.jsx`)

### 7.1. Quy tắc duy nhất

Hệ thống cho phép **CHỈ 1 user duy nhất** có `is_eb_representative = true` tại 1 thời điểm.

### 7.2. API

| Method | Endpoint | Mục đích |
|---|---|---|
| `GET /admin/eb-candidates` | List user có role EB | (đánh dấu `is_eb_representative`) |
| `POST /admin/eb-representative/:userId` | Chỉ định user | (BE tự gỡ flag user cũ) |
| `DELETE /admin/eb-representative` | Bỏ chỉ định | (clear flag) |

### 7.3. Flow

```
[Trang EB Representative]
  → Load candidates từ API
    → Tìm user có is_eb_representative=true → "Đại diện hiện tại"
      → Admin chọn user khác trong bảng
        → handleSetRepresentative(userId)
          → POST .../eb-representative/:userId
            → Reload candidates (user mới có flag, user cũ mất flag)
      → Admin bấm "Bỏ chỉ định"
        → Dialog confirm
          → handleClear()
            → DELETE /admin/eb-representative
              → Reload (tất cả flag = false)
```

### 7.4. Quy tắc nghiệp vụ

| Tình huống | Hành vi |
|---|---|
| Chapter **không có đại diện** | Roster mặc định (`EB_COUNCIL_MEMBERS` 5 người) vẫn dùng được nhưng **không thể lưu điểm HĐ** lên BE |
| Có đại diện | Đại diện được phép nhập điểm cho cả HĐ |
| Cờ `enteredBy` (audit trail) | = ID đại diện đã nhập |
| Đổi đại diện | BE tự động gỡ flag user cũ |
| Bỏ chỉ định | Clear flag, không ảnh hưởng user khác |

### 7.5. UI states

| State | Hiển thị |
|---|---|
| Loading | Spinner toàn trang |
| Có đại diện | Card "Đại diện hiện tại" + nút Bỏ chỉ định |
| Không có đại diện | Card "Chưa có đại diện EB nào được chỉ định" |
| Đang cập nhật (user X) | Disable nút user X + spinner |
| Dialog xác nhận bỏ | Hiện hỏi "Bỏ chỉ định đại diện hiện tại?" |

---

## 8. Rankings (`Rankings.jsx`)

### 8.1. 3 loại xếp hạng

| Type | Ý nghĩa | Số liệu chính |
|---|---|---|
| `views` | Lượt đọc | `views_today`, `views_weekly`, `views_monthly`, `views_count` |
| `votes` | Bình chọn | `votes_today`, `votes_weekly`, `votes_monthly`, `votes_count` |
| `rating` | Điểm đánh giá | `average_score`, `total_votes` (default combo = avg × votes) |

### 8.2. 4 period

| Period | Trường dữ liệu |
|---|---|
| `daily` | hôm nay |
| `weekly` | tuần này (default) |
| `monthly` | tháng này |
| `all` | tổng tất cả |

### 8.3. Quy tắc `getValue` cho chart

```js
const getValue = (item) => {
  if (type === 'views') {
    if (period === 'all') return item.views_count ?? 0
    if (period === 'daily') return item.views_today ?? 0
    if (period === 'weekly') return item.views_weekly ?? 0
    if (period === 'monthly') return item.views_monthly ?? 0
    return item.views_today ?? 0  // fallback
  }
  if (type === 'votes') {
    // tương tự với votes_* fields
  }
  // rating
  return (item.average_score ?? 0) * (item.total_votes ?? 1)
}
```

### 8.4. Columns theo period (bảng)

```js
function getColumnsByPeriod(type, period) {
  const baseCols = [
    { key: 'rank', label: '#', className: 'w-12 text-center font-bold' },
    // ... series info (title, cover, author, score, votes)
  ]

  if (type === 'views') {
    if (period === 'daily')   return [...baseCols, { key: 'views_today', label: 'Views hôm nay' }]
    if (period === 'weekly')  return [...baseCols, { key: 'views_weekly', label: 'Views tuần' }]
    if (period === 'monthly') return [...baseCols, { key: 'views_monthly', label: 'Views tháng' }]
    return [...baseCols, { key: 'views_count', label: 'Tổng views' }]
  }

  if (type === 'votes') {
    // tương tự
  }

  return [
    ...baseCols,
    { key: 'average_score', label: 'Điểm TB' },
    { key: 'total_votes', label: 'Tổng votes' },
  ]
}
```

### 8.5. Filter & Pagination

| State | Default | Reset to page 1 khi đổi |
|---|---|---|
| `type` | `'views'` | ✓ |
| `period` | `'weekly'` | ✓ |
| `limit` | `'100'` | – |
| `page` | `1` | – (auto reset về 1) |
| `search` | `''` | ✓ |

```js
useEffect(() => { setPage(1) }, [search, type, period])
```

`ITEMS_PER_PAGE = 10` (UI, không phải API).

### 8.6. Top 10 Chart

- Hiển thị top 10 series.
- Label: `Top 10 - {views|votes|rating} {month|week|today}`.
- Color: gradient theo rank.

---

## 9. Publication Calendar (`PublicationCalendar.jsx`)

### 9.1. Default range

```js
from = today - 30 days  // 30 ngày trước
to   = today + 90 days  // 90 ngày tới
```

(so với `getPublicationCalendarDefaultRange`)

### 9.2. Hiển thị

Có 2 loại event:
- **ChapterRow** — chapter cụ thể (`scheduledPublishAt` hoặc `publishedAt`)
  - Màu emerald nếu đã publish
  - Hiển thị: chapter number, title, series name, TE, time
- **SeriesLaunchRow** — sự kiện ra mắt series
  - Tên series + chu kỳ phát hành (publication_schedule)

### 9.3. Filter

- Publication schedule: `weekly` / `monthly`
- View mode: calendar / list
- Include overdue: `true` / `false`
- Phạm vi: từ ngày → đến ngày

### 9.4. Map response

```js
const data = mapAdminPublicationCalendarResponse(body)
// → { days: [{ date, events: [...] }], groups: [...] }
```

→ Dùng chung helper với EB.

---

## 10. Profile (`Profile.jsx`)

### 10.1. CRUD Profile admin

| Action | Method | Endpoint |
|---|---|---|
| Xem profile | `GET /admin/me` | (hoặc `/users/me`) |
| Update avatar | `POST /admin/profile/avatar` | multipart |
| Update info | `PATCH /admin/profile` | |

### 10.2. Stats cá nhân

- Tổng series đã manage
- Tổng chapter đã review
- Hoạt động gần đây

---

## 11. Dashboard — Charts & Layout

### 11.1. Các card chính

1. **StatCards** — 4 ô tổng quan (total series, chapters, users, ratings)
2. **RoleDistributionChart** (BarChart ngang) — Phân bố role
3. **GenreDistributionChart** (BarChart ngang) — Phân bố thể loại
4. **ChapterStatusChart** (PieChart) — Trạng thái chapter
5. **TopRankingsWidget** — Top 5 series (theo views/votes/rating)
6. **RecentActivitiesWidget** — Activity feed

### 11.2. Role data shape

```js
{
  name: 'Admin',     // role
  pct: 5,            // phần trăm
  color: '#8b5cf6',
}

// Tính count:
const count = r.pct ? Math.round((r.pct / 100) * totalUsers) : 0
```

### 11.3. Genre data shape

```js
{
  name: 'Hành động',
  fullName: 'Hành động',
  count: 45,
  color: '#8b5cf6',
}
```

### 11.4. Chapter status chart

```js
const byStatus = chapterStats.byStatus ?? []
// Map:
//   published → "Đã duyệt" (green)
//   pending   → "Chờ duyệt" (amber)
//   draft     → "Bản nháp" (slate)
//   default   → "Khác" (red)
```

### 11.5. Recent Activities

```js
api.getRecentActivities(page=1, limit=50)
// → { activities: [...] }
```

Hiển thị: avatar, tên user, action, timestamp, target.

---

## 12. API endpoints tổng hợp (Admin)

| Method | Endpoint | Mục đích |
|---|---|---|
| `GET` | `/admin/dashboard` | Dashboard stats |
| `GET` | `/admin/recent-activities` | Activity feed |
| `GET` | `/admin/roles` | Phân bố role |
| `GET` | `/admin/genres-stats` | Phân bố thể loại |
| `GET` | `/admin/stats` | System stats (users/chapters) |
| `GET` | `/admin/rankings` | Rankings với filter |
| `GET` | `/admin/users-legacy` | List users |
| `POST` | `/admin/users-legacy` | Tạo user |
| `GET` | `/admin/users-legacy/:id` | User detail |
| `PATCH` | `/admin/users-legacy/:id` | Update user info |
| `POST` | `/admin/users-legacy/:id/role` | Đổi role |
| `DELETE` | `/admin/users-legacy/:id` | Xoá user |
| `POST` | `/admin/users-legacy/:id/lock` | Khoá |
| `POST` | `/admin/users-legacy/:id/unlock` | Mở khoá |
| `GET` | `/admin/manga` | List manga |
| `GET` | `/admin/manga/:id` | Manga detail |
| `POST` | `/admin/manga` | Tạo manga |
| `PATCH` | `/admin/manga/:id` | Update manga |
| `DELETE` | `/admin/manga/:id` | Soft delete |
| `POST` | `/admin/manga/:id/restore` | Restore |
| `GET` | `/admin/chapters` | List chapter (filter by series) |
| `PATCH` | `/admin/chapters/:id` | Update chapter |
| `DELETE` | `/admin/chapters/:id` | Delete chapter |
| `GET` | `/admin/eb-candidates` | List EB users |
| `POST` | `/admin/eb-representative/:userId` | Chỉ định |
| `DELETE` | `/admin/eb-representative` | Bỏ chỉ định |
| `GET` | `/admin/profile` | Admin profile |
| `PATCH` | `/admin/profile` | Update profile |
| `POST` | `/admin/profile/avatar` | Update avatar |

---

## 13. Workflow & Quy tắc chung

### 13.1. Confirm trước khi xoá

```js
async function handleDelete() {
  if (!confirm('Xoá người dùng này? Hành động không thể hoàn tác.')) return
  // ...
}
```

→ Mọi action xoá đều có confirm dialog hoặc window.confirm().

### 13.2. Cancellation flag cho async load

```js
useEffect(() => {
  let cancelled = false
  api.getUserById(userId).then((data) => {
    if (cancelled) return
    setDetail(data)
  })
  return () => { cancelled = true }  // cleanup
}, [open, userId])
```

→ Tránh setState sau khi component unmount.

### 13.3. Fallback cho API response

Dashboard load 6 API song song (Promise.all) — **mỗi API đều có `.catch()` fallback**:

```js
api.getRecentActivities(1, 50).catch(() => ({ activities: [] }))
api.getRoles().catch(() => [])
api.getGenresStats().catch(() => [])
api.getStats().catch(() => null)
api.getRankingsList({...}).catch(() => [])
```

→ Nếu API nào lỗi → vẫn hiển thị được, dùng sample data.

### 13.4. Local search filter (client-side)

Một số trang (Users, Manga) có **search filter cục bộ**:

```js
const filtered = list.filter(u => {
  if (!searchTerm) return true
  return u.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
    || u.email?.toLowerCase().includes(searchTerm.toLowerCase())
})
```

→ Ngoài `search` query param gửi BE, còn filter thêm ở FE để update ngay khi user gõ.

---

## 14. Edge cases & Quy tắc phụ

| Tình huống | Xử lý |
|---|---|
| API lỗi khi load | Toast lỗi + giữ state cũ (Users, Manga, Chapters) |
| Chapter count = 0 | Hiển thị empty state với icon |
| Series bị soft delete | Ẩn khỏi list mặc định, có action restore |
| EB chưa có đại diện | EB staff vẫn xem được hàng chờ nhưng không lưu điểm HĐ được |
| User không có email | Toast cảnh báo validation |
| Role `Admin` đổi thành role khác | (BE chặn nếu là Admin cuối cùng) |
| Rankings API trả mảng rỗng | Chart không render, table hiển thị empty |
| Calendar range không có events | Hiển thị "Không có lịch phát hành" + render empty day |
| MangaEditDialog mở từ 2 chỗ khác nhau | Cùng 1 dialog, đảm bảo props reset khi đóng/mở |
| Dashboard API fails completely | Render sample data (chart vẫn hiển thị) |
| Force delete manga đã xoá | `canForceDeleteManga` = false → nút bị disable |
| Cancel request khi đang load | `cancelled` flag trong `useEffect` cleanup |

---

## 15. Soft delete vs Force delete

### 15.1. Soft delete

```js
DELETE /admin/manga/:id
// → set isDeleted = true
```

- Manga bị ẩn khỏi danh sách public.
- Vẫn còn trong DB → có thể restore.
- Admin vẫn thấy trong tab "Đã xoá" (nếu có filter riêng).

### 15.2. Force delete

- Chỉ khi `!isDeleted` → throw error nếu manga đã xoá.
- Hard delete khỏi DB → không restore được.

### 15.3. API distinguish

Cùng endpoint `DELETE /admin/manga/:id`:
- Soft: default
- Force: query param `?force=true` HOẶC method riêng

→ Xem `canForceDeleteManga` để gate UI nút.

---

## 16. Quy tắc role transitions

| From | To (qua API changeUserRole) | Lưu ý |
|---|---|---|
| Any | Any trong ROLE_OPTIONS | Có thể đổi tự do (BE không chặn) |
| Admin → khác | ⚠️ Có thể bị mất quyền | Nên block trên BE cho Admin cuối |
| Reader → Mangaka | OK | User có quyền upload sau đó |
| EB → Editor | OK | Mất quyền chấm HĐ |
| Mangaka → EB | OK | User đổi sang vai trò mới |

> **Best practice**: Luôn có ít nhất 1 user role Admin đang active.

---

## 17. Glossary

| Thuật ngữ | Nghĩa |
|---|---|
| **Admin** | Quản trị viên, full quyền |
| **Manga** | Series / truyện (thuật ngữ phổ biến trong codebase cho "series") |
| **Chapter** | Chương truyện |
| **Status** | Trạng thái workflow nội bộ (draft→submitted→approved→published) |
| **Publication status** | Trạng thái hiển thị cho reader (upcoming/ongoing/hiatus/...) |
| **Rep** | EB Representative — 1 user duy nhất được phép lưu điểm HĐ |
| **Lock** | Khoá tài khoản (user không đăng nhập được) |
| **Soft delete** | Đánh dấu xoá (khôi phục được) |
| **Force delete** | Xoá cứng khỏi DB (không khôi phục) |
| **Rankings** | Bảng xếp hạng series theo views/votes/rating |
| **Period** | daily / weekly / monthly / all — khoảng thời gian thống kê |
| **Candidate** | User có role EB được phép chỉ định làm representative |
| **__none__** | Sentinel cho "rỗng" trong Select filter |

---

## 18. Liên hệ với workflow tổng thể

Xem thêm:
- `docs/EB-BUSINESS-RULES.md` — Business rule EB
- `docs/TANTOU-BUSINESS-RULES.md` — Business rule Tantou
- `docs/WORKFLOW-SPEC.md` (nếu có) — Workflow tổng thể
- `docs/system-architecture.html` — Sơ đồ kiến trúc

---

*Cập nhật lần cuối: 2026-07-26 — Dựa trên source code hiện tại tại branch `main`.*
