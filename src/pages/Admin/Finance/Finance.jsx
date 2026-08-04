import { useCallback, useEffect, useState } from 'react'
import { Banknote, Loader2, RefreshCcw, TrendingUp, Users, BookOpen, DollarSign } from 'lucide-react'
import { api } from '@/api/index.js'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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

/* ---------- format helpers ----------
 * Finance dashboard gắn các endpoint BE theo spec 2026-08-04:
 *
 * /admin/finance/summary:
 *   total_circulation_coin_display / total_revenue_all_time_coin_display
 *
 * /admin/finance/revenue-timeline:
 *   points: [{ date, revenue_coin_display, withdrawal_coin_display }]
 *   summary: { total_revenue_coin_display, total_withdrawal_coin_display, net_flow_coin_display }
 *
 * /admin/dashboard/finance:
 *   top_mangaka / top_assistant / top_reader
 *
 * /admin/payments:
 *   summary: { total_coin_display, count }
 */

function formatCoin(n) {
  // BE trả coin_display là string kiểu "2.40" → parse đúng rồi format lại 2 decimal
  const num = Number(n) || 0
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`
  return num.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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
            {formatCoin(value)}
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

export default function Finance() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Revenue analytics
  const [financeSummary, setFinanceSummary] = useState(null)
  const [paymentsSummary, setPaymentsSummary] = useState(null)
  const [revenueTimeline, setRevenueTimeline] = useState(null)
  const [dashboardFinance, setDashboardFinance] = useState(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [timelineError, setTimelineError] = useState(false)

  const loadStats = useCallback(async () => {
    setStatsLoading(true)
    setTimelineLoading(true)
    setTimelineError(false)
    console.groupCollapsed('[Finance] loadStats start')
    try {
      const [sumRes, payRes, timelineRes, dashRes] = await Promise.allSettled([
        api.getFinanceSummary(),
        api.getPayments({ limit: 1 }),
        api.getRevenueTimeline({ days: 30 }),
        api.getDashboardFinance({ limit: 10 }),
      ])
      console.log('[Finance] raw responses', {
        summary: { status: sumRes.status, value: sumRes.status === 'fulfilled' ? sumRes.value : sumRes.reason },
        payments: { status: payRes.status, value: payRes.status === 'fulfilled' ? payRes.value : payRes.reason },
        timeline: {
          status: timelineRes.status,
          value: timelineRes.status === 'fulfilled' ? timelineRes.value : timelineRes.reason,
        },
        dashboard: { status: dashRes.status, value: dashRes.status === 'fulfilled' ? dashRes.value : dashRes.reason },
      })
      if (sumRes.status === 'fulfilled') setFinanceSummary(sumRes.value)
      if (payRes.status === 'fulfilled') {
        const items = payRes.value?.items ?? []
        const computedSummary = {
          total_coin_display: items.reduce((s, p) => s + Number(p.coin_amount ?? 0), 0) / (items[0]?.coin_unit_scale ?? 100),
          count: items.length,
          total_vnd: items.reduce((s, p) => s + Number(p.amount_vnd ?? 0), 0),
        }
        setPaymentsSummary(computedSummary)
      }
      if (timelineRes.status === 'fulfilled') {
        console.log('[Finance] timeline success', {
          pointsCount: Array.isArray(timelineRes.value?.points) ? timelineRes.value.points.length : 'not-array',
          firstPoint: timelineRes.value?.points?.[0],
          summary: timelineRes.value?.summary,
          fullValue: timelineRes.value,
        })
        setRevenueTimeline(timelineRes.value)
        setTimelineError(false)
      } else {
        console.warn('[Finance] timeline FAILED', timelineRes.reason)
        setTimelineError(true)
      }
      if (dashRes.status === 'fulfilled') setDashboardFinance(dashRes.value)
    } catch (err) {
      console.warn('Không tải được stats tài chính:', err)
    } finally {
      setStatsLoading(false)
      setTimelineLoading(false)
      setLoading(false)
      setRefreshing(false)
      console.groupEnd()
    }
  }, [])

  useEffect(() => {
    void loadStats()
  }, [loadStats])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-2 text-muted-foreground">
        <Loader2 className="size-10 animate-spin text-amber-500" />
        <p className="text-sm">Đang tải thống kê tài chính...</p>
      </div>
    )
  }

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
            Tổng quan doanh thu, nạp tiền và hoạt động ví — đơn vị hiển thị: <strong>Coin</strong>
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadStats()} disabled={refreshing || statsLoading}>
          <RefreshCcw className={cn('size-4', (refreshing || statsLoading) && 'animate-spin')} />
          Làm mới
        </Button>
      </div>

      {/* ============ Stat Cards ============ */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard
          label="Tổng nạp tiền"
          value={Number(paymentsSummary?.total_coin_display ?? 0)}
          icon={Banknote}
          accent="bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400"
          sub={`${paymentsSummary?.count ?? 0} giao dịch PayOS`}
        />
        <StatCard
          label="Tổng doanh thu"
          value={Number(revenueTimeline?.summary?.total_revenue_coin_display ?? financeSummary?.total_revenue_all_time_coin_display ?? 0)}
          icon={TrendingUp}
          accent="bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400"
          sub="theo ngày"
        />
        <StatCard
          label="Tổng withdrawal"
          value={Number(revenueTimeline?.summary?.total_withdrawal_coin_display ?? 0)}
          icon={DollarSign}
          accent="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"
          sub={`chênh lệch ${revenueTimeline?.summary?.net_flow_coin_display ?? '—'}`}
        />
      </div>

      {/* ============ Revenue Timeline Chart ============ */}
      <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="size-4" />
                  Doanh thu &amp; Withdrawal (30 ngày)
                </CardTitle>
                <CardDescription className="text-xs">
                  Biểu đồ theo ngày — dùng giá trị Coin display
                </CardDescription>
              </div>
              {revenueTimeline?.summary ? (
                <div className="flex gap-4 text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-violet-500 inline-block" />
                    Doanh thu: {revenueTimeline.summary.total_revenue_coin_display ?? '—'}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-emerald-500 inline-block" />
                    Withdrawal: {revenueTimeline.summary.total_withdrawal_coin_display ?? '—'}
                  </span>
                </div>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            {(() => {
              const branch = timelineLoading && !revenueTimeline
                ? 'loading'
                : timelineError && !revenueTimeline
                  ? 'error'
                  : revenueTimeline && revenueTimeline.points && revenueTimeline.points.length > 0
                    ? 'has-data'
                    : 'empty'
              console.log('[Finance] chart render branch =', branch, {
                timelineLoading,
                timelineError,
                revenueTimelineExists: Boolean(revenueTimeline),
                pointsCount: Array.isArray(revenueTimeline?.points) ? revenueTimeline.points.length : 'n/a',
                firstPoint: revenueTimeline?.points?.[0],
              })
              if (branch === 'loading') {
                return (
                  <div className="h-64 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Loader2 className="size-5 animate-spin text-amber-500" />
                      <span className="text-sm">Đang tải biểu đồ...</span>
                    </div>
                    <div className="w-full max-w-md h-40 rounded-lg bg-muted/60 animate-pulse" />
                  </div>
                )
              }
              if (branch === 'error') {
                return (
                  <div className="h-64 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                    <TrendingUp className="size-10 opacity-40" />
                    <p className="text-sm font-medium">Không tải được biểu đồ</p>
                    <p className="text-xs">Vui lòng kiểm tra kết nối hoặc thử lại</p>
                    <Button variant="outline" size="sm" onClick={() => void loadStats()}>
                      <RefreshCcw className="size-4" />
                      Thử lại
                    </Button>
                  </div>
                )
              }
              if (branch === 'has-data') {
                return (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={revenueTimeline.points} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorWithdrawal" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11 }}
                          tickFormatter={(v) => {
                            const d = new Date(v)
                            return `${d.getDate()}/${d.getMonth() + 1}`
                          }}
                          className="text-muted-foreground"
                        />
                        <YAxis
                          tick={{ fontSize: 11 }}
                          tickFormatter={(v) => formatCoin(v)}
                          className="text-muted-foreground"
                          width={60}
                        />
                        <Tooltip
                          formatter={(value, name) => [value, name === 'revenue_coin_display' ? 'Doanh thu' : 'Withdrawal']}
                          labelFormatter={(label) => {
                            const d = new Date(label)
                            return d.toLocaleDateString('vi-VN', { day: '2-digit', month: 'long', year: 'numeric' })
                          }}
                          contentStyle={{ fontSize: 12 }}
                        />
                        <Area
                          type="monotone"
                          dataKey="revenue_coin_display"
                          stroke="#7c3aed"
                          strokeWidth={2}
                          fill="url(#colorRevenue)"
                          dot={false}
                        />
                        <Area
                          type="monotone"
                          dataKey="withdrawal_coin_display"
                          stroke="#10b981"
                          strokeWidth={2}
                          fill="url(#colorWithdrawal)"
                          dot={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )
              }
              return (
                <div className="h-64 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <TrendingUp className="size-10 opacity-40" />
                  <p className="text-sm font-medium">Chưa có dữ liệu doanh thu 30 ngày qua</p>
                  <p className="text-xs">Biểu đồ sẽ tự cập nhật khi có giao dịch mới</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => void loadStats()}
                  >
                    <RefreshCcw className="size-4" />
                    Tải lại
                  </Button>
                </div>
              )
            })()}
          </CardContent>
        </Card>

      {/* ============ Top Earners ============ */}
      {dashboardFinance ? (
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <TrendingUp className="size-5 text-violet-600" />
            <h2 className="text-lg font-bold tracking-tight">Top 10 thu nhập cao nhất</h2>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Top Mangaka */}
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
              <div className="divide-y divide-border/60">
                {((dashboardFinance.top_mangaka ?? []).length === 0) && (
                  <p className="py-8 text-center text-xs text-muted-foreground">Chưa có dữ liệu</p>
                )}
                {(dashboardFinance.top_mangaka ?? []).slice(0, 5).map((u, i) => {
                  const maxCoin = Number((dashboardFinance.top_mangaka ?? [])[0]?.total_coin_display ?? 1)
                  const pct = maxCoin > 0 ? ((Number(u.total_coin_display ?? 0)) / maxCoin) * 100 : 0
                  return (
                    <div key={u.user_id ?? i} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
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
                          <div className="h-full rounded-full bg-rose-400 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold">{formatCoin(Number(u.total_coin_display ?? 0))}</p>
                        <p className="text-[10px] text-muted-foreground">đã rút {formatCoin(Number(u.withdrawn_coin_display ?? 0))}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Top Assistant */}
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
              <div className="divide-y divide-border/60">
                {((dashboardFinance.top_assistant ?? []).length === 0) && (
                  <p className="py-8 text-center text-xs text-muted-foreground">Chưa có dữ liệu</p>
                )}
                {(dashboardFinance.top_assistant ?? []).slice(0, 5).map((u, i) => {
                  const maxCoin = Number((dashboardFinance.top_assistant ?? [])[0]?.total_coin_display ?? 1)
                  const pct = maxCoin > 0 ? ((Number(u.total_coin_display ?? 0)) / maxCoin) * 100 : 0
                  return (
                    <div key={u.user_id ?? i} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
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
                          <div className="h-full rounded-full bg-blue-400 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold">{formatCoin(Number(u.total_coin_display ?? 0))}</p>
                        <p className="text-[10px] text-muted-foreground">đã rút {formatCoin(Number(u.withdrawn_coin_display ?? 0))}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Top Reader */}
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
              <div className="divide-y divide-border/60">
                {((dashboardFinance.top_reader ?? []).length === 0) && (
                  <p className="py-8 text-center text-xs text-muted-foreground">Chưa có dữ liệu</p>
                )}
                {(dashboardFinance.top_reader ?? []).slice(0, 5).map((u, i) => {
                  const maxCoin = Number((dashboardFinance.top_reader ?? [])[0]?.total_coin_spent_display ?? 1)
                  const pct = maxCoin > 0 ? ((Number(u.total_coin_spent_display ?? 0)) / maxCoin) * 100 : 0
                  return (
                    <div key={u.user_id ?? i} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
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
                          <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold">{formatCoin(Number(u.total_coin_spent_display ?? 0))}</p>
                        <p className="text-[10px] text-muted-foreground">{u.chapters_purchased ?? 0} chapters</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}