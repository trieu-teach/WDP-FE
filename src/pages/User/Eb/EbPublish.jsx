import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Calendar, CheckCircle2 } from "lucide-react";
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
import { getSession, logout } from "@/lib/auth.js";
import { ebEvaluationsService } from "@/api/ebEvaluations.service.js";
import { getApiErrorMessage } from "@/api/http.js";
import { LABEL_EDITOR_BOARD } from "@/constants/roleTerminology.js";
import {
  EB_PUBLICATION_SCHEDULES,
  formatEbClassification,
  formatEbScheduledPublishDate,
  mapEbChapterDetailResponse,
  mapEbChapterPendingItem,
  normalizeEbEvaluateResponse,
} from "@/utils/ebEvaluationMappers.js";
import "./Eb.css";

const NAV_LINKS = [
  { to: "/", label: "Trang chủ" },
  { to: "/mangaka", label: "Mangaka" },
  { to: "/tantou", label: "Tantou Editor" },
];

export default function EbPublish() {
  const navigate = useNavigate();
  const { chapterId } = useParams();
  const user = getSession();

  const [chapter, setChapter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [publicationSchedule, setPublicationSchedule] = useState("");
  const [scheduledPublishAt, setScheduledPublishAt] = useState("");
  const [lastEvaluation, setLastEvaluation] = useState(null);

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
    const scheduled_publish_at = formatEbScheduledPublishDate(scheduledPublishAt);
    if (!schedule && !scheduled_publish_at) {
      toast.error("Chọn lịch phát hành (weekly/monthly) hoặc ngày publish cụ thể.");
      return;
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
      toast.success(
        res?.message
        || `Series "${seriesName}" đã publish${scheduled_publish_at ? ` ngày ${scheduled_publish_at}` : ""}${res?.council_average != null ? ` · DTB ${Number(res.council_average).toFixed(1)}` : ""}.`,
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
                <CardDescription>
                  Bước 2 sau khi đã gửi điểm Hội đồng —{" "}
                  <code className="text-[10px]">
                    POST /eb-evaluations/series/:seriesId/confirm-publish
                  </code>
                </CardDescription>
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
                  <Badge variant="secondary" className="mt-2">
                    {chapter.status ?? "pending_EB"}
                  </Badge>
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

                <div className="space-y-2">
                  <Label htmlFor="eb-scheduled-publish">
                    Ngày publish cụ thể (YYYY-MM-DD)
                  </Label>
                  <Input
                    id="eb-scheduled-publish"
                    type="date"
                    value={scheduledPublishAt}
                    onChange={(event) => setScheduledPublishAt(event.target.value)}
                  />
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

                <p className="text-xs text-muted-foreground">
                  Cần DTB ≥ 2.5. Gửi{" "}
                  <code className="text-[10px]">publication_schedule</code> và/hoặc{" "}
                  <code className="text-[10px]">scheduled_publish_at</code>.
                </p>

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
