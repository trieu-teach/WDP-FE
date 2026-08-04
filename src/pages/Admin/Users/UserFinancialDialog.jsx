import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowUpRight,
  BookOpen,
  CircleDollarSign,
  Coins,
  Copy,
  Inbox,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/api/index.js'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

/* ---------- formatters ---------- */

const nf0 = new Intl.NumberFormat('vi-VN')
const nf2 = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 })

function formatFullCoin(n) {
  return `${(Number(n) || 0).toLocaleString('vi-VN')} coin`
}

function formatCompact(n) {
  const num = Number(n) || 0
  if (Math.abs(num) >= 1_000_000) return `${nf2.format(num / 1_000_000)}M`
  if (Math.abs(num) >= 1_000) return `${nf2.format(num / 1_000)}K`
  return nf0.format(num)
}

function formatDate(value) {
  if (!value) return '—'
  try {
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

function initialsOf(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/* ---------- shared atoms ---------- */

function StatusBadge({ status }) {
  const map = {
    pending: {
      label: 'Chờ duyệt',
      cls: 'bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-200/60 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30',
      dot: 'bg-amber-500',
    },
    approved: {
      label: 'Đã duyệt',
      cls: 'bg-blue-100 text-blue-700 ring-1 ring-inset ring-blue-200/60 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-500/30',
      dot: 'bg-blue-500',
    },
    completed: {
      label: 'Hoàn tất',
      cls: 'bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200/60 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30',
      dot: 'bg-emerald-500',
    },
    rejected: {
      label: 'Từ chối',
      cls: 'bg-rose-100 text-rose-700 ring-1 ring-inset ring-rose-200/60 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30',
      dot: 'bg-rose-500',
    },
    paid: {
      label: 'Đã trả',
      cls: 'bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200/60 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30',
      dot: 'bg-emerald-500',
    },
    failed: {
      label: 'Thất bại',
      cls: 'bg-rose-100 text-rose-700 ring-1 ring-inset ring-rose-200/60 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30',
      dot: 'bg-rose-500',
    },
    cancelled: {
      label: 'Đã huỷ',
      cls: 'bg-zinc-100 text-zinc-700 ring-1 ring-inset ring-zinc-200/60 dark:bg-zinc-500/15 dark:text-zinc-300 dark:ring-zinc-500/30',
      dot: 'bg-zinc-500',
    },
  }
  const cfg = map[status] ?? {
    label: status ?? '—',
    cls: 'bg-zinc-100 text-zinc-700 ring-1 ring-inset ring-zinc-200/60 dark:bg-zinc-500/15 dark:text-zinc-300',
    dot: 'bg-zinc-400',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
        cfg.cls
      )}
    >
      <span className={cn('size-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
  )
}

function RolePill({ role }) {
  const normalized = String(role || '').toLowerCase()
  const map = {
    reader: { label: 'Reader', cls: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 ring-sky-500/20' },
    mangaka: { label: 'Mangaka', cls: 'bg-violet-500/10 text-violet-700 dark:text-violet-300 ring-violet-500/20' },
    assistant: { label: 'Trợ lý', cls: 'bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300 ring-fuchsia-500/20' },
    admin: { label: 'Admin', cls: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 ring-rose-500/20' },
  }
  const cfg = map[normalized] ?? {
    label: role || '—',
    cls: 'bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 ring-zinc-500/20',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset',
        cfg.cls
      )}
    >
      {cfg.label}
    </span>
  )
}

function Copyable({ value, label }) {
  if (!value) return null
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(String(value))
          toast.success(`Đã sao chép ${label || 'giá trị'}`)
        } catch {
          toast.error('Không thể sao chép')
        }
      }}
      className="group inline-flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground"
      title="Sao chép"
    >
      <span className="font-mono">{value}</span>
      <Copy className="size-3 opacity-0 transition group-hover:opacity-100" />
    </button>
  )
}

