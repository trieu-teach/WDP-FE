import { useEffect, useState } from 'react'
import { Building2, Eye, EyeOff, Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { bankInformationService } from '@/api/bankInformation.service.js'
import { getApiErrorMessage } from '@/api/http.js'
import { cn } from '@/lib/utils'

/**
 * BankInformationForm — Form cập nhật thông tin ngân hàng cho Mangaka/Assistant.
 *
 * Yêu cầu:
 *  - Hiển thị cho own profile (Mangaka/Assistant).
 *  - Không hiển thị full account number sau khi lưu — chỉ mask.
 *  - Yêu cầu current_password khi cập nhật.
 *  - KHÔNG lưu password vào localStorage / sessionStorage.
 *  - KHÔNG tự gọi GET /profile — WalletTab fetch và truyền xuống qua prop.
 *  - Sau cập nhật thành công, gọi onSaved(updated) để parent đồng bộ
 *    bankInfo trong state chung (để WithdrawalPanel mở khoá ngay).
 *
 * Props:
 *  - bankInfo: { bankName, accountHolder, accountNumberMasked, hasAccountNumber, hasBankInfo } | null
 *  - bankLoading: boolean
 *  - bankError: string
 *  - onSaved(updated?): callback sau khi PATCH thành công, nhận bankInfo mới từ BE.
 *  - onReload(): optional callback để parent refetch bankInfo nếu cần.
 */
export default function BankInformationForm({
  bankInfo = null,
  bankLoading = false,
  bankError = '',
  onSaved,
  onReload,
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    bankName: '',
    accountHolder: '',
    bankAccountNumber: '',
    currentPassword: '',
  })
  const [showPassword, setShowPassword] = useState(false)

  // Đồng bộ form với bankInfo khi parent truyền dữ liệu mới.
  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      bankName: bankInfo?.bankName ?? '',
      accountHolder: bankInfo?.accountHolder ?? '',
      // KHÔNG giữ full account number — luôn reset rỗng khi parent refresh.
      bankAccountNumber: '',
      currentPassword: '',
    }))
  }, [bankInfo])

  function reset() {
    setForm({
      bankName: bankInfo?.bankName ?? '',
      accountHolder: bankInfo?.accountHolder ?? '',
      bankAccountNumber: '',
      currentPassword: '',
    })
    setShowPassword(false)
    setError('')
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.bankName.trim() || !form.accountHolder.trim() || !form.bankAccountNumber.trim()) {
      setError('Vui lòng nhập đầy đủ thông tin ngân hàng.')
      return
    }
    if (!form.currentPassword) {
      setError('Vui lòng nhập mật khẩu hiện tại để xác nhận.')
      return
    }
    setSaving(true)
    setError('')
    try {
      // PATCH /profile/bank-information — không truyền role.
      const updated = await bankInformationService.update({
        current_password: form.currentPassword,
        bank_name: form.bankName.trim(),
        account_holder: form.accountHolder.trim(),
        bank_account_number: form.bankAccountNumber.trim(),
      })
      // Reset password / số tài khoản sau khi lưu — không giữ trong state.
      setForm((prev) => ({
        ...prev,
        bankAccountNumber: '',
        currentPassword: '',
      }))
      setShowForm(false)
      toast.success('Đã cập nhật thông tin ngân hàng.')
      // Truyền bankInfo mới từ BE để parent đồng bộ.
      onSaved?.(updated)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Không lưu được thông tin ngân hàng.'))
    } finally {
      setSaving(false)
    }
  }

  if (bankLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <Loader2 className="size-4 animate-spin" />
        Đang tải thông tin ngân hàng...
      </div>
    )
  }

  const hasInfo = bankInfo?.hasBankInfo
  const displayError = error || bankError

  return (
    <div className="space-y-3">
      {displayError ? (
        <Alert variant="destructive">
          <AlertDescription>{displayError}</AlertDescription>
        </Alert>
      ) : null}

      {hasInfo && !showForm ? (
        <dl className="space-y-2 rounded-lg border border-zinc-200 bg-zinc-50/60 p-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-xs uppercase tracking-wide text-zinc-500">Ngân hàng</dt>
            <dd className="font-medium text-zinc-900">{bankInfo.bankName || '—'}</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-xs uppercase tracking-wide text-zinc-500">Chủ tài khoản</dt>
            <dd className="font-medium text-zinc-900">{bankInfo.accountHolder || '—'}</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-xs uppercase tracking-wide text-zinc-500">Số tài khoản</dt>
            <dd className="font-mono text-zinc-900">
              {bankInfo.accountNumberMasked || '—'}
            </dd>
          </div>
        </dl>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={showForm ? 'outline' : 'default'}
          onClick={() => {
            if (showForm) reset()
            setShowForm((v) => !v)
          }}
        >
          <Building2 className="size-4" />
          {showForm ? 'Huỷ' : hasInfo ? 'Cập nhật' : 'Thêm thông tin'}
        </Button>
        {onReload ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onReload()}
            aria-label="Tải lại thông tin ngân hàng"
          >
            <Loader2 className="size-4" />
            Tải lại
          </Button>
        ) : null}
        {hasInfo && !showForm ? (
          <p className="text-xs text-zinc-500">
            BE chỉ trả về số tài khoản đã mask. Nhập lại số mới để thay đổi.
          </p>
        ) : null}
      </div>

      {showForm ? (
        <form onSubmit={handleSave} className="space-y-3 rounded-lg border border-zinc-200 p-3">
          <div className="space-y-1.5">
            <Label htmlFor="bk-bank-name">Tên ngân hàng</Label>
            <Input
              id="bk-bank-name"
              value={form.bankName}
              onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))}
              maxLength={80}
              placeholder="VD: Vietcombank"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bk-holder">Chủ tài khoản</Label>
            <Input
              id="bk-holder"
              value={form.accountHolder}
              onChange={(e) => setForm((f) => ({ ...f, accountHolder: e.target.value }))}
              maxLength={80}
              placeholder="Nguyễn Văn A"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bk-account">Số tài khoản</Label>
            <Input
              id="bk-account"
              value={form.bankAccountNumber}
              onChange={(e) =>
                setForm((f) => ({ ...f, bankAccountNumber: e.target.value.replace(/\D/g, '') }))
              }
              inputMode="numeric"
              autoComplete="off"
              placeholder="Nhập số tài khoản đầy đủ"
              required
            />
            <p className="text-xs text-zinc-500">
              BE sẽ mask số tài khoản khi trả về — UI không bao giờ hiển thị số đầy đủ sau khi lưu.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bk-current-pwd">Mật khẩu hiện tại</Label>
            <div className="relative">
              <Input
                id="bk-current-pwd"
                type={showPassword ? 'text' : 'password'}
                value={form.currentPassword}
                onChange={(e) => setForm((f) => ({ ...f, currentPassword: e.target.value }))}
                autoComplete="current-password"
                placeholder="Nhập mật khẩu để xác nhận"
                required
                className={cn('pr-10')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 transition hover:text-zinc-700"
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <p className="text-xs text-zinc-500">
              Mật khẩu chỉ dùng để xác nhận, không lưu vào bộ nhớ trình duyệt.
            </p>
          </div>
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Lưu thông tin
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  )
}
