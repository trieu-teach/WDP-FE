import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Calendar, FileText, History, Sparkles } from "lucide-react";
import Header from "@/components/User/Header/Header.jsx";
import Footer from "@/components/User/Footer/Footer.jsx";
import { WorkspaceHero } from "@/components/layout/WorkspaceHero.jsx";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getSession, logout } from "@/lib/auth.js";
import { seriesService } from "@/api/series.service.js";
import {
  buildTeAnnotationCreatePayload,
  resolveTePageImageUrl,
  resolveTePreviewPage,
  teReviewsService,
} from "@/api/teReviews.service.js";
import { getApiErrorMessage, resolveMediaUrl } from "@/api/http.js";
import { apiSeriesToUi } from "@/utils/apiMappers.js";
import {
  LABEL_EDITOR_BOARD,
  LABEL_TANTOU_EDITOR,
  PATH_EDITOR_BOARD,
} from "@/constants/roleTerminology.js";
import { readEbDebutApproved } from "@/utils/ebDebutStorage.js";
import {
  applyScheduleForEbApprovedSeries,
  isSeriesEbApproved,
  listPublishSchedules,
  listTantouReviewHistory,
  pushTantouReviewHistory,
  suggestPublishCadence,
} from "@/utils/tantouWorkspaceStorage.js";
import TantouPageReview from "./TantouPageReview.jsx";

const NAV_LINKS = [
  { to: "/", label: "Trang chủ" },
  { to: "/mangaka", label: "Mangaka" },
  { to: PATH_EDITOR_BOARD, label: LABEL_EDITOR_BOARD },
];

function statusVariant(status) {
  if (status === "pending") return "secondary";
  if (status === "forwarded_eb") return "default";
  if (status === "revision") return "destructive";
  return "outline";
}

function statusLabel(status) {
  const map = {
    pending: "Chờ duyệt",
    revision: "Đã gửi chỉnh",
    forwarded_eb: `Đã chuyển ${LABEL_EDITOR_BOARD}`,
    approved_publish: "Đã duyệt phát hành",
  };
  return map[status] ?? status;
}

function reviewStatusLabel(status) {
  const map = {
    draft: "Nháp",
    reject: "Yêu cầu chỉnh",
    publish: "Đã duyệt",
  };
  return map[status] ?? status;
}

