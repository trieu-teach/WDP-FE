import { http } from './http.js'

/**
 * Bank information service cho Mangaka / Assistant.
 *
 * Contract BE hiện tại (04/08/2026):
 *
 *   GET   /profile
 *     → root.user.bank_info (hoặc root.bank_info / root.data.bank_info tuỳ phiên bản)
 *     bank_info: {
 *       bank_name,
 *       account_holder,
 *       account_number_masked,   // KHÔNG trả về số đầy đủ
 *       has_account_number,
 *       has_bank_info,
 *     }
 *
 *   PATCH /profile/bank-information
 *     body: {
 *       current_password,
 *       bank_name,
 *       account_holder,
 *       bank_account_number,
 *     }
 *     response: root.bank_info (cũng đã mask) — KHÔNG bao gồm số TK đầy đủ.
 *
 * Lưu ý:
 *  - Tuyệt đối KHÔNG gọi `/mangaka/profile` hay `/assistant/profile`.
 *    Endpoint BE là `/profile` chung cho mọi role.
 *  - Tham số `role` được giữ lại ở method chỉ để tương thích ngược với caller,
 *    nhưng KHÔNG dùng để tạo URL — luôn gọi `/profile` / `/profile/bank-information`.
 *  - Service KHÔNG trả full account number. UI tự lưu tạm input để nhập lại khi update.
 *  - Mọi full account number nhập vào form phải bị xoá khỏi React state ngay sau khi lưu.
 */

function unwrap(res) {
  if (res && typeof res === 'object' && res.success !== undefined && res.data !== undefined) {
    return unwrap(res.data)
  }
  return res
}

function extractBankInfo(root) {
  if (!root || typeof root !== 'object') return null
  // BE có thể wrap ở nhiều cấp — chấp nhận cả 3 vị trí phổ biến.
  return (
    root.bank_info
    ?? root.user?.bank_info
    ?? root.data?.bank_info
    ?? null
  )
}

function mapBankInfo(raw) {
  const b = raw && typeof raw === 'object' ? raw : {}
  const hasAccountNumber = Boolean(b.has_account_number ?? b.hasAccountNumber)
  const hasBankInfo = Boolean(
    b.has_bank_info ?? b.hasBankInfo ?? (b.bank_name && b.account_holder),
  )
  return {
    bankName: String(b.bank_name ?? b.bankName ?? '').trim(),
    accountHolder: String(b.account_holder ?? b.accountHolder ?? '').trim(),
    // BE đã mask — KHÔNG có field full account number hợp lệ từ response.
    accountNumberMasked: String(
      b.account_number_masked ?? b.accountNumberMasked ?? '',
    ).trim(),
    hasAccountNumber,
    hasBankInfo,
    raw: b,
  }
}

export const bankInformationService = {
  /**
   * GET /profile
   * Lấy thông tin ngân hàng của user đang đăng nhập (Mangaka / Assistant).
   * Tham số `role` chỉ tồn tại để tương thích ngược — KHÔNG dùng để build URL.
   */
  async get(/* role */) {
    const payload = await http.get('/profile').then(unwrap)
    return mapBankInfo(extractBankInfo(payload))
  },

  /**
   * PATCH /profile/bank-information
   * Body chỉ gồm: current_password, bank_name, account_holder, bank_account_number.
   * KHÔNG gửi kèm `role` / không phụ thuộc role.
   * KHÔNG lưu / không trả full account number xuống UI.
   *
   * @param {{current_password:string, bank_name:string, account_holder:string, bank_account_number:string}} payload
   */
  async update(payload) {
    const body = {
      current_password: String(payload?.current_password ?? ''),
      bank_name: String(payload?.bank_name ?? '').trim(),
      account_holder: String(payload?.account_holder ?? '').trim(),
      bank_account_number: String(payload?.bank_account_number ?? '').trim(),
    }
    const res = await http.patch('/profile/bank-information', body).then(unwrap)
    return mapBankInfo(extractBankInfo(res) ?? res)
  },
}
