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
  phaseToPipeline,
  resolveTePhase,
} from "@/utils/teReviewPhase.js";
import {
  enrichTeSubmissionAssignment,
  flattenTePendingSections,
  isTeChapterLevelSubmission,
  isTeSeriesLevelSubmission,
  mapTePendingChapterToSubmission,
  parseTePendingResponse,
  resolveTeEntityId,
} from "@/utils/teReviewPending.js";
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
  const canReview = sub.canReview !== false;
  const assignmentVariant =
    sub.teAssignmentStatus === "mine"
      ? "default"
      : sub.teAssignmentStatus === "other"
        ? "destructive"
        : "outline";

  return (
    <Card
      className={`group transition-all hover:shadow-md${!canReview ? " opacity-75" : ""}`}
    >
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
            {sub.teAssignmentStatus ? (
              <Badge variant={assignmentVariant} className="text-[10px]">
                {sub.teAssignmentStatus === "unassigned"
                  ? "Chưa ai nhận"
                  : sub.teAssignmentStatus === "mine"
                    ? "Của bạn"
                    : "TE khác"}
              </Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            Ch. {sub.chapterNum} · {sub.pageLabel} · {sub.mangakaName}
          </p>
          {sub.teAssignmentLabel ? (
            <p className="text-xs text-muted-foreground">{sub.teAssignmentLabel}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!canReview}
            onClick={() => onReview(sub)}
          >
            Mở & nhận xét
          </Button>
          {showQuickApprove && sub.status === "pending" && canReview ? (
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
  const currentTeId = user?.id ?? null;
  const [submissions, setSubmissions] = useState([]);
  const [pendingSections, setPendingSections] = useState(null);
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
      const raw = await teReviewsService.getPending();
      const parsed = parseTePendingResponse(raw);
      setPendingSections(parsed);

      const flat = flattenTePendingSections(parsed);
      const baseMapped = flat.map(({ chapter, series, tabType }) =>
        enrichTeSubmissionAssignment(
          mapTePendingChapterToSubmission(chapter, series, tabType, null),
          currentTeId,
        ),
      );
      setSubmissions(baseMapped);
      setLoading(false);

      if (!flat.length) return;

      const enriched = await Promise.all(
        flat.map(async (entry, index) => {
          const chapterId = resolveTeEntityId(entry.chapter);
          if (!chapterId) return enrichTeQueueItemWithSeriesDetail(baseMapped[index]);
          let preview = null;
          try {
            preview = await teReviewsService.getAllChapterPages(chapterId);
          } catch {
            preview = null;
          }
          return enrichTeQueueItemWithSeriesDetail(
            enrichTeSubmissionAssignment(
              mapTePendingChapterToSubmission(
                entry.chapter,
                entry.series,
                entry.tabType,
                preview,
              ),
              currentTeId,
            ),
          );
        }),
      );
      setSubmissions(enriched);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không tải được hàng chờ Tantou."));
      setSubmissions([]);
      setPendingSections(null);
      setLoading(false);
    }
  }, [currentTeId]);

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
    () => submissions.filter((s) => isTeSeriesLevelSubmission(s)),
    [submissions],
  );

  const recurringQueue = useMemo(
    () =>
      submissions.filter(
        (s) =>
          isTeChapterLevelSubmission(s)
          && (s.status === "pending" || s.status === "revision"),
      ),
    [submissions],
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
    if (sub?.canReview === false) {
      toast.error(
        sub?.teAssignmentLabel ?? "Chapter này đã được gán cho TE khác.",
      );
      return;
    }
    setSelectedId(sub.id);
    setReviewOpen(true);
  }

  function closeReview() {
    setReviewOpen(false);
    refresh();
  }

  async function handleQuickApprove(chapterId) {
    const sub = submissions.find((s) => s.id === chapterId);
    if (!sub || !isTeChapterLevelSubmission(sub) || !sub.seriesId) return;
    if (sub.canReview === false) {
      toast.error(
        sub.teAssignmentLabel ?? "Chapter này đã được gán cho TE khác.",
      );
      return;
    }

    setSaving(true);
    try {
      const res = await teReviewsService.reviewChapter(sub.seriesId, {
        chapter_id: String(chapterId),
        action: "approve",
        feedback: "OK",
      });
      toast.success(res?.message ?? "Chapter đã được publish.");
      refresh();
    } catch (err) {
      const fallback =
        err?.response?.status === 403
          ? "Chapter này đã được gán cho TE khác."
          : "Duyệt nhanh thất bại.";
      toast.error(getApiErrorMessage(err, fallback));
    } finally {
      setSaving(false);
    }
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
  if (
    apiStatus === "approved_by_eb"
    || apiStatus === "approved"
    || apiStatus === "published"
    || series?.is_public === true
  ) {
    return true;
  }
  return isSeriesEbApproved(seriesTitle);
}

function submissionIsSeriesLevel(submission) {
  return isTeSeriesLevelSubmission(submission);
}

async function enrichTeQueueItemWithSeriesDetail(mapped) {
  if (!mapped?.seriesId) return mapped;

  const seriesLevel = submissionIsSeriesLevel(mapped);

  try {
    if (seriesLevel) {
      const profile = await teReviewsService.getSeriesProfile(mapped.seriesId);
      const series = profile?.series ?? profile ?? {};
      const tabType =
        mapped.tabType
        ?? resolveTePhase({
          phase: mapped.phase,
          seriesStatus: series?.status ?? mapped.seriesMeta?.seriesApiStatus,
        });
      const authorObj = series?.author_id ?? series?.author;
      const authorId =
        authorObj && typeof authorObj === "object" ? authorObj._id : authorObj;
      return {
        ...mapped,
        tabType,
        phase: tabType,
        pipeline: phaseToPipeline(tabType),
        seriesTitle: series?.name || mapped.seriesTitle,
        seriesMeta: {
          ...mapped.seriesMeta,
          genres: parseSeriesGenres(series).length
            ? parseSeriesGenres(series)
            : mapped.seriesMeta.genres,
          tags: Array.isArray(series?.tags) ? series.tags : mapped.seriesMeta.tags,
          synopsis:
            String(series?.synopsis ?? series?.description ?? "").trim()
            || mapped.seriesMeta.synopsis,
          coverImageUrl:
            resolveMediaUrl(series?.cover_image_url ?? null)
            || mapped.seriesMeta.coverImageUrl,
          authorId: authorId ? String(authorId) : mapped.seriesMeta.authorId,
          authorName:
            authorObj && typeof authorObj === "object"
              ? (authorObj.full_name ?? authorObj.username ?? "")
              : mapped.seriesMeta.authorName,
          seriesApiStatus: series?.status ?? mapped.seriesMeta.seriesApiStatus,
          ebApproved: tabType === "chapter_level",
        },
      };
    }

    const raw = await seriesService.getById(mapped.seriesId);
    const series = apiSeriesToUi(raw);
    const tabType =
      mapped.tabType
      ?? resolveTePhase({
        phase: mapped.phase,
        seriesStatus: raw?.status,
      });
    return {
      ...mapped,
      tabType,
      phase: tabType,
      pipeline: phaseToPipeline(tabType),
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
        ebApproved: tabType === "chapter_level",
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

    if (!options.saveDraftOnly && selected.canReview === false) {
      toast.error(
        selected.teAssignmentLabel ?? "Chapter này đã được gán cho TE khác.",
      );
      return;
    }

    const nextStatus =
      options.submitAction ?? reviewData.reviewStatus ?? "publish";
    const nextText = String(reviewData.reviewText ?? "").trim();
    const nextQuickNotes = String(reviewData.quickNotes ?? "").trim();
    const nextRevisionFeedback = String(reviewData.revisionFeedback ?? "").trim();
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

    if (options.saveDraftOnly) {
      if (!nextSeriesId) {
        toast.error("Thiếu series_id để lưu nháp.");
        return;
      }
      setSaving(true);
      try {
        await teReviewsService.saveSeriesReviewDraft(nextSeriesId, {
          feedback: nextText,
          quick_notes: nextQuickNotes || nextText,
        });
        toast.success("Đã lưu nháp Series Review.");
      } catch (err) {
        toast.error(getApiErrorMessage(err, "Không lưu được nháp."));
      } finally {
        setSaving(false);
      }
      return;
    }

    if (nextStatus === "reject" && !nextText && !nextRevisionFeedback) {
      toast.error("Nhập lý do trước khi gửi Mangaka chỉnh.");
      return;
    }

    if (!nextChapterId) {
      toast.error("Thiếu chapter_id để gửi review.");
      return;
    }

    setSaving(true);
    try {
      await syncChapterAnnotations({
        chapterId: nextChapterId,
      });
      await createChapterAnnotations(
        { chapterId: nextChapterId },
        editorialNotesByPage,
        pagesMeta,
      );

      if (nextStatus === "publish" || nextStatus === "reject") {
        const seriesLevel = submissionIsSeriesLevel(selected);
        const action = nextStatus === "reject" ? "reject" : "approve";
        const rejectNotes = [nextText, nextRevisionFeedback]
          .filter(Boolean)
          .flatMap((t) => t.split("\n").map((l) => l.trim()).filter(Boolean));
        const noteLines = rejectNotes.length
          ? rejectNotes
          : (nextText ? [nextText] : []);

        if (!nextSeriesId) {
          toast.error("Thiếu series_id để gửi review.");
          return;
        }

        if (seriesLevel && (nextText || nextQuickNotes) && action === "approve") {
          await teReviewsService
            .saveSeriesReviewDraft(nextSeriesId, {
              feedback: nextText,
              quick_notes: nextQuickNotes || nextText,
            })
            .catch(() => null);
        }

        const reviewBody = {
          chapter_id: nextChapterId,
          action,
          ...(nextText || nextRevisionFeedback
            ? { feedback: nextText || nextRevisionFeedback }
            : {}),
          ...(noteLines.length ? { notes: noteLines } : {}),
          ...(action === "reject"
            ? {
                revision_notes:
                  nextRevisionFeedback || nextText || noteLines.join("\n"),
              }
            : {}),
        };

        const res = await teReviewsService.reviewChapter(
          nextSeriesId,
          reviewBody,
        );

        if (action === "approve") {
          toast.success(
            res?.message
              ?? (seriesLevel
                ? `Chapter → pending_EB, đã duyệt series.`
                : "Chapter đã được publish."),
          );
        } else {
          toast.success(
            res?.message ?? "Đã yêu cầu Mangaka sửa chapter.",
          );
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
      const fallback =
        err?.response?.status === 403
          ? "Chapter này đã được gán cho TE khác."
          : "Không lưu được review.";
      toast.error(getApiErrorMessage(err, fallback));
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
              (s) =>
                (selected.seriesId && s.seriesId === selected.seriesId)
                || s.seriesTitle === selected.seriesTitle,
            )}
            allSubmissions={submissions}
            onCancel={closeReview}
            onSaveReview={handleSaveReview}
            onSelectChapter={(submissionId) => setSelectedId(submissionId)}
            saving={saving}
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
                {pendingSections?.seriesLevel?.label ?? "Duyệt series (giai đoạn 1)"}
                <Badge variant="secondary" className="font-normal">
                  {debutQueue.length || pendingSections?.seriesLevel?.count || 0}
                </Badge>
              </CardTitle>
              <CardDescription>
                {pendingSections?.seriesLevel?.description
                  ?? `Series chưa EB-approved — duyệt series + chapter, gửi ${LABEL_EDITOR_BOARD} hoặc yêu cầu Mangaka sửa.`}
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
                {pendingSections?.chapterLevel?.label ?? "Duyệt chapter (giai đoạn 2)"}
                <Badge variant="secondary" className="font-normal">
                  {recurringQueue.length || pendingSections?.chapterLevel?.count || 0}
                </Badge>
              </CardTitle>
              <CardDescription>
                {pendingSections?.chapterLevel?.description
                  ?? "Series đã EB-approved — TE duyệt chapter để publish ngay."}
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
                    onQuickApprove={(id) => void handleQuickApprove(id)}
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
