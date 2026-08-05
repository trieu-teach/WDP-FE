import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowUpRight,
  Banknote,
  BookOpen,
  CircleDollarSign,
  Coins,
  Copy,
  Inbox,
  Loader2,
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
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { getBackendOrigin } from '@/api/http.js'
import {
  formatCoinStringWithUnit,
  formatVnd,
  getByPath,
  pickCoinDisplay,
  pickVndDisplay,
} from '@/utils/coinFormatter.js'

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

function resolveMediaUrl(url) {
  if (!url) return ''
  const value = String(url).trim()
  if (!value) return ''
  if (/^(data:|blob:|https?:)/i.test(value)) return value
  const origin = getBackendOrigin()
  return value.startsWith('/') ? `${origin}${value}` : `${origin}/${value}`
}

/* ---------- shared atoms ---------- */

const WITHDRAWAL_STATUS_LABELS = {
  pending: 'Đang chờ',
  approved: 'Đã duyệt',
  completed: 'Đã chi trả hoàn tất',
  rejected: 'Từ chối',
  cancelled: 'Đã huỷ',
}

function StatusBadge({ status }) {
  const map = {
    pending: {
      label: WITHDRAWAL_STATUS_LABELS.pending,
      cls: 'bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-200/60 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30',
      dot: 'bg-amber-500',
    },
    approved: {
      label: WITHDRAWAL_STATUS_LABELS.approved,
      cls: 'bg-blue-100 text-blue-700 ring-1 ring-inset ring-blue-200/60 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-500/30',
      dot: 'bg-blue-500',
    },
    completed: {
      label: WITHDRAWAL_STATUS_LABELS.completed,
      cls: 'bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200/60 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30',
      dot: 'bg-emerald-500',
    },
    rejected: {
      label: WITHDRAWAL_STATUS_LABELS.rejected,
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
    },    cancelled: {
      label: WITHDRAWAL_STATUS_LABELS.cancelled,
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

/* ---------- top series (period-driven) ---------- */

const TOP_SERIES_PERIOD_OPTIONS = [
  { value: 'month', label: 'Tháng' },
  { value: 'quarter', label: 'Quý' },
  { value: 'year', label: 'Năm' },
]

function todayParts() {
  const now = new Date()
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    quarter: Math.floor(now.getMonth() / 3) + 1,
  }
}

function buildTopSeriesPeriodLabel(period, year, month, quarter) {
  if (period === 'month') return `Tháng ${month}/${year}`
  if (period === 'quarter') return `Quý ${quarter}/${year}`
  if (period === 'year') return `Năm ${year}`
  return ''
}

function PeriodSeriesRow({ item, max }) {
  const gross = parseDisplay(item, [
    'gross_revenue_coin_display',
    'gross_revenue_coin',
  ])
  const creator = parseDisplay(item, [
    'creator_revenue_coin_display',
    'creator_revenue_coin',
  ])
  const chapters = Number(item.chapters_sold ?? 0)
  const pct = max > 0 ? Math.max(2, (gross / max) * 100) : 2
  const thumb = resolveMediaUrl(item.thumbnail ?? item.cover_image_url)
  const initials = (item.series_name ?? '?').slice(0, 2).toUpperCase()
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <div className={cn(
        'flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground',
      )}>
        {item.rank ?? '—'}
      </div>
      <Avatar size="sm" className="size-9 shrink-0">
        {thumb ? <AvatarImage src={thumb} alt={item.series_name ?? ''} /> : null}
        <AvatarFallback className="bg-muted text-xs font-semibold">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium">{item.series_name ?? '—'}</p>
          <p className="shrink-0 text-sm font-semibold tabular-nums">
            {formatCoinStringWithUnit(item.gross_revenue_coin_display ?? gross.toFixed(2))}
          </p>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-violet-400"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Nhà sáng tạo {formatCompact(creator)} · {chapters} lượt mua chương
        </p>
      </div>
    </li>
  )
}

function TopSeriesPeriod({ userId, role, data }) {
  const today = todayParts()
  const [period, setPeriod] = useState('month')
  const [year, setYear] = useState(today.year)
  const [month, setMonth] = useState(today.month)
  const [quarter, setQuarter] = useState(today.quarter)
  const [items, setItems] = useState([])
  const [periodSummary, setPeriodSummary] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const roleNormalized = String(role ?? '').toLowerCase()
  const canLoadTopSeries = roleNormalized === 'mangaka' || roleNormalized === 'assistant'

  const loadTopSeries = useCallback(async () => {
    if (!canLoadTopSeries || !userId) return
    setLoading(true)
    setError(false)
    try {
      const params = { period, year }
      if (period === 'month') params.month = month
      if (period === 'quarter') params.quarter = quarter
      const res = await api.getUserFinancialTopSeries(userId, params)
      setItems(Array.isArray(res?.top_series) ? res.top_series : [])
      setPeriodSummary(res?.summary ?? null)
    } catch (err) {
      console.warn('Không tải được top series:', err)
      // Fallback: revenue_by_series nếu endpoint mới không khả dụng.
      const fallback = Array.isArray(data?.revenue_by_series) ? data.revenue_by_series : []
      setItems(fallback)
      setPeriodSummary(null)
      setError(true)
    } finally {
      setLoading(false)
    }
    // data?.revenue_by_series được đọc trong fallback nhưng KHÔNG phải dep của load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canLoadTopSeries, userId, period, year, month, quarter])

  useEffect(() => {
    Promise.resolve().then(() => loadTopSeries())
  }, [loadTopSeries])

  if (!canLoadTopSeries) return null

  const label = buildTopSeriesPeriodLabel(period, year, month, quarter)
  const max = items.reduce((m, s) => {
    const v = parseDisplay(s, [
      'gross_revenue_coin_display',
      'gross_revenue_coin',
    ])
    return v > m ? v : m
  }, 0)
  const creatorRevenue = parseDisplay(periodSummary, [
    'creator_revenue_coin_display',
    'creator_revenue_coin',
  ])
  const chaptersSold = Number(periodSummary?.chapters_sold ?? 0)
  const seriesCount = Number(periodSummary?.series_count ?? items.length)

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Truyện có doanh thu cao nhất · {label}</p>
          <p className="text-xs text-muted-foreground">
            Nhà sáng tạo {formatCompact(creatorRevenue)} · {chaptersSold} lượt mua chương · {seriesCount} truyện
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="h-8 w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TOP_SERIES_PERIOD_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="h-8 w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 6 }, (_, i) => today.year - i).map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {period === 'month' ? (
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="h-8 w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <SelectItem key={m} value={String(m)}>T{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          {period === 'quarter' ? (
            <Select value={String(quarter)} onValueChange={(v) => setQuarter(Number(v))}>
              <SelectTrigger className="h-8 w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4].map((q) => (
                  <SelectItem key={q} value={String(q)}>Quý {q}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => Promise.resolve().then(() => loadTopSeries())}
            disabled={loading}
            title="Tải lại"
          >
            <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Đang tải...
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={TrendingUp} title="Chưa có doanh thu theo kỳ" hint="Khi có doanh thu, top series sẽ hiển thị ở đây." />
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {items.map((s, i) => (
            <PeriodSeriesRow
              key={s.series_id ?? s.id ?? i}
              item={s}
              max={max}
            />
          ))}
        </ul>
      )}
      {error ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Endpoint top-series chưa khả dụng — đang hiển thị dữ liệu revenue_by_series fallback.
        </p>
      ) : null}
    </div>
  )
}