function EmptyState({ icon: Icon = Inbox, title, hint }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5" />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {hint ? <p className="max-w-xs text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function Skeleton({ className }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-md bg-muted/60',
        'after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-white/40 after:to-transparent after:animate-[shimmer_1.5s_infinite]',
        className
      )}
    />
  )
}

/* ---------- hero coin card ---------- */

function HeroCoinCard({ kind, value, secondaryLabel, secondaryValue, ratio }) {
  const isEarn = kind === 'earn'
  const accent = isEarn
    ? 'from-emerald-500/15 via-emerald-500/5 to-transparent ring-emerald-500/20'
    : 'from-amber-500/15 via-amber-500/5 to-transparent ring-amber-500/20'
  const Icon = isEarn ? Coins : CircleDollarSign
  const iconWrap = isEarn
    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
    : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl bg-gradient-to-br p-5 ring-1 ring-inset',
        accent
      )}
    >
      <div className="absolute -right-12 -top-12 size-44 rounded-full bg-white/5 blur-2xl" />
      <div className="relative flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {isEarn ? 'Coin khả dụng' : 'Số dư hiện tại'}
          </p>
          <p className="text-4xl font-bold tracking-tight tabular-nums">
            {formatFullCoin(value)}
          </p>
          {secondaryValue != null ? (
            <p className="text-xs text-muted-foreground">
              {secondaryLabel} ·{' '}
              <span className="font-semibold text-foreground tabular-nums">
                {formatFullCoin(secondaryValue)}
              </span>
            </p>
          ) : null}
        </div>
        <div
          className={cn(
            'flex size-11 items-center justify-center rounded-xl',
            iconWrap
          )}
        >
          <Icon className="size-5" />
        </div>
      </div>

      {isEarn && ratio ? (
        <div className="relative mt-4 space-y-1.5">
          <div className="flex h-2 overflow-hidden rounded-full bg-zinc-200/60 dark:bg-zinc-800/60">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${Math.min(100, Math.max(0, ratio.pct))}%` }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            {ratio.pct.toFixed(0)}% đã sẵn sàng để rút — phần còn lại đang chờ duyệt.
          </p>
        </div>
      ) : null}
    </div>
  )
}

/* ---------- KPI grid ---------- */

function KpiTile({ label, value, hint, icon: Icon, tone = 'violet' }) {
  const tones = {
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    sky: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
    zinc: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400',
  }
  return (
    <div className="rounded-xl border bg-card p-4 transition hover:shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <div className={cn('flex size-7 items-center justify-center rounded-lg', tones[tone])}>
          <Icon className="size-3.5" />
        </div>
      </div>
      <p className="mt-2 text-xl font-bold tabular-nums tracking-tight">
        {formatFullCoin(value)}
      </p>
      {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

/* ---------- top series chart (CSS-only) ---------- */

function TopSeriesChart({ series = [] }) {
  if (series.length === 0) {
    return <EmptyState icon={TrendingUp} title="Chưa có dữ liệu doanh thu" hint="Khi có giao dịch, top series sẽ hiển thị ở đây." />
  }
  // BE revenue_by_series: ưu tiên *_coin_display > *_coin > raw.
  const sorted = [...series]
    .map((s) => ({
      id: s.series_id ?? s.id,
      name: s.series_name ?? s.name ?? '—',
      availableCoin: parseDisplay(s,
        'available_coin_display', 'by_status.available_coin_display',
        'available_coin', 'by_status.available_coin',
        'available',
      ),
      pendingCoin: parseDisplay(s,
        'pending_coin_display', 'by_status.pending_coin_display',
        'pending_coin', 'by_status.pending_coin',
        'pending',
      ),
      totalCoin: parseDisplay(s,
        'total_coin_display', 'total_coin',
        'total',
      ),
    }))
    .sort((a, b) => b.totalCoin - a.totalCoin)
    .slice(0, 5)
  // Bar metric: sort theo availableCoin (sorted trên đã sort by total; ta sort lại để hiển thị)
  const sortedByAvailable = [...sorted].sort((a, b) => b.availableCoin - a.availableCoin)
  const max = Math.max(1, ...sortedByAvailable.map((s) => s.availableCoin))

  return (
    <div className="space-y-3">
      {sortedByAvailable.map((s, i) => {
        const pct = (s.availableCoin / max) * 100
        return (
          <div key={s.id ?? i} className="flex items-center gap-3">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
              {i + 1}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium">{s.name}</p>
                <p className="shrink-0 text-sm font-semibold tabular-nums">
                  {formatFullCoin(s.availableCoin)}
                </p>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                  style={{ width: `${Math.max(6, pct)}%` }}
                />
              </div>
              {s.pendingCoin > 0 ? (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  + <span className="font-medium text-foreground">{formatFullCoin(s.pendingCoin)}</span> đang chờ duyệt
                </p>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ---------- bank card ----------
 * BE chưa có endpoint rút tiền (2026-08-04) → tạm không render UI này.
 * Code tham khảo giữ trong git history, sẽ phục hồi khi BE sẵn sàng.
 */

/* ---------- activity timeline ---------- */

function formatRelative(value) {
  if (!value) return ''
  try {
    const d = new Date(value)
    const diff = (Date.now() - d.getTime()) / 1000
    if (diff < 60) return 'vừa xong'
    if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`
    if (diff < 86_400) return `${Math.floor(diff / 3600)} giờ trước`
    if (diff < 604_800) return `${Math.floor(diff / 86_400)} ngày trước`
    return d.toLocaleDateString('vi-VN')
  } catch {
    return ''
  }
}

