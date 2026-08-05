import { useCallback, useEffect, useState } from 'react'
import { Loader2, Wallet, ArrowDownLeft, ArrowUpRight, Receipt, Clock, Building2, RefreshCcw } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getApiErrorMessage } from '@/api/http.js'
import {
  walletService,
  LEDGER_TYPES,
  ledgerTypeLabel,
  resolveDirection,
} from '@/api/wallet.service.js'
import { bankInformationService } from '@/api/bankInformation.service.js'
import {
  formatCoinString,
  formatCoinStringWithUnit,
  formatVnd,
  formatDateTime,
} from '@/utils/coinFormatter.js'
import { cn } from '@/lib/utils'
import BankInformationForm from '@/components/Wallet/BankInformationForm.jsx'
import WithdrawalPanel from '@/components/Wallet/WithdrawalPanel.jsx'

/* ---------- Filter options theo BE spec (type PascalCase) ---------- */
const LEDGER_FILTER_OPTIONS = [
  { value: 'all', label: 'Tất cả' },
  { value: LEDGER_TYPES.REVENUE, label: 'Doanh thu' },
  { value: LEDGER_TYPES.REFUND, label: 'Hoàn tiền' },
  { value: LEDGER_TYPES.DEPOSIT, label: 'Nạp Coin' },
  { value: LEDGER_TYPES.PURCHASE, label: 'Mua chapter' },
  { value: LEDGER_TYPES.WITHDRAWAL, label: 'Rút Coin' },
]

function SummaryCard({ label, value, hint, icon: Icon, tone = 'default' }) {
  const toneClass = {
    default: 'border-zinc-200 bg-white',
    positive: 'border-emerald-200 bg-emerald-50/60',
    pending: 'border-amber-200 bg-amber-50/60',
  }[tone] ?? 'border-zinc-200 bg-white'

  return (
    <Card className={cn('shadow-sm', toneClass)}>
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
          <p className="mt-1.5 text-lg font-bold tabular-nums text-zinc-900">{value}</p>
          {hint ? <p className="mt-0.5 text-[11px] text-zinc-500">{hint}</p> : null}
        </div>
        {Icon ? (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/70 text-zinc-700 shadow-sm">
            <Icon className="size-4" />
          </span>
        ) : null}
      </CardContent>
    </Card>
  )
}

function LedgerRow({ entry }) {
  const direction = resolveDirection(entry) ?? (entry.type === LEDGER_TYPES.WITHDRAWAL ? 'out' : null)
  const inflow = direction === 'in'
  const AmountIcon = inflow ? ArrowDownLeft : ArrowUpRight
  const amountColor = inflow ? 'text-emerald-700' : 'text-rose-700'
  const amountPrefix = inflow ? '+' : '-'
  // BE trả sẵn *_display — render trực tiếp để giữ nguyên "2.40".
  const display = String(entry.amountCoinDisplay ?? entry.amountCoinString ?? '0.00')
  const amountNumber = Math.abs(Number(display.replace(',', '.')) || Number(entry.amountCoin) || 0)
  return (
    <li className="flex items-center justify-between gap-3 border-b border-zinc-100 py-3 last:border-b-0">
      <div className="flex min-w-0 items-start gap-3">
        <span className={cn(
          'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg',
          inflow ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700',
        )}>
          <AmountIcon className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-zinc-900">
            {entry.description || ledgerTypeLabel(entry.type)}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-zinc-500">
            {ledgerTypeLabel(entry.type)} · {formatDateTime(entry.createdAt)}
          </p>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className={cn('text-sm font-semibold tabular-nums', amountColor)}>
          {amountPrefix}{formatCoinString(amountNumber.toFixed(2))}
        </div>
        {entry.vndAmount > 0 ? (
          <div className="text-[11px] tabular-nums text-zinc-400">{formatVnd(entry.vndAmount)}</div>
        ) : null}
      </div>
    </li>
  )
}

