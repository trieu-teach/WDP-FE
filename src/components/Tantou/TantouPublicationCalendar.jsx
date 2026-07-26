import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BookOpen,
  Calendar,
  Clock,
  RefreshCw,
} from "lucide-react";
import { teReviewsService } from "@/api/teReviews.service.js";
import { getApiErrorMessage } from "@/api/http.js";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatTeScheduledPublishDisplay } from "@/utils/teReviewPhase.js";
import {
  formatPublicationCalendarChapterTitle,
  formatPublicationCalendarDateDisplay,
  formatPublicationCalendarDayLabel,
  getPublicationCalendarDefaultRange,
  mapTeReviewsCalendarResponse,
} from "@/utils/publicationCalendarMappers.js";
import { cn } from "@/lib/utils";

function ChapterRow({ chapter }) {
  const when = formatTeScheduledPublishDisplay(
    chapter.scheduledPublishAt || chapter.publishedAt,
  );
  const seriesName = chapter.series?.name ?? "Series";
  const chapterLabel = formatPublicationCalendarChapterTitle(chapter);

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border p-3.5 shadow-sm",
        chapter.isPublished
          ? "border-emerald-200/90 bg-emerald-50/50 dark:border-emerald-500/25 dark:bg-emerald-500/10"
          : "border-border/80 bg-card",
      )}
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-700 dark:text-sky-300">
        <BookOpen className="size-4" />
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[0.95rem] font-semibold leading-snug text-foreground">
            {seriesName}
          </p>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] font-medium",
              chapter.isPublished
                ? "border-emerald-300/80 bg-emerald-100 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/20 dark:text-emerald-200"
                : "border-sky-300/70 bg-sky-50 text-sky-800 dark:border-sky-500/40 dark:bg-sky-500/15 dark:text-sky-200",
            )}
          >
            {chapter.isPublished ? "Đã publish" : "Đã lên lịch"}
          </Badge>
          {chapter.publicationSchedule ? (
            <Badge
              variant="outline"
              className="border-slate-200 bg-slate-100 text-[10px] font-medium text-slate-700 dark:border-slate-500/40 dark:bg-slate-500/15 dark:text-slate-200"
            >
              {chapter.publicationSchedule}
            </Badge>
          ) : null}
        </div>
        <p className="text-sm font-medium text-foreground/85">{chapterLabel}</p>
        {when ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="size-3.5 shrink-0" />
            {when}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function SeriesLaunchRow({ launch }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-200/80 bg-amber-50/50 p-3.5 shadow-sm dark:border-amber-500/25 dark:bg-amber-500/10">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-800 dark:text-amber-200">
        <Calendar className="size-4" />
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[0.95rem] font-semibold leading-snug text-foreground">
            {launch.name}
          </p>
          <Badge
            variant="outline"
            className="border-amber-300/80 bg-amber-100 text-[10px] font-medium text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/20 dark:text-amber-100"
          >
            Ra mắt series
          </Badge>
          {launch.publicationSchedule ? (
            <Badge
              variant="outline"
              className="border-slate-200 bg-slate-100 text-[10px] font-medium text-slate-700 dark:border-slate-500/40 dark:bg-slate-500/15 dark:text-slate-200"
            >
              {launch.publicationSchedule}
            </Badge>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Lịch publish TE — GET /te-reviews/calendar */
export function TantouPublicationCalendar() {
  const defaults = useMemo(() => getPublicationCalendarDefaultRange(), []);
  const [fromDate, setFromDate] = useState(defaults.from_date);
  const [toDate, setToDate] = useState(defaults.to_date);
  const [includePublished, setIncludePublished] = useState(true);
  const [loading, setLoading] = useState(true);
  const [calendar, setCalendar] = useState(null);
  const [selectedDate, setSelectedDate] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const raw = await teReviewsService.getCalendar({
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        include_published: includePublished,
        scope: "mine",
      });
      const mapped = mapTeReviewsCalendarResponse(raw);
      setCalendar(mapped);
      const daysWithEvents = mapped.days.filter((d) => d.eventCount > 0);
      setSelectedDate((current) => {
        if (current && daysWithEvents.some((d) => d.date === current)) {
          return current;
        }
        return daysWithEvents[0]?.date || mapped.days[0]?.date || "";
      });
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không tải được lịch phát hành."));
      setCalendar(null);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, includePublished]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleDays = useMemo(() => {
    if (!calendar?.days?.length) return [];
    return calendar.days.filter((d) => d.eventCount > 0);
  }, [calendar]);

  const selectedDay = useMemo(() => {
    if (!calendar || !selectedDate) return null;
    return calendar.days.find((d) => d.date === selectedDate) ?? null;
  }, [calendar, selectedDate]);

  const [eventFilter, setEventFilter] = useState("all");

  const daySections = useMemo(() => {
    if (!selectedDay) {
      return {
        seriesLaunches: [],
        publishedChapters: [],
        scheduledChapters: [],
      };
    }
    const publishedChapters = selectedDay.chapters.filter((ch) => ch.isPublished);
    const scheduledChapters = selectedDay.chapters.filter((ch) => !ch.isPublished);
    return {
      seriesLaunches: selectedDay.seriesLaunches,
      publishedChapters,
      scheduledChapters,
    };
  }, [selectedDay]);

  const showSeries =
    eventFilter === "all" || eventFilter === "series";
  const showPublished =
    eventFilter === "all" || eventFilter === "published";
  const showScheduled =
    eventFilter === "all" || eventFilter === "scheduled";

  const visibleEventCount =
    (showSeries ? daySections.seriesLaunches.length : 0)
    + (showPublished ? daySections.publishedChapters.length : 0)
    + (showScheduled ? daySections.scheduledChapters.length : 0);

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Lịch phát hành</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Theo dõi chapter và series sắp publish theo lịch/chu kỳ đã lên.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => void load()}
        >
          <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          Làm mới
        </Button>
      </div>

      <Card className="w-full border-border/80 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <CardTitle className="text-base">Bộ lọc</CardTitle>
            {!loading && calendar ? (
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-50 dark:border-sky-500/30 dark:bg-sky-500/15 dark:text-sky-200">
                  {calendar.stats.scheduledChapters} đã lên lịch
                </Badge>
                <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200">
                  {calendar.stats.publishedInRange} đã publish
                </Badge>
                <Badge className="border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-100">
                  {calendar.stats.seriesLaunchesInRange} ra mắt series
                </Badge>
              </div>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-end sm:gap-5">
            <div className="min-w-0 flex-1 space-y-2">
              <Label htmlFor="te-cal-from">Từ ngày</Label>
              <Input
                id="te-cal-from"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <Label htmlFor="te-cal-to">Đến ngày</Label>
              <Input
                id="te-cal-to"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="flex h-10 shrink-0 items-center sm:pb-0">
              <label className="flex cursor-pointer items-center gap-2.5 text-sm leading-none">
                <input
                  type="checkbox"
                  className="size-4 rounded border-input accent-sky-600"
                  checked={includePublished}
                  onChange={(e) => setIncludePublished(e.target.checked)}
                />
                <span className="whitespace-nowrap">Gồm chapter đã publish</span>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
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
        <div className="grid gap-4 lg:grid-cols-[minmax(240px,0.9fr)_minmax(0,1.3fr)]">
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Theo ngày</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:flex-col">
              {visibleDays.map((day) => {
                const active = day.date === selectedDate;
                return (
                  <button
                    key={day.date}
                    type="button"
                    onClick={() => setSelectedDate(day.date)}
                    className={cn(
                      "rounded-xl border px-3.5 py-2.5 text-left text-sm transition-all",
                      active
                        ? "border-sky-400 bg-sky-100 shadow-md shadow-sky-500/20 ring-1 ring-sky-300/60 dark:border-sky-400/60 dark:bg-sky-500/25 dark:shadow-sky-900/40 dark:ring-sky-400/30"
                        : "border-border/70 bg-card hover:border-border hover:bg-muted/40",
                    )}
                  >
                    <div
                      className={cn(
                        "font-semibold",
                        active
                          ? "text-sky-950 dark:text-sky-50"
                          : "text-foreground",
                      )}
                    >
                      {day.weekday || "—"}
                    </div>
                    <div
                      className={cn(
                        "text-xs",
                        active
                          ? "text-sky-800/90 dark:text-sky-100/80"
                          : "text-muted-foreground",
                      )}
                    >
                      {formatPublicationCalendarDateDisplay(day.date)}
                    </div>
                    <div
                      className={cn(
                        "mt-1.5 text-[11px] font-medium",
                        active
                          ? "text-sky-700 dark:text-sky-200"
                          : "text-muted-foreground",
                      )}
                    >
                      {day.eventCount} sự kiện
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <Card className="border-border/80 shadow-sm">
            <CardHeader className="space-y-3 pb-3">
              <CardTitle className="text-base">
                {selectedDay
                  ? formatPublicationCalendarDayLabel(
                      selectedDay.date,
                      selectedDay.weekday,
                    )
                  : "Chi tiết ngày"}
              </CardTitle>
              {selectedDay && selectedDay.eventCount > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: "all", label: "Tất cả" },
                    {
                      id: "series",
                      label: `Ra mắt series (${daySections.seriesLaunches.length})`,
                    },
                    {
                      id: "published",
                      label: `Đã publish (${daySections.publishedChapters.length})`,
                    },
                    {
                      id: "scheduled",
                      label: `Đã lên lịch (${daySections.scheduledChapters.length})`,
                    },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setEventFilter(opt.id)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                        eventFilter === opt.id
                          ? "border-sky-400 bg-sky-100 text-sky-900 dark:border-sky-500/50 dark:bg-sky-500/20 dark:text-sky-100"
                          : "border-border/70 bg-background text-muted-foreground hover:bg-muted/50",
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-4">
              {!selectedDay || selectedDay.eventCount === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Không có sự kiện trong ngày này.
                </p>
              ) : visibleEventCount === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Không có sự kiện thuộc nhóm đang chọn.
                </p>
              ) : (
                <>
                  {showSeries && daySections.seriesLaunches.length > 0 ? (
                    <div className="space-y-2.5 rounded-2xl border border-amber-200/80 bg-amber-50/30 p-3 dark:border-amber-500/25 dark:bg-amber-500/5">
                      <div className="flex items-center justify-between gap-2 px-0.5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-100">
                          Ra mắt series
                        </p>
                        <Badge
                          variant="outline"
                          className="border-amber-300/70 bg-amber-100 text-[10px] text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/20 dark:text-amber-100"
                        >
                          {daySections.seriesLaunches.length}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        {daySections.seriesLaunches.map((launch) => (
                          <SeriesLaunchRow key={`s-${launch.id}`} launch={launch} />
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {showPublished && daySections.publishedChapters.length > 0 ? (
                    <div className="space-y-2.5 rounded-2xl border border-emerald-200/80 bg-emerald-50/30 p-3 dark:border-emerald-500/25 dark:bg-emerald-500/5">
                      <div className="flex items-center justify-between gap-2 px-0.5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-100">
                          Đã publish
                        </p>
                        <Badge
                          variant="outline"
                          className="border-emerald-300/70 bg-emerald-100 text-[10px] text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/20 dark:text-emerald-200"
                        >
                          {daySections.publishedChapters.length}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        {daySections.publishedChapters.map((chapter) => (
                          <ChapterRow key={chapter.id} chapter={chapter} />
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {showScheduled && daySections.scheduledChapters.length > 0 ? (
                    <div className="space-y-2.5 rounded-2xl border border-sky-200/80 bg-sky-50/30 p-3 dark:border-sky-500/25 dark:bg-sky-500/5">
                      <div className="flex items-center justify-between gap-2 px-0.5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-sky-900 dark:text-sky-100">
                          Đã lên lịch
                        </p>
                        <Badge
                          variant="outline"
                          className="border-sky-300/70 bg-sky-100 text-[10px] text-sky-800 dark:border-sky-500/40 dark:bg-sky-500/20 dark:text-sky-200"
                        >
                          {daySections.scheduledChapters.length}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        {daySections.scheduledChapters.map((chapter) => (
                          <ChapterRow key={chapter.id} chapter={chapter} />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </section>
  );
}