function TimelineItem({ icon: Icon, tone = 'violet', title, subtitle, right, rightTone, meta }) {
  const tones = {
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    sky: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
    zinc: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400',
  }
  return (
    <li className="flex items-start gap-3 py-3">
      <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-full', tones[tone])}>
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        {subtitle ? (
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        ) : null}
        {meta ? <p className="mt-0.5 text-[11px] text-muted-foreground">{meta}</p> : null}
      </div>
      <div className="shrink-0 text-right">
        <p
          className={cn(
            'text-sm font-semibold tabular-nums',
            rightTone === 'in' && 'text-emerald-600 dark:text-emerald-400',
            rightTone === 'out' && 'text-rose-600 dark:text-rose-400'
          )}
        >
          {right}
        </p>
      </div>
    </li>
  )
}

/* ---------- field accessors (BE ground truth 04/08/2026) ----------
 *  BE /admin/users/:id/financials trả raw CoinUnit (integer) cho MỌI tiền.
 *  - Reader: data.financial_summary.{ current_coin, total_deposit, total_purchase, total_refund, total_revenue, total_withdrawal }
 *            data.deposits.history     (Payment list, có coin_amount, amount_vnd, coin_package_id.name, status)
 *            data.purchases.history    (PurchasedChapter list, có price, chapter_id.{chapter_number, series_id.name})
 *            data.transaction_summary  (WalletTransaction aggregate by type)
 *  - Mangaka/Assistant: thêm
 *            data.bank_info.{ bank_name, account_holder, bank_account_number, has_bank_info }
 *            data.revenue_by_series[] = { series_id, series_name, total_coin, by_status.{pending_coin, available_coin, withdrawn_coin} }
 *            data.withdrawals.history  (có coin_amount, vnd_amount, status, bank_snapshot)
 *  - KHÔNG có field topup_history / purchase_history / refund_history / amount_coin / net_coin.
 *
 *  Helper dưới đây đọc cả shape cũ + mới để còn tương thích nếu BE đổi.
 */
function pickField(obj, ...keys) {
  if (!obj || typeof obj !== 'object') return undefined
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) return obj[k]
  }
  return undefined
}

