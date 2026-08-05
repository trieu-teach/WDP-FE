import { useCallback, useEffect, useState } from 'react'
import { ArrowUpRight, CircleAlert, Loader2, RefreshCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { walletService } from '@/api/wallet.service.js'
import { getApiErrorMessage } from '@/api/http.js'
import {
  formatCoinStringWithUnit,
  formatVnd,
  formatDateTime,
} from '@/utils/coinFormatter.js'
import { cn } from '@/lib/utils'

const STATUS_LABELS = {
  pending: 'Đang chờ',
  approved: 'Đã duyệt',
  completed: 'Đã chi trả hoàn tất',
  rejected: 'Từ chối',
  cancelled: 'Đã huỷ',
}
const STATUS_TONES = {
  pending: 'bg-amber-100 text-amber-700 ring-amber-200/60',
  approved: 'bg-blue-100 text-blue-700 ring-blue-200/60',
  completed: 'bg-emerald-100 text-emerald-700 ring-emerald-200/60',
  rejected: 'bg-rose-100 text-rose-700 ring-rose-200/60',
  cancelled: 'bg-zinc-100 text-zinc-700 ring-zinc-200/60',
}

function StatusPill({ status }) {
  const label = STATUS_LABELS[status] ?? status ?? '—'
  const cls = STATUS_TONES[status] ?? 'bg-zinc-100 text-zinc-700 ring-zinc-200/60'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        cls,
      )}
    >
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {label}
    </span>
  )
}

function WithdrawalRow({ request }) {
  const amount = String(request.amountCoinDisplay ?? '0.00')
  return (
    <li className="border-b border-zinc-100 py-3 last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold tabular-nums text-zinc-900">
            {formatCoinStringWithUnit(amount)}
          </p>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            {formatVnd(request.vndAmount)} · {formatDateTime(request.createdAt)}
          </p>
        </div>
        <StatusPill status={request.status} />
      </div>
      {request.bankSnapshot ? (
        <p className="mt-1 truncate text-[11px] text-zinc-500">
          {request.bankSnapshot.bank_name || '—'} · {request.bankSnapshot.account_holder || '—'} ·{' '}
          <span className="font-mono">
            {request.bankSnapshot.account_number_masked || '—'}
          </span>
        </p>
      ) : null}
      {request.note ? (
        <p className="mt-1 text-[11px] text-zinc-500">Ghi chú: {request.note}</p>
      ) : null}
      {request.adminNote ? (
        <p className="mt-1 text-[11px] text-zinc-500">Admin: {request.adminNote}</p>
      ) : null}
    </li>
  )
}

/**
 * WithdrawalPanel — Tạo yêu cầu rút tiền + xem lịch sử cho creator.
 *
 * Yêu cầu:
 *  - Chỉ Mangaka/Assistant dùng (caller lo guard).
 *  - Disable khi available balance = 0.
 *  - Disable khi chưa có bank information (props.hasBankInfo).
 *  - Disable khi có withdrawal pending/approved.
 *  - Hiển thị số Coin + VND dự kiến (BE tự rút toàn bộ available).
 *  - Có dialog xác nhận.
 *  - Sau tạo thành công refresh summary + history + ledger.
 *
 * Props:
 *  - summary: wallet summary từ WalletTab (để biết available balance & VND).
 *  - hasBankInfo: boolean — được WalletTab truyền xuống (KHÔNG tự fetch ở panel).
 *  - onChanged: callback sau khi tạo withdrawal thành công.
 */
