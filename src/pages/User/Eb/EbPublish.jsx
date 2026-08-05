import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  ImageIcon,
  Star,
  User,
} from "lucide-react";
import Header from "@/components/User/Header/Header.jsx";
import Footer from "@/components/User/Footer/Footer.jsx";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSession, logout } from "@/lib/auth.js";
import { ebEvaluationsService } from "@/api/ebEvaluations.service.js";
import { getApiErrorMessage } from "@/api/http.js";
import { EB_NAV_LINKS } from "@/constants/ebNav.js";
import { LABEL_EDITOR_BOARD } from "@/constants/roleTerminology.js";
import {
  EB_PUBLICATION_SCHEDULES,
  EB_COUNCIL_MIN_FOR_PUBLISH,
  areAllCouncilMembersFullyScored,
  formatEbClassification,
  formatEbScheduledPublishDateTime,
  formatEbScheduledPublishDisplay,
  getEbVietnamDateNow,
  getEbVietnamTimeNow,
  mapEbChapterDetailResponse,
  mapEbChapterPendingItem,
  normalizeEbEvaluateResponse,
} from "@/utils/ebEvaluationMappers.js";
import {
  readCouncilRoster,
  readCouncilSeriesScores,
} from "@/utils/ebCouncilStorage.js";
import { cn } from "@/lib/utils";
import "./Eb.css";

const NAV_LINKS = EB_NAV_LINKS;

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) =>
  String(i).padStart(2, "0"),
);
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) =>
  String(i).padStart(2, "0"),
);

function parseHhMm(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? "").trim());
  if (!match) return { hour: "09", minute: "00" };
  return {
    hour: String(Math.min(23, Math.max(0, Number(match[1])))).padStart(2, "0"),
    minute: String(Math.min(59, Math.max(0, Number(match[2])))).padStart(2, "0"),
  };
}

function isPastPublishTime(dateValue, hour, minute) {
  if (!dateValue || dateValue !== getEbVietnamDateNow()) return false;
  const candidate = `${hour}:${minute}`;
  return candidate < getEbVietnamTimeNow();
}