function parseDisplay(raw, ...keys) {
  const v = pickField(raw, ...keys)
  if (v == null) return 0
  if (typeof v === 'string') {
    const n = Number(v.trim())
    return Number.isFinite(n) ? n : 0
  }
  return Number(v) || 0
}

function getSummary(readerOrCreators, summary) {
  const s = summary && typeof summary === 'object' ? summary : {}
  if (readerOrCreators === 'reader') {
    return {
      currentCoin: parseDisplay(s,
        'current_coin_display', 'current_coin',
        'balance_coin_display', 'balance_coin', 'balance',
      ),
      totalDeposit: parseDisplay(s,
        'total_deposit_display', 'total_deposited_display',
        'total_deposit_coin_display', 'total_deposited_coin_display',
        'total_deposit_coin', 'total_deposited_coin',
        'total_deposit', 'total_deposited',
      ),
      totalPurchase: parseDisplay(s,
        'total_purchase_display', 'total_spent_display',
        'total_purchase_coin_display', 'total_spent_coin_display',
        'total_purchase_coin', 'total_spent_coin',
        'total_purchase', 'total_spent',
      ),
      totalRefund: parseDisplay(s,
        'total_refund_display',
        'total_refund_coin_display', 'total_refund',
      ),
      pendingRevenue: parseDisplay(s,
        'pending_revenue_display',
        'pending_revenue_coin_display', 'pending_revenue_coin',
        'pending_revenue',
      ),
      availableBalance: parseDisplay(s,
        'available_balance_display',
        'available_balance_coin_display', 'available_balance_coin',
        'available_balance',
      ),
      depositCount: Number(pickField(readerOrCreators === 'reader' ? s : {}, 'topup_count') ?? 0),
      purchaseCount: Number(pickField(s, 'purchase_count') ?? 0),
      raw: s,
    }
  }
  return {
    currentCoin: parseDisplay(s,
      'current_coin_display', 'current_coin',
      'balance_coin_display', 'balance_coin', 'balance',
    ),
    pendingRevenue: parseDisplay(s,
      'pending_revenue_display',
      'pending_revenue_coin_display', 'pending_revenue_coin',
      'pending_balance_display', 'pending_balance_coin_display', 'pending_balance',
      'pending_revenue',
    ),
    availableBalance: parseDisplay(s,
      'available_balance_display',
      'available_balance_coin_display', 'available_balance_coin',
      'available_balance',
    ),
    totalRevenue: parseDisplay(s,
      'total_revenue_display',
      'total_revenue_coin_display', 'total_revenue_coin',
      'total_revenue',
    ),
    totalDeposit: parseDisplay(s,
      'total_deposit_display', 'total_deposited_display',
      'total_deposit_coin_display', 'total_deposited_coin_display',
      'total_deposit_coin', 'total_deposited_coin',
      'total_deposit', 'total_deposited',
    ),
    totalPurchase: parseDisplay(s,
      'total_purchase_display', 'total_spent_display',
      'total_purchase_coin_display', 'total_spent_coin_display',
      'total_purchase_coin', 'total_spent_coin',
      'total_purchase', 'total_spent',
    ),
    totalRefund: parseDisplay(s,
      'total_refund_display',
      'total_refund_coin_display', 'total_refund',
    ),
    raw: s,
  }
}

/* ---------- views ---------- */

