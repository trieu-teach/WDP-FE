import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Calendar,
  ChevronRight,
  Clock,
  List,
  RefreshCw,
} from "lucide-react";
import Header from "@/components/User/Header/Header.jsx";
import Footer from "@/components/User/Footer/Footer.jsx";
import { WorkspaceHero } from "@/components/layout/WorkspaceHero.jsx";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getSession, logout } from "@/lib/auth.js";
import { ebEvaluationsService } from "@/api/ebEvaluations.service.js";
import { getApiErrorMessage } from "@/api/http.js";
import { LABEL_EDITOR_BOARD } from "@/constants/roleTerminology.js";
import {
  EB_PUBLICATION_SCHEDULES,
  formatEbPublicationScheduleDayLabel,
  formatEbScheduledPublishDisplay,
  getEbDefaultPublicationScheduleRange,
  mapEbPublicationScheduleResponse,
  resolveEbPublicationEventHref,
} from "@/utils/ebEvaluationMappers.js";
import { cn } from "@/lib/utils";
import "./Eb.css";

const NAV_LINKS = [
  { to: "/", label: "Trang chủ" },
  { to: "/mangaka", label: "Mangaka" },
  { to: "/tantou", label: "Tantou Editor" },
];

function ScheduleEventRow({ event }) {
  const href = resolveEbPublicationEventHref(event);
  const isChapter = event.type === "chapter";
  const title = isChapter
    ? `Ch. ${event.chapterNumber ?? "?"}${event.chapterTitle ? ` — ${event.chapterTitle}` : ""}`
    : "Publish series";
  const timeLabel = event.scheduledPublishAt
    ? formatEbScheduledPublishDisplay(event.scheduledPublishAt)
    : null;

  const inner = (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3 transition-colors",
        event.isOverdue
          ? "border-amber-300/80 bg-amber-50/50 dark:border-amber-500/30 dark:bg-amber-500/5"
          : "bg-card hover:bg-muted/40",
        href && "cursor-pointer hover:border-primary/30",
      )}
    >
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          isChapter ? "bg-sky-500/10 text-sky-700" : "bg-teal-500/10 text-teal-700",
        )}
      >
        {isChapter ? <BookOpen className="size-4" /> : <Calendar className="size-4" />}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold">{title}</p>
          <Badge variant="outline" className="text-[10px]">
            {isChapter ? "Chapter" : "Series"}
          </Badge>
          {event.publicationSchedule ? (
            <Badge variant="secondary" className="text-[10px]">
              {event.publicationSchedule}
            </Badge>
          ) : null}
          {event.isOverdue ? (
            <Badge className="bg-amber-500 text-[10px] text-white hover:bg-amber-500">
              Quá hạn
            </Badge>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">{event.seriesName}</p>
        {timeLabel ? (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3" />
            {timeLabel}
          </p>
        ) : null}
      </div>
      {href ? <ChevronRight className="size-4 shrink-0 text-muted-foreground" /> : null}
    </div>
  );

  if (!href) return inner;
  return (
    <Link to={href} className="block no-underline text-inherit">
      {inner}
    </Link>
  );
}