function formatReviewedAt(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function SubmissionCard({ sub, onReview, onQuickApprove, showQuickApprove }) {
  return (
    <Card className="group transition-all hover:shadow-md">
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
        <div className="flex size-16 shrink-0 overflow-hidden rounded-lg bg-muted sm:size-20">
          {sub.mangakaImageUrl ? (
            <img
              src={sub.mangakaImageUrl}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-2xl">
              📄
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{sub.seriesTitle}</h3>
            <Badge variant={statusVariant(sub.status)}>
              {statusLabel(sub.status)}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Ch. {sub.chapterNum} · {sub.pageLabel} · {sub.mangakaName}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => onReview(sub)}>
            Mở & nhận xét
          </Button>
          {showQuickApprove && sub.status === "pending" ? (
            <Button size="sm" onClick={() => onQuickApprove(sub.id)}>
              Duyệt nhanh
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export default function TantouEditor() {
  const navigate = useNavigate();
  const user = getSession();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((n) => n + 1), []);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      const queue = await teReviewsService.getPending();
      const mapped = await Promise.all(
        (Array.isArray(queue) ? queue : []).map(async (item) => {
          const chapterId = String(item?._id ?? "");
          let preview = null;
          try {
            preview = await teReviewsService.getAllChapterPages(chapterId);
          } catch {
            preview = null;
          }
          return enrichTeQueueItemWithSeriesDetail(
            mapTeQueueItem(item, preview),
          );
        }),
      );
      setSubmissions(mapped);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không tải được hàng chờ Tantou."));
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue, tick]);

  const schedules = useMemo(() => listPublishSchedules(), [tick]);
  const ebApproved = useMemo(() => readEbDebutApproved(), [tick]);
  const reviewHistory = useMemo(() => listTantouReviewHistory(), [tick, historyOpen]);

  const selected = useMemo(
    () => submissions.find((s) => s.id === selectedId) ?? null,
    [submissions, selectedId],
  );

  const debutQueue = useMemo(
    () =>
      submissions.filter(
        (s) => s.pipeline === "debut" && s.status !== "approved_publish",
      ),
    [submissions],
  );

  const recurringQueue = useMemo(
    () =>
      submissions.filter(
        (s) =>
          (s.pipeline === "recurring" || isSeriesEbApproved(s.seriesTitle)) &&
          s.status === "pending",
      ),
    [submissions, tick],
  );

  const scheduleSeries = useMemo(() => {
    const titles = new Set([
      ...Object.keys(ebApproved).filter((t) => ebApproved[t]),
      ...submissions
        .filter((s) => s.status === "forwarded_eb")
        .map((s) => s.seriesTitle),
    ]);
    return [...titles].map((title) => {
      const sub = submissions.find((s) => s.seriesTitle === title);
      const sched = schedules[title];
      const q = sub?.qualityScore ?? 70;
      const p = sub?.popularityScore ?? 65;
      return {
        title,
        qualityScore: q,
        popularityScore: p,
        suggested: suggestPublishCadence(q, p),
        cadence: sched?.cadence ?? sub?.publishCadence,
        label: sched?.label,
      };
    });
  }, [ebApproved, submissions, schedules]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  function openReview(sub) {
    setSelectedId(sub.id);
    setReviewOpen(true);
  }

  function closeReview() {
    setReviewOpen(false);
    refresh();
  }

function parseSeriesGenres(series) {
  const genreRaw = series?.genre ?? series?.genres;
  if (Array.isArray(genreRaw)) return genreRaw.filter(Boolean);
  if (genreRaw) {
    return String(genreRaw)
      .split(/[,;|]/)
      .map((g) => g.trim())
      .filter(Boolean);
  }
  return [];
}

function isSeriesApprovedByEb(series, seriesTitle) {
  const apiStatus = String(series?.status ?? "").toLowerCase();
  if (apiStatus === "approved" || series?.is_public === true) return true;
  return isSeriesEbApproved(seriesTitle);
}

function resolveTePipeline(series, seriesTitle) {
  return isSeriesApprovedByEb(series, seriesTitle) ? "recurring" : "debut";
}

function submissionNeedsEbSeriesSubmit(submission, seriesTitle) {
  if (submission?.pipeline === "recurring") return false;
  if (submission?.seriesMeta?.ebApproved) return false;
  return !isSeriesApprovedByEb(null, seriesTitle);
}

function mapTeChapterStatus(status) {
  const value = String(status ?? "").toLowerCase();
  if (value.includes("eb") || value === "pending_eb") return "forwarded_eb";
  if (value.includes("revision") || value.includes("reject")) return "revision";
  if (value.includes("publish") || value.includes("approved")) return "approved_publish";
  return "pending";
}

function mapTeQueueItem(item, preview) {
  const chapterId = String(item?._id ?? "");
  const series = item?.series_id && typeof item.series_id === "object"
    ? item.series_id
    : {};
  const seriesId = series?._id ? String(series._id) : null;
  const seriesTitle = series?.name ?? "Series";
  const authorObj = series?.author_id;
  const authorId =
    authorObj && typeof authorObj === "object" ? authorObj._id : authorObj;
  const submittedBy = item?.submitted_by ?? {};
  const previewPage = resolveTePreviewPage(preview, 0);
  const mangakaName = submittedBy.full_name ?? submittedBy.username ?? "Mangaka";

  return {
    id: chapterId,
    chapterId,
    seriesId,
    seriesTitle,
    chapterNum: String(item?.chapter_number ?? ""),
    chapterTitle: String(item?.title ?? ""),
    pageIndex: 0,
    pageLabel: previewPage?.page_number
      ? `Trang ${previewPage.page_number}`
      : "Trang 1",
    mangakaImageUrl: resolveTePageImageUrl(previewPage),
    mangakaName,
    pipeline: resolveTePipeline(series, seriesTitle),
    status: mapTeChapterStatus(item?.status),
    sentAt: item?.updatedAt ?? item?.createdAt ?? null,
    pagesMeta: Array.isArray(preview?.pages) ? preview.pages : [],
    seriesMeta: {
      genres: parseSeriesGenres(series),
      tags: Array.isArray(series?.tags) ? series.tags : [],
      synopsis: String(series?.synopsis ?? series?.description ?? "").trim(),
      coverImageUrl: resolveMediaUrl(series?.cover_image_url ?? null),
      authorId: authorId ? String(authorId) : "",
      authorName:
        authorObj && typeof authorObj === "object"
          ? (authorObj.full_name ?? authorObj.username ?? "")
          : mangakaName,
    },
  };
}

async function enrichTeQueueItemWithSeriesDetail(mapped) {
  if (!mapped?.seriesId) return mapped;

  try {
    const raw = await seriesService.getById(mapped.seriesId);
    const series = apiSeriesToUi(raw);
    const ebApproved = isSeriesApprovedByEb(raw, mapped.seriesTitle);
    return {
      ...mapped,
      pipeline: resolveTePipeline(raw, mapped.seriesTitle),
      seriesTitle: series.title || mapped.seriesTitle,
      seriesMeta: {
        ...mapped.seriesMeta,
        genres: series.genres?.length ? series.genres : mapped.seriesMeta.genres,
        tags: series.tags?.length ? series.tags : mapped.seriesMeta.tags,
        synopsis: series.synopsis || mapped.seriesMeta.synopsis,
        coverImageUrl: series.coverImage || mapped.seriesMeta.coverImageUrl,
        authorId: series.authorId
          ? String(series.authorId)
          : mapped.seriesMeta.authorId,
        authorName: series.authorName || mapped.seriesMeta.authorName,
        seriesApiStatus: raw?.status ?? null,
        ebApproved,
      },
    };
  } catch {
    return mapped;
  }
}

  async function syncChapterAnnotations(chapter) {
    if (!chapter?.chapterId) return;

    const existing = await teReviewsService.getAnnotations(chapter.chapterId);
    const list = Array.isArray(existing) ? existing : [];
    await Promise.all(
      list.map((annotation) =>
        teReviewsService.deleteAnnotation(chapter.chapterId, annotation._id),
      ),
    );
  }

  async function createChapterAnnotations(chapter, editorialNotesByPage, pagesMetaOverride) {
    if (!chapter?.chapterId) return;
    const pages = Array.isArray(pagesMetaOverride)
      ? pagesMetaOverride
      : (Array.isArray(chapter.pagesMeta) ? chapter.pagesMeta : []);
    if (!pages.length) {
      toast.error("Thiếu danh sách page để lưu annotation.");
      return;
    }

    const notesMap = editorialNotesByPage ?? {};
    const createJobs = [];

    pages.forEach((page, pageIndex) => {
      const notes = Array.isArray(notesMap[pageIndex]) ? notesMap[pageIndex] : [];
      notes.forEach((note) => {
        const payload = buildTeAnnotationCreatePayload(note, page);
        if (!payload) return;
        createJobs.push(
          teReviewsService.createAnnotation(chapter.chapterId, payload),
        );
      });
    });

    if (createJobs.length) {
      await Promise.all(createJobs);
    }
  }

  async function handleSaveReview(reviewData, options = {}) {
    if (!selected) return;

    const nextStatus =
      options.submitAction ?? reviewData.reviewStatus ?? "publish";
    const nextText = String(reviewData.reviewText ?? "").trim();
    const nextAverage = Number(reviewData.averageScore ?? 0);
    const nextChapterId = String(
      reviewData.chapter_id ?? selected.chapterId ?? selected.id ?? "",
    ).trim();
    const nextSeriesId = String(
      reviewData.series_id ?? selected.seriesId ?? "",
    ).trim();
    const nextChapterNumber = String(
      reviewData.chapter_number ?? selected.chapterNum ?? "",
    ).trim();
    const nextSeriesName =
      String(reviewData.series_name ?? selected.seriesTitle).trim() ||
      selected.seriesTitle;
    const nextSeriesAuthorName = String(
      reviewData.series_author_name ??
        selected.seriesMeta?.authorName ??
        selected.mangakaName ??
        "",
    ).trim();
    const editorialNotesByPage = reviewData.editorialNotesByPage ?? {};
    const pagesMeta =
      reviewData.pagesMeta ??
      selected.pagesMeta ??
      [];

    if (nextStatus === "reject" && !nextText) {
      toast.error("Nhập lý do trước khi gửi Mangaka chỉnh.");
      return;
    }

    if (!nextChapterId) {
      toast.error("Thiếu chapter_id để gửi review.");
      return;
    }

    setSaving(true);
    try {
      await syncChapterAnnotations(selected);
      await createChapterAnnotations(
        selected,
        editorialNotesByPage,
        pagesMeta,
      );

      if (nextStatus === "publish" || nextStatus === "reject") {
        if (nextStatus === "reject") {
          await teReviewsService.teAction(nextChapterId, {
            action: "request_revision",
            notes: [nextText],
          });
          toast.success("Đã gửi về Mangaka.");
        } else if (submissionNeedsEbSeriesSubmit(selected, nextSeriesName)) {
          if (!nextSeriesId) {
            toast.error(`Thiếu series_id để gửi ${LABEL_EDITOR_BOARD}.`);
            return;
          }
          const res = await teReviewsService.submitSeriesReview(nextSeriesId, {
            action: "approve",
            ...(nextText ? { feedback: nextText, quick_notes: nextText } : {}),
          });
          const count = Array.isArray(res?.chapters_to_eb)
            ? res.chapters_to_eb.length
            : null;
          toast.success(
            count != null
              ? `Đã gửi ${count} chapter sang ${LABEL_EDITOR_BOARD} để chấm điểm series.`
              : `Đã gửi series sang ${LABEL_EDITOR_BOARD} để chấm điểm.`,
          );
        } else {
          await teReviewsService.teAction(nextChapterId, {
            action: "approve",
            ...(nextText ? { notes: [nextText] } : {}),
          });
          toast.success("Đã duyệt chapter — series đã được EB phê duyệt trước đó.");
        }
      }

      pushTantouReviewHistory({
        id: `${nextChapterId}-${Date.now()}`,
        chapterId: nextChapterId,
        chapterNumber: nextChapterNumber,
        seriesName: nextSeriesName,
        authorName: nextSeriesAuthorName,
        status: nextStatus,
        averageScore: nextAverage,
        feedback: nextText,
        reviewedAt: new Date().toISOString(),
      });

      setReviewOpen(false);
      refresh();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không lưu được review."));
    } finally {
      setSaving(false);
    }
  }

  function handleSetSchedule(title, q, p, cadence) {
    applyScheduleForEbApprovedSeries(title, q, p, cadence);
    toast.success(`Đã đặt lịch ${title}.`);
    refresh();
  }

  if (reviewOpen && selected) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header links={NAV_LINKS} onLogout={user ? handleLogout : undefined} />
        <main className="page-container flex-1 py-8">
          <TantouPageReview
            submission={selected}
            relatedSubmissions={submissions.filter(
              (s) => s.seriesTitle === selected.seriesTitle,
            )}
            allSubmissions={submissions}
            onCancel={closeReview}
            onSaveReview={handleSaveReview}
            onSelectChapter={(submissionId) => setSelectedId(submissionId)}
          />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header links={NAV_LINKS} onLogout={user ? handleLogout : undefined} />

      <WorkspaceHero
        className="from-sky-950 to-zinc-950"
        label={LABEL_TANTOU_EDITOR}
        title={`Xin chào${user?.name ? `, ${user.name}` : ""}`}
        description={`Nhận bản thảo từ Mangaka · viết nhận xét · chuyển ${LABEL_EDITOR_BOARD} hoặc duyệt phát hành.`}
      />

      <main className="page-container flex-1 space-y-8 py-8">
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="size-5 text-amber-500" />
                Duyệt series riêng
              </CardTitle>
              <CardDescription>
                Xét chuyển {LABEL_EDITOR_BOARD} hoặc gửi Mangaka chỉnh (kèm nhận
                xét).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {debutQueue.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    {loading ? "Đang tải hàng chờ..." : "Không có series chờ duyệt."}
                  </CardContent>
                </Card>
              ) : (
                debutQueue.map((sub) => (
                  <SubmissionCard
                    key={sub.id}
                    sub={sub}
                    onReview={openReview}
                  />
                ))
              )}
            </CardContent>
          </Card>

          <SidebarFlow onOpenHistory={() => setHistoryOpen(true)} />
        </section>

        <TantouReviewHistoryDialog
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          items={reviewHistory}
        />

        <section className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="size-5 text-sky-500" />
                Duyệt chapter riêng
              </CardTitle>
              <CardDescription>
                Series đã qua EB — chỉ cần Tantou duyệt chapter để phát hành.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {recurringQueue.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    Không có chapter chờ duyệt.
                  </CardContent>
                </Card>
              ) : (
                recurringQueue.map((sub) => (
                  <SubmissionCard
                    key={sub.id}
                    sub={sub}
                    onReview={openReview}
                    onQuickApprove={() => {}}
                    showQuickApprove
                  />
                ))
              )}
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Lịch phát hành</h2>
            <p className="text-sm text-muted-foreground">
              Series đã được {LABEL_EDITOR_BOARD} chấp nhận.
            </p>
          </div>
          {scheduleSeries.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Chưa có series qua {LABEL_EDITOR_BOARD}.
              </CardContent>
            </Card>
          ) : (
            scheduleSeries.map((row) => (
              <Card key={row.title}>
                <CardHeader>
                  <CardTitle>{row.title}</CardTitle>
                  <CardDescription>
                    Chất lượng {row.qualityScore}% · Độ nổi{" "}
                    {row.popularityScore}%{" · Gợi ý: "}
                    {row.suggested === "weekly"
                      ? "Theo tuần"
                      : row.suggested === "biweekly"
                        ? "2 tuần/lần"
                        : "Theo tháng"}
                    {row.label ? ` · Đang: ${row.label}` : ""}
                  </CardDescription>
                </CardHeader>
                <CardFooter className="gap-2">
                  <Button
                    variant={row.cadence === "weekly" ? "default" : "outline"}
                    size="sm"
                    onClick={() =>
                      handleSetSchedule(
                        row.title,
                        row.qualityScore,
                        row.popularityScore,
                        "weekly",
                      )
                    }
                  >
                    Theo tuần
                  </Button>
                  <Button
                    variant={row.cadence === "monthly" ? "default" : "outline"}
                    size="sm"
                    onClick={() =>
                      handleSetSchedule(
                        row.title,
                        row.qualityScore,
                        row.popularityScore,
                        "monthly",
                      )
                    }
                  >
                    Theo tháng
                  </Button>
                </CardFooter>
              </Card>
            ))
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}

function SidebarFlow({ onOpenHistory }) {
  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle className="text-base">Luồng công việc</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-muted-foreground">
        <div>
          <p className="font-medium text-foreground">Lần đầu</p>
          <p>Mangaka → Assistant → Mangaka → Tantou → {LABEL_EDITOR_BOARD}</p>
        </div>
        <Separator />
        <div>
          <p className="font-medium text-foreground">Lần 2+</p>
          <p>Mangaka → chỉ Tantou duyệt → phát hành</p>
        </div>
        <Button variant="link" className="h-auto p-0" asChild>
          <Link to={PATH_EDITOR_BOARD}>Mở {LABEL_EDITOR_BOARD} →</Link>
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={onOpenHistory}
        >
          <History className="size-4" />
          Lịch sử duyệt
        </Button>
      </CardContent>
    </Card>
  );
}

function TantouReviewHistoryDialog({ open, onOpenChange, items }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Lịch sử duyệt</DialogTitle>
          <DialogDescription>
            Các lần bạn lưu hoặc gửi nhận xét gần đây.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          {items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Chưa có lịch sử duyệt.
            </p>
          ) : (
            items.map((item) => (
              <Card key={item.id} className="border-border/70">
                <CardContent className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{item.seriesName}</p>
                    <Badge variant="secondary">
                      {reviewStatusLabel(item.status)}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Ch. {item.chapterNumber}
                    {item.authorName ? ` · ${item.authorName}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatReviewedAt(item.reviewedAt)}
                    {item.averageScore != null
                      ? ` · Điểm TB ${Number(item.averageScore).toFixed(1)}`
                      : ""}
                  </p>
                  {item.feedback ? (
                    <p className="line-clamp-2 text-sm">{item.feedback}</p>
                  ) : null}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
