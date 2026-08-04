# 🔴 PROMPT GỬI BACKEND TEAM — Kiểm tra & fix các lỗi hiện có

> **Người gửi:** FE team
> **Ngày:** 03/08/2026
> **Mức độ:** P1 — cần fix trước khi release tiếp
> **Frontend base URL (Vite dev):** `http://localhost:5173`
> **Backend base URL:** `https://wdp-be-a2qb.onrender.com`
> **Tài liệu tham chiếu:** Swagger UI của BE

---

## I. TÓM TẮT NHANH

FE đã hoàn thiện các luồng sau và đang chờ BE xác nhận/implement:

| # | Luồng | Endpoint gọi | Tình trạng |
|---|---|---|---|
| 1 | **Wallet — user (mangaka/assistant)** | `GET /api/wallet/summary`, `GET /api/wallet/ledger`, `GET /api/wallet/withdrawals`, `POST /api/wallet/withdrawals` | ❌ **404 Not Found** — chưa có |
| 2 | **Assistant profile** | `GET /api/assistant/profile` | ❌ Chưa có, FE đang fallback tạm `mangakaProfileService.getProfile()` |
| 3 | **Session sync khi đổi role** | `GET /api/auth/me` | ⚠️ Có nhưng `role` trả về không consistent |
| 4 | **Notifications** | `GET /api/notifications`, `PATCH /api/notifications/:id/read`, `PATCH /api/notifications/read-all` | ✅ Hoạt động |
| 5 | **EB chấm điểm** | `GET /api/eb-evaluations/pending`, `POST /api/eb-evaluations/chapter/:id/evaluate` | ✅ Hoạt động (có fallback 404) |
| 6 | **Admin finance** | `/admin/dashboard/finance`, `/admin/revenue/hub`, `/admin/revenue/stats` | ✅ Hoạt động |

---

## II. CHI TIẾT LỖI CẦN FIX

### 🔴 LỖI 1: Wallet endpoints — 404 (ƯU TIÊN CAO NHẤT)

**Hiện trạng FE** (trong `src/components/Wallet/WalletTab.jsx` và `src/api/wallet.service.js`):

```
GET /api/wallet/summary         → 404 (247ms)
GET /api/wallet/withdrawals     → 404 (283ms)
GET /api/wallet/summary         → 404 (304ms)
GET /api/wallet/ledger          → 404 (445ms)
```

**FE đã có sẵn các call sau**, BE cần implement:

### 1.1. `GET /api/wallet/summary`

**Auth:** Bearer JWT (resolve role từ token — mangaka/assistant/reader)

**Response shape FE expect:**
```json
{
  "success": true,
  "data": {
    "balance": 1500000,
    "pending_balance": 200000,
    "lifetime_earnings": 5000000,
    "lifetime_withdrawn": 3500000,
    "currency": "VND",
    "updated_at": "2026-08-03T10:30:00.000Z"
  }
}
```

**Accept snake_case hoặc camelCase** — FE đã normalize trong `mapSummary()`.

---

### 1.2. `GET /api/wallet/ledger`

**Auth:** Bearer JWT

**Query:** `page=1&limit=20&type=earning` (type optional: earning/withdrawal/refund/adjustment/bonus/platform_fee)

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "65abc...",
        "type": "earning",
        "amount": 50000,
        "description": "Bán chapter 5 của One Piece",
        "chapter_id": "65def...",
        "chapter_title": "Chapter 5",
        "manga_title": "One Piece",
        "created_at": "2026-08-01T08:00:00.000Z"
      }
    ],
    "total": 42,
    "page": 1,
    "limit": 20
  }
}
```

---

### 1.3. `GET /api/wallet/withdrawals`

**Auth:** Bearer JWT

**Query:** `page=1&limit=20&status=pending` (status optional: pending/approved/rejected/paid/failed)

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "65abc...",
        "amount": 500000,
        "status": "pending",
        "requested_at": "2026-08-01T08:00:00.000Z",
        "processed_at": null,
        "note": "Rút về Vietcombank",
        "rejection_reason": ""
      }
    ],
    "total": 3,
    "page": 1,
    "limit": 20
  }
}
```

---

### 1.4. `POST /api/wallet/withdrawals` — Tạo yêu cầu rút tiền

**Auth:** Bearer JWT

