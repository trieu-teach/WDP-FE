import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Calendar, FileText, Sparkles } from "lucide-react";
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
import { getSession, logout } from "@/lib/auth.js";
import { submissionsService } from "@/api/submissions.service.js";
import { teReviewsService } from "@/api/teReviews.service.js";
import { getApiErrorMessage, resolveMediaUrl } from "@/api/http.js";
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
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((n) => n + 1), []);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      const queue = await submissionsService.getTeQueue();
      const mapped = await Promise.all(
        (Array.isArray(queue) ? queue : []).map(async (item) => {
          const chapterId = String(item?._id ?? "");
          const seriesTitle = item?.series_id?.name ?? "Series";
          const submittedBy = item?.submitted_by ?? {};
          let preview = null;
          try {
            preview = await teReviewsService.getChapterPages(chapterId, 1);
          } catch {
            preview = null;
          }
          const previewPage = preview?.page ?? null;
          return {
            id: chapterId,
            chapterId,
            seriesId: item?.series_id?._id ? String(item.series_id._id) : null,
            seriesTitle,
            chapterNum: String(item?.chapter_number ?? ""),
            pageIndex: 0,
            pageLabel: previewPage?.page_number ? `Trang ${previewPage.page_number}` : "Trang 1",
            mangakaImageUrl: resolveMediaUrl(
              previewPage?.result_image_url ?? previewPage?.original_image_url ?? null,
            ),
            mangakaName: submittedBy.full_name ?? submittedBy.username ?? "Mangaka",
            pipeline: "debut",
            status: "pending",
            sentAt: item?.updatedAt ?? item?.createdAt ?? null,
            pagesMeta: Array.isArray(preview?.pages) ? preview.pages : [],
          };
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

  function buildSeriesReviewScores(reviewData) {
    const ratings = reviewData?.ratings ?? {};
    return {
      pacing_content: Math.round(Number(ratings.pacingContent ?? 0)),
      visual_art_writing: Math.round(Number(ratings.visualArt ?? 0)),
      layout_storyboard: Math.round(Number(ratings.layoutStoryboard ?? 0)),
      localization_technical: Math.round(Number(ratings.localizationTech ?? 0)),
    };
  }

  function mapNoteTypeToErrorType(taskType) {
    const value = String(taskType ?? "").toLowerCase();
    if (value.includes("dialog")) return "dialogue";
    if (value.includes("script")) return "script";
    if (value.includes("art")) return "art";
    if (value.includes("content")) return "content";
    return "other";
  }

  async function syncChapterAnnotations(chapter) {
    if (!chapter?.chapterId) return;
    const pages = Array.isArray(chapter.pagesMeta) ? chapter.pagesMeta : [];
    if (!pages.length) return;

    await Promise.all(
      pages.map(async (page) => {
        const existing = await teReviewsService.getPageAnnotations(
          chapter.chapterId,
          page._id,
        );
        await Promise.all(
          (Array.isArray(existing) ? existing : []).map((annotation) =>
            teReviewsService.deleteAnnotation(chapter.chapterId, annotation._id),
          ),
        );
      }),
    );
  }

  async function createChapterAnnotations(chapter, editorialNotesByPage) {
    if (!chapter?.chapterId) return;
    const pages = Array.isArray(chapter.pagesMeta) ? chapter.pagesMeta : [];
    if (!pages.length) return;

    const notesMap = editorialNotesByPage ?? {};
    const createJobs = [];

    pages.forEach((page, pageIndex) => {
      const notes = Array.isArray(notesMap[pageIndex]) ? notesMap[pageIndex] : [];
      notes.forEach((note) => {
        createJobs.push(
          teReviewsService.createAnnotation(chapter.chapterId, {
            page_id: page._id,
            region: {
              x: Number(note.x ?? 0),
              y: Number(note.y ?? 0),
              width: Number(note.w ?? 0),
              height: Number(note.h ?? 0),
            },
            content: String(note.text ?? "").trim() || "No detail",
            error_type: mapNoteTypeToErrorType(note.taskType),
          }),
        );
      });
    });

    if (createJobs.length) {
      await Promise.all(createJobs);
    }
  }

  async function handleSaveReview(reviewData, options = {}) {
    if (!selected) return;

    const advanceNext = options.advanceNext === true;
    const nextStatus = reviewData.reviewStatus ?? "draft";
    const nextText = String(reviewData.reviewText ?? "").trim();
    const nextAverage = Number(reviewData.averageScore ?? 0);
    const nextTitle =
      String(reviewData.storyTitle ?? selected.seriesTitle).trim() ||
      selected.seriesTitle;
    const nextAuthor =
      String(reviewData.authorName ?? selected.mangakaName).trim() ||
      selected.mangakaName;
    const nextGenres = Array.isArray(reviewData.genres)
      ? reviewData.genres
      : [];
    const nextSynopsis = String(reviewData.synopsis ?? "").trim();
    const editorialNotesByPage = reviewData.editorialNotesByPage ?? {};

    if (nextStatus === "reject" && !nextText) {
      toast.error("Nhập lý do trước khi gửi Mangaka chỉnh.");
      return;
    }

    const pool = submissions.filter((s) => s.status === "pending");
    const currentIndex = pool.findIndex((s) => s.id === selected.id);
    const nextInQueue =
      currentIndex >= 0 && currentIndex < pool.length - 1
        ? pool[currentIndex + 1]
        : pool.find((s) => s.id !== selected.id) ?? null;

    function maybeAdvance() {
      if (advanceNext && nextInQueue) {
        setSelectedId(nextInQueue.id);
        toast.success(`Đã lưu · chuyển sang Ch. ${nextInQueue.chapterNum}`);
        refresh();
        return true;
      }
      return false;
    }

    if (!selected.seriesId) {
      toast.error("Thiếu series_id để gửi review.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        scores: buildSeriesReviewScores(reviewData),
        feedback: nextText,
        quick_notes: nextText,
        revision_feedback: nextStatus === "reject" ? nextText : "",
        metadata: {
          title: nextTitle,
          author: nextAuthor,
          genres: nextGenres,
          synopsis: nextSynopsis,
          average_score: nextAverage,
        },
      };

      await syncChapterAnnotations(selected);
      await createChapterAnnotations(selected, editorialNotesByPage);

      if (nextStatus === "publish" || nextStatus === "reject") {
        const result = await teReviewsService.submitSeriesReview(
          selected.seriesId,
          payload,
        );
        const route = result?.auto_route;
        if (route === "EB") {
          toast.success("Đã chuyển series sang Editor Board.");
        } else {
          toast.success("Đã gửi review về Mangaka.");
        }
      } else {
        await teReviewsService.saveSeriesReview(selected.seriesId, payload);
        toast.success("Đã lưu bản nháp review.");
      }

      if (!maybeAdvance()) {
        setReviewOpen(false);
      }
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

          <SidebarFlow />
        </section>

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

function SidebarFlow() {
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
      </CardContent>
    </Card>
  );
}