/* ---------- bank info card ---------- */

function BankInfoCard({ bankInfo }) {
  if (!bankInfo) {
    return (
      <EmptyState
        icon={Banknote}
        title="Chưa có thông tin ngân hàng"
        hint="Creator cần cập nhật trước khi yêu cầu rút tiền."
      />
    )
  }
  const hasAccount = Boolean(bankInfo.has_account_number ?? bankInfo.hasAccountNumber)
  const masked = String(
    bankInfo.account_number_masked ?? bankInfo.accountNumberMasked ?? '',
  ).trim()
  return (
    <dl className="space-y-2 rounded-xl border bg-card p-4 text-sm">
      <div className="flex items-center justify-between gap-2">
        <dt className="text-xs uppercase tracking-wide text-muted-foreground">Ngân hàng</dt>
        <dd className="font-medium text-foreground">{bankInfo.bank_name || bankInfo.bankName || '—'}</dd>
      </div>
      <div className="flex items-center justify-between gap-2">
        <dt className="text-xs uppercase tracking-wide text-muted-foreground">Chủ tài khoản</dt>
        <dd className="font-medium text-foreground">
          {bankInfo.account_holder || bankInfo.accountHolder || '—'}
        </dd>
      </div>
      <div className="flex items-center justify-between gap-2">
        <dt className="text-xs uppercase tracking-wide text-muted-foreground">Số tài khoản</dt>
        <dd className="font-mono text-foreground">
          {masked || (hasAccount ? '••••••' : '—')}
        </dd>
      </div>
    </dl>
  )
}

