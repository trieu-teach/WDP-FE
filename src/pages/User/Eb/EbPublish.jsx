import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Calendar, CheckCircle2, Clock } from "lucide-react";
import Header from "@/components/User/Header/Header.jsx";
import Footer from "@/components/User/Footer/Footer.jsx";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
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
import { LABEL_EDITOR_BOARD } from "@/constants/roleTerminology.js";
import {
  EB_PUBLICATION_SCHEDULES,
  formatEbClassification,
  formatEbScheduledPublishDateTime,
  formatEbScheduledPublishDisplay,
  getEbVietnamDateNow,
  getEbVietnamTimeNow,
  mapEbChapterDetailResponse,
  mapEbChapterPendingItem,
  normalizeEbEvaluateResponse,
} from "@/utils/ebEvaluationMappers.js";
import { cn } from "@/lib/utils";
import "./Eb.css";

const NAV_LINKS = [
  { to: "/", label: "Trang chủ" },
  { to: "/mangaka", label: "Mangaka" },
  { to: "/tantou", label: "Tantou Editor" },
];

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
          "border-input bg-background flex h-9 w-full items-center justify-between rounded-md border px-3 text-sm shadow-xs transition-colors",
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

  const hasScores = councilAverage != null;

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

  function handleLogout() {
    logout();
    navigate("/login");
  }

  async function handleConfirmPublish() {
    const seriesId = chapter?.seriesId;
    if (!seriesId) {
      toast.error("Thiếu series để xác nhận publish.");
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
        "Chọn lịch phát hành (weekly/monthly) hoặc ngày + giờ publish cụ thể.",
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
      toast.error("Gửi điểm Hội đồng trước khi xác nhận publish.");
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
          ? `Series đã được duyệt. Series sẽ tự động chuyển sang 'published' vào ${whenLabel}.`
          : (res?.message
            || `Series "${seriesName}" đã publish${res?.council_average != null ? ` · DTB ${Number(res.council_average).toFixed(1)}` : ""}.`),
      );
      navigate("/eb");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không xác nhận được lịch publish."));
    } finally {
      setSubmitting(false);
    }
  }

  const evaluateUrl = chapterId
    ? `/eb/chapter/${encodeURIComponent(chapterId)}`
    : "/eb";

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
            <p className="text-xs font-medium uppercase tracking-widest text-primary">
              {LABEL_EDITOR_BOARD} · Publish
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
                Không tìm thấy chapter để publish.
              </p>
              <Button asChild variant="outline">
                <Link to="/eb">Về hàng chờ</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="mx-auto max-w-xl space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="size-5 text-primary" />
                  Lịch publish series
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl border bg-muted/30 p-4 text-sm">
                  <p className="text-muted-foreground">Điểm Hội đồng</p>
                  {hasScores ? (
                    <p className="mt-1 font-semibold text-foreground">
                      DTB {councilAverage.toFixed(1)}
                      {formatEbClassification(lastEvaluation ?? chapter)
                        ? ` · ${formatEbClassification(lastEvaluation ?? chapter)}`
                        : ""}
                    </p>
                  ) : (
                    <p className="mt-1 text-amber-700">
                      Chưa có điểm — quay lại trang đánh giá để gửi điểm Hội đồng
                      trước.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="eb-publication-schedule">
                    Lịch phát hành (weekly / monthly)
                  </Label>
                  <Select
                    value={publicationSchedule || undefined}
                    onValueChange={setPublicationSchedule}
                  >
                    <SelectTrigger id="eb-publication-schedule" className="w-full">
                      <SelectValue placeholder="Chọn weekly hoặc monthly (tùy chọn)" />
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

                <p className="text-xs text-muted-foreground">
                  Giờ hiện tại tại Việt Nam:{" "}
                  <strong className="text-foreground">{vietnamNowLabel}</strong>
                  {" "}
                  (GMT+7)
                </p>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="eb-scheduled-publish">
                      Ngày publish (giờ Việt Nam)
                    </Label>
                    <Input
                      id="eb-scheduled-publish"
                      type="date"
                      min={vietnamDateNow}
                      value={scheduledPublishAt}
                      onChange={(event) => applyPublishDate(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="eb-scheduled-publish-time">
                      Giờ publish (giờ Việt Nam, HH:mm)
                    </Label>
                    <PublishTimePicker
                      dateValue={scheduledPublishAt}
                      value={scheduledPublishTime}
                      disabled={!scheduledPublishAt}
                      onChange={setScheduledPublishTime}
                    />
                  </div>
                </div>

                <Button
                  className="w-full"
                  disabled={
                    submitting
                    || !hasScores
                    || !chapter?.seriesId
                    || (!publicationSchedule && !scheduledPublishAt)
                  }
                  onClick={() => void handleConfirmPublish()}
                >
                  <CheckCircle2 className="size-4" />
                  Xác nhận publish series
                </Button>

                {!hasScores ? (
                  <Button variant="outline" className="w-full" asChild>
                    <Link to={evaluateUrl}>Quay lại trang đánh giá</Link>
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