export default function WithdrawalPanel({ summary, hasBankInfo = false, onChanged }) {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const availableDisplay = summary?.availableBalanceCoinDisplay ?? '0.00'
  const availableCoin = Number(summary?.availableBalanceCoin ?? 0)
  const availableVnd = Number(summary?.availableBalanceVnd ?? 0)
  // Lấy hasBankInfo từ prop do WalletTab truyền xuống (single source of truth).
  const hasBank = Boolean(hasBankInfo)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await walletService.listMyWithdrawals({ page: 1, limit: 20 })
      setRequests(Array.isArray(res.items) ? res.items : [])
    } catch (err) {
      setError(getApiErrorMessage(err, 'Không tải được lịch sử rút tiền.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    Promise.resolve().then(() => load())
  }, [load])

  const activeRequest = requests.find(
    (r) => r.status === 'pending' || r.status === 'approved',
  )
  const disabled =
    submitting || availableCoin <= 0 || !hasBank || Boolean(activeRequest)

  const reason =
    !hasBank
      ? 'Cần cập nhật thông tin ngân hàng trước.'
      : availableCoin <= 0
        ? 'Số dư khả dụng bằng 0.'
        : activeRequest
          ? `Đang có yêu cầu ${STATUS_LABELS[activeRequest.status] ?? activeRequest.status} chờ xử lý.`
          : ''

  function openDialog() {
    if (disabled) return
    setNote('')
    setError('')
    setDialogOpen(true)
  }

  async function handleConfirm() {
    if (disabled) return
    setSubmitting(true)
    setError('')
    try {
      await walletService.createWithdrawal({ note: note.trim() || undefined })
      toast.success('Đã gửi yêu cầu rút tiền.')
      setDialogOpen(false)
      setNote('')
      await load()
      onChanged?.()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Không tạo được yêu cầu rút tiền.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-3">
        <p className="text-xs uppercase tracking-wide text-zinc-500">Dự kiến rút</p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-zinc-900">
          {formatCoinStringWithUnit(availableDisplay)}
        </p>
        <p className="text-xs tabular-nums text-zinc-500">{formatVnd(availableVnd)}</p>
        <p className="mt-1 text-[11px] text-zinc-500">
          Hệ thống sẽ tự rút toàn bộ số dư khả dụng.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={openDialog}
          disabled={disabled}
          title={reason}
        >
          <ArrowUpRight className="size-4" />
          Yêu cầu rút tiền
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          onClick={() => void load()}
          disabled={loading}
          aria-label="Tải lại lịch sử"
        >
          <RefreshCcw className={cn('size-4', loading && 'animate-spin')} />
        </Button>
        {!hasBank ? (
          <Badge variant="outline" className="gap-1 border-amber-200 text-amber-700">
            <CircleAlert className="size-3" /> Thiếu thông tin ngân hàng
          </Badge>
        ) : null}
        {activeRequest ? (
          <Badge variant="outline" className="gap-1 border-blue-200 text-blue-700">
            Đang chờ duyệt
          </Badge>
        ) : null}
      </div>

      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Lịch sử yêu cầu
        </p>
        {loading ? (
          <div className="flex items-center gap-2 py-3 text-sm text-zinc-500">
            <Loader2 className="size-4 animate-spin" /> Đang tải...
          </div>
        ) : requests.length === 0 ? (
          <p className="py-3 text-sm text-zinc-500">Chưa có yêu cầu rút tiền nào.</p>
        ) : (
          <ScrollArea className="max-h-64 pr-2">
            <ul className="divide-y divide-zinc-100">
              {requests.map((req) => (
                <WithdrawalRow key={req.id ?? req.createdAt} request={req} />
              ))}
            </ul>
          </ScrollArea>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Xác nhận yêu cầu rút tiền</DialogTitle>
            <DialogDescription>
              Hệ thống sẽ tạo yêu cầu rút toàn bộ số dư khả dụng. Bạn không thể chỉnh sửa sau khi gửi.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Số tiền dự kiến</p>
              <p className="mt-1 text-xl font-bold tabular-nums">
                {formatCoinStringWithUnit(availableDisplay)}
              </p>
              <p className="text-xs tabular-nums text-zinc-500">{formatVnd(availableVnd)}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wd-note">Ghi chú (tuỳ chọn)</Label>
              <Textarea
                id="wd-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="VD: rút về tài khoản Vietcombank..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              Huỷ
            </Button>
            <Button type="button" onClick={() => void handleConfirm()} disabled={submitting}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : 'Gửi yêu cầu'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