/* ---------- withdrawals list ---------- */

function WithdrawalList({ items = [] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Wallet}
        title="Chưa có yêu cầu rút tiền"
        hint="Lịch sử rút tiền sẽ hiển thị tại đây."
      />
    )
  }
  return (
    <ul className="divide-y rounded-xl border bg-card">
      {items.slice(0, 20).map((w, i) => {
        const amount = String(w.coin_amount_coin_display ?? w.coin_display ?? w.coin_amount ?? '0.00')
        const vnd = pickVndDisplay(w, [
          'vnd_amount_display',
          'vnd_amount',
          'amount_vnd',
        ]).number
        const bank = w.bank_snapshot ?? w.bankSnapshot ?? null
        const masked = String(
          bank?.account_number_masked ?? bank?.bank_account_number_masked ?? '',
        ).trim()
        return (
          <li key={w._id ?? w.id ?? i} className="space-y-1 px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold tabular-nums text-foreground">
                  {formatCoinStringWithUnit(amount)}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {formatVnd(vnd)} · {formatDate(w.createdAt ?? w.created_at)}
                </p>
              </div>
              <StatusBadge status={w.status} />
            </div>
            {bank ? (
              <p className="truncate text-[11px] text-muted-foreground">
                {bank.bank_name || '—'} · {bank.account_holder || '—'} ·{' '}
                <span className="font-mono">{masked || '—'}</span>
              </p>
            ) : null}
            {w.note ? (
              <p className="text-[11px] text-muted-foreground">Ghi chú: {w.note}</p>
            ) : null}
            {w.admin_note ? (
              <p className="text-[11px] text-muted-foreground">Admin: {w.admin_note}</p>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

/* ---------- collaboration revenue share ---------- */

function CollaborationTable({ rows = [] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Sparkles}
        title="Chưa có dữ liệu hợp tác"
        hint="Khi có doanh thu hợp tác, bảng phân chia sẽ hiển thị tại đây."
      />
    )
  }
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">Series</th>
            <th className="px-3 py-2 text-left">Vai trò</th>
            <th className="px-3 py-2 text-right">Coin</th>
            <th className="px-3 py-2 text-right">Tỉ lệ</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row, i) => {
            const coin = pickCoinDisplay(row, [
              'share_coin_display',
              'coin_amount_coin_display',
              'share_coin',
              'coin_amount_coin',
              'share',
            ]).number
            const rate = Number(row.share_percent ?? row.sharePercent ?? 0)
            return (
              <tr key={row.series_id ?? row.id ?? i}>
                <td className="px-3 py-2">
                  <p className="font-medium">{row.series_name ?? row.name ?? '—'}</p>
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {row.role ?? row.contribution_role ?? '—'}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatFullCoin(coin)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {Number.isFinite(rate) && rate > 0 ? `${rate.toFixed(1)}%` : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

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

/* ---------- field accessors ---------- */
function parseDisplay(raw, keys) {
  for (const k of keys) {
    const v = getByPath(raw, k)
    if (v == null || v === '') continue
    if (typeof v === 'string') {
      const n = Number(v.trim())
      return Number.isFinite(n) ? n : 0
    }
    if (typeof v === 'number' && Number.isFinite(v)) return v
  }
  return 0
}

/* ---------- revenue history → timeline ---------- */
function buildRevenueActivity(revenues = []) {
  if (!Array.isArray(revenues) || revenues.length === 0) return []
  return revenues.map((r, i) => {
    const coin = parseDisplay(r, [
      'coin_amount_coin_display',
      'coin_amount_coin',
      'coin_display',
      'coin_amount',
      'amount',
    ])
    const seriesName = r.series_name ?? r.series?.name ?? 'Series'
    const chapterNumber = r.chapter_number ?? r.chapter?.chapter_number
    const ts = r.createdAt ?? r.created_at ?? r.paid_at ?? r.updated_at
    const status = r.status ?? null
    return {
      key: `rev-${r._id ?? r.id ?? i}`,
      icon: BookOpen,
      tone: status === 'pending' ? 'amber' : 'emerald',
      title: `Doanh thu · ${seriesName}${chapterNumber != null ? ` · Chapter ${chapterNumber}` : ''}`,
      subtitle: status ? `Trạng thái: ${status}` : 'Đã ghi nhận',
      right: `+ ${formatFullCoin(coin)}`,
      rightTone: 'in',
      meta: formatRelative(ts),
    }
  })
}

/* ---------- views ---------- */

function ReaderView({ data }) {
  const summary = (() => {
    const s = data?.financial_summary ?? data?.summary ?? {}
    return {
      currentCoin: parseDisplay(s, [
        'current_coin_display', 'current_coin',
        'balance_coin_display', 'balance_coin', 'balance',
      ]),
      totalDeposit: parseDisplay(s, [
        'total_deposit_display', 'total_deposited_display',
        'total_deposit_coin_display', 'total_deposited_coin_display',
        'total_deposit_coin', 'total_deposited_coin',
        'total_deposit', 'total_deposited',
      ]),
      totalPurchase: parseDisplay(s, [
        'total_purchase_display', 'total_spent_display',
        'total_purchase_coin_display', 'total_spent_coin_display',
        'total_purchase_coin', 'total_spent_coin',
        'total_purchase', 'total_spent',
      ]),
      totalRefund: parseDisplay(s, [
        'total_refund_display',
        'total_refund_coin_display', 'total_refund',
      ]),
      raw: s,
    }
  })()
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
      const coinAmount = parseDisplay(t, [
        'coin_display', 'coin_amount_display',
        'coin_amount_coin_display', 'coin_amount_coin',
        'coin_amount', 'coin', 'amount',
      ])
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
      const priceRaw = parseDisplay(p, ['price_coin_display', 'price_display', 'price_coin', 'price', 'amount'])
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
        right: `+ ${formatFullCoin(parseDisplay(r, ['total_coin_display', 'total_coin', 'total']))}`,
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
                    right={`+ ${formatFullCoin(parseDisplay(t, ['coin_display', 'coin_amount_display', 'coin_amount_coin_display', 'coin_amount_coin', 'coin_amount', 'coin', 'amount']))}`}
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
                    right={`− ${formatFullCoin(parseDisplay(p, ['price_coin_display', 'price_display', 'price_coin', 'price', 'amount']))}`}
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

function EarnView({ data, userId, role, transactions, transactionsPagination, transactionsTotal, onChangeTxParams, txLoading }) {
  const s = data?.financial_summary ?? data?.summary ?? {}

  // ---- Revenue status: data.revenues.by_status (mới) → data.revenue_by_status (cũ) ----
  const revenuesRoot = data?.revenues
  const byStatus =
    revenuesRoot && typeof revenuesRoot === 'object' && revenuesRoot.by_status
      ? revenuesRoot.by_status
      : (data?.revenue_by_status && typeof data.revenue_by_status === 'object'
        ? data.revenue_by_status
        : {})

  // ---- Cooperation: data.cooperation_revenue_share (mới) → data.collaboration_revenue (cũ) ----
  const collaborations = useMemo(
    () =>
      Array.isArray(data?.cooperation_revenue_share)
        ? data.cooperation_revenue_share
        : Array.isArray(data?.collaboration_revenue)
          ? data.collaboration_revenue
          : [],
    [data]
  )

  const summary = {
    pendingBalance: pickCoinDisplay(s, [
      'pending_revenue_display',
      'pending_revenue_coin_display',
      'pending_balance_display',
      'pending_balance_coin_display',
      'pending_revenue_coin',
      'pending_balance_coin',
      'pending_revenue',
      'pending_balance',
    ]).number,
    availableBalance: pickCoinDisplay(s, [
      'available_balance_display',
      'available_balance_coin_display',
      'available_balance_coin',
      'available_balance',
    ]).number,
    totalRevenue: pickCoinDisplay(s, [
      'total_revenue_display',
      'total_revenue_coin_display',
      'total_revenue_coin',
      'total_revenue',
    ]).number,
    totalWithdrawal: pickCoinDisplay(s, [
      'total_withdrawal_display',
      'total_withdrawal_coin_display',
      'total_withdrawal_coin',
      'total_withdrawal',
      'total_withdrawn_coin_display',
      'total_withdrawn_coin',
      'total_withdrawn',
    ]).number,
  }

  // ---- Revenue history: data.revenues.history → timeline thật ----
  const revenueHistory = useMemo(
    () =>
      Array.isArray(revenuesRoot?.history)
        ? revenuesRoot.history
        : Array.isArray(data?.revenue?.history)
          ? data.revenue.history
          : [],
    [revenuesRoot, data]
  )

  // ---- revenue_by_series: chỉ dùng làm fallback khi endpoint top-series không khả dụng ----
  const bySeries = useMemo(
    () =>
      Array.isArray(data?.revenue_by_series)
        ? data.revenue_by_series
        : Array.isArray(data?.series_revenue)
          ? data.series_revenue
          : [],
    [data]
  )

  const statusDisplay = {
    pending: pickCoinDisplay(byStatus, [
      'pending_coin_display',
      'pending_coin',
      'pending',
    ]),
    available: pickCoinDisplay(byStatus, [
      'available_coin_display',
      'available_coin',
      'available',
    ]),
    withdrawn: pickCoinDisplay(byStatus, [
      'withdrawn_coin_display',
      'withdrawn_coin',
      'withdrawn',
    ]),
  }

  const withdrawals = useMemo(
    () =>
      Array.isArray(data?.withdrawals?.history)
        ? data.withdrawals.history
        : Array.isArray(data?.withdrawals)
          ? data.withdrawals
          : [],
    [data]
  )

  const bankInfo = data?.bank_info ?? data?.bankInfo ?? null
  const withdrawalsTotal =
    Number(data?.withdrawals?.total ?? data?.withdrawal_count ?? 0) ||
    Number(transactionsTotal ?? 0)

  const available = Number(summary.availableBalance ?? 0)
  const pending = Number(summary.pendingBalance ?? 0)
  const total = available + pending
  const pct = total > 0 ? (available / total) * 100 : 100

  const activity = useMemo(() => buildRevenueActivity(revenueHistory), [revenueHistory])

  // Series có doanh thu — đếm trên revenue_by_series (fallback) HOẶC top series hiện tại.
  const seriesWithRevenue = useMemo(() => {
    if (Array.isArray(bySeries) && bySeries.length > 0) {
      return bySeries.filter((s) => {
        const totalCoin = parseDisplay(s, [
          'total_coin_display',
          'total_coin',
          'total',
        ])
        return totalCoin > 0
      }).length
    }
    return revenueHistory.length > 0
      ? new Set(revenueHistory.map((r) => r.series_id ?? r.series?.id)).size
      : 0
  }, [bySeries, revenueHistory])

  return (
    <div className="space-y-5">
      <HeroCoinCard
        kind="earn"
        value={available}
        secondaryLabel="Đang chờ duyệt"
        secondaryValue={pending}
        ratio={{ pct }}
      />

      {/* KPI: Available & Pending đã hiển thị ở HeroCard → tránh trùng.
          Chỉ giữ các metric có ý nghĩa khác: tổng kiếm, đã chi trả hoàn tất,
          coin đã đưa vào yêu cầu rút, số series có doanh thu. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile
          label="Tổng kiếm"
          value={summary.totalRevenue}
          hint="Tổng coin tích lũy"
          icon={TrendingUp}
          tone="violet"
        />
        <KpiTile
          label="Đã chi trả hoàn tất"
          value={summary.totalWithdrawal}
          hint="Withdrawal đã hoàn tất"
          icon={ArrowUpRight}
          tone="emerald"
        />
        <KpiTile
          label="Coin đã đưa vào yêu cầu rút"
          value={statusDisplay.withdrawn.number}
          hint={statusDisplay.withdrawn.display}
          icon={Wallet}
          tone="blue"
        />
        <KpiTile
          label="Series có doanh thu"
          value={seriesWithRevenue}
          hint="Đã phát sinh doanh thu"
          icon={BookOpen}
          tone="amber"
        />
      </div>

      {/* Bank info + progress thay cho Phân bổ doanh thu */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Thông tin ngân hàng
          </p>
          <BankInfoCard bankInfo={bankInfo} />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Phân bổ doanh thu
          </p>
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Đang chờ duyệt</span>
              <span className="tabular-nums">{formatFullCoin(pending)}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-200/60 dark:bg-zinc-800/60">
              <div
                className="h-full rounded-full bg-amber-500"
                style={{ width: `${total > 0 ? Math.min(100, (pending / total) * 100) : 0}%` }}
              />
            </div>
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="font-medium">Có thể rút</span>
              <span className="tabular-nums">{formatFullCoin(available)}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-200/60 dark:bg-zinc-800/60">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${total > 0 ? Math.min(100, (available / total) * 100) : 0}%` }}
              />
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Coin đã đưa vào yêu cầu rút: <strong className="text-foreground">{formatFullCoin(statusDisplay.withdrawn.number)}</strong>
            </p>
          </div>
        </div>
      </div>

      {/* ===== Tab Doanh thu (Top series theo kỳ — DUY NHẤT) ===== */}
      <Tabs defaultValue="revenue" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="revenue">Doanh thu</TabsTrigger>
          <TabsTrigger value="activity">Hoạt động</TabsTrigger>
          <TabsTrigger value="withdrawals">Rút tiền ({withdrawals.length})</TabsTrigger>
          <TabsTrigger value="transactions">Biến động ví</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue">
          <TopSeriesPeriod userId={userId} role={role} data={data} />
        </TabsContent>

        <TabsContent value="activity">
          <div className="rounded-xl border bg-card">
            {activity.length === 0 ? (
              <EmptyState
                icon={Sparkles}
                title="Chưa có hoạt động doanh thu"
                hint="Khi có doanh thu, lịch sử sẽ hiển thị tại đây."
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

        <TabsContent value="withdrawals">
          <div className="space-y-4">
            <p className="text-[11px] text-muted-foreground">
              {withdrawalsTotal > 0
                ? `${withdrawalsTotal} yêu cầu rút (BE cung cấp tổng)`
                : `${withdrawals.length} yêu cầu đang hiển thị`}
            </p>
            <WithdrawalList items={withdrawals} />
            {collaborations.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Phân chia doanh thu hợp tác
                </p>
                <CollaborationTable rows={collaborations} />
              </div>
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="transactions">
          <PaginatedTransactions
            rows={transactions}
            pagination={transactionsPagination}
            onChangeParams={onChangeTxParams}
            loading={txLoading}
            fallback={null}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

/* ---------- paginated transactions ---------- */

const TX_TYPE_OPTIONS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'Deposit', label: 'Nạp Coin' },
  { value: 'Purchase', label: 'Mua chapter' },
  { value: 'Revenue', label: 'Doanh thu' },
  { value: 'Withdrawal', label: 'Rút Coin' },
  { value: 'Refund', label: 'Hoàn tiền' },
]

function PaginatedTransactions({
  rows,
  pagination,
  onChangeParams,
  loading,
}) {
  const [type, setType] = useState('all')
  const [sort, setSort] = useState('desc')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  // Đồng bộ filters với BE qua callback — CHỈ set state, KHÔNG gọi API bên trong.
  useEffect(() => {
    onChangeParams?.({
      type: type === 'all' ? undefined : type,
      sort,
      from_date: fromDate || undefined,
      to_date: toDate || undefined,
      page: 1,
    })
  }, [type, sort, fromDate, toDate, onChangeParams])

  const list = Array.isArray(rows) ? rows : []
  const page = pagination?.page ?? 1
  const pages = pagination?.pages ?? 1
  const total = pagination?.total ?? list.length

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <div className="space-y-1">
          <Label htmlFor="tx-type" className="text-xs">Loại</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger id="tx-type" className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TX_TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="tx-sort" className="text-xs">Sắp xếp</Label>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger id="tx-sort" className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">Mới nhất</SelectItem>
              <SelectItem value="asc">Cũ nhất</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="tx-from" className="text-xs">Từ ngày</Label>
          <Input
            id="tx-from"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="h-8"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="tx-to" className="text-xs">Đến ngày</Label>
          <Input
            id="tx-to"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="h-8"
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{total} giao dịch</p>

      {loading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Đang tải...
        </div>
      ) : list.length === 0 ? (
        <EmptyState icon={Wallet} title="Chưa có giao dịch" />
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {list.map((entry, i) => {
            const amount = pickCoinDisplay(entry, [
              'coin_amount_coin_display',
              'coin_amount_coin',
              'coin_display',
              'coin_amount',
              'amount',
            ])
            const direction =
              entry.direction === 'in'
                ? 'in'
                : entry.direction === 'out'
                  ? 'out'
                  : entry.type === 'Purchase' || entry.type === 'Withdrawal'
                    ? 'out'
                    : 'in'
            const rightClass =
              direction === 'in'
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            return (
              <li
                key={entry._id ?? entry.id ?? i}
                className="flex items-center justify-between gap-3 px-4 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {entry.description ?? entry.type ?? '—'}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {entry.type ?? '—'} · {formatDate(entry.createdAt ?? entry.created_at)}
                  </p>
                </div>
                <span className={cn('shrink-0 font-semibold tabular-nums', rightClass)}>
                  {direction === 'in' ? '+' : '−'}
                  {formatCoinStringWithUnit(amount.display)}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      {pages > 1 ? (
        <div className="flex items-center justify-end gap-2 text-xs">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => onChangeParams?.({ page: page - 1 })}
          >
            Trước
          </Button>
          <span>Trang {page} / {pages}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pages || loading}
            onClick={() => onChangeParams?.({ page: page + 1 })}
          >
            Sau
          </Button>
        </div>
      ) : null}
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
  const [transactions, setTransactions] = useState([])
  const [txPagination, setTxPagination] = useState(null)
  const [txTotal, setTxTotal] = useState(0)
  const [txParams, setTxParams] = useState({ page: 1, limit: 50 })
  const [txLoading, setTxLoading] = useState(false)

  const role = user?.role ?? data?.user_role ?? data?.role ?? ''
  const roleNormalized = String(role).toLowerCase()
  const fetchedAt = data?.fetched_at ?? data?.last_sync ?? null

  /* =========================================================
   * Effect financial detail — chỉ phụ thuộc open + user.id.
   * ========================================================= */
  useEffect(() => {
    if (!open || !user?.id) return
    let cancelled = false
    Promise.resolve()
      .then(async () => {
        setLoading(true)
        setError('')
        try {
          const res = await api.getUserFinancials(user.id)
          if (!cancelled) setData(res)
        } catch (err) {
          if (cancelled) return
          const msg = err?.response?.data?.message || 'Không tải được dữ liệu tài chính'
          setError(msg)
          toast.error(msg)
        } finally {
          if (!cancelled) setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [open, user?.id])

  /* =========================================================
   * Effect transactions — phụ thuộc open, user.id, role và txParams.
   * Đổi txParams KHÔNG gọi lại getUserFinancials.
   * Reader KHÔNG render paginated transactions → KHÔNG gọi endpoint.
   * ========================================================= */
  useEffect(() => {
    if (!open || !user?.id) return
    if (roleNormalized !== 'mangaka' && roleNormalized !== 'assistant') {
      Promise.resolve().then(() => {
        setTransactions([])
        setTxPagination(null)
        setTxTotal(0)
        setTxLoading(false)
      })
      return
    }
    let cancelled = false
    Promise.resolve()
      .then(async () => {
        setTxLoading(true)
        try {
          const res = await api.getUserFinancialsTransactions(user.id, txParams)
          const list = Array.isArray(res?.transactions)
            ? res.transactions
            : Array.isArray(res?.items)
              ? res.items
              : Array.isArray(res?.data)
                ? res.data
                : Array.isArray(res)
                  ? res
                  : []
          if (cancelled) return
          setTransactions(list)
          setTxPagination(res?.pagination ?? null)
          setTxTotal(Number(res?.pagination?.total ?? list.length))
        } catch {
          if (cancelled) return
          setTransactions([])
          setTxPagination(null)
          setTxTotal(0)
        } finally {
          if (!cancelled) setTxLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [open, user?.id, roleNormalized, txParams])

  const onChangeTxParams = useCallback(
    (next) => {
      // CHỈ set state, KHÔNG gọi API bên trong callback.
      setTxParams((prev) => ({ ...prev, ...next }))
    },
    [],
  )

  const handleRefresh = useCallback(() => {
    const id = user?.id
    if (!id) return
    // Re-trigger cả financial detail + transactions.
    setData(null)
    setLoading(true)
    Promise.resolve()
      .then(async () => {
        try {
          const res = await api.getUserFinancials(id)
          setData(res)
        } catch (err) {
          const msg = err?.response?.data?.message || 'Không tải được dữ liệu tài chính'
          toast.error(msg)
        } finally {
          setLoading(false)
        }
      })
  }, [user])

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
            onRefresh={handleRefresh}
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
                <Button size="sm" variant="outline" onClick={handleRefresh}>
                  Thử lại
                </Button>
              </div>
            ) : !data ? (
              <EmptyState icon={Wallet} title="Không có dữ liệu" />
            ) : roleNormalized === 'reader' ? (
              <ReaderView data={data} />
            ) : roleNormalized === 'mangaka' || roleNormalized === 'assistant' ? (
              <EarnView
                data={data}
                userId={user.id}
                role={role}
                transactions={transactions}
                transactionsPagination={txPagination}
                transactionsTotal={txTotal}
                onChangeTxParams={onChangeTxParams}
                txLoading={txLoading}
              />
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