**Body:**
```json
{
  "amount": 500000,
  "note": "Rút về Vietcombank",
  "bank_info": {           // optional
    "bank_name": "VCB",
    "account_number": "1234567890",
    "account_name": "Nguyen Van A"
  }
}
```

**Response:** 1 withdrawal object (giống shape ở 1.3)

**Validation rules cần BE check:**
- `amount > 0` và `amount <= balance`
- User có role hợp lệ (mangaka/assistant)
- Không có pending withdrawal nào chưa xử lý (optional)

---

### 🟡 LỖI 2: Assistant profile — endpoint riêng

**Hiện trạng:**
- FE không có `/assistant/profile` riêng từ BE
- Đang fallback dùng `/mangaka/profile` (cùng user_id, cùng shape)
- Comment trong `AssistantProfile.jsx` line 158: `"BE chưa có /assistant/profile riêng → fallback dùng mangakaProfileService"`

**Câu hỏi cần BE confirm:**

**Option A:** Có thể dùng chung `GET /api/mangaka/profile` cho assistant không?
- Nếu CÓ → giữ nguyên như hiện tại, không cần làm gì.
- Nếu KHÔNG → BE cần tạo:

### 2.1. `GET /api/assistant/profile` (nếu cần riêng)

**Auth:** Bearer JWT

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "username": "assistant01",
      "full_name": "Trợ lý ABC",
      "email": "...",
      "avatar_url": "https://...",
      "cover_image_url": "https://...",
      "bio": "...",
      "social_links": { "facebook": "", "twitter": "", "website": "" },
      "joined_at": "2026-07-01T..."
    },
    "stats": {
      "totalSeries": 5,
      "chapters": 20,
      "earnings": 500000,
      "followersCount": 10
    },
    "series": [...]   // series mà assistant này đang hợp tác
  }
}
```

### 2.2. `PUT /api/assistant/profile` (nếu cần riêng)

**Body:** giống `PUT /mangaka/profile`:
```json
{
  "full_name": "...",
  "bio": "...",
  "avatar_base64": "data:image/jpeg;base64,...",
  "cover_image_base64": "data:image/jpeg;base64,...",
  "social_links": { "facebook": "", "twitter": "", "website": "" }
}
```

**Câu hỏi quyết định:** Endpoint chung `/mangaka/profile` đã chấp nhận role=assistant chưa? Nếu rồi → **KHÔNG cần làm gì**.

---

### 🟡 LỖI 3: Session sync — `GET /api/auth/me` trả role không consistent

**Triệu chứng FE:**
- User vừa login xong với role=`assistant`
- Click "Profile" từ header dropdown
- Bị redirect về `/profile` (Mangaka) thay vì `/assistant/profile`
- Nguyên nhân: `sessionStorage.manga_user.role` có thể là giá trị CŨ trước khi login mới (race condition)

**FE đã fix bằng cách** (trong `AssistantProfile.jsx` line 184-220): khi user vào trang → nếu role không đúng → gọi `GET /api/auth/me` để refresh session.

**BE cần confirm:**
1. `GET /api/auth/me` response có trả `role` không? Format gì?
   ```json
   { "success": true, "data": { "user": { "id": "...", "role": "Assistant" } } }
   ```
   Hay
   ```json
   { "user": { "role": "assistant" } }
   ```
2. Field `role` viết HOA hay thường? (FE expect "Assistant", "Mangaka", "Reader", "Editor", "EB", "Admin" — theo enum API)

**Hiện tại FE có mapping** (trong `src/lib/auth.js` line 19-26):
```js
const API_ROLE_TO_APP = {
  Admin: 'admin',
  Mangaka: 'mangaka',
  Assistant: 'assistant',
  Editor: 'editor',
  EB: 'eb',
  Reader: 'reader',
}
```
→ BE nên trả **PascalCase** ("Assistant", "Mangaka", ...) để mapping khớp.

Nếu BE đang trả lowercase → **CẦN ĐỔI** sang PascalCase, hoặc FE sẽ phải đổi mapping.

---

### 🟢 LỖI 4: Notifications — đã OK, chỉ kiểm tra shape

FE đang gọi:
- `GET /api/notifications` → ✅ OK
- `PATCH /api/notifications/:id/read` → ✅ OK
- `PATCH /api/notifications/read-all` → ✅ OK

**Câu hỏi BE:** Response của `GET /api/notifications` có field `unreadCount` không?

FE đang fallback:
```js
setUnreadCount(Number(res.unreadCount ?? list.filter(n => !n.isRead).length))
```

Nếu BE có `unreadCount` → trả để tối ưu. Nếu không → FE tự đếm từ list.

---

### 🟢 LỖI 5: EB Evaluations — chỉ kiểm tra consistency

**Endpoint FE gọi:**
- `GET /api/eb-evaluations/pending` ✅ (có fallback `/chapter-pending`)
- `GET /api/eb-scores/chapter/:id/preview` ✅
- `GET /api/eb-evaluations/series/:id/detail` ✅
- `POST /api/eb-evaluations/chapter/:id/evaluate` ✅

**Câu hỏi BE:** Field `member_name` trong `evaluate` request body — bắt buộc hay optional? Hiện FE luôn gửi.

---

### 🟢 LỖI 6: Admin finance — chỉ xác nhận consistency

FE gọi 3 endpoint admin:
- `GET /admin/dashboard/finance` ✅
- `GET /admin/revenue/hub` ✅ (query: period, top_limit)
- `GET /admin/revenue/stats` ✅

**Câu hỏi BE:** Cấu trúc `wallet` trong `/admin/revenue/stats` trả gì? FE không dùng trực tiếp, chỉ kiểm tra có field `wallet` không thôi.

---

## III. ACTION ITEMS CHO BE

| # | Hành động | Mức độ | Ưu tiên | Effort |
|---|---|---|---|---|
| 1 | Implement 4 endpoint `/api/wallet/*` (summary, ledger, withdrawals, POST withdrawals) | 🔴 P1 | **Cao** | ~2 ngày |
| 2 | Confirm `/api/mangaka/profile` có accept role=assistant không. Nếu không → tạo `/api/assistant/profile` riêng | 🟡 P2 | Trung bình | ~1 ngày |
| 3 | Confirm format `role` trong `/api/auth/me` response là PascalCase (Assistant, Mangaka, ...) | 🟡 P2 | Trung bình | ~10 phút |
| 4 | Confirm `unreadCount` field trong `/api/notifications` response | 🟢 P3 | Thấp | ~5 phút |
| 5 | Test 3 endpoint EB + 3 endpoint Admin finance với sample data | 🟢 P3 | Thấp | ~30 phút |

---

## IV. CÁCH BE TEST NHANH

### Test 1: Login as Assistant → Check wallet tab

```bash
# 1. Login
curl -X POST https://wdp-be-a2qb.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"assistant01","password":"test123"}'

# Save token từ response → TOKEN

# 2. Test wallet summary
curl https://wdp-be-a2qb.onrender.com/api/wallet/summary \
  -H "Authorization: Bearer TOKEN"
# Expect: 200 + balance/pending/lifetime shape
# Hiện tại: 404 ❌
```

### Test 2: Login as Mangaka → Test admin finance

```bash
# 1. Login as admin
curl -X POST .../api/auth/login -d '{"username":"admin","password":"..."}'

# 2. Test
curl .../api/admin/dashboard/finance -H "Authorization: Bearer ADMIN_TOKEN"
curl .../api/admin/revenue/hub?period=30d -H "Authorization: Bearer ADMIN_TOKEN"
curl .../api/admin/revenue/stats -H "Authorization: Bearer ADMIN_TOKEN"
```

---

## V. TIMELINE

- **Lỗi 1 (Wallet):** Cần BE confirm trước ngày **05/08/2026** — nếu không có, FE sẽ tạm thời ẩn tab Ví.
- **Lỗi 2-3:** Cần BE confirm trong **1-2 ngày tới** — FE sẽ không sửa gì thêm nếu BE confirm là OK.
- **Lỗi 4-6:** Không blocking, có thể làm sau.

---

## VI. LIÊN HỆ

- **FE lead:** [tên] — Discord: ... — Email: ...
- **Repo FE:** https://github.com/...
- **Backend Swagger:** https://wdp-be-a2qb.onrender.com/api/docs

Khi fix xong, vui lòng reply trong thread này + ping trên Discord để FE test lại. Cảm ơn anh em BE! 🙏