export default function EbPublicationSchedule() {
  const navigate = useNavigate();
  const user = getSession();
  const defaults = useMemo(() => getEbDefaultPublicationScheduleRange(), []);

  const [view, setView] = useState("calendar");
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [publicationSchedule, setPublicationSchedule] = useState("");
  const [includeOverdue, setIncludeOverdue] = useState(true);
  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState(null);
  const [selectedDate, setSelectedDate] = useState("");

  const loadSchedule = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        from: from || undefined,
        to: to || undefined,
        view,
        ...(publicationSchedule ? { publication_schedule: publicationSchedule } : {}),
        ...(includeOverdue ? { include_overdue: "true" } : {}),
      };
      const res = await ebEvaluationsService.getPublicationSchedule(params);
      const mapped = mapEbPublicationScheduleResponse(res);
      setSchedule(mapped);
      if (mapped.view === "calendar" && mapped.days.length > 0) {
        setSelectedDate((current) => {
          if (current && mapped.days.some((d) => d.date === current)) return current;
          return mapped.days[0].date;
        });
      } else {
        setSelectedDate("");
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không tải được lịch publish."));
      setSchedule(null);
    } finally {
      setLoading(false);
    }
  }, [from, to, view, publicationSchedule, includeOverdue]);

  useEffect(() => {
    void loadSchedule();
  }, [loadSchedule]);

  const selectedDay = useMemo(() => {
    if (!schedule || schedule.view !== "calendar" || !selectedDate) return null;
    return schedule.days.find((d) => d.date === selectedDate) ?? null;
  }, [schedule, selectedDate]);

  const flatTimeline = useMemo(() => {
    if (!schedule || schedule.view !== "calendar") return [];
    return schedule.days.flatMap((day) =>
      day.events.map((event) => ({ ...event, date: day.date })),
    );
  }, [schedule]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="ws-page--eb flex min-h-screen flex-col bg-background">
      <Header links={NAV_LINKS} onLogout={user ? handleLogout : undefined} />

      <WorkspaceHero
        label={LABEL_EDITOR_BOARD}
        title="Lịch phát hành"
        description="Series và chapter đã lên lịch publish — weekly, monthly hoặc ngày cụ thể."
        className="ws-hero--eb"
      />

      <main className="page-container flex-1 space-y-6 py-8">
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="ghost" size="sm" asChild>
            <Link to="/eb">
              <ArrowLeft className="size-4" />
              Hàng chờ EB
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => void loadSchedule()}
          >
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            Làm mới
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Bộ lọc</CardTitle>
            <CardDescription>
              Mặc định: 30 ngày trước → 90 ngày tới (giờ Việt Nam).
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="eb-schedule-from">Từ ngày</Label>
              <Input
                id="eb-schedule-from"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="eb-schedule-to">Đến ngày</Label>
              <Input
                id="eb-schedule-to"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Lịch phát hành</Label>
              <Select
                value={publicationSchedule || "__all__"}
                onValueChange={(v) => setPublicationSchedule(v === "__all__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tất cả" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tất cả</SelectItem>
                  {EB_PUBLICATION_SCHEDULES.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 rounded border-input"
                  checked={includeOverdue}
                  onChange={(e) => setIncludeOverdue(e.target.checked)}
                />
                Bao gồm quá hạn
              </label>
            </div>
          </CardContent>
        </Card>

        {!loading && schedule ? (
          <div className="flex flex-wrap gap-3">
            <Badge variant="secondary">{schedule.total} sự kiện</Badge>
            <Badge variant="outline">{schedule.seriesCount} series</Badge>
            <Badge variant="outline">{schedule.chapterCount} chapter</Badge>
            {schedule.range?.from && schedule.range?.to ? (
              <span className="text-xs text-muted-foreground">
                {schedule.range.from.slice(0, 10)} → {schedule.range.to.slice(0, 10)}
              </span>
            ) : null}
          </div>
        ) : null}

        <Tabs value={view} onValueChange={setView}>
          <TabsList>
            <TabsTrigger value="calendar" className="gap-2">
              <Calendar className="size-4" />
              Calendar
            </TabsTrigger>
            <TabsTrigger value="list" className="gap-2">
              <List className="size-4" />
              Theo series
            </TabsTrigger>
          </TabsList>

          <TabsContent value="calendar" className="mt-4 space-y-4">
            {loading ? (
              <Card>
                <CardContent className="py-16 text-center text-muted-foreground">
                  Đang tải lịch...
                </CardContent>
              </Card>
            ) : !schedule?.days?.length ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
                  <Calendar className="size-10 opacity-30" />
                  <p>Không có sự kiện publish trong khoảng đã chọn.</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {schedule.days.map((day) => {
                    const overdueCount = day.events.filter((e) => e.isOverdue).length;
                    const active = day.date === selectedDate;
                    return (
                      <button
                        key={day.date}
                        type="button"
                        onClick={() => setSelectedDate(day.date)}
                        className={cn(
                          "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                          active
                            ? "border-primary bg-primary/10 text-foreground"
                            : "bg-card hover:bg-muted/50",
                        )}
                      >
                        <span className="block font-semibold tabular-nums">{day.date}</span>
                        <span className="text-xs text-muted-foreground">
                          {day.events.length} sự kiện
                          {overdueCount > 0 ? ` · ${overdueCount} quá hạn` : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {selectedDay ? (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">
                        {formatEbPublicationScheduleDayLabel(selectedDay.date)}
                      </CardTitle>
                      <CardDescription>
                        {selectedDay.events.length} sự kiện
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {selectedDay.events.map((event, idx) => (
                        <ScheduleEventRow
                          key={`${selectedDay.date}-${event.type}-${event.seriesId}-${event.chapterId}-${idx}`}
                          event={event}
                        />
                      ))}
                    </CardContent>
                  </Card>
                ) : null}

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Timeline</CardTitle>
                    <CardDescription>Sắp xếp theo thời gian trong khoảng lọc</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {flatTimeline.map((event, idx) => (
                      <div key={`tl-${event.date}-${idx}`} className="space-y-2">
                        {idx === 0 || flatTimeline[idx - 1]?.date !== event.date ? (
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {event.date}
                          </p>
                        ) : null}
                        <ScheduleEventRow event={event} />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="list" className="mt-4 space-y-4">
            {loading ? (
              <Card>
                <CardContent className="py-16 text-center text-muted-foreground">
                  Đang tải lịch...
                </CardContent>
              </Card>
            ) : !schedule?.groups?.length ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
                  <List className="size-10 opacity-30" />
                  <p>Không có series nào có lịch publish trong khoảng đã chọn.</p>
                </CardContent>
              </Card>
            ) : (
              schedule.groups.map((group) => (
                <Card key={group.seriesId ?? group.seriesName}>
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">
                          {group.seriesName}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {group.events.length} sự kiện
                          {group.publicationSchedule
                            ? ` · ${group.publicationSchedule}`
                            : ""}
                        </CardDescription>
                      </div>
                      {group.seriesId ? (
                        <Button size="sm" variant="outline" asChild>
                          <Link to={`/eb/series/${encodeURIComponent(group.seriesId)}`}>
                            Chi tiết series
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {group.events.map((event, idx) => (
                      <ScheduleEventRow
                        key={`${group.seriesId}-ev-${idx}`}
                        event={event}
                      />
                    ))}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>

        <Card className="border-dashed bg-muted/20">
          <CardContent className="flex gap-3 py-4 text-xs text-muted-foreground">
            <AlertTriangle className="size-4 shrink-0 text-amber-600" />
            <p>
              Chỉ hiển thị series/chapter liên quan EB. Chapter mới sau confirm-publish
              có thể chưa có lịch — kết hợp với hàng chờ TE hoặc Mangaka để theo dõi
              publish thực tế.
            </p>
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
}
