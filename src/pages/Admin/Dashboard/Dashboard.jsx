import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Activity,
  ArrowDown,
  ArrowUp,
  BarChart3,
  BookOpen,
  ChevronRight,
  Eye,
  Loader2,
  Star,
  TrendingUp,
  Users,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
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

const STAT_GRADIENTS = [
  'from-violet-500 to-purple-600',
  'from-emerald-500 to-teal-600',
  'from-blue-500 to-indigo-600',
  'from-amber-500 to-orange-600',
]
const STAT_BG_LIGHT = ['bg-violet-50', 'bg-emerald-50', 'bg-blue-50', 'bg-amber-50']
const STAT_BG_DARK = ['bg-violet-500/10', 'bg-emerald-500/10', 'bg-blue-500/10', 'bg-amber-500/10']

function StatCard({ stat, index }) {
  const up = stat.dir === 'up'
  const gradient = STAT_GRADIENTS[index % 4]
  const bgLight = STAT_BG_LIGHT[index % 4]

  const icons = [Users, BookOpen, Eye, Star]
  const Icon = icons[index % 4]

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.02 }}
      transition={{ duration: 0.2 }}
      className="h-full"
    >
      <Card className="relative overflow-hidden border-0 shadow-md hover:shadow-xl transition-all duration-300 h-full bg-gradient-to-br from-card to-background">
        <div className={cn('absolute -right-8 -bottom-8 size-32 rounded-full opacity-20 blur-3xl', bgLight)} />
        <CardContent className="relative flex items-start justify-between gap-4 p-6">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {stat.label}
            </p>
            <div className="text-4xl font-bold tracking-tight">{stat.value}</div>
            {stat.delta && (
              <div className={cn(
                'flex items-center gap-1.5 text-sm font-medium rounded-full px-3 py-1 w-fit',
                up ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400'
              )}>
                {up ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />}
                <span>{stat.delta}</span>
              </div>
            )}
          </div>
          <motion.div
            className={cn('flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg', gradient)}
            whileHover={{ rotate: 5 }}
            transition={{ duration: 0.2 }}
          >
            <Icon className="size-7 text-white" />
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function ViewsTrendChart({ data }) {
  const chartData = data && data.length > 0 && data[0].reads > 0
    ? data
    : [
        { day: 'T2', reads: 120 },
        { day: 'T3', reads: 190 },
        { day: 'T4', reads: 150 },
        { day: 'T5', reads: 220 },
        { day: 'T6', reads: 280 },
        { day: 'T7', reads: 350 },
        { day: 'CN', reads: 300 },
      ]

  return (
    <Card className="border-0 shadow-md h-full overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5 border border-blue-500/10">
            <TrendingUp className="size-4 text-blue-600" />
          </div>
          Xu hướng lượt xem
        </CardTitle>
        <CardDescription className="text-xs">Lượt xem trong 7 ngày gần đây</CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
              <defs>
                <linearGradient id="colorReads" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="day"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                formatter={(value) => [value.toLocaleString(), 'Lượt xem']}
              />
              <Area
                type="monotone"
                dataKey="reads"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#colorReads)"
                dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }}
                activeDot={{ r: 5, fill: '#3b82f6' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

function GenresBarChart({ data }) {
  const genres = data && data.length > 0 ? data.slice(0, 6) : [
    { name: 'Hành động', fullName: 'Hành động', count: 45 },
    { name: 'Lãng mạn', fullName: 'Lãng mạn', count: 32 },
    { name: 'Phiêu lưu', fullName: 'Phiêu lưu', count: 28 },
    { name: 'Kinh dị', fullName: 'Kinh dị', count: 18 },
    { name: 'Hài hước', fullName: 'Hài hước', count: 15 },
    { name: 'Khác', fullName: 'Khác', count: 12 },
  ]
  const colors = ['#8b5cf6', '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#ec4899']

  const chartData = genres.map((g, i) => ({
    name: g.name?.length > 8 ? g.name.slice(0, 8) + '...' : g.name,
    fullName: g.fullName || g.name,
    count: g.count || 0,
  }))

  return (
    <Card className="border-0 shadow-md h-full overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-500/5 border border-violet-500/10">
            <BarChart3 className="size-4 text-violet-600" />
          </div>
          Thể loại truyện
        </CardTitle>
        <CardDescription className="text-xs">Phân bổ thể loại trong hệ thống</CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 15, left: 0, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                width={70}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                formatter={(value, name, props) => [value, props.payload.fullName]}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

function PieChartCard({ title, description, data, dataKey, colors }) {
  const chartData = data && data.length > 0 ? data : [
    { name: 'Người dùng', count: 120 },
    { name: 'Biên tập', count: 25 },
    { name: 'Dịch giả', count: 15 },
  ]
  const total = chartData.reduce((sum, d) => sum + (d[dataKey] || 0), 0) || 1

  return (
    <Card className="border-0 shadow-md h-full overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/10">
            <Users className="size-4 text-emerald-600" />
          </div>
          {title}
        </CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="flex items-center gap-4">
          <div className="relative flex-shrink-0 w-[140px] h-[140px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey={dataKey}
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={38}
                  outerRadius={58}
                  paddingAngle={3}
                  strokeWidth={0}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={colors[index % colors.length]} stroke="none" />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                  formatter={(value, name) => [`${value} (${Math.round((value / total) * 100)}%)`, name]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="text-lg font-bold">{total}</div>
              <div className="text-[10px] text-muted-foreground">Tổng</div>
            </div>
          </div>
          <div className="flex-1 space-y-2">
            {chartData.map((entry, i) => {
              const pct = Math.round((entry[dataKey] / total) * 100)
              return (
                <div key={entry.name || i} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="size-3 rounded-full flex-shrink-0" style={{ backgroundColor: colors[i % colors.length] }} />
                    <span className="text-xs font-medium truncate max-w-[80px]">{entry.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold">{entry[dataKey]}</span>
                    <span className="text-[10px] text-muted-foreground">{pct}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ChapterStatusChart({ stats }) {
  // API getStats trả về { chapters: { total }, users: { byRole } }
  // Không có approved/pending/rejected nên dùng sample data hoặc từ byStatus nếu có
  const chapterStats = stats?.chapters ?? {}
  const byStatus = chapterStats.byStatus ?? []
  
  // Nếu API trả byStatus thì dùng, không thì dùng sample
  const statusData = byStatus.length > 0
    ? byStatus.map((s, i) => ({
        name: s._id === 'published' ? 'Đã duyệt' : s._id === 'pending' ? 'Chờ duyệt' : s._id === 'draft' ? 'Bản nháp' : s._id || 'Khác',
        count: s.count ?? 0,
        color: s._id === 'published' ? '#10b981' : s._id === 'pending' ? '#f59e0b' : s._id === 'draft' ? '#6b7280' : '#ef4444',
      }))
    : [
        { name: 'Đã duyệt', count: 85, color: '#10b981' },
        { name: 'Chờ duyệt', count: 12, color: '#f59e0b' },
        { name: 'Từ chối', count: 3, color: '#ef4444' },
      ]
  
  const total = statusData.reduce((sum, d) => sum + d.count, 0) || 1

  return (
    <Card className="border-0 shadow-md h-full overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 border border-amber-500/10">
            <BookOpen className="size-4 text-amber-600" />
          </div>
          Trạng thái chương
        </CardTitle>
        <CardDescription className="text-xs">Phân bổ trạng thái kiểm duyệt</CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="flex items-center gap-4">
          <div className="relative flex-shrink-0 w-[140px] h-[140px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={38}
                  outerRadius={58}
                  paddingAngle={3}
                  strokeWidth={0}
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                  formatter={(value, name) => [`${value} (${Math.round((value / total) * 100)}%)`, name]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="text-lg font-bold">{total}</div>
              <div className="text-[10px] text-muted-foreground">Tổng</div>
            </div>
          </div>
          <div className="flex-1 space-y-2">
            {statusData.map((entry) => {
              const pct = Math.round((entry.count / total) * 100)
              return (
                <div key={entry.name} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="size-3 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                    <span className="text-xs font-medium">{entry.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold">{entry.count}</span>
                    <span className="text-[10px] text-muted-foreground">{pct}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function TopMangaCard({ topManga, onViewAll }) {
  const maxReads = Math.max(...topManga.map(m => typeof m.reads === 'number' ? m.reads : parseInt(m.reads) || 0), 1)

  const rankGradients = [
    'from-amber-400 to-amber-600',
    'from-slate-300 to-slate-500',
    'from-amber-600 to-amber-800',
  ]

  const barGradients = [
    'from-violet-500 to-purple-600',
    'from-emerald-500 to-teal-600',
    'from-blue-500 to-indigo-600',
    'from-amber-500 to-orange-600',
    'from-rose-500 to-pink-600',
  ]

  return (
    <Card className="border-0 shadow-md h-full overflow-hidden">
      <CardHeader className="flex flex-row items-start justify-between pb-4">
        <div className="space-y-1">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 border border-amber-500/10">
              <TrendingUp className="size-5 text-amber-600" />
            </div>
            Top truyện nổi bật
          </CardTitle>
          <CardDescription className="text-sm">Top 5 series được đọc nhiều nhất tuần này</CardDescription>
        </div>
        <Button variant="ghost" size="sm" onClick={onViewAll} className="hover:bg-primary/10 hover:text-primary text-xs font-medium">
          Xem tất cả <ChevronRight className="size-3 ml-1" />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {topManga.map((m, i) => {
            const readsNum = typeof m.reads === 'number' ? m.reads : parseInt(m.reads) || 0
            const width = (readsNum / maxReads) * 100
            const gradient = barGradients[i % barGradients.length]
            const rankBg = i < 3 ? rankGradients[i] : 'from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600'

            return (
              <motion.div
                key={m.title}
                className="group relative flex flex-col items-center rounded-xl border bg-card hover:bg-muted/30 transition-all duration-200 p-4 text-center"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.08 }}
              >
                <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl font-bold text-lg shadow-md bg-gradient-to-br z-10 mb-3', rankBg)}>
                  <span className="text-white">{i + 1}</span>
                </div>

                {m.thumbnail ? (
                  <img src={m.thumbnail} alt={m.title} className="w-full aspect-[3/4] rounded-lg object-cover shadow-lg mb-3" crossOrigin="anonymous" />
                ) : (
                  <div className="w-full aspect-[3/4] rounded-lg flex items-center justify-center text-white text-xl font-bold shadow-lg mb-3" style={{ backgroundColor: m.bg || '#6366f1' }}>
                    {m.initials}
                  </div>
                )}

                <h4 className="font-semibold text-sm line-clamp-2 mb-1 min-h-[2.5rem]">{m.title}</h4>
                <p className="text-[10px] text-muted-foreground mb-3">{m.genre}</p>

                <div className="w-full space-y-1">
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <motion.div
                      className={cn('h-full rounded-full bg-gradient-to-r', gradient)}
                      initial={{ width: 0 }}
                      animate={{ width: `${width}%` }}
                      transition={{ duration: 0.6, delay: i * 0.1 + 0.2, ease: 'easeOut' }}
                    />
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold">{readsNum.toLocaleString()}</span>
                    <span className="text-[10px] text-muted-foreground ml-1">lượt đọc</span>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function RecentActivityCard({ activities }) {
  return (
    <Card className="border-0 shadow-md h-full overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500/20 to-rose-500/5 border border-rose-500/10">
            <Activity className="size-4 text-rose-600" />
          </div>
          Hoạt động gần đây
        </CardTitle>
        <CardDescription className="text-xs">Các hoạt động mới nhất trong hệ thống</CardDescription>
      </CardHeader>
      <CardContent className="max-h-[280px] overflow-y-auto">
        <div className="space-y-3">
          {activities.slice(0, 8).map((a, i) => (
            <motion.div
              key={a.id || i}
              className="flex items-start gap-3 text-sm"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: i * 0.05 }}
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-lg">
                {a.icon || '📌'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{a.text}</p>
                <p className="text-xs text-muted-foreground">{a.time}</p>
              </div>
            </motion.div>
          ))}
          {activities.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Chưa có hoạt động nào</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [systemStats, setSystemStats] = useState(null)
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [topMangaWithCover, setTopMangaWithCover] = useState([])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')

    Promise.all([
      api.getDashboard().catch(() => null),
      api.getRecentActivities(1, 50).catch(() => ({ activities: [] })),
      api.getRoles().catch(() => []),
      api.getGenresStats().catch(() => []),
      api.getStats().catch(() => null),
      api.getRankingsList({ type: 'views', period: 'weekly', limit: 5 }).catch(() => []),
    ]).then(([dashboard, actResult, roles, genresStats, stats, rankingsRes]) => {
      if (cancelled) return
      setActivities(actResult?.activities ?? [])
      setSystemStats(stats)

      const rankings = rankingsRes?.data ?? rankingsRes?.items ?? rankingsRes ?? []

      if (rankings && rankings.length) {
        const topMangaFromRankings = rankings.map((r, index) => ({
          title: r.name ?? r.title ?? '—',
          genre: r.genre ?? '—',
          chapters: r.chapters ?? '—',
          reads: r.views_count ?? 0,
          status: r.status ?? 'ongoing',
          initials: String(r.name ?? r.title ?? '?').slice(0, 2).toUpperCase(),
          bg: `hsl(${(index * 67) % 360} 55% 42%)`,
          thumbnail: r.cover_image_url ?? '',
        }))
        setTopMangaWithCover(topMangaFromRankings)
      }

      if (dashboard) {
        if (!rankings?.length) {
          setTopMangaWithCover(dashboard.topManga ?? [])
        }
        setData({ 
          ...dashboard, 
          genres: genresStats.length ? genresStats : (roles.length ? roles : dashboard.genres),
          roles: roles.length ? roles : [],
        })
      } else {
        setData(null)
        setError('Không tải được dữ liệu dashboard. Kiểm tra quyền Admin và kết nối API.')
      }
    }).catch((err) => {
      if (!cancelled) {
        console.error(err)
        setError('Không tải được dữ liệu dashboard. Kiểm tra quyền Admin và kết nối API.')
      }
    }).finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <Loader2 className="size-12 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Đang tải dashboard...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4 text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-destructive/10">
          <TrendingUp className="size-8 text-destructive" />
        </div>
        <p className="text-sm text-muted-foreground max-w-md">{error || 'Không có dữ liệu dashboard.'}</p>
      </div>
    )
  }

  // Roles data từ API getRoles (đã được map với mapRoleStats)
  const roleLabels = { user: 'Người dùng', admin: 'Quản trị', editor: 'Biên tập', translator: 'Dịch giả', author: 'Tác giả' }
  const roles = data.roles ?? []
  const totalUsers = systemStats?.users?.total ?? 100
  
  // Tính count từ pct
  const roleData = roles.map((r) => ({
    name: roleLabels[r.name] || r.name,
    count: r.pct ? Math.round((r.pct / 100) * totalUsers) : 0,
    color: r.color || '#8b5cf6',
  }))

  // Nếu roleData rỗng, dùng sample
  const hasRoleData = roleData.some(r => r.count > 0)
  const displayRoleData = hasRoleData ? roleData : [
    { name: 'Người dùng', count: 120, color: '#8b5cf6' },
    { name: 'Biên tập', count: 25, color: '#10b981' },
    { name: 'Dịch giả', count: 15, color: '#3b82f6' },
    { name: 'Tác giả', count: 10, color: '#f59e0b' },
  ]

  const roleColors = displayRoleData.map(r => r.color)

  // API genresStats trả về { name, count, color }
  const genreData = data.genres.map((r) => ({
    name: r.name,
    count: r.count || 0,
    color: r.color || '#8b5cf6',
  }))

  // Nếu genreData rỗng, dùng sample
  const hasGenreData = genreData.some(r => r.count > 0)
  const displayGenreData = hasGenreData ? genreData : [
    { name: 'Hành động', count: 45, color: '#8b5cf6' },
    { name: 'Lãng mạn', count: 32, color: '#10b981' },
    { name: 'Phiêu lưu', count: 28, color: '#3b82f6' },
    { name: 'Kinh dị', count: 18, color: '#f59e0b' },
    { name: 'Hài hước', count: 15, color: '#ef4444' },
  ]

  return (
    <motion.div className="space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      {/* Header */}
      <motion.div
        className="flex flex-wrap items-end justify-between gap-3"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-rose-600 shadow-lg shadow-primary/20">
              <BarChart3 className="size-5 text-white" />
            </div>
            Dashboard
          </h1>
          <p className="mt-2 text-sm text-muted-foreground flex items-center gap-2 pl-[52px]">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            {new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <motion.div
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        {data.stats.map((s, i) => (
          <StatCard key={s.label} stat={s} index={i} />
        ))}
      </motion.div>

      {/* Charts Row 1 - Views Trend & Genres */}
      <div className="grid gap-4 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }}>
          <ViewsTrendChart data={data.chartData} />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
          <GenresBarChart data={displayGenreData} />
        </motion.div>
      </div>

      {/* Charts Row 2 - Role Distribution & Chapter Status */}
      <div className="grid gap-4 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.25 }}>
          <PieChartCard
            title="Phân bổ vai trò"
            description="Tỷ lệ người dùng theo vai trò"
            data={displayRoleData}
            dataKey="count"
            colors={roleColors}
          />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.3 }}>
          <ChapterStatusChart stats={systemStats} />
        </motion.div>
      </div>

      {/* Recent Activity */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.35 }}>
        <RecentActivityCard activities={activities} />
      </motion.div>

      {/* Top Manga */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.4 }}>
        <TopMangaCard topManga={topMangaWithCover} onViewAll={() => navigate('/admin/manga')} />
      </motion.div>
    </motion.div>
  )
}
