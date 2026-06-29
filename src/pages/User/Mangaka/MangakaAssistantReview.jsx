import { useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  ClipboardCheck,
  Sparkles,
} from "lucide-react";
import Header from "@/components/User/Header/Header.jsx";
import Footer from "@/components/User/Footer/Footer.jsx";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getSession, logout } from "@/lib/auth.js";
import { resolveMediaUrl } from "@/api/http.js";
import { useMangakaWorkspace } from "@/hooks/useMangakaWorkspace.js";
import { useMangakaTasks } from "@/hooks/useMangakaTasks.js";
import { buildReviewPageCompare, countUnapprovedTasks, dedupeTasksByPage } from "@/utils/chapterTaskFlow.js";
import { resolveAnnotatorChapter } from "@/utils/mangakaWorkspaceReader.js";

const NAV_LINKS = [
  { to: "/", label: "Trang chủ" },
  { to: "/mangaka", label: "Mangaka" },
];

const REVIEW_BADGE_CLASS =
  "bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-400";

function chapterNumSort(a, b) {
  const na =
    typeof a?.chapter?.num === "number"
      ? a.chapter.num
      : parseInt(String(a?.chapter?.num ?? ""), 10);
  const nb =
    typeof b?.chapter?.num === "number"
      ? b.chapter.num
      : parseInt(String(b?.chapter?.num ?? ""), 10);
  if (Number.isNaN(na) && Number.isNaN(nb)) return 0;
  if (Number.isNaN(na)) return 1;
  if (Number.isNaN(nb)) return -1;
  return na - nb;
}

