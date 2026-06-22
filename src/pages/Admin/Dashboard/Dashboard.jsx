import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  MessageSquare,
  TrendingUp,
  Users,
} from 'lucide-react'
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
import { cn } from '@/lib/utils'

const STATUS_LABEL = {
  ongoing: { label: 'Đang ra', variant: 'default', class: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-400' },
  completed: { label: 'Hoàn thành', variant: 'secondary', class: 'bg-sky-100 text-sky-700 hover:bg-sky-100 dark:bg-sky-500/15 dark:text-sky-400' },
  hiatus: { label: 'Tạm dừng', variant: 'outline', class: 'bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-400' },
}

const STAT_ICONS = {
  0: BookOpen,
  1: Eye,
  2: Users,
  3: MessageSquare,
}

function StatCard({ stat, index }) {
  const Icon = STAT_ICONS[index % 4] ?? TrendingUp
  const up = stat.dir === 'up'
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {stat.label}
          </p>
          <div className="text-3xl font-bold tracking-tight">{stat.value}</div>
          <div className={cn('flex items-center gap-1 text-xs font-medium', up ? 'text-emerald-600' : 'text-amber-600')}>
            {up ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
            {stat.delta}
          </div>
        </div>
        <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  )
}

function BarChart({ data }) {
  const maxReads = Math.max(...data.map(d => d.reads))
  return (
    <Card className="col-span-2">
      <CardHeader className="flex flex-row items-start justify-between pb-3">
        <div>
          <CardTitle className="text-base">Lượt đọc 7 ngày qua</CardTitle>
          <CardDescription>So sánh lượt đọc và chương mới</CardDescription>
        </div>
        <Button variant="ghost" size="sm">Chi tiết →</Button>
      </CardHeader>
      <CardContent>
        <div className="flex h-48 items-end gap-3">
          {data.map(d => {
            const readH = (d.reads / maxReads) * 100
            const newH = (d.newCh / maxReads) * 100
            return (
              <div key={d.day} className="group flex flex-1 flex-col items-center gap-2">
                <div className="flex h-full w-full items-end justify-center gap-1">
                  <div
                    className="w-2.5 rounded-t bg-primary/80 transition-all group-hover:bg-primary"
                    style={{ height: `${readH}%` }}
                    title={`${d.reads} lượt đọc`}
                  />
                  <div
                    className="w-2.5 rounded-t bg-amber-400/80 transition-all group-hover:bg-amber-500"
                    style={{ height: `${newH}%` }}
                    title={`${d.newCh} chương mới`}
                  />
                </div>
                <div className="text-xs text-muted-foreground">{d.day}</div>
              </div>
            )
          })}
        </div>
        <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-primary" />
            Lượt đọc
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-amber-400" />
            Chương mới
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function GenrePanel({ genres, title = 'Thể loại phổ biến', description = 'Phân bổ theo lượt đọc' }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {genres.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có dữ liệu thống kê.</p>
        ) : (
          genres.map(g => (
            <div key={g.name}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">{g.name}</span>
                <span className="text-muted-foreground">{g.pct}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${g.pct}%`, background: g.color }}
                />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

function TopMangaTable({ topManga, onViewAll }) {
  return (
    <Card className="col-span-2">
      <CardHeader className="flex flex-row items-start justify-between pb-3">
        <div>
          <CardTitle className="text-base">Truyện nổi bật</CardTitle>
          <CardDescription>Top 5 series được đọc nhiều</CardDescription>
        </div>
        <Button variant="ghost" size="sm" onClick={onViewAll}>Xem tất cả →</Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y border-t">
          {topManga.map(m => {
            const st = STATUS_LABEL[m.status] ?? { label: m.status ?? '—', class: '' }
            return (
              <div key={m.title} className="flex items-center gap-4 px-6 py-3 transition-colors hover:bg-muted/50">
                <div
                  className="flex size-10 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white shadow-sm"
                  style={{ background: m.bg }}
                >
                  {m.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{m.title}</div>
                  <div className="text-xs text-muted-foreground">{m.genre}</div>
                </div>
                <div className="hidden text-right text-sm sm:block">
                  <div className="font-medium">{m.chapters}</div>
                  <div className="text-xs text-muted-foreground">chương</div>
                </div>
                <div className="hidden text-right text-sm md:block">
                  <div className="font-medium">{m.reads}</div>
                  <div className="text-xs text-muted-foreground">đọc</div>
                </div>
                <Badge className={st.class} variant="secondary">{st.label}</Badge>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function getPageNumbers(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  const pages = new Set([1, total, current, current - 1, current + 1])
  return [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b)
}

function ActivityFeed() {
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api
      .getRecentActivities(page, 5)
      .then((result) => {
        if (cancelled) return
        setActivities(result.activities ?? [])
        setPages(Math.max(result.pages ?? 1, 1))
      })
      .catch(() => {
        if (!cancelled) {
          setActivities([])
          setPages(1)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [page])

  function renderText(a) {
    if (!a.bold?.length) return a.text
    const parts = []
    let remaining = a.text
    a.bold.forEach(word => {
      const idx = remaining.indexOf(word)
      if (idx === -1) return
      if (idx > 0) parts.push(remaining.slice(0, idx))
      parts.push(<strong key={word} className="font-semibold text-foreground">{word}</strong>)
      remaining = remaining.slice(idx + word.length)
    })
    if (remaining) parts.push(remaining)
    return parts
  }

  const typeColor = {
    chapter: 'bg-primary/10 text-primary',
    user: 'bg-emerald-500/10 text-emerald-600',
    report: 'bg-amber-500/10 text-amber-600',
    comment: 'bg-sky-500/10 text-sky-600',
  }

  const pageNumbers = getPageNumbers(page, pages)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Hoạt động gần đây</CardTitle>
        <CardDescription>Cập nhật mới nhất</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-10 text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : activities.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Chưa có hoạt động nào.</p>
        ) : (
          activities.map((a) => (
            <div key={a.id ?? a.text + a.time} className="flex gap-3">
              <div className={cn('flex size-8 shrink-0 items-center justify-center rounded-full text-sm', typeColor[a.type] ?? 'bg-muted')}>
                {a.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted-foreground">{renderText(a)}</p>
                <p className="text-xs text-muted-foreground/70">{a.time}</p>
              </div>
            </div>
          ))
        )}

        {!loading ? (
          <div className="flex items-center justify-center gap-1 border-t pt-4">
            <Button
              variant="outline"
              size="icon-sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              aria-label="Trang trước"
            >
              <ChevronLeft className="size-4" />
            </Button>
            {pageNumbers.map((p, index) => {
              const prev = pageNumbers[index - 1]
              const showEllipsis = prev != null && p - prev > 1
              return (
                <span key={p} className="flex items-center gap-1">
                  {showEllipsis ? <span className="px-1 text-xs text-muted-foreground">…</span> : null}
                  <Button
                    variant={p === page ? 'default' : 'ghost'}
                    size="sm"
                    className="size-8 min-w-8 px-0"
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </Button>
                </span>
              )
            })}
            <Button
              variant="outline"
              size="icon-sm"
              disabled={page >= pages}
              onClick={() => setPage((p) => Math.min(p + 1, pages))}
              aria-label="Trang sau"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [systemStats, setSystemStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')

    api.getDashboard()
      .then(async (d) => {
        if (cancelled) return
        let roles = []
        let stats = null
        try {
          ;[roles, stats] = await Promise.all([
            api.getRoles().catch(() => []),
            api.getStats().catch(() => null),
          ])
        } catch {
          roles = []
        }
        if (!cancelled) {
          setSystemStats(stats)
          setData({ ...d, genres: roles.length ? roles : d.genres })
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error(err)
          setError('Không tải được dữ liệu dashboard. Kiểm tra quyền Admin và kết nối API.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-muted-foreground">
        <Loader2 className="size-8 animate-spin" />
        <p className="mt-3 text-sm">Đang tải dashboard...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center text-muted-foreground">
        <p className="text-sm">{error || 'Không có dữ liệu dashboard.'}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {data.stats.map((s, i) => <StatCard key={s.label} stat={s} index={i} />)}
      </div>

      {systemStats ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Thống kê hệ thống</CardTitle>
            <CardDescription>Từ GET /admin/stats</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <div><span className="text-muted-foreground">Truyện:</span> <strong>{systemStats.series?.total ?? 0}</strong></div>
            <div><span className="text-muted-foreground">Chương:</span> <strong>{systemStats.chapters?.total ?? 0}</strong></div>
            <div><span className="text-muted-foreground">Vote:</span> <strong>{systemStats.votes?.total ?? 0}</strong></div>
            <div><span className="text-muted-foreground">User mới:</span> <strong>{systemStats.recentUsers?.length ?? 0}</strong></div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <BarChart data={data.chartData} />
        <GenrePanel
          genres={data.genres}
          title="Phân bổ vai trò"
          description="Tỷ lệ người dùng theo vai trò (GET /admin/roles)"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <TopMangaTable topManga={data.topManga} onViewAll={() => navigate('/admin/manga')} />
        <ActivityFeed />
      </div>
    </div>
  )
}
