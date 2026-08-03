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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatTeScheduledPublishDisplay } from "@/utils/teReviewPhase.js";
import {
  formatPublicationCalendarChapterTitle,
  formatPublicationCalendarDateCompact,
  formatPublicationCalendarDayLabel,
  getPublicationCalendarDefaultRange,
  mapTeReviewsCalendarResponse,
} from "@/utils/publicationCalendarMappers.js";
import { cn } from "@/lib/utils";

function SeriesThumb({ coverUrl, fallbackIcon: Icon = BookOpen, tone = "sky" }) {
  const tones = {
    sky: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-700",
  };
  if (coverUrl) {
    return (
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
        <img src={coverUrl} alt="" className="size-full object-cover" />
      </div>
    );
  }
  return (
    <div
      className={cn(
        "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-gray-100",
        tones[tone] ?? tones.sky,
      )}
    >
      <Icon className="size-4" />
    </div>
  );
}

function MetaPill({ children, className }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border border-gray-100 bg-gray-50 px-2 py-0.5 text-[11px] font-medium text-gray-600",
        className,
      )}
    >
      {children}
    </span>
  );
}

function ChapterRow({ chapter }) {
  const when = formatTeScheduledPublishDisplay(
    chapter.scheduledPublishAt || chapter.publishedAt,
  );
  const seriesName = chapter.series?.name ?? "Series";
  const chapterLabel = formatPublicationCalendarChapterTitle(chapter);
  const coverUrl = chapter.series?.coverUrl ?? null;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-white p-3.5 shadow-2xs transition-all hover:border-gray-200",
        chapter.isPublished && "border-emerald-100 bg-emerald-50/40 hover:border-emerald-200",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <SeriesThumb coverUrl={coverUrl} />
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="truncate text-sm font-semibold text-gray-900">
            {seriesName}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <MetaPill
              className={
                chapter.isPublished
                  ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                  : "border-blue-100 bg-blue-50 text-blue-700"
              }
            >
              {chapter.isPublished ? "Đã publish" : "Đã lên lịch"}
            </MetaPill>
            {chapterLabel ? <MetaPill>{chapterLabel}</MetaPill> : null}
            {chapter.publicationSchedule ? (
              <MetaPill>{chapter.publicationSchedule}</MetaPill>
            ) : null}
            {chapter.te?.name ? (
              <MetaPill>TE: {chapter.te.name}</MetaPill>
            ) : null}
          </div>
          {when ? (
            <p className="flex items-center gap-1.5 text-[11px] text-gray-500">
              <Clock className="size-3 shrink-0" />
              {when}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SeriesLaunchRow({ launch }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-100 bg-white p-3.5 shadow-2xs transition-all hover:border-amber-200">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <SeriesThumb
          coverUrl={launch.coverUrl ?? launch.series?.coverUrl ?? null}
          fallbackIcon={Calendar}
          tone="amber"
        />
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="truncate text-sm font-semibold text-gray-900">
            {launch.name}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <MetaPill className="border-amber-100 bg-amber-50 text-amber-800">
              Ra mắt series
            </MetaPill>
            {launch.publicationSchedule ? (
              <MetaPill>{launch.publicationSchedule}</MetaPill>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionBlock({ title, count, tone, children }) {
  const tones = {
    amber: {
      wrap: "border-amber-100 bg-amber-50/40",
      title: "text-amber-800",
      count: "border-amber-100 bg-white text-amber-700",
    },
    emerald: {
      wrap: "border-emerald-100 bg-emerald-50/40",
      title: "text-emerald-800",
      count: "border-emerald-100 bg-white text-emerald-700",
    },
    blue: {
      wrap: "border-blue-100 bg-blue-50/40",
      title: "text-blue-800",
      count: "border-blue-100 bg-white text-blue-700",
    },
  };
  const t = tones[tone] ?? tones.blue;

  return (
    <div className={cn("space-y-2.5 rounded-xl border p-3", t.wrap)}>
      <div className="flex items-center justify-between gap-2 px-0.5">
        <p className={cn("text-[11px] font-semibold uppercase tracking-wide", t.title)}>
          {title}
        </p>
        <span
          className={cn(
            "inline-flex min-w-5 items-center justify-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold",
            t.count,
          )}
        >
          {count}
        </span>
      </div>
      <div className="space-y-2">{children}</div>
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

  const filterTabs = [
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
  ];

  return (
    <section className="space-y-5">
      <div className="mb-5 space-y-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight text-gray-900">
              Lịch phát hành
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Theo dõi chapter và series sắp publish theo lịch/chu kỳ đã lên.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!loading && calendar ? (
              <>
                <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                  {calendar.stats.scheduledChapters} đã lên lịch
                </span>
                <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                  {calendar.stats.publishedInRange} đã publish
                </span>
                <span className="rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
                  {calendar.stats.seriesLaunchesInRange} ra mắt series
                </span>
              </>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => void load()}
              className="h-8 border-gray-200 text-xs shadow-none"
            >
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
              Làm mới
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <Label
              htmlFor="te-cal-from"
              className="shrink-0 text-xs font-medium text-gray-600"
            >
              Từ ngày
            </Label>
            <Input
              id="te-cal-from"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-8 w-auto min-w-[9.5rem] border-gray-200 text-xs shadow-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label
              htmlFor="te-cal-to"
              className="shrink-0 text-xs font-medium text-gray-600"
            >
              Đến ngày
            </Label>
            <Input
              id="te-cal-to"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-8 w-auto min-w-[9.5rem] border-gray-200 text-xs shadow-none"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-700">
            <input
              type="checkbox"
              className="size-3.5 rounded border-gray-300 accent-blue-600"
              checked={includePublished}
              onChange={(e) => setIncludePublished(e.target.checked)}
            />
            <span className="whitespace-nowrap">Gồm chapter đã publish</span>
          </label>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-gray-100 bg-white py-16 text-center text-sm text-gray-500 shadow-sm">
          Đang tải lịch...
        </div>
      ) : !visibleDays.length ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-gray-100 bg-white py-16 text-center text-sm text-gray-500 shadow-sm">
          <Calendar className="size-9 text-gray-300" />
          <p>Không có sự kiện publish trong khoảng đã chọn.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(220px,0.85fr)_minmax(0,1.35fr)] lg:items-start">
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">Theo ngày</h3>
            <div className="scrollbar-hide flex max-h-[min(560px,calc(100vh-280px))] flex-col space-y-2 overflow-y-auto sm:flex-row sm:flex-wrap sm:gap-2 sm:space-y-0 lg:flex-col lg:gap-0 lg:space-y-2">
              {visibleDays.map((day) => {
                const active = day.date === selectedDate;
                return (
                  <button
                    key={day.date}
                    type="button"
                    onClick={() => setSelectedDate(day.date)}
                    className={cn(
                      "w-full cursor-pointer rounded-xl border p-3 text-left transition-all sm:w-auto lg:w-full",
                      active
                        ? "border-2 border-blue-600 bg-blue-50/80 shadow-xs"
                        : "border border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50/80",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-gray-900">
                          {day.weekday || "—"}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatPublicationCalendarDateCompact(day.date)}
                        </div>
                      </div>
                      <span className="shrink-0 rounded-md bg-white/80 px-2 py-0.5 text-xs font-medium text-blue-700">
                        {day.eventCount} sự kiện
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="mb-3 space-y-3">
              <h3 className="text-sm font-semibold text-gray-900">
                {selectedDay
                  ? formatPublicationCalendarDayLabel(
                      selectedDay.date,
                      selectedDay.weekday,
                    )
                  : "Chi tiết ngày"}
              </h3>
              {selectedDay && selectedDay.eventCount > 0 ? (
                <div className="inline-flex max-w-full flex-wrap gap-1 rounded-xl bg-gray-100/80 p-1">
                  {filterTabs.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setEventFilter(opt.id)}
                      className={cn(
                        "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                        eventFilter === opt.id
                          ? "bg-white text-gray-900 shadow-sm"
                          : "text-gray-600 hover:text-gray-900",
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="scrollbar-hide max-h-[min(560px,calc(100vh-280px))] space-y-3 overflow-y-auto">
              {!selectedDay || selectedDay.eventCount === 0 ? (
                <p className="py-8 text-center text-sm text-gray-500">
                  Không có sự kiện trong ngày này.
                </p>
              ) : visibleEventCount === 0 ? (
                <p className="py-8 text-center text-sm text-gray-500">
                  Không có sự kiện thuộc nhóm đang chọn.
                </p>
              ) : (
                <>
                  {showSeries && daySections.seriesLaunches.length > 0 ? (
                    <SectionBlock
                      title="Ra mắt series"
                      count={daySections.seriesLaunches.length}
                      tone="amber"
                    >
                      {daySections.seriesLaunches.map((launch) => (
                        <SeriesLaunchRow key={`s-${launch.id}`} launch={launch} />
                      ))}
                    </SectionBlock>
                  ) : null}

                  {showPublished && daySections.publishedChapters.length > 0 ? (
                    <SectionBlock
                      title="Đã publish"
                      count={daySections.publishedChapters.length}
                      tone="emerald"
                    >
                      {daySections.publishedChapters.map((chapter) => (
                        <ChapterRow key={chapter.id} chapter={chapter} />
                      ))}
                    </SectionBlock>
                  ) : null}

                  {showScheduled && daySections.scheduledChapters.length > 0 ? (
                    <SectionBlock
                      title="Đã lên lịch"
                      count={daySections.scheduledChapters.length}
                      tone="blue"
                    >
                      {daySections.scheduledChapters.map((chapter) => (
                        <ChapterRow key={chapter.id} chapter={chapter} />
                      ))}
                    </SectionBlock>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