export default function MangakaAssistantReview() {
  const navigate = useNavigate();
  const user = getSession();

  const {
    seriesList,
    chapterRows,
    annotatorChapters,
    loadChapterPages,
  } = useMangakaWorkspace(user);

  const { pendingReviews, loading: tasksLoading } = useMangakaTasks(chapterRows);

  const pendingReviewChapterIds = useMemo(
    () => (pendingReviews ?? []).map((r) => r?.chapter?.id).filter(Boolean).join("|"),
    [pendingReviews],
  );

  useEffect(() => {
    if (!pendingReviewChapterIds) return;
    const ids = pendingReviewChapterIds.split("|").filter(Boolean);
    let cancelled = false;
    Promise.all(ids.map((id) => loadChapterPages(id, { force: true })))
      .then(() => {
        if (cancelled) void 0;
      })
      .catch(() => {
        if (cancelled) void 0;
      });
    return () => {
      cancelled = true;
    };
  }, [pendingReviewChapterIds, loadChapterPages]);

  const reviewsBySeries = useMemo(() => {
    const map = new Map();
    for (const review of pendingReviews ?? []) {
      const series =
        review?.chapter?.series ??
        review?.submission?.seriesName ??
        "Không rõ series";
      if (!map.has(series)) map.set(series, []);
      map.get(series).push(review);
    }

    return Array.from(map.entries())
      .map(([series, reviews]) => {
        const seriesMeta = (seriesList ?? []).find((s) => s.title === series);
        const sorted = [...reviews].sort(chapterNumSort);
        return { series, seriesMeta, reviews: sorted };
      })
      .sort((a, b) => a.series.localeCompare(b.series, "vi"));
  }, [pendingReviews, seriesList]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header links={NAV_LINKS} onLogout={user ? handleLogout : undefined} />

      <main className="page-container flex min-h-0 flex-1 flex-col gap-6 py-6 lg:py-8">
        <header className="flex flex-wrap items-center gap-3 border-b border-border/60 pb-4">
          <Button type="button" variant="ghost" size="sm" asChild>
            <Link to="/mangaka">
              <ArrowLeft className="size-4" />
              Quay lại workspace
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-widest text-amber-600">
              Mangaka · Duyệt bản Assistant
            </p>
            <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold tracking-tight sm:text-2xl">
              <ClipboardCheck className="size-5 shrink-0 text-amber-600" />
              Series chờ duyệt
              {pendingReviews.length > 0 ? (
                <Badge variant="secondary" className="text-sm font-normal">
                  {pendingReviews.length} chapter
                </Badge>
              ) : null}
            </h1>
            <p className="text-sm text-muted-foreground">
              Các series bạn đã gửi Assistant chỉnh sửa và Assistant đã nộp lại
              — chọn chapter để so sánh ảnh và duyệt.
            </p>
          </div>
        </header>

        {tasksLoading && pendingReviews.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Đang tải danh sách series chờ duyệt...
            </CardContent>
          </Card>
        ) : pendingReviews.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
              <ClipboardCheck className="size-10 text-muted-foreground/40" />
              <div className="space-y-1">
                <p className="font-medium">Chưa có bản nào chờ duyệt</p>
                <p className="text-sm text-muted-foreground">
                  Sau khi gửi chapter cho Assistant và họ nộp ảnh kết quả, series
                  sẽ hiện tại đây.
                </p>
              </div>
              <Button variant="outline" asChild>
                <Link to="/mangaka" state={{ tab: "annotate" }}>
                  Về Upload & Ghi chú
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {reviewsBySeries.map(({ series, seriesMeta, reviews }) => {
              const color = seriesMeta?.color ?? "#e11d48";
              const initials = (series.length >= 2 ? series : `${series}●`).slice(
                0,
                2,
              );

              return (
                <section key={series} className="space-y-4">
                  <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
                    <span
                      className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg text-sm font-bold text-white"
                      style={{
                        background: seriesMeta?.coverImage
                          ? `url(${resolveMediaUrl(seriesMeta.coverImage)}) center / cover no-repeat`
                          : `linear-gradient(135deg, ${color}, ${color}88)`,
                      }}
                    >
                      {!seriesMeta?.coverImage ? initials : null}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold">{series}</h2>
                        <Badge className={REVIEW_BADGE_CLASS} variant="secondary">
                          {reviews.length} chapter chờ duyệt
                        </Badge>
                        {seriesMeta?.needsFullDebutPipeline ? (
                          <Badge
                            variant="secondary"
                            className="bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-400"
                          >
                            <Sparkles className="mr-1 size-3" />
                            Lần đầu
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Assistant đã gửi lại bản chỉnh sửa — bấm chapter để xem
                        chi tiết và duyệt.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {reviews.map((review) => {
                      const chapter = review.chapter;
                      const chapterId = chapter?.id;
                      const annot = resolveAnnotatorChapter(
                        chapter,
                        annotatorChapters,
                      );
                      const pageCompare = buildReviewPageCompare(
                        annot?.pages ?? [],
                        review.tasks ?? [],
                      );
                      const resultUrls = pageCompare.results.filter(Boolean);
                      const thumbUrl =
                        resultUrls[0] ??
                        annot?.pages?.find((p) => p?.url)?.url ??
                        null;
                      const tasks = dedupeTasksByPage(review.tasks ?? []);
                      const approvedTasks = tasks.filter(
                        (t) => t.status === "approved",
                      ).length;
                      const unapproved = countUnapprovedTasks(tasks);

                      return (
                        <Link
                          key={chapterId ?? review.submission?.id}
                          to={`/mangaka/review/chapter/${chapterId}`}
                          className="group relative flex flex-col overflow-hidden rounded-xl border bg-card transition-all hover:-translate-y-0.5 hover:shadow-md"
                        >
                          <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
                            {thumbUrl ? (
                              <img
                                src={thumbUrl}
                                alt=""
                                className="size-full object-cover transition-transform group-hover:scale-105"
                              />
                            ) : (
                              <div className="flex size-full items-center justify-center text-muted-foreground">
                                <BookOpen className="size-8 opacity-30" />
                              </div>
                            )}
                            <div className="absolute right-2 top-2">
                              <Badge className={REVIEW_BADGE_CLASS} variant="secondary">
                                Chờ duyệt
                              </Badge>
                            </div>
                            {pageCompare.resultCount > 0 ? (
                              <div className="absolute left-2 top-2">
                                <Badge
                                  variant="secondary"
                                  className="bg-black/60 text-[10px] text-white hover:bg-black/60"
                                >
                                  {pageCompare.resultCount}/{pageCompare.pageCount || pageCompare.resultCount} trang
                                </Badge>
                              </div>
                            ) : null}
                          </div>

                          <div className="flex flex-1 flex-col gap-1.5 p-3">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-semibold leading-tight">
                                Ch. {chapter?.num}
                                {chapter?.title ? (
                                  <span className="ml-1 font-normal text-muted-foreground">
                                    · {chapter.title}
                                  </span>
                                ) : null}
                              </p>
                              <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {chapter?.assistantName
                                ? `Assistant: ${chapter.assistantName}`
                                : "Đã nộp từ Assistant"}
                              {tasks.length > 0
                                ? ` · ${approvedTasks}/${tasks.length} task đã duyệt`
                                : ""}
                            </p>
                            {unapproved > 0 ? (
                              <p className="text-[10px] font-medium text-amber-600">
                                Còn {unapproved} task cần nhận/duyệt
                              </p>
                            ) : tasks.length > 0 ? (
                              <p className="text-[10px] font-medium text-emerald-600">
                                Đủ điều kiện phê duyệt chapter
                              </p>
                            ) : (
                              <p className="text-[10px] text-muted-foreground">
                                Chờ Assistant nộp đủ task
                              </p>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
