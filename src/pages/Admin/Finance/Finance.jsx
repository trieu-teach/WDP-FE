import { useCallback, useEffect, useMemo, useState } from 'react'
import { Banknote, BookOpen, Loader2, RefreshCcw, TrendingUp, Users } from 'lucide-react'
import { api } from '@/api/index.js'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { getBackendOrigin } from '@/api/http.js'
import {
  formatCoinString,
  formatCoinStringWithUnit,
  formatVnd,
} from '@/utils/coinFormatter.js'

/* ---------- format helpers ----------
 * Finance dashboard gắn các endpoint BE theo spec 2026-08-05:
 *
 * /admin/finance/revenue-analytics?period=month|quarter|year&year=&month=&quarter=&limit=
 *   filter: { period, year, month?, quarter?, limit }
 *   config: { platform_fee_percent, coin_to_vnd_rate }
 *   summary: { gross_revenue_coin_display, mangaka_revenue_coin_display,
 *              assistant_revenue_coin_display, platform_fee_coin_display,
 *              platform_fee_vnd_display, platform_fee_vnd,
 *              chapters_sold }
 *   points: [{ label, date, gross_revenue_coin_display, mangaka_revenue_coin_display,
 *              assistant_revenue_coin_display, platform_fee_coin_display,
 *              platform_fee_vnd_display, chapters_sold }]
 *   top_series: [{ rank, series_id, series_name, thumbnail?, author_name?,
 *                  chapters_sold, gross_revenue_coin_display, creator_revenue_coin_display,
 *                  platform_fee_coin_display, platform_fee_vnd_display }]
 *
 * /admin/dashboard/finance?limit=5 — top all-time rankings (Mangaka/Assistant/Reader).
 * /admin/payments?page=1&limit=1 — tổng nạp (all-time, không phụ thuộc period).
 *
 * FE KHÔNG tự tính platform fee — luôn lấy từ summary.platform_fee_coin_display +
 * summary.platform_fee_vnd_display. Phần trăm hiển thị lấy từ config.platform_fee_percent.
 */

const PERIOD_OPTIONS = [
  { value: 'month', label: 'Tháng' },
  { value: 'quarter', label: 'Quý' },
  { value: 'year', label: 'Năm' },
]

const QUARTER_OPTIONS = [
  { value: 1, label: 'Quý 1 (T1–T3)' },
  { value: 2, label: 'Quý 2 (T4–T6)' },
  { value: 3, label: 'Quý 3 (T7–T9)' },
  { value: 4, label: 'Quý 4 (T10–T12)' },
]

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: `Tháng ${i + 1}`,
}))

const YEAR_OPTIONS = (() => {
  const now = new Date().getFullYear()
  const list = []
  for (let y = now; y >= now - 5; y -= 1) list.push(y)
  return list
})()

function todayLocalParts() {
  const now = new Date()
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    quarter: Math.floor(now.getMonth() / 3) + 1,
  }
}

function buildPeriodLabel(filter) {
  if (!filter) return ''
  const period = filter.period
  if (period === 'month') return `Tháng ${filter.month}/${filter.year}`
  if (period === 'quarter') return `Quý ${filter.quarter}/${filter.year}`
  if (period === 'year') return `Năm ${filter.year}`
  return ''
}