/** Cộng/trừ ngày trên chuỗi YYYY-MM-DD (lịch Việt Nam). */
function shiftVietnamDate(dateStr, days) {
  const base = String(dateStr || getEbVietnamDateNow());
  const [y, m, d] = base.split("-").map(Number);
  if (!y || !m || !d) return getEbVietnamDateNow();
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** Thứ Hai của tuần kế tiếp (theo ngày VN YYYY-MM-DD). */
function nextWeekMonday(dateStr = getEbVietnamDateNow()) {
  const [y, m, d] = String(dateStr).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.getUTCDay(); // 0 CN … 1 T2
  const daysUntilNextMonday = day === 1 ? 7 : ((8 - day) % 7 || 7);
  return shiftVietnamDate(dateStr, daysUntilNextMonday);
}

function councilScoreBadgeClass(label) {
  const text = String(label ?? "").toLowerCase();
  if (text.includes("xuất sắc") || text.includes("xuat sac")) {
    return "border-emerald-300/70 bg-emerald-500/15 text-emerald-900 dark:border-emerald-500/40 dark:text-emerald-200";
  }
  if (text.includes("tốt") || text.includes("tot")) {
    return "border-sky-300/70 bg-sky-500/15 text-sky-900 dark:border-sky-500/40 dark:text-sky-200";
  }
  if (text.includes("đạt") || text.includes("dat")) {
    return "border-amber-300/70 bg-amber-500/15 text-amber-900 dark:border-amber-500/40 dark:text-amber-200";
  }
  if (text.includes("không") || text.includes("khong")) {
    return "border-rose-300/70 bg-rose-500/15 text-rose-900 dark:border-rose-500/40 dark:text-rose-200";
  }
  return "border-emerald-300/70 bg-emerald-500/15 text-emerald-900 dark:border-emerald-500/40 dark:text-emerald-200";
}

/** Custom time picker — chặn giờ/phút trong quá khứ (native input không bắt được từng ô). */
function PublishTimePicker({
  value,
  onChange,
  disabled = false,
  dateValue,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const { hour, minute } = parseHhMm(value);

  useEffect(() => {
    if (!open) return undefined;
    function onDocPointerDown(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [open]);

  function pickHour(nextHour) {
    if (isPastPublishTime(dateValue, nextHour, minute)) return;
    onChange?.(`${nextHour}:${minute}`);
  }

  function pickMinute(nextMinute) {
    if (isPastPublishTime(dateValue, hour, nextMinute)) return;
    onChange?.(`${hour}:${nextMinute}`);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "border-input bg-background flex h-10 w-full items-center justify-between rounded-md border px-3 text-sm shadow-xs transition-colors",
          "hover:bg-accent/40 disabled:cursor-not-allowed disabled:opacity-50",
          open && "ring-ring ring-1",
        )}
      >
        <span className="tabular-nums">{`${hour}:${minute}`}</span>
        <Clock className="size-4 text-muted-foreground" />
      </button>

      {open && !disabled ? (
        <div className="absolute bottom-full left-0 z-50 mb-2 flex overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg">
          <div className="max-h-48 w-16 overflow-y-auto py-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {HOUR_OPTIONS.map((h) => {
              const past = isPastPublishTime(dateValue, h, minute);
              const selected = h === hour;
              return (
                <button
                  key={h}
                  type="button"
                  className={cn(
                    "flex w-full items-center justify-center px-2 py-1.5 text-sm tabular-nums",
                    selected && "bg-accent font-medium",
                    past
                      ? "cursor-not-allowed text-muted-foreground/50"
                      : "hover:bg-accent",
                  )}
                  onClick={() => pickHour(h)}
                >
                  {h}
                </button>
              );
            })}
          </div>
          <div className="max-h-48 w-16 overflow-y-auto border-l py-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {MINUTE_OPTIONS.map((m) => {
              const past = isPastPublishTime(dateValue, hour, m);
              const selected = m === minute;
              return (
                <button
                  key={m}
                  type="button"
                  className={cn(
                    "flex w-full items-center justify-center px-2 py-1.5 text-sm tabular-nums",
                    selected && "bg-accent font-medium ring-1 ring-inset ring-foreground/20",
                    past
                      ? "cursor-not-allowed text-muted-foreground/50"
                      : "hover:bg-accent",
                  )}
                  onClick={() => pickMinute(m)}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function EbPublish() {
  const navigate = useNavigate();
  const { chapterId } = useParams();
  const user = getSession();

  const [chapter, setChapter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [publicationSchedule, setPublicationSchedule] = useState("");
  const [scheduledPublishAt, setScheduledPublishAt] = useState("");
  const [scheduledPublishTime, setScheduledPublishTime] = useState(getEbVietnamTimeNow);
  const [vietnamNowLabel, setVietnamNowLabel] = useState(() =>
    formatEbScheduledPublishDisplay(new Date().toISOString()),
  );
  const [lastEvaluation, setLastEvaluation] = useState(null);

  useEffect(() => {
    function syncVietnamClock() {
      setVietnamNowLabel(
        formatEbScheduledPublishDisplay(new Date().toISOString()),
      );
    }

    const timer = window.setInterval(syncVietnamClock, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const loadChapter = useCallback(async () => {
    if (!chapterId) return;
    setLoading(true);
    try {
      const data = await ebEvaluationsService.getChapterDetail(chapterId);
      const mapped = mapEbChapterDetailResponse(data);
      if (mapped) {
        setChapter(mapped);
        const latestEval = mapped.evaluationHistory?.at(-1);
        const normalized = normalizeEbEvaluateResponse({
          evaluation: latestEval,
          council_average: mapped.councilAverage,
          classification: mapped.classification,
          classification_text: mapped.classificationText,
        });
        if (
          normalized.councilAverage != null
          || normalized.evaluation
        ) {
          setLastEvaluation({
            ...(normalized.evaluation ?? {}),
            council_average: normalized.councilAverage,
            classification: normalized.classification,
            classification_text: normalized.classificationText,
          });
        }
        return;
      }
      throw new Error("empty");
    } catch {
      try {
        const { items } = await ebEvaluationsService.getChapterPending({
          page: 1,
          limit: 50,
        });
        const found = (Array.isArray(items) ? items : [])
          .map(mapEbChapterPendingItem)
          .find((item) => item?.id === chapterId);
        if (found) {
          setChapter(found);
          if (found.councilAverage != null) {
            setLastEvaluation({
              council_average: found.councilAverage,
              classification: found.classification,
              classification_text: found.classificationText,
            });
          }
        } else {
          setChapter(null);
        }
      } catch (err) {
        toast.error(getApiErrorMessage(err, "Không tải được thông tin chapter."));
        setChapter(null);
      }
    } finally {
      setLoading(false);
    }
  }, [chapterId]);

  useEffect(() => {
    void loadChapter();
  }, [loadChapter]);

  const councilAverage = useMemo(() => {
    if (lastEvaluation?.council_average != null) {
      return Number(lastEvaluation.council_average);
    }
    if (chapter?.councilAverage != null) {
      return Number(chapter.councilAverage);
    }
    return null;
  }, [chapter, lastEvaluation]);

  const allMembersFullyScored = useMemo(() => {
    if (!chapterId) return false;
    const roster = readCouncilRoster(chapterId);
    const record = readCouncilSeriesScores(chapterId);
    if (roster.length < EB_COUNCIL_MIN_FOR_PUBLISH) return false;
    return areAllCouncilMembersFullyScored({
      roster,
      councilRecord: record,
    });
  }, [chapterId, councilAverage, lastEvaluation]);

  const hasScores = councilAverage != null && allMembersFullyScored;

  const vietnamDateNow = getEbVietnamDateNow();

  function clampPublishTime(dateValue, timeValue) {
    const nextTime = String(timeValue ?? "").trim() || getEbVietnamTimeNow();
    if (!dateValue || dateValue !== getEbVietnamDateNow()) return nextTime;
    const nowTime = getEbVietnamTimeNow();
    return nextTime < nowTime ? nowTime : nextTime;
  }

  function applyPublishDate(nextDate) {
    const today = getEbVietnamDateNow();
    if (nextDate && nextDate < today) {
      setScheduledPublishAt(today);
      setScheduledPublishTime((prev) => clampPublishTime(today, prev));
      return;
    }
    setScheduledPublishAt(nextDate);
    setScheduledPublishTime((prev) => clampPublishTime(nextDate, prev));
  }

  function applySchedulePreset(preset) {
    const today = getEbVietnamDateNow();
    if (preset === "today") {
      applyPublishDate(today);
      setScheduledPublishTime(clampPublishTime(today, getEbVietnamTimeNow()));
      return;
    }
    if (preset === "tomorrow-morning") {
      const tomorrow = shiftVietnamDate(today, 1);
      setScheduledPublishAt(tomorrow);
      setScheduledPublishTime("09:00");
      return;
    }
    if (preset === "next-week") {
      const monday = nextWeekMonday(today);
      setScheduledPublishAt(monday);
      setScheduledPublishTime("09:00");
    }
  }

  function handleLogout() {
    logout();
    navigate("/login");
  }

  async function handleConfirmPublish() {
    const seriesId = chapter?.seriesId;
    if (!seriesId) {
      toast.error("Thiếu series để xác nhận phát hành.");
      return;
    }
    const schedule = publicationSchedule.trim();
    const publishTime = clampPublishTime(scheduledPublishAt, scheduledPublishTime);
    if (publishTime !== scheduledPublishTime) {
      setScheduledPublishTime(publishTime);
    }
    const scheduled_publish_at = scheduledPublishAt
      ? formatEbScheduledPublishDateTime(scheduledPublishAt, publishTime)
      : "";
    if (!schedule && !scheduled_publish_at) {
      toast.error(
        "Chọn tần suất phát hành hoặc ngày + giờ phát hành cụ thể.",
      );
      return;
    }
    if (scheduled_publish_at) {
      const selectedMs = new Date(scheduled_publish_at).getTime();
      const earliestAllowedMs = new Date(
        formatEbScheduledPublishDateTime(getEbVietnamDateNow(), getEbVietnamTimeNow()),
      ).getTime();
      if (
        Number.isNaN(selectedMs)
        || Number.isNaN(earliestAllowedMs)
        || selectedMs < earliestAllowedMs
      ) {
        return;
      }
    }
    if (!hasScores) {
      toast.error(
        `Cần ít nhất ${EB_COUNCIL_MIN_FOR_PUBLISH} thành viên Hội đồng, tất cả nhập đủ điểm và nộp kết quả trước khi xác nhận lịch phát hành.`,
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await ebEvaluationsService.confirmPublish(seriesId, {
        ...(schedule ? { publication_schedule: schedule } : {}),
        ...(scheduled_publish_at ? { scheduled_publish_at } : {}),
      });
      const seriesName = res?.series?.name ?? chapter?.seriesName ?? "Series";
      const whenLabel = scheduled_publish_at
        ? formatEbScheduledPublishDisplay(scheduled_publish_at)
        : "";
      toast.success(
        whenLabel
          ? `Đã duyệt "${seriesName}" — lên sóng lúc ${whenLabel}. Chapter 1 chuyển Mangaka/Assistant hoàn thiện.`
          : `Đã duyệt "${seriesName}" — chờ lịch phát hành. Chapter 1 chuyển Mangaka/Assistant hoàn thiện.`,
      );
      navigate("/eb");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không xác nhận được lịch phát hành."));
    } finally {
      setSubmitting(false);
    }
  }

  const evaluateUrl = chapterId
    ? `/eb/chapter/${encodeURIComponent(chapterId)}`
    : "/eb";

  const classificationLabel = formatEbClassification(lastEvaluation ?? chapter);
  const coverUrl =
    chapter?.seriesCoverUrl
    || chapter?.previewImageUrl
    || chapter?.coverUrl
    || null;
  const authorName = chapter?.mangakaName || "—";

  return (
    <div className="ws-page--eb flex min-h-screen flex-col bg-background">
      <Header links={NAV_LINKS} onLogout={user ? handleLogout : undefined} />

      <main className="page-container flex-1 space-y-6 py-8">
        <header className="flex flex-wrap items-center gap-3 border-b border-border/60 pb-4">
          <Button type="button" variant="ghost" size="sm" asChild>
            <Link to={evaluateUrl}>
              <ArrowLeft className="size-4" />
              Quay lại đánh giá
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-widest text-sky-600 dark:text-sky-400">
              {LABEL_EDITOR_BOARD} · Phát hành
            </p>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Xác nhận lịch phát hành
            </h1>
            {chapter ? (
              <p className="text-sm text-muted-foreground">
                {chapter.seriesName}
                {chapter.chapterNumber != null ? ` · Ch.${chapter.chapterNumber}` : ""}
                {chapter.title ? ` — ${chapter.title}` : ""}
              </p>
            ) : null}
          </div>
        </header>

        {loading ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              Đang tải...
            </CardContent>
          </Card>
        ) : !chapter ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
              <p className="text-muted-foreground">
                Không tìm thấy chapter để phát hành.
              </p>
              <Button asChild variant="outline">
                <Link to="/eb">Về hàng chờ</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[minmax(260px,1fr)_minmax(0,1.2fr)] lg:items-stretch">
            <Card className="flex h-full flex-col overflow-hidden border-border/70 py-0 shadow-sm">
              <CardHeader className="shrink-0 pb-3 pt-5">
                <CardTitle className="text-base">Tóm tắt series</CardTitle>
                <CardDescription>
                  Đối chiếu nhanh trước khi xác nhận lịch.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex min-h-0 flex-1 flex-col gap-4 pb-5">
                <div className="relative min-h-[220px] flex-1 overflow-hidden rounded-xl border border-border/70 bg-muted/30 shadow-sm">
                  {coverUrl ? (
                    <img
                      src={coverUrl}
                      alt=""
                      className="absolute inset-0 size-full object-cover object-top"
                    />
                  ) : (
                    <div className="flex size-full min-h-[220px] flex-col items-center justify-center gap-2 text-muted-foreground">
                      <ImageIcon className="size-8 opacity-40" />
                      <span className="text-xs">Chưa có ảnh bìa</span>
                    </div>
                  )}
                </div>
                <div className="shrink-0 space-y-1.5 border-t border-border/60 pt-3">
                  <h2 className="text-lg font-semibold leading-snug tracking-tight">
                    {chapter.seriesName || "Series"}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {chapter.chapterNumber != null
                      ? `Chapter ${chapter.chapterNumber}`
                      : "Chapter"}
                    {chapter.title ? ` — ${chapter.title}` : ""}
                  </p>
                  <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                    <User className="size-3.5 shrink-0" />
                    <span>
                      Tác giả:{" "}
                      <strong className="font-medium text-foreground">
                        {authorName}
                      </strong>
                    </span>
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="flex h-full flex-col border-border/70 py-0 shadow-sm">
              <CardHeader className="shrink-0 pb-3 pt-5">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Calendar className="size-5 text-emerald-600 dark:text-emerald-400" />
                  Lịch phát hành series
                </CardTitle>
                <CardDescription>
                  Confirm-publish mở debut gate: series → approved_by_EB / upcoming;
                  chapter 1 → pending_assistant. Series chưa published ngay — job chạy
                  theo scheduled_publish_at. Lịch chapter do TE sau khi Mangaka/Assistant
                  hoàn tất (không phải EB publish chapter).
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-5 pb-5">
                {hasScores ? (
                  <div
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border px-4 py-3.5 shadow-sm",
                      councilScoreBadgeClass(classificationLabel),
                    )}
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/70 shadow-sm dark:bg-black/20">
                      <Star className="size-5 fill-amber-400 text-amber-400" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wider opacity-80">
                        Điểm Hội đồng
                      </p>
                      <p className="mt-0.5 text-lg font-bold tracking-tight tabular-nums sm:text-xl">
                        ĐTB {councilAverage.toFixed(1)}
                        {classificationLabel ? (
                          <span className="font-semibold">
                            {" "}
                            · {classificationLabel}
                          </span>
                        ) : null}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-amber-300/70 bg-amber-500/10 px-4 py-3.5 text-sm text-amber-900 dark:border-amber-500/40 dark:text-amber-200">
                    <p className="font-medium">Chưa có điểm Hội đồng</p>
                    <p className="mt-1 text-xs opacity-90">
                      Quay lại trang đánh giá để gửi điểm trước khi xác nhận lịch.
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="eb-publication-schedule">
                    Tần suất phát hành
                  </Label>
                  <Select
                    value={publicationSchedule || undefined}
                    onValueChange={setPublicationSchedule}
                  >
                    <SelectTrigger id="eb-publication-schedule" className="h-10 w-full">
                      <SelectValue placeholder="Chọn hàng tuần / hàng tháng (tuỳ chọn)" />
                    </SelectTrigger>
                    <SelectContent>
                      {EB_PUBLICATION_SCHEDULES.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label>Thời điểm phát hành</Label>
                    <p className="text-xs text-muted-foreground">
                      Hiện tại VN:{" "}
                      <strong className="text-foreground">{vietnamNowLabel}</strong>
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: "today", label: "Hôm nay" },
                      { id: "tomorrow-morning", label: "Sáng mai 09:00" },
                      { id: "next-week", label: "Đầu tuần sau" },
                    ].map((chip) => (
                      <Button
                        key={chip.id}
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-full border-border/80 bg-background px-3 text-xs hover:border-emerald-300 hover:bg-emerald-500/10 hover:text-emerald-900 dark:hover:border-emerald-500/40 dark:hover:text-emerald-200"
                        onClick={() => applySchedulePreset(chip.id)}
                      >
                        {chip.label}
                      </Button>
                    ))}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="eb-scheduled-publish">Ngày phát hành</Label>
                      <Input
                        id="eb-scheduled-publish"
                        type="date"
                        min={vietnamDateNow}
                        value={scheduledPublishAt}
                        className="h-10"
                        onChange={(event) => applyPublishDate(event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="eb-scheduled-publish-time">
                        Giờ:Phút
                      </Label>
                      <PublishTimePicker
                        dateValue={scheduledPublishAt}
                        value={scheduledPublishTime}
                        disabled={!scheduledPublishAt}
                        onChange={setScheduledPublishTime}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-auto space-y-3 pt-1">
                  <Button
                    className="h-11 w-full gap-2 bg-emerald-600 text-white shadow-sm transition hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-muted disabled:text-muted-foreground"
                    disabled={
                      submitting
                      || !hasScores
                      || !chapter?.seriesId
                      || (!publicationSchedule && !scheduledPublishAt)
                    }
                    onClick={() => void handleConfirmPublish()}
                  >
                    <CheckCircle2 className="size-4" />
                    {submitting ? "Đang xác nhận…" : "Xác nhận phát hành series"}
                  </Button>

                  {!hasScores ? (
                    <>
                      <p className="text-center text-xs text-muted-foreground">
                        Chưa đủ điều kiện: cần ít nhất {EB_COUNCIL_MIN_FOR_PUBLISH}{" "}
                        thành viên Hội đồng, tất cả nhập đủ điểm và đã nộp kết quả
                        chấm. Nút xác nhận đang bị khóa.
                      </p>
                      <Button variant="outline" className="w-full" asChild>
                        <Link to={evaluateUrl}>Quay lại trang đánh giá</Link>
                      </Button>
                    </>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
