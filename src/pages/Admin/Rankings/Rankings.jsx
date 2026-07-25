import { useCallback, useEffect, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Award,
  BarChart3,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsLeft,
  ChevronsRight,
  Crown,
  Eye,
  Loader2,
  Search,
  ThumbsUp,
  Trophy,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api } from '@/api/index.js'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

const TYPE_OPTIONS = [
  { value: 'views', label: 'Lượt đọc' },
  { value: 'votes', label: 'Lượt bình chọn' },
  { value: 'rating', label: 'Điểm đánh giá' },
]

const PERIOD_OPTIONS = [
  { value: 'daily', label: 'Hôm nay' },
  { value: 'weekly', label: 'Tuần này' },
  { value: 'monthly', label: 'Tháng này' },
  { value: 'all', label: 'Tất cả' },
]

function formatNum(n) {
  const num = Number(n) || 0
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`
  return String(num)
}

function StatCard({ label, value, change, icon: Icon, accent }) {
  const up = change >= 0
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <div className="text-3xl font-bold tracking-tight">{formatNum(value)}</div>
          {change !== undefined && (
            <div
              className={cn(
                'flex items-center gap-1 text-xs font-medium',
                up ? 'text-emerald-600' : 'text-rose-600',
              )}
            >
              {up ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
              {Math.abs(change)}%
            </div>
          )}
        </div>
        <div
          className={cn(
            'flex size-11 items-center justify-center rounded-xl shadow-sm',
            accent,
          )}
        >
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  )
}

function MiniLineChart({ data, dataKey, color, height = 80 }) {
  if (!data?.length) return <div className="h-20" />
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
        <XAxis dataKey="date" tick={false} axisLine={false} tickLine={false} />
        <YAxis hide />
        <Tooltip
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: 'none',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
          labelStyle={{ fontSize: 11, color: '#888' }}
        />
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

function Top10Chart({ data, type, period }) {
  if (!data?.length) return null

  const getValue = (item) => {
    if (type === 'views') {
      if (period === 'all') return item.views_count ?? 0
      if (period === 'daily') return item.views_today ?? 0
      if (period === 'weekly') return item.views_weekly ?? 0
      if (period === 'monthly') return item.views_monthly ?? 0
      return item.views_today ?? 0
    }
    if (type === 'votes') {
      if (period === 'all') return item.votes_count ?? 0
      if (period === 'daily') return item.votes_today ?? 0
      if (period === 'weekly') return item.votes_weekly ?? 0
      if (period === 'monthly') return item.votes_monthly ?? 0
      return item.votes_today ?? 0
    }
    return (item.average_score ?? 0) * (item.total_votes ?? 1)
  }

  const chartData = data.slice(0, 10).map((item) => ({
    name: item.title ?? item.name ?? '—',
    value: getValue(item),
    cover: item.cover_image_url,
    rank: item.rank,
  }))

  const maxVal = Math.max(...chartData.map((d) => d.value), 1)
  const BAR_COLORS = [
    '#f59e0b', '#6366f1', '#10b981', '#ef4444', '#8b5cf6',
    '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16',
  ]

  const chartLabel = type === 'views' ? 'Lượt đọc' : type === 'votes' ? 'Bình chọn' : 'Điểm TB'
  const periodLabel = period === 'monthly' ? 'tháng' : period === 'daily' ? 'hôm nay' : 'tuần'

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="size-4" />
          Top 10 - {chartLabel} {periodLabel}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-around gap-2 px-2" style={{ height: 260 }}>
          {chartData.map((item, i) => {
            const barHeight = Math.max((item.value / maxVal) * 120, 20)
            return (
            <div key={i} className="flex flex-col items-center gap-1 flex-1 min-w-0">
              <img
                src={item.cover}
                alt={item.name}
                className="w-14 h-18 rounded-md object-cover shadow-lg border-2"
                style={{ borderColor: BAR_COLORS[i] }}
                crossOrigin="anonymous"
              />
              <div 
                className="w-full rounded-md relative overflow-hidden flex items-center justify-center"
                style={{ 
                  height: barHeight,
                  backgroundColor: BAR_COLORS[i],
                  minHeight: 20
                }}
              >
                <span className="text-white font-bold text-xs drop-shadow-md">
                  {formatNum(item.value)}
                </span>
              </div>
              <span className="text-[10px] text-center font-medium truncate w-full" title={item.name}>
                {item.name.length > 10 ? item.name.slice(0, 10) + '…' : item.name}
              </span>
            </div>
          )})
          }
        </div>
      </CardContent>
    </Card>
  )
}

function SeriesDetailModal({ id, open, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !id) return
    setLoading(true)
    api
      .getRankingsSeriesDetail(id)
      .then(setData)
      .catch(() => toast.error('Không tải được chi tiết series'))
      .finally(() => setLoading(false))
  }, [open, id])

  const series = data?.series
  const daily = data?.trends?.daily ?? []
  const weekly = data?.trends?.weekly ?? []
  const topChapters = data?.top_chapters ?? []

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="size-5 text-amber-500" />
            {series?.name ?? 'Chi tiết Series'}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {series && (
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
                  <Eye className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{formatNum(series.views_count ?? 0)}</span>
                  <span className="text-xs text-muted-foreground">lượt đọc</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
                  <ThumbsUp className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{formatNum(series.total_votes ?? 0)}</span>
                  <span className="text-xs text-muted-foreground">bình chọn</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
                  <ChevronUp className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{Number(series.average_score ?? 0).toFixed(1)}</span>
                  <span className="text-xs text-muted-foreground">/ 5</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Lượt đọc 7 ngày</CardTitle>
                </CardHeader>
                <CardContent>
                  <MiniLineChart
                    data={daily}
                    dataKey="views_count"
                    color="var(--primary)"
                    height={100}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Bình chọn 7 ngày</CardTitle>
                </CardHeader>
                <CardContent>
                  <MiniLineChart
                    data={daily}
                    dataKey="votes_count"
                    color="#f59e0b"
                    height={100}
                  />
                </CardContent>
              </Card>
            </div>

            {topChapters.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Top Chapters</CardTitle>
                  <CardDescription>Chapter có lượt đọc cao nhất</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Chương</TableHead>
                        <TableHead className="text-right">Lượt đọc</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topChapters.slice(0, 3).map((ch) => (
                        <TableRow key={ch.chapter_number}>
                          <TableCell className="font-medium">{ch.chapter_number}</TableCell>
                          <TableCell>{ch.title ?? `Chapter ${ch.chapter_number}`}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatNum(ch.views_count ?? 0)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function getColumnsByPeriod(type, period) {
  const baseCols = [
    { key: 'rank', label: '#', className: 'w-12 text-center font-bold' },
    { key: 'cover', label: 'Cover', className: 'w-16' },
    { key: 'name', label: 'Tên truyện' },
  ]

  if (type === 'views') {
    if (period === 'daily') {
      return [...baseCols, { key: 'views_today', label: 'Views hôm nay', className: 'text-right font-semibold' }]
    }
    if (period === 'weekly') {
      return [...baseCols, { key: 'views_weekly', label: 'Views tuần', className: 'text-right font-semibold' }]
    }
    if (period === 'monthly') {
      return [...baseCols, { key: 'views_monthly', label: 'Views tháng', className: 'text-right font-semibold' }]
    }
    // all
    return [...baseCols, { key: 'views_count', label: 'Tổng views', className: 'text-right font-semibold' }]
  }

  if (type === 'votes') {
    if (period === 'daily') {
      return [...baseCols, { key: 'votes_today', label: 'Votes hôm nay', className: 'text-right font-semibold' }]
    }
    if (period === 'weekly') {
      return [...baseCols, { key: 'votes_weekly', label: 'Votes tuần', className: 'text-right font-semibold' }]
    }
    if (period === 'monthly') {
      return [...baseCols, { key: 'votes_monthly', label: 'Votes tháng', className: 'text-right font-semibold' }]
    }
    return [...baseCols, { key: 'votes_count', label: 'Tổng votes', className: 'text-right font-semibold' }]
  }

  // rating
  return [
    ...baseCols,
    { key: 'average_score', label: 'Điểm TB', className: 'text-right font-semibold' },
    { key: 'total_votes', label: 'Tổng votes', className: 'text-right text-muted-foreground' },
  ]
}

function getCellContent(item, colKey, type, period) {
  switch (colKey) {
    case 'rank':
      return (
        <span className={cn(
          'font-bold text-lg',
          item.rank === 1 ? 'text-amber-500' :
          item.rank === 2 ? 'text-slate-400' :
          item.rank === 3 ? 'text-amber-700' : 'text-muted-foreground'
        )}>
          {item.rank}
        </span>
      )
    case 'name':
      return (
        <div>
          <div className="font-medium leading-tight">{item.title ?? item.name ?? '—'}</div>
          {item.author && (
            <div className="text-xs text-muted-foreground">{item.author}</div>
          )}
        </div>
      )
    case 'cover':
      return item.cover_image_url ? (
        <img
          src={item.cover_image_url}
          alt=""
          className="h-10 w-8 rounded-md object-cover"
          crossOrigin="anonymous"
        />
      ) : (
        <div className="flex h-10 w-8 items-center justify-center rounded-md bg-muted">
          <BookOpen className="size-3 text-muted-foreground" />
        </div>
      )
    case 'views_count':
      return <span className={type === 'views' && period === 'all' ? 'font-semibold' : ''}>{formatNum(item.views_count ?? 0)}</span>
    case 'views_today':
      return <span className="font-semibold">{formatNum(item.views_today ?? 0)}</span>
    case 'views_weekly':
      return <span className="font-semibold">{formatNum(item.views_weekly ?? 0)}</span>
    case 'views_monthly':
      return <span className="font-semibold">{formatNum(item.views_monthly ?? 0)}</span>
    case 'views_total':
      return <span className="font-semibold">{formatNum(item.views_total ?? 0)}</span>
    case 'votes_today':
      return <span className="font-semibold">{formatNum(item.votes_today ?? 0)}</span>
    case 'votes_weekly':
      return <span className="font-semibold">{formatNum(item.votes_weekly ?? 0)}</span>
    case 'votes_monthly':
      return <span className="font-semibold">{formatNum(item.votes_monthly ?? 0)}</span>
    case 'votes_count':
      return <span className={type === 'votes' && period === 'all' ? 'font-semibold' : ''}>{formatNum(item.votes_count ?? 0)}</span>
    case 'votes_total':
      return <span className="font-semibold">{formatNum(item.votes_total ?? 0)}</span>
    case 'average_score':
      return (
        <div className="flex items-center justify-end gap-1">
          <span className="font-semibold">{Number(item.average_score ?? item.avg_score ?? 0).toFixed(1)}</span>
          <span className="text-xs text-muted-foreground">/5</span>
        </div>
      )
    case 'total_votes':
      return <span className="text-muted-foreground">{formatNum(item.total_votes ?? 0)}</span>
    default:
      return String(item[colKey] ?? '')
  }
}

export default function Rankings() {
  const [stats, setStats] = useState(null)
  const [list, setList] = useState([])
  const [loadingStats, setLoadingStats] = useState(false)
  const [loadingList, setLoadingList] = useState(false)
  const [type, setType] = useState('views')
  const [period, setPeriod] = useState('weekly')
  const [limit, setLimit] = useState('100')
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [selectedSeries, setSelectedSeries] = useState(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [top10List, setTop10List] = useState([])
  const [total, setTotal] = useState(0)

  const ITEMS_PER_PAGE = 10

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [search, type, period])

  const loadStats = useCallback(() => {
    setLoadingStats(true)
    api
      .getRankingsStats()
      .then(setStats)
      .catch(() => toast.error('Không tải được thống kê'))
      .finally(() => setLoadingStats(false))
  }, [])

  const loadList = useCallback(() => {
    setLoadingList(true)
    api
      .getRankingsList({ type, period, page, limit, search })
      .then((data) => {
        setList(data.items || [])
        setTotal(data.total || 0)
      })
      .catch(() => toast.error('Không tải được bảng xếp hạng'))
      .finally(() => setLoadingList(false))
  }, [type, period, page, limit, search])

  const loadTop10 = useCallback(() => {
    api
      .getRankingsList({ type, period, limit: '10' })
      .then((data) => {
        setTop10List(Array.isArray(data) ? data : data.items || [])
      })
      .catch(() => {})
  }, [type, period, limit])

  useEffect(() => { loadList() }, [loadList])
  useEffect(() => { loadTop10() }, [loadTop10])
  useEffect(() => { loadStats() }, [loadStats])

  function handleSearch(e) {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  function handleRowClick(item) {
    setSelectedSeries(item.id ?? item._id)
    setDetailOpen(true)
  }

  const columns = getColumnsByPeriod(type, period)
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Bảng xếp hạng</h1>
        <p className="text-sm text-muted-foreground">
          Thống kê &amp; xếp hạng series theo lượt đọc, bình chọn và điểm đánh giá
        </p>
      </div>

      {/* Stats Cards */}
      {loadingStats && !stats ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-28 p-5" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Views hôm nay"
            value={stats?.views_today?.value ?? 0}
            change={stats?.views_today?.change}
            icon={Eye}
            accent="bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400"
          />
          <StatCard
            label="Views tuần này"
            value={stats?.views_this_week?.value ?? 0}
            change={stats?.views_this_week?.change}
            icon={BarChart3}
            accent="bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400"
          />
          <StatCard
            label="Votes tuần này"
            value={stats?.votes_this_week?.value ?? 0}
            change={stats?.votes_this_week?.change}
            icon={ThumbsUp}
            accent="bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400"
          />
          <StatCard
            label="Series hoạt động"
            value={stats?.active_series?.value ?? 0}
            icon={BookOpen}
            accent="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"
          />
        </div>
      )}

      {/* Top 10 Chart */}
      <Top10Chart data={top10List} type={type} period={period} />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Loại</span>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Kỳ</span>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Hiển thị</span>
          <Select value={limit} onValueChange={setLimit}>
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 20, 50, 100].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <form onSubmit={handleSearch} className="ml-auto flex items-center gap-2">
          <Input
            placeholder="Tìm tên truyện..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-52"
          />
          <Button type="submit" variant="secondary" size="sm">
            <Search className="size-4" />
          </Button>
        </form>
      </div>

      {/* Rankings Table */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-0 bg-muted/30">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Bảng xếp hạng{' '}
              <Badge variant="secondary" className="ml-1.5">
                {TYPE_OPTIONS.find((o) => o.value === type)?.label}
              </Badge>
            </CardTitle>
            <span className="text-xs text-muted-foreground">
              {total} series
            </span>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                {columns.map((col) => (
                  <TableHead key={col.key} className={cn(col.className, 'font-semibold')}>
                    {col.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingList ? (
                [...Array(ITEMS_PER_PAGE)].map((_, i) => (
                  <TableRow key={i}>
                    {columns.map((col) => (
                      <TableCell key={col.key}>
                        <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : list.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Trophy className="size-8" />
                      <p className="text-sm">Chưa có dữ liệu xếp hạng</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                list.map((item) => {
                  const isGold = item.rank === 1
                  const isSilver = item.rank === 2
                  const isBronze = item.rank === 3
                  const medalClass = isGold ? 'bg-amber-100 dark:bg-amber-900/60 border-amber-400 dark:border-amber-500 border-l-4 border-l-amber-500' :
                                    isSilver ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-500 border-l-4 border-l-slate-400' :
                                    isBronze ? 'bg-orange-100 dark:bg-orange-900/50 border-orange-400 dark:border-orange-600 border-l-4 border-l-orange-500' : ''
                  return (
                  <TableRow key={item.id ?? item._id ?? item.rank} className={medalClass}>
                    {columns.map((col) => (
                      <TableCell key={col.key} className={cn(col.className, isGold && 'py-3')}>
                        {col.key === 'cover' && item.cover_image_url ? (
                          <div className="relative">
                            {isGold && (
                              <Crown className="absolute -top-2 -right-2 z-10 size-5 text-amber-400 drop-shadow-[0_0_6px_rgba(250,204,21,0.8)] animate-bounce" />
                            )}
                            <img
                              src={item.cover_image_url}
                              alt=""
                              className={cn(
                                'rounded-md object-cover shadow-md',
                                isGold ? 'h-12 w-10 ring-2 ring-amber-400' : 'h-10 w-8'
                              )}
                              crossOrigin="anonymous"
                            />
                          </div>
                        ) : col.key === 'rank' ? (
                          <div className="flex items-center justify-center">
                            <Award className={cn(
                              'size-5',
                              isGold ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]' : isSilver ? 'text-slate-400 drop-shadow-[0_0_6px_rgba(148,163,184,0.5)]' : isBronze ? 'text-orange-400 drop-shadow-[0_0_6px_rgba(251,146,60,0.5)]' : 'text-muted-foreground'
                            )} />
                            <span className={cn(
                              'ml-1 text-[10px] font-bold uppercase',
                              isGold ? 'text-amber-600 dark:text-amber-400' : isSilver ? 'text-slate-500 dark:text-slate-400' : isBronze ? 'text-orange-600 dark:text-orange-400' : 'text-muted-foreground'
                            )}>
                              Top {item.rank}
                            </span>
                          </div>
                        ) : getCellContent(item, col.key, type, period)}
                      </TableCell>
                    ))}
                  </TableRow>
                )})
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t">
          <p className="text-sm text-muted-foreground">
            Hiển thị {(page - 1) * ITEMS_PER_PAGE + 1} - {Math.min(page * ITEMS_PER_PAGE, total)} trong {total} series
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setPage(1)}
              disabled={page === 1}
              className="size-9"
            >
              <ChevronsLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="size-9"
            >
              <ChevronLeft className="size-4" />
            </Button>

            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum
              if (totalPages <= 5) {
                pageNum = i + 1
              } else if (page <= 3) {
                pageNum = i + 1
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i
              } else {
                pageNum = page - 2 + i
              }
              return (
                <Button
                  key={pageNum}
                  variant={page === pageNum ? 'default' : 'outline'}
                  size="icon-sm"
                  onClick={() => setPage(pageNum)}
                  className="size-9"
                >
                  {pageNum}
                </Button>
              )
            })}

            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="size-9"
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
              className="size-9"
            >
              <ChevronsRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      <SeriesDetailModal
        id={selectedSeries}
        open={detailOpen}
        onClose={(v) => {
          setDetailOpen(v)
          if (!v) setSelectedSeries(null)
        }}
      />
    </div>
  )
}