function formatCoinCompact(n) {
  const num = Number(n) || 0
  if (Math.abs(num) >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`
  if (Math.abs(num) >= 1_000) return `${(num / 1_000).toFixed(2)}K`
  return formatCoinString(num.toFixed(2))
}

function parseDisplay(value, fallback = 0) {
  if (value == null || value === '') return fallback
  const n = Number(String(value).replace(/[,]/g, ''))
  return Number.isFinite(n) ? n : fallback
}

/**
 * Resolve giá trị VND từ BE cho phí hệ thống.
 * Ưu tiên platform_fee_vnd (number) > platform_fee_vnd_display > fallback
 * platform_fee_coin × coin_to_vnd_rate (CHỈ là quy đổi đơn vị hiển thị, KHÔNG tính lại platform fee).
 * Trả về null khi không suy ra được giá trị > 0.
 */
function resolvePlatformFeeVnd(item, coinRate) {
  if (!item || typeof item !== 'object') return null
  const direct = item.platform_fee_vnd ?? item.platform_fee_vnd_display
  const directNum = Number(direct)
  if (Number.isFinite(directNum) && directNum > 0) return directNum
  const coinNum = Number(
    item.platform_fee_coin ?? item.platform_fee_coin_display ?? 0,
  )
  const rateNum = Number(coinRate ?? 0)
  if (coinNum > 0 && rateNum > 0) return coinNum * rateNum
  return null
}

function resolveSeriesThumbUrl(url) {
  if (!url) return ''
  const value = String(url).trim()
  if (!value) return ''
  if (/^(data:|blob:|https?:)/i.test(value)) return value
  const origin = getBackendOrigin()
  return value.startsWith('/') ? `${origin}${value}` : `${origin}/${value}`
}

function StatCard({ label, value, icon: Icon, accent, sub }) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="space-y-1 min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <div className="text-3xl font-bold tracking-tight truncate" title={String(value ?? '')}>
            {formatCoinCompact(value)}
          </div>
          {sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}
        </div>
        <div className={cn('flex size-11 items-center justify-center rounded-xl shadow-sm', accent)}>
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  )
}

function PlatformFeeLabel({ percent }) {
  const p = Number(percent)
  if (!Number.isFinite(p) || p <= 0) return 'Doanh thu hệ thống'
  return `Doanh thu hệ thống (${p.toFixed(1).replace(/\.0$/, '')}%)`
}

function PeriodTooltip({ active, payload, label, coinRate }) {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload ?? {}
  const platformFeeVnd = resolvePlatformFeeVnd(point, coinRate)
  return (
    <div className="rounded-lg border bg-card p-2.5 text-xs shadow-md">
      <p className="mb-1.5 font-medium">{label ?? point.label ?? point.date ?? '—'}</p>
      <ul className="space-y-0.5">
        {payload.map((p) => (
          <li key={p.dataKey} className="flex items-center gap-2">
            <span
              className="size-2 rounded-full"
              style={{ background: p.color }}
            />
            <span className="text-muted-foreground">{p.name}:</span>
            <span className="font-semibold tabular-nums">
              {formatCoinStringWithUnit(p.value)}
            </span>
          </li>
        ))}
        {platformFeeVnd != null && Number(platformFeeVnd) > 0 ? (
          <li className="flex items-center gap-2 border-t pt-1 text-muted-foreground">
            <span>Doanh thu hệ thống VND:</span>
            <span className="font-semibold tabular-nums">{formatVnd(platformFeeVnd)}</span>
          </li>
        ) : null}
        {coinRate != null && (
          <li className="text-[10px] text-muted-foreground">Tỉ giá: 1 Coin = {coinRate} ₫</li>
        )}
      </ul>
    </div>
  )
}

function SeriesRow({ item, index = 0, max, coinRate }) {
  const gross = parseDisplay(item.gross_revenue_coin_display ?? item.gross_revenue_coin, 0)
  const creator = parseDisplay(item.creator_revenue_coin_display ?? item.creator_revenue_coin, 0)
  const platform = parseDisplay(item.platform_fee_coin_display ?? item.platform_fee_coin, 0)
  const platformVnd = resolvePlatformFeeVnd(item, coinRate)
  const chapters = Number(item.chapters_sold ?? 0)
  const pct = max > 0 ? Math.max(2, (gross / max) * 100) : 2
  const thumb = resolveSeriesThumbUrl(item.thumbnail ?? item.cover_image_url)
  const initials = (item.series_name ?? item.series_slug ?? '?').slice(0, 2).toUpperCase()
  // BE đôi khi không trả field `rank` — fallback theo index mảng để luôn hiện số thứ tự.
  const rank = Number(item.rank ?? item.position ?? index + 1) || index + 1
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <div className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold',
        rank === 1 ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' :
        rank === 2 ? 'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300' :
        rank === 3 ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300' :
        'bg-muted text-muted-foreground'
      )}>
        {rank}
      </div>
      <Avatar size="sm" className="size-9 shrink-0">
        {thumb ? <AvatarImage src={thumb} alt={item.series_name ?? ''} /> : null}
        <AvatarFallback className="bg-muted text-xs font-semibold">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{item.series_name ?? '—'}</p>
        <p className="truncate text-[11px] text-muted-foreground">
          {item.author_name ? `Tác giả: ${item.author_name}` : '—'}
        </p>
        <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-violet-400 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="shrink-0 text-right text-xs">
        <p className="text-sm font-bold tabular-nums">
          {formatCoinStringWithUnit(item.gross_revenue_coin_display ?? gross.toFixed(2))}
        </p>
        <p className="text-[10px] text-muted-foreground">
          Nhà sáng tạo {formatCoinCompact(creator)} · Phí hệ thống {formatCoinCompact(platform)}
        </p>
        {platformVnd != null && Number(platformVnd) > 0 ? (
          <p className="text-[10px] text-muted-foreground">
            Phí hệ thống {formatVnd(platformVnd)}
          </p>
        ) : null}
        <p className="text-[10px] text-muted-foreground">{chapters} lượt mua chương</p>
      </div>
    </li>
  )
}

function TopEarnersList({ items, kind }) {
  if (!Array.isArray(items) || items.length === 0) {
    return (
      <p className="py-8 text-center text-xs text-muted-foreground">Chưa có dữ liệu</p>
    )
  }
  const top = items[0] ?? {}
  const maxCoin = kind === 'reader'
    ? parseDisplay(top.total_coin_spent_display ?? top.total_coin_spent, 1)
    : parseDisplay(top.total_coin_display ?? top.total_coin, 1)
  return (
    <ul className="divide-y divide-border/60">
      {items.map((u, i) => {
        const value = kind === 'reader'
          ? parseDisplay(u.total_coin_spent_display ?? u.total_coin_spent, 0)
          : parseDisplay(u.total_coin_display ?? u.total_coin, 0)
        const pct = maxCoin > 0 ? (value / maxCoin) * 100 : 0
        const chapters = kind === 'reader'
          ? Number(u.chapters_bought ?? u.chapters_purchased ?? 0)
          : Number(u.chapters_sold ?? 0)
        const accent = kind === 'mangaka' ? 'bg-rose-400' : kind === 'assistant' ? 'bg-blue-400' : 'bg-emerald-400'
        return (
          <li key={u.user_id ?? i} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
            <div className={cn(
              'flex size-8 min-w-[2rem] items-center justify-center rounded-xl text-xs font-bold',
              i === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' :
              i === 1 ? 'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300' :
              i === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300' :
              'bg-muted text-muted-foreground'
            )}>
              {i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{u.full_name ?? u.username ?? '—'}</p>
              <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className={cn('h-full rounded-full transition-all', accent)} style={{ width: `${pct}%` }} />
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-bold">{formatCoinCompact(value)}</p>
              <p className="text-[10px] text-muted-foreground">{chapters} lượt mua chương</p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export default function Finance() {
  // ---- Filter state (period analytics) ----
  const today = todayLocalParts()
  const [period, setPeriod] = useState('month')
  const [year, setYear] = useState(today.year)
  const [month, setMonth] = useState(today.month)
  const [quarter, setQuarter] = useState(today.quarter)

  // ---- Analytics data (theo period) ----
  const [analytics, setAnalytics] = useState(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(true)
  const [analyticsError, setAnalyticsError] = useState(false)

  // ---- Overview (all-time, không phụ thuộc period) ----
  const [paymentsSummary, setPaymentsSummary] = useState(null)

  // ---- Top rankings (all-time, gọi với limit=5) ----
  const [dashboardRankings, setDashboardRankings] = useState(null)
  const [rankingsLoading, setRankingsLoading] = useState(false)

  // ---- Loading flags ----
  const [refreshing, setRefreshing] = useState(false)
  const initialLoading = analyticsLoading && !analytics

  /* =========================================================
   * loadAnalytics — gọi DUY NHẤT khi period/year/month/quarter đổi.
   * Tuyệt đối không gọi payments/dashboard ở đây.
   * ========================================================= */
  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true)
    setAnalyticsError(false)
    try {
      const params = { period, year }
      if (period === 'month') params.month = month
      if (period === 'quarter') params.quarter = quarter
      const res = await api.getRevenueAnalytics(params)
      setAnalytics(res)
    } catch (err) {
      console.warn('Không tải được revenue analytics:', err)
      setAnalytics(null)
      setAnalyticsError(true)
    } finally {
      setAnalyticsLoading(false)
    }
  }, [period, year, month, quarter])

  /* =========================================================
   * loadOverview — tĩnh/all-time, không phụ thuộc period.
   * ========================================================= */
  const loadOverview = useCallback(async () => {
    try {
      const payRes = await api.getPayments({ page: 1, limit: 1 })
      setPaymentsSummary(payRes?.summary ?? null)
    } catch (err) {
      console.warn('Không tải được payments summary:', err)
      setPaymentsSummary(null)
    }
  }, [])

  /* =========================================================
   * loadDashboardRankings — gọi với limit=5, không slice 10→5.
   * ========================================================= */
  const loadDashboardRankings = useCallback(async () => {
    setRankingsLoading(true)
    try {
      const res = await api.getDashboardFinance({ limit: 5 })
      setDashboardRankings(res ?? null)
    } catch (err) {
      console.warn('Không tải được dashboard rankings:', err)
      setDashboardRankings(null)
    } finally {
      setRankingsLoading(false)
    }
  }, [])

  /* =========================================================
   * refreshAll — gọi khi bấm "Làm mới" tổng.
   * ========================================================= */
  const refreshAll = useCallback(async () => {
    setRefreshing(true)
    try {
      await Promise.allSettled([
        loadAnalytics(),
        loadOverview(),
        loadDashboardRankings(),
      ])
    } finally {
      setRefreshing(false)
    }
  }, [loadAnalytics, loadOverview, loadDashboardRankings])

  // Mount: load all-time overview + rankings một lần.
  // KHÔNG gọi payments/dashboard khi đổi period.
  // Effect defer setState bằng microtask để không vi phạm react-hooks rule.
  const [hasMounted, setHasMounted] = useState(false)
  useEffect(() => {
    if (hasMounted) return
    Promise.resolve()
      .then(() => loadOverview())
      .then(() => loadDashboardRankings())
      .then(() => setHasMounted(true))
  }, [hasMounted, loadOverview, loadDashboardRankings])

  // Đổi period/year/month/quarter → CHỉ loadAnalytics, KHÔNG refetch payments/dashboard.
  useEffect(() => {
    Promise.resolve().then(() => loadAnalytics())
  }, [loadAnalytics])

  /* =========================================================
   * Derived values
   * ========================================================= */
  const summary = useMemo(() => analytics?.summary ?? null, [analytics])
  const config = useMemo(() => analytics?.config ?? null, [analytics])

  const chartPoints = useMemo(
    () =>
      (analytics?.points ?? []).map((p) => ({
        label: p.label ?? p.date,
        date: p.date,
        gross: parseDisplay(p.gross_revenue_coin_display ?? p.gross_revenue_coin, 0),
        mangaka: parseDisplay(p.mangaka_revenue_coin_display ?? p.mangaka_revenue_coin, 0),
        assistant: parseDisplay(p.assistant_revenue_coin_display ?? p.assistant_revenue_coin, 0),
        platform_fee: parseDisplay(p.platform_fee_coin_display ?? p.platform_fee_coin, 0),
        platform_fee_vnd: parseDisplay(p.platform_fee_vnd_display ?? p.platform_fee_vnd, 0),
        chapters_sold: Number(p.chapters_sold ?? 0),
      })),
    [analytics],
  )
  const topSeries = useMemo(() => analytics?.top_series ?? [], [analytics])
  const activeFilter = useMemo(
    () => analytics?.filter ?? { period, year, month, quarter },
    [analytics, period, year, month, quarter],
  )

  const platformFeePercent = Number(config?.platform_fee_percent ?? 0)
  const coinRate = Number(config?.coin_to_vnd_rate ?? 0)

  const topSeriesMax = useMemo(
    () =>
      topSeries.reduce((m, s) => {
        const v = parseDisplay(s.gross_revenue_coin_display ?? s.gross_revenue_coin, 0)
        return v > m ? v : m
      }, 0),
    [topSeries],
  )

  const paymentsCount = Number(paymentsSummary?.count ?? 0)
  const paymentsTotalCoinDisplay = String(
    paymentsSummary?.total_coin_display ?? paymentsSummary?.total_coin ?? '0',
  )

  /* =========================================================
   * Render helpers
   * ========================================================= */
  if (initialLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-2 text-muted-foreground">
        <Loader2 className="size-10 animate-spin text-amber-500" />
        <p className="text-sm">Đang tải thống kê tài chính...</p>
      </div>
    )
  }

  const periodLabel = buildPeriodLabel(activeFilter)

  return (
    <div className="space-y-6">
      {/* ============ Header + Refresh ============ */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/20">
              <Banknote className="size-5 text-white" />
            </div>
            Tài chính
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tổng quan doanh thu theo kỳ — đơn vị hiển thị: <strong>Coin</strong>
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void refreshAll()}
          disabled={refreshing}
        >
          <RefreshCcw className={cn('size-4', refreshing && 'animate-spin')} />
          Làm mới
        </Button>
      </div>

      {/* ============ Period Filter ============ */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="finance-period" className="text-xs">Kỳ thống kê</Label>
            <Select value={period} onValueChange={(v) => setPeriod(v)}>
              <SelectTrigger id="finance-period" className="h-9 w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="finance-year" className="text-xs">Năm</Label>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger id="finance-year" className="h-9 w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {YEAR_OPTIONS.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {period === 'month' ? (
            <div className="flex items-center gap-2">
              <Label htmlFor="finance-month" className="text-xs">Tháng</Label>
              <Select
                value={String(month)}
                onValueChange={(v) => setMonth(Number(v))}
              >
                <SelectTrigger id="finance-month" className="h-9 w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_OPTIONS.map((m) => (
                    <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          {period === 'quarter' ? (
            <div className="flex items-center gap-2">
              <Label htmlFor="finance-quarter" className="text-xs">Quý</Label>
              <Select
                value={String(quarter)}
                onValueChange={(v) => setQuarter(Number(v))}
              >
                <SelectTrigger id="finance-quarter" className="h-9 w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUARTER_OPTIONS.map((q) => (
                    <SelectItem key={q.value} value={String(q.value)}>{q.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="font-mono">{periodLabel}</Badge>
            {platformFeePercent > 0 ? (
              <Badge variant="secondary">Doanh thu hệ thống: {platformFeePercent}%</Badge>
            ) : null}
            {coinRate > 0 ? (
              <Badge variant="secondary">1 Coin = {coinRate} ₫</Badge>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* ============ KPI Cards (no duplicate meaning) ============ */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard
          label="Tổng doanh thu bán chương"
          value={parseDisplay(summary?.gross_revenue_coin_display ?? summary?.gross_revenue_coin, 0)}
          icon={TrendingUp}
          accent="bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400"
          sub={periodLabel}
        />
        <StatCard
          label="Doanh thu nhà sáng tạo"
          value={parseDisplay(summary?.mangaka_revenue_coin_display ?? summary?.mangaka_revenue_coin, 0)}
          icon={BookOpen}
          accent="bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400"
          sub={periodLabel}
        />
        <StatCard
          label="Doanh thu trợ lý"
          value={parseDisplay(summary?.assistant_revenue_coin_display ?? summary?.assistant_revenue_coin, 0)}
          icon={Users}
          accent="bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400"
          sub={periodLabel}
        />
        <StatCard
          label={PlatformFeeLabel({ percent: platformFeePercent })}
          value={parseDisplay(summary?.platform_fee_coin_display ?? summary?.platform_fee_coin, 0)}
          icon={Banknote}
          accent="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"
          sub={(() => {
            const vnd = resolvePlatformFeeVnd(summary ?? {}, coinRate)
            return vnd != null ? formatVnd(vnd) : 'Doanh thu hệ thống'
          })()}
        />
        <StatCard
          label="Lượt mua chương"
          value={Number(summary?.chapters_sold ?? 0)}
          icon={BookOpen}
          accent="bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400"
          sub={`${paymentsCount} giao dịch PayOS · ${paymentsTotalCoinDisplay} coin nạp`}
        />
      </div>

      {/* ============ Revenue Chart ============ */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="size-4" />
            Doanh thu theo kỳ
          </CardTitle>
          <CardDescription className="text-xs">
            Tổng doanh thu / Doanh thu nhà sáng tạo / Doanh thu trợ lý / Doanh thu hệ thống — dùng giá trị từ BE.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(() => {
            const branch = analyticsLoading && !analytics
              ? 'loading'
              : analyticsError && !analytics
                ? 'error'
                : chartPoints.length > 0
                  ? 'has-data'
                  : 'empty'
            if (branch === 'loading') {
              return (
                <div className="h-72 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                  <Loader2 className="size-5 animate-spin text-amber-500" />
                  <span className="text-sm">Đang tải biểu đồ...</span>
                </div>
              )
            }
            if (branch === 'error') {
              return (
                <div className="h-72 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                  <TrendingUp className="size-10 opacity-40" />
                  <p className="text-sm font-medium">Không tải được biểu đồ</p>
                  <Button variant="outline" size="sm" onClick={() => void loadAnalytics()}>
                    <RefreshCcw className="size-4" />
                    Thử lại
                  </Button>
                </div>
              )
            }
            if (branch === 'has-data') {
              return (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartPoints} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="cGross" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="cMangaka" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="cAssistant" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="cFee" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11 }}
                        className="text-muted-foreground"
                      />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) => formatCoinCompact(v)}
                        className="text-muted-foreground"
                        width={60}
                      />
                      <Tooltip
                        content={<PeriodTooltip coinRate={coinRate || undefined} />}
                      />
                      <Area
                        type="monotone"
                        dataKey="gross"
                        name="Tổng doanh thu"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        fill="url(#cGross)"
                        dot={false}
                      />
                      <Area
                        type="monotone"
                        dataKey="mangaka"
                        name="Nhà sáng tạo"
                        stroke="#f43f5e"
                        strokeWidth={2}
                        fill="url(#cMangaka)"
                        dot={false}
                      />
                      <Area
                        type="monotone"
                        dataKey="assistant"
                        name="Trợ lý"
                        stroke="#8b5cf6"
                        strokeWidth={2}
                        fill="url(#cAssistant)"
                        dot={false}
                      />
                      <Area
                        type="monotone"
                        dataKey="platform_fee"
                        name="Doanh thu hệ thống"
                        stroke="#10b981"
                        strokeWidth={2}
                        fill="url(#cFee)"
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )
            }
            return (
              <div className="h-72 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <TrendingUp className="size-10 opacity-40" />
                <p className="text-sm font-medium">Chưa có dữ liệu trong kỳ đã chọn</p>
                <Button variant="ghost" size="sm" onClick={() => void loadAnalytics()}>
                  <RefreshCcw className="size-4" />
                  Tải lại
                </Button>
              </div>
            )
          })()}
        </CardContent>
      </Card>

      {/* ============ Top Series (period) ============ */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="size-4" />
                Truyện có doanh thu cao nhất · {periodLabel}
              </CardTitle>
              <CardDescription className="text-xs">
                Xếp hạng từ BE theo kỳ đang chọn — KHÔNG dùng dashboard finance all-time.
              </CardDescription>
            </div>
            <Badge variant="outline">{topSeries.length}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {topSeries.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">
              Chưa có dữ liệu top series trong kỳ này
            </p>
          ) : (
            <ul className="divide-y rounded-lg border bg-card">
              {topSeries.map((s, index) => (
                <SeriesRow
                  key={s.series_id ?? s.rank ?? s.series_name ?? index}
                  item={s}
                  index={index}
                  max={topSeriesMax}
                  coinRate={coinRate}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ============ All-time Top Rankings (gọi với limit=5) ============ */}
      {dashboardRankings ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="size-5 text-violet-600" />
            <h2 className="text-lg font-bold tracking-tight">Top 5 thu nhập cao nhất (all-time)</h2>
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="flex items-center gap-2.5 px-4 py-3 bg-rose-50 dark:bg-rose-500/10 border-b border-rose-100 dark:border-rose-500/20">
                <div className="flex size-8 items-center justify-center rounded-lg bg-rose-500/15">
                  <BookOpen className="size-4 text-rose-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">Mangaka</p>
                  <p className="text-[11px] text-rose-500 dark:text-rose-400">Thu nhập cao nhất</p>
                </div>
              </div>
              <TopEarnersList items={dashboardRankings.top_mangaka ?? []} kind="mangaka" />
            </div>
            <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="flex items-center gap-2.5 px-4 py-3 bg-blue-50 dark:bg-blue-500/10 border-b border-blue-100 dark:border-blue-500/20">
                <div className="flex size-8 items-center justify-center rounded-lg bg-blue-500/15">
                  <Users className="size-4 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">Assistant</p>
                  <p className="text-[11px] text-blue-500 dark:text-blue-400">Thu nhập cao nhất</p>
                </div>
              </div>
              <TopEarnersList items={dashboardRankings.top_assistant ?? []} kind="assistant" />
            </div>
            <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="flex items-center gap-2.5 px-4 py-3 bg-emerald-50 dark:bg-emerald-500/10 border-b border-emerald-100 dark:border-emerald-500/20">
                <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/15">
                  <Banknote className="size-4 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Reader</p>
                  <p className="text-[11px] text-emerald-500 dark:text-emerald-400">Tiêu nhiều nhất</p>
                </div>
              </div>
              <TopEarnersList items={dashboardRankings.top_reader ?? []} kind="reader" />
            </div>
          </div>
        </div>
      ) : rankingsLoading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          <span className="text-xs">Đang tải bảng xếp hạng...</span>
        </div>
      ) : null}
    </div>
  )
}