function ReaderView({ data }) {
  const summary = getSummary('reader', data?.financial_summary ?? data?.summary ?? {})
  const deposits = useMemo(
    () =>
      Array.isArray(data?.deposits?.history)
        ? data.deposits.history
        : Array.isArray(data?.topup_history)
          ? data.topup_history
          : Array.isArray(data?.topups)
            ? data.topups
            : [],
    [data]
  )
  const purchases = useMemo(
    () =>
      Array.isArray(data?.purchases?.history)
        ? data.purchases.history
        : Array.isArray(data?.purchase_history)
          ? data.purchase_history
          : Array.isArray(data?.purchases) && data.purchases.length > 0 && typeof data.purchases[0] === 'object'
            ? data.purchases
            : [],
    [data]
  )
  const refunds = useMemo(() => {
    // BE không trả refund_history riêng; lấy từ transaction_summary.
    const txSum = Array.isArray(data?.transaction_summary) ? data.transaction_summary : []
    const refundRow = txSum.find((r) => r._id === 'Refund' || r.type === 'Refund')
    return refundRow ? [refundRow] : []
  }, [data])

  const balance = summary.currentCoin
  const depositsCount = data?.deposits?.count ?? deposits.length
  const purchasesCount = data?.purchases?.total_chapters_bought ?? purchases.length

  const activity = useMemo(() => {
    const items = []
    deposits.forEach((t, i) => {
      const packageName = t.coin_package_id?.name ?? t.package_name ?? t.package ?? t.description ?? 'Nạp coin'
      const coinAmount = parseDisplay(t,
        'coin_display', 'coin_amount_display',
        'coin_amount_coin_display', 'coin_amount_coin',
        'coin_amount', 'coin', 'amount',
      )
      const ts = t.createdAt ?? t.created_at ?? t.time
      items.push({
        key: `top-${t._id ?? t.id ?? i}`,
        icon: ArrowUpRight,
        tone: 'emerald',
        title: packageName,
        subtitle: `Gói nạp · ${formatDate(ts)}`,
        right: `+ ${formatCompact(coinAmount)}`,
        rightTone: 'in',
        meta: formatRelative(ts),
        status: t.status,
      })
    })
    purchases.forEach((p, i) => {
      const seriesName = p.chapter_id?.series_id?.name ?? p.series_name ?? p.manga_title ?? 'Mua chapter'
      const chapterNumber = p.chapter_id?.chapter_number ?? p.chapter_number
      const priceRaw = parseDisplay(p, 'price_coin_display', 'price_display', 'price_coin', 'price', 'amount')
      const ts = p.purchased_at ?? p.createdAt ?? p.created_at ?? p.time
      items.push({
        key: `buy-${p._id ?? p.id ?? i}`,
        icon: BookOpen,
        tone: 'violet',
        title: seriesName,
        subtitle: chapterNumber != null ? `Chapter ${chapterNumber}` : 'Chapter',
        meta: formatDate(ts),
        right: `− ${formatFullCoin(priceRaw)}`,
        rightTone: 'out',
      })
    })
    refunds.forEach((r, i) =>
      items.push({
        key: `ref-${r._id ?? r.id ?? i}`,
        icon: RefreshCw,
        tone: 'sky',
        title: 'Hoàn coin',
        subtitle: r.reason ?? 'Hoàn tiền từ hệ thống',
        meta: `${r.total_coin_display ?? r.total_coin ?? r.total ?? 0} coin tổng`,
        right: `+ ${formatFullCoin(parseDisplay(r, 'total_coin_display', 'total_coin', 'total'))}`,
        rightTone: 'in',
      })
    )
    return items.sort((a, b) => (b.meta > a.meta ? 1 : -1)).slice(0, 12)
  }, [deposits, purchases, refunds])

  const hasTopups = deposits.length > 0
  const hasPurchases = purchases.length > 0

  return (
    <div className="space-y-5">
      <HeroCoinCard
        kind="read"
        value={balance}
        secondaryLabel="Tổng đã nạp"
        secondaryValue={summary.totalDeposit}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile
          label="Tổng nạp"
          value={summary.totalDeposit}
          hint={`${depositsCount} giao dịch`}
          icon={ArrowUpRight}
          tone="emerald"
        />
        <KpiTile
          label="Tổng mua chapter"
          value={summary.totalPurchase}
          hint={`${purchasesCount} lượt mua`}
          icon={BookOpen}
          tone="violet"
        />
        <KpiTile
          label="Tổng hoàn"
          value={summary.totalRefund}
          hint="Hoàn tiền từ hệ thống"
          icon={RefreshCw}
          tone="sky"
        />
        <KpiTile
          label="TB / giao dịch"
          value={depositsCount ? Math.round(summary.totalDeposit / depositsCount) : 0}
          hint="Trung bình mỗi lần nạp"
          icon={Coins}
          tone="amber"
        />
      </div>

      <Tabs defaultValue="activity" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="activity">Hoạt động</TabsTrigger>
          <TabsTrigger value="topups">Nạp ({deposits.length})</TabsTrigger>
          <TabsTrigger value="purchases">Mua ({purchases.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="activity">
          <div className="rounded-xl border bg-card">
            {activity.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title="Chưa có hoạt động nào"
                hint="Hoạt động nạp, mua và hoàn coin sẽ xuất hiện ở đây."
              />
            ) : (
              <ul className="divide-y px-4">
                {activity.map((it) => (
                  <TimelineItem key={it.key} {...it} />
                ))}
              </ul>
            )}
          </div>
        </TabsContent>

        <TabsContent value="topups">
          <div className="rounded-xl border bg-card p-3">
            {hasTopups ? (
              <ul className="divide-y">
                {deposits.slice(0, 20).map((t, i) => (
                  <TimelineItem
                    key={t._id ?? t.id ?? i}
                    icon={ArrowUpRight}
                    tone="emerald"
                    title={t.coin_package_id?.name ?? t.package_name ?? t.package ?? t.description ?? 'Nạp coin'}
                    subtitle={formatDate(t.createdAt ?? t.created_at ?? t.time)}
                    right={`+ ${formatFullCoin(parseDisplay(t, 'coin_display', 'coin_amount_display', 'coin_amount_coin_display', 'coin_amount_coin', 'coin_amount', 'coin', 'amount'))}`}
                    rightTone="in"
                    meta={<StatusBadge status={t.status} />}
                  />
                ))}
              </ul>
            ) : (
              <EmptyState icon={ArrowUpRight} title="Chưa có giao dịch nạp" />
            )}
          </div>
        </TabsContent>

        <TabsContent value="purchases">
          <div className="rounded-xl border bg-card p-3">
            {hasPurchases ? (
              <ul className="divide-y">
                {purchases.slice(0, 20).map((p, i) => (
                  <TimelineItem
                    key={p._id ?? p.id ?? i}
                    icon={BookOpen}
                    tone="violet"
                    title={p.chapter_id?.series_id?.name ?? p.series_name ?? p.manga_title ?? 'Mua chapter'}
                    subtitle={
                      p.chapter_id?.chapter_number != null
                        ? `Chapter ${p.chapter_id.chapter_number}`
                        : p.chapter_number != null
                          ? `Chapter ${p.chapter_number}`
                          : '—'
                    }
                    meta={formatDate(p.purchased_at ?? p.createdAt ?? p.created_at ?? p.time)}
                    right={`− ${formatFullCoin(parseDisplay(p, 'price_coin_display', 'price_display', 'price_coin_display', 'price_display', 'price_coin', 'price', 'price_coin', 'amount'))}`}
                    rightTone="out"
                  />
                ))}
              </ul>
            ) : (
              <EmptyState icon={BookOpen} title="Chưa có giao dịch mua" />
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function EarnView({ data }) {
  const summary = getSummary('creator', data?.financial_summary ?? data?.summary ?? {})
  const bySeries = useMemo(
    () =>
      Array.isArray(data?.revenue_by_series)
        ? data.revenue_by_series
        : Array.isArray(data?.series_revenue)
          ? data.series_revenue
          : [],
    [data]
  )

  // BE: available_balance / pending_revenue (raw integer).
  // Map về Coin cho UI.
  const available = Number(summary.availableBalance ?? 0)
  const pending = Number(summary.pendingRevenue ?? 0)
  const total = available + pending
  const pct = total > 0 ? (available / total) * 100 : 100

  const activity = useMemo(() => {
    const items = []
    bySeries.forEach((s, i) => {
      // BE revenue_by_series: ưu tiên *_coin_display > *_coin > raw.
      const availableCoin = parseDisplay(s,
        'available_coin_display', 'by_status.available_coin_display',
        'available_coin', 'by_status.available_coin',
        'available',
      )
      const pendingCoin = parseDisplay(s,
        'pending_coin_display', 'by_status.pending_coin_display',
        'pending_coin', 'by_status.pending_coin',
        'pending',
      )
      const totalCoin = parseDisplay(s,
        'total_coin_display', 'total_coin',
        'total',
      ) || (availableCoin + pendingCoin)
      if (totalCoin > 0) {
        items.push({
          key: `earn-${s.series_id ?? s.id ?? i}`,
          icon: BookOpen,
          tone: 'emerald',
          title: `Doanh thu · ${s.series_name ?? s.name ?? '—'}`,
          subtitle: `Tổng ${formatCompact(totalCoin)} · Pending ${formatCompact(pendingCoin)}`,
          meta: formatRelative(s.last_paid_at ?? s.updated_at) || null,
          right: `+ ${formatFullCoin(totalCoin)}`,
          rightTone: 'in',
        })
      }
    })
    return items.slice(0, 12)
  }, [bySeries])

  return (
    <div className="space-y-5">
      <HeroCoinCard
        kind="earn"
        value={available}
        secondaryLabel="Đang chờ duyệt"
        secondaryValue={pending}
        ratio={{ pct }}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile
          label="Tổng kiếm"
          value={summary.totalRevenue}
          hint="Tổng coin tích lũy"
          icon={TrendingUp}
          tone="violet"
        />
        <KpiTile
          label="Số series"
          value={bySeries.length}
          hint="Đang phát hành"
          icon={BookOpen}
          tone="emerald"
        />
      </div>

      <div className="rounded-xl border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Top series kiếm coin</p>
            <p className="text-xs text-muted-foreground">
              Sắp xếp theo tổng coin
            </p>
          </div>
          <Badge variant="outline" className="font-mono">
            {bySeries.length}
          </Badge>
        </div>
        <TopSeriesChart series={bySeries} />
      </div>

      <Tabs defaultValue="activity" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="activity">Hoạt động</TabsTrigger>
          <TabsTrigger value="series">Doanh thu ({bySeries.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="activity">
          <div className="rounded-xl border bg-card">
            {activity.length === 0 ? (
              <EmptyState
                icon={Sparkles}
                title="Chưa có hoạt động"
                hint="Doanh thu từ các series sẽ hiển thị tại đây."
              />
            ) : (
              <ul className="divide-y px-4">
                {activity.map((it) => (
                  <TimelineItem key={it.key} {...it} />
                ))}
              </ul>
            )}
          </div>
        </TabsContent>

        <TabsContent value="series">
          <div className="rounded-xl border bg-card p-4">
            <TopSeriesChart series={bySeries} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

/* ---------- header (identity strip) ---------- */

function IdentityStrip({ user, role, fetchedAt, onRefresh, loading }) {
  const name = user?.name || user?.username || user?.email || 'Người dùng'
  const avatar = user?.avatar || user?.avatar_url || user?.avatarUrl || ''
  const email = user?.email
  const id = user?.id ?? user?._id

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-violet-600 via-indigo-600 to-violet-800 px-6 py-5 text-white">
      <div className="absolute -right-16 -top-16 size-56 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute -bottom-12 right-32 size-40 rounded-full bg-amber-300/10 blur-3xl" />
      <div className="relative flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar size="lg" className="size-12 ring-2 ring-white/30">
            {avatar ? <AvatarImage src={avatar} alt={name} /> : null}
            <AvatarFallback className="bg-white/15 text-base font-semibold text-white backdrop-blur">
              {initialsOf(name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-lg font-semibold">{name}</h2>
              <RolePill role={role} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/70">
              {email ? <span className="truncate">{email}</span> : null}
              {id ? <Copyable value={id} label="ID" /> : null}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {fetchedAt ? (
            <span className="hidden text-[11px] text-white/60 sm:inline">
              Cập nhật {formatRelative(fetchedAt)}
            </span>
          ) : null}
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={onRefresh}
            disabled={loading}
            className="text-white hover:bg-white/15"
            title="Tải lại"
          >
            <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>
    </div>
  )
}

function UnknownRoleView({ role }) {
  return (
    <div className="px-2 py-8">
      <EmptyState
        icon={Wallet}
        title="Chưa có dữ liệu tài chính"
        hint={`Vai trò "${role || '—'}" hiện không có dữ liệu để hiển thị.`}
      />
    </div>
  )
}

/* ---------- root ---------- */

export default function UserFinancialDialog({ user, open, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    const id = user?.id
    if (!id) return
    setLoading(true)
    setError('')
    api
      .getUserFinancials(id)
      .then((res) => setData(res))
      .catch((err) => {
        const msg = err?.response?.data?.message || 'Không tải được dữ liệu tài chính'
        setError(msg)
        toast.error(msg)
      })
      .finally(() => setLoading(false))
  }, [user?.id])

  useEffect(() => {
    if (!open || !user?.id) return
    let cancelled = false
    const run = () => {
      if (cancelled) return
      load()
    }
    run()
    return () => { cancelled = true }
  }, [open, user?.id, load])

  const role = user?.role ?? data?.user_role ?? data?.role ?? ''
  const roleNormalized = String(role).toLowerCase()
  const fetchedAt = data?.fetched_at ?? data?.last_sync ?? null

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent
        className="max-h-[92vh] gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-4xl"
        aria-describedby="user-financial-description"
      >
        <span id="user-financial-description" className="sr-only">Chi tiết tài chính người dùng</span>
        <DialogHeader className="sr-only">
          <DialogTitle>Tài chính người dùng</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <IdentityStrip
            user={user}
            role={role}
            fetchedAt={fetchedAt}
            onRefresh={load}
            loading={loading}
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="absolute right-3 top-3 z-10 flex size-8 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20"
          >
            <X className="size-4" />
          </button>
        </div>

        <ScrollArea className="max-h-[calc(92vh-150px)]">
          <div className="space-y-5 p-5 sm:p-6">
            {loading && !data ? (
              <div className="space-y-5">
                <Skeleton className="h-28 w-full" />
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <Skeleton className="h-24" />
                  <Skeleton className="h-24" />
                  <Skeleton className="h-24" />
                  <Skeleton className="h-24" />
                </div>
                <Skeleton className="h-40 w-full" />
              </div>
            ) : error ? (
              <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50/50 p-4 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
                <div className="flex size-9 items-center justify-center rounded-full bg-rose-500/10">
                  <X className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Không tải được dữ liệu</p>
                  <p className="truncate text-xs opacity-80">{error}</p>
                </div>
                <Button size="sm" variant="outline" onClick={load}>
                  Thử lại
                </Button>
              </div>
            ) : !data ? (
              <EmptyState icon={Wallet} title="Không có dữ liệu" />
            ) : roleNormalized === 'reader' ? (
              <ReaderView data={data} />
            ) : roleNormalized === 'mangaka' || roleNormalized === 'assistant' ? (
              <EarnView data={data} />
            ) : (
              <UnknownRoleView role={role} />
            )}
          </div>

          <Separator />
          <div className="flex items-center justify-between px-5 py-3 text-[11px] text-muted-foreground sm:px-6">
            <span>
              Dữ liệu được làm mới mỗi khi mở hộp thoại hoặc bấm tải lại.
            </span>
            <span className="font-mono">
              {fetchedAt ? formatDate(fetchedAt) : ''}
            </span>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