export default function WalletTab() {
  const [summary, setSummary] = useState(null)
  const [ledger, setLedger] = useState({
    items: [],
    pagination: { page: 1, limit: 20, total: 0, pages: 1 },
  })
  const [bankInfo, setBankInfo] = useState(null)
  const [bankLoading, setBankLoading] = useState(true)
  const [bankError, setBankError] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [ledgerType, setLedgerType] = useState('all')
  const [refreshTick, setRefreshTick] = useState(0)

  /**
   * GET /profile — single source of truth cho bankInfo.
   * Lưu ý: không truyền role vào service — endpoint BE cố định là /profile.
   */
  const loadBankInfo = useCallback(async () => {
    setBankLoading(true)
    setBankError('')
    try {
      const info = await bankInformationService.get()
      setBankInfo(info)
    } catch (err) {
      setBankError(getApiErrorMessage(err, 'Không tải được thông tin ngân hàng.'))
    } finally {
      setBankLoading(false)
    }
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [sum, led] = await Promise.all([
        walletService.getSummary(),
        walletService.getTransactions({ page: 1, limit: 50 }),
      ])
      setSummary(sum)
      setLedger(led)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Không tải được ví.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAll()
  }, [loadAll, refreshTick])

  // Tách riêng useEffect cho bankInfo để tránh gọi GET /profile mỗi lần refresh wallet summary.
  useEffect(() => {
    void loadBankInfo()
  }, [loadBankInfo])

  /**
   * Sau khi BankInformationForm lưu thành công:
   *  - cập nhật bankInfo/hasBankInfo ngay lập tức (để WithdrawalPanel mở khoá);
   *  - refresh wallet summary + transactions (số dư có thể đã thay đổi).
   */
  const handleBankSaved = useCallback(
    (updated) => {
      if (updated && typeof updated === 'object') {
        setBankInfo(updated)
      } else {
        // Fallback: refetch /profile nếu form không trả về data.
        void loadBankInfo()
      }
      setRefreshTick((t) => t + 1)
    },
    [loadBankInfo],
  )

  const filteredLedger = ledgerType === 'all'
    ? ledger.items
    : ledger.items.filter((e) => e.type === ledgerType)

  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center py-16 text-zinc-500">
        <Loader2 className="size-5 animate-spin" />
        <span className="ml-2">Đang tải ví...</span>
      </div>
    )
  }

  if (error && !summary) {
    return (
      <Alert variant="destructive">
        <AlertDescription className="flex items-center justify-between gap-3">
          <span>{error}</span>
          <Button size="sm" variant="outline" onClick={() => void loadAll()}>
            Thử lại
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  const availableCoinDisplay = summary?.availableBalanceCoinDisplay ?? '0.00'
  const pendingCoinDisplay = summary?.pendingBalanceCoinDisplay ?? '0.00'
  const earningsCoinDisplay = summary?.lifetimeEarningsCoinDisplay ?? '0.00'
  const withdrawnCoinDisplay = summary?.lifetimeWithdrawnCoinDisplay ?? '0.00'
  const availableVnd = summary?.availableBalanceVnd ?? 0
  const pendingVnd = summary?.pendingBalanceVnd ?? 0
  const earningsVnd = summary?.lifetimeEarningsVnd ?? 0
  const withdrawnVnd = summary?.lifetimeWithdrawnVnd ?? 0

  const hasBankInfo = Boolean(bankInfo?.hasBankInfo)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setRefreshTick((t) => t + 1)}
          disabled={loading}
        >
          <RefreshCcw className={cn('size-4', loading && 'animate-spin')} />
          Làm mới
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Số dư khả dụng"
          value={formatCoinStringWithUnit(availableCoinDisplay)}
          hint={formatVnd(availableVnd)}
          icon={Wallet}
          tone="positive"
        />
        <SummaryCard
          label="Đang chờ xử lý"
          value={formatCoinStringWithUnit(pendingCoinDisplay)}
          hint={formatVnd(pendingVnd)}
          icon={Clock}
          tone="pending"
        />
        <SummaryCard
          label="Tổng thu nhập"
          value={formatCoinStringWithUnit(earningsCoinDisplay)}
          hint={formatVnd(earningsVnd)}
          icon={ArrowDownLeft}
        />
        <SummaryCard
          label="Đã rút"
          value={formatCoinStringWithUnit(withdrawnCoinDisplay)}
          hint={formatVnd(withdrawnVnd)}
          icon={ArrowUpRight}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="size-4 text-zinc-500" />
              <CardTitle className="text-base">Thông tin ngân hàng</CardTitle>
            </div>
            <CardDescription>
              Cần thiết để rút Coin về tài khoản.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BankInformationForm
              bankInfo={bankInfo}
              bankLoading={bankLoading}
              bankError={bankError}
              onSaved={handleBankSaved}
              onReload={loadBankInfo}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ArrowUpRight className="size-4 text-zinc-500" />
              <CardTitle className="text-base">Yêu cầu rút tiền</CardTitle>
            </div>
            <CardDescription>
              Hệ thống tự rút toàn bộ số dư khả dụng.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WithdrawalPanel
              summary={summary}
              hasBankInfo={hasBankInfo}
              onChanged={() => setRefreshTick((t) => t + 1)}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Receipt className="size-4 text-zinc-500" />
            <CardTitle className="text-base">Lịch sử giao dịch</CardTitle>
          </div>
          <CardDescription>
            {ledger.pagination.total} giao dịch
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex items-center gap-2">
            <Label htmlFor="wallet-ledger-filter" className="shrink-0 text-xs">Loại</Label>
            <Select value={ledgerType} onValueChange={setLedgerType}>
              <SelectTrigger id="wallet-ledger-filter" className="h-8 w-full sm:w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEDGER_FILTER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {filteredLedger.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">
              Chưa có giao dịch nào.
            </p>
          ) : (
            <ScrollArea className="max-h-96 pr-2">
              <ul className="divide-y divide-zinc-100">
                {filteredLedger.map((entry) => (
                  <LedgerRow
                    key={entry.id ?? `${entry.createdAt}-${entry.amountCoin}`}
                    entry={entry}
                  />
                ))}
              </ul>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
