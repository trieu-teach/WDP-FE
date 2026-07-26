import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  BookOpen,
  Calendar,
  Clock,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { api } from '@/api/index.js'
import { getApiErrorMessage } from '@/api/http.js'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatTeScheduledPublishDisplay } from '@/utils/teReviewPhase.js'
import {
  formatPublicationCalendarDayLabel,
  getPublicationCalendarDefaultRange,
  mapAdminPublicationCalendarResponse,
} from '@/utils/publicationCalendarMappers.js'
import { cn } from '@/lib/utils'

function ChapterRow({ chapter }) {
  const when = formatTeScheduledPublishDisplay(
    chapter.scheduledPublishAt || chapter.publishedAt,
  )
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border p-3',
        chapter.isPublished
          ? 'border-emerald-200/80 bg-emerald-50/40 dark:border-emerald-500/20 dark:bg-emerald-500/5'
          : 'bg-card',
      )}
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-700">
        <BookOpen className="size-4" />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold">
            Ch. {chapter.chapterNumber ?? '?'}
            {chapter.title ? ` — ${chapter.title}` : ''}
          </p>
          <Badge variant="outline" className="text-[10px]">
            {chapter.isPublished ? 'Đã publish' : 'Đã lên lịch'}
          </Badge>
          {chapter.publicationSchedule ? (
            <Badge variant="secondary" className="text-[10px]">
              {chapter.publicationSchedule}
            </Badge>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          {chapter.series?.name ?? 'Series'}
          {chapter.te?.name ? ` · TE: ${chapter.te.name}` : ''}
        </p>
        {when ? (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3" />
            {when}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function SeriesLaunchRow({ launch }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-teal-200/70 bg-teal-50/40 p-3 dark:border-teal-500/20 dark:bg-teal-500/5">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-teal-500/10 text-teal-700">
        <Calendar className="size-4" />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold">{launch.name}</p>
          <Badge variant="outline" className="text-[10px]">
            Ra mắt series
          </Badge>
        </div>
        {launch.publicationSchedule ? (
          <p className="text-xs text-muted-foreground">
            Chu kỳ: {launch.publicationSchedule}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export default function PublicationCalendar() {
  const defaults = useMemo(() => getPublicationCalendarDefaultRange(), [])
  const [fromDate, setFromDate] = useState(defaults.from_date)
  const [toDate, setToDate] = useState(defaults.to_date)
  const [schedule, setSchedule] = useState('all')
  const [includePublished, setIncludePublished] = useState(true)
  const [loading, setLoading] = useState(true)
  const [calendar, setCalendar] = useState(null)
  const [selectedDate, setSelectedDate] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const raw = await api.getPublicationCalendar({
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        include_published: includePublished,
        ...(schedule !== 'all' ? { schedule } : {}),
      })
      const mapped = mapAdminPublicationCalendarResponse(raw)
      setCalendar(mapped)
      const daysWithEvents = mapped.days.filter((d) => d.eventCount > 0)
      setSelectedDate((current) => {
        if (current && daysWithEvents.some((d) => d.date === current)) return current
        return daysWithEvents[0]?.date || mapped.days[0]?.date || ''
      })
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Không tải được lịch phát hành.'))
      setCalendar(null)
    } finally {
      setLoading(false)
    }
  }, [fromDate, toDate, schedule, includePublished])

  useEffect(() => {
    void load()
  }, [load])

  const visibleDays = useMemo(() => {
    if (!calendar?.days?.length) return []
    return calendar.days.filter((d) => d.eventCount > 0)
  }, [calendar])

  const selectedDay = useMemo(() => {
    if (!calendar || !selectedDate) return null
    return calendar.days.find((d) => d.date === selectedDate) ?? null
  }, [calendar, selectedDate])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Lịch phát hành</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tổng quan lịch publish series/chapter toàn hệ thống
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => void load()}
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          Làm mới
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Bộ lọc</CardTitle>
          <CardDescription>Lọc theo khoảng ngày, chu kỳ phát hành và trạng thái publish</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="admin-cal-from">Từ ngày</Label>
            <Input
              id="admin-cal-from"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-cal-to">Đến ngày</Label>
            <Input
              id="admin-cal-to"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Chu kỳ</Label>
            <Select value={schedule} onValueChange={setSchedule}>
              <SelectTrigger>
                <SelectValue placeholder="Tất cả" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 rounded border-input"
                checked={includePublished}
                onChange={(e) => setIncludePublished(e.target.checked)}
              />
              Gồm chapter đã publish
            </label>
          </div>
        </CardContent>
      </Card>

      {!loading && calendar ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground">Tổng series</p>
              <p className="text-2xl font-bold">{calendar.overview.totalSeries}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground">Chapter đã publish</p>
              <p className="text-2xl font-bold">
                {calendar.overview.totalChaptersPublished}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground">Sắp publish (range)</p>
              <p className="text-2xl font-bold">
                {calendar.upcomingChapters.length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground">Ra mắt series (range)</p>
              <p className="text-2xl font-bold">
                {calendar.upcomingSeries.length}
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {loading ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
            <Loader2 className="size-8 animate-spin" />
            Đang tải lịch...
          </CardContent>
        </Card>
      ) : !visibleDays.length ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
            <Calendar className="size-10 opacity-30" />
            <p>Không có sự kiện publish trong khoảng đã chọn.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Theo ngày</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {visibleDays.map((day) => {
                const active = day.date === selectedDate
                return (
                  <button
                    key={day.date}
                    type="button"
                    onClick={() => setSelectedDate(day.date)}
                    className={cn(
                      'rounded-xl border px-3 py-2 text-left text-sm transition-colors',
                      active
                        ? 'border-primary/50 bg-primary/10'
                        : 'hover:bg-muted/50',
                    )}
                  >
                    <div className="font-medium">{day.weekday || day.date.slice(8)}</div>
                    <div className="text-xs text-muted-foreground">{day.date}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {day.eventCount} sự kiện
                    </div>
                  </button>
                )
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {selectedDay
                  ? formatPublicationCalendarDayLabel(
                      selectedDay.date,
                      selectedDay.weekday,
                    )
                  : 'Chi tiết ngày'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {!selectedDay || selectedDay.eventCount === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Không có sự kiện trong ngày này.
                </p>
              ) : (
                <>
                  {selectedDay.seriesLaunches.map((launch) => (
                    <SeriesLaunchRow key={`s-${launch.id}`} launch={launch} />
                  ))}
                  {selectedDay.chapters.map((chapter) => (
                    <ChapterRow key={chapter.id} chapter={chapter} />
                  ))}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
