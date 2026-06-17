import { useEffect, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
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

function GenrePanel({ genres }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Thể loại phổ biến</CardTitle>
        <CardDescription>Phân bổ theo lượt đọc</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {genres.map(g => (
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
        ))}
      </CardContent>
    </Card>
  )
}

function TopMangaTable({ topManga }) {
  return (
    <Card className="col-span-2">
      <CardHeader className="flex flex-row items-start justify-between pb-3">
        <div>
          <CardTitle className="text-base">Truyện nổi bật</CardTitle>
          <CardDescription>Top 5 series được đọc nhiều</CardDescription>
        </div>
        <Button variant="ghost" size="sm">Xem tất cả →</Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y border-t">
          {topManga.map(m => {
            const st = STATUS_LABEL[m.status]
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

function ActivityFeed({ activities }) {
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

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between pb-3">
        <div>
          <CardTitle className="text-base">Hoạt động gần đây</CardTitle>
          <CardDescription>Cập nhật mới nhất</CardDescription>
        </div>
        <Button variant="ghost" size="sm">Tất cả →</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {activities.map((a, i) => (
          <div key={i} className="flex gap-3">
            <div className={cn('flex size-8 shrink-0 items-center justify-center rounded-full text-sm', typeColor[a.type] ?? 'bg-muted')}>
              {a.icon}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-muted-foreground">{renderText(a)}</p>
              <p className="text-xs text-muted-foreground/70">{a.time}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getDashboard().then(d => { setData(d); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-muted-foreground">
        <Loader2 className="size-8 animate-spin" />
        <p className="mt-3 text-sm">Đang tải dashboard...</p>
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

      <div className="grid gap-4 lg:grid-cols-3">
        <BarChart data={data.chartData} />
        <GenrePanel genres={data.genres} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <TopMangaTable topManga={data.topManga} />
        <ActivityFeed activities={data.activities} />
      </div>
    </div>
  )
}
