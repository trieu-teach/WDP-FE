import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  ClipboardCheck,
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
import {
  buildReviewPageCompare,
  countUnapprovedTasks,
  dedupeTasksForMangakaReview,
} from "@/utils/chapterTaskFlow.js";
import { resolveAnnotatorChapter } from "@/utils/mangakaWorkspaceReader.js";
import { cn } from "@/lib/utils";
import { MANGAKA_NAV_LINKS } from "@/constants/mangakaNav.js";

const NAV_LINKS = MANGAKA_NAV_LINKS;

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

function ChapterReviewItem({ review, annotatorChapters }) {
  const chapter = review.chapter;
  const chapterId = chapter?.id;
  const annot = resolveAnnotatorChapter(chapter, annotatorChapters);
  const pageCompare = buildReviewPageCompare(annot?.pages ?? [], review.tasks ?? []);
  const resultUrls = pageCompare.results.filter(Boolean);
  const thumbUrl =
    resultUrls[0] ?? annot?.pages?.find((p) => p?.url)?.url ?? null;
  const tasks = dedupeTasksForMangakaReview(review.allTasks ?? review.tasks ?? []);
  const approvedTasks = tasks.filter((t) => t.status === "approved").length;
  const unapproved = countUnapprovedTasks(tasks);
  const awaitingTe = Boolean(review?.awaitingTe);

  return (
    <Link
      to={`/mangaka/review/chapter/${chapterId}`}
      className="group flex min-w-0 items-stretch gap-3 rounded-xl border bg-card p-2.5 transition-all hover:border-primary/40 hover:bg-muted/30 hover:shadow-sm"
    >
      <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-muted sm:size-16">
        {thumbUrl ? (
          <img
            src={thumbUrl}
            alt=""
            className="size-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <BookOpen className="size-5 opacity-40" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-1 py-0.5">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-semibold leading-tight">
            Ch. {chapter?.num}
            {chapter?.title ? (
              <span className="ml-1 font-normal text-muted-foreground">
                · {chapter.title}
              </span>
            ) : null}
          </p>
          <Badge
            className={cn(
              "shrink-0",
              awaitingTe
                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-400"
                : REVIEW_BADGE_CLASS,
            )}
            variant="secondary"
          >
            {awaitingTe ? "Chờ gửi TE" : "Chờ duyệt"}
          </Badge>
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {chapter?.assistantName
            ? `Assistant: ${chapter.assistantName}`
            : "Đã nộp từ Assistant"}
          {tasks.length > 0 ? ` · ${approvedTasks}/${tasks.length} task` : ""}
        </p>
        {awaitingTe ? (
          <p className="text-[11px] font-medium text-emerald-600">
            Đã duyệt — chọn TE và gửi
          </p>
        ) : unapproved > 0 ? (
          <p className="text-[11px] font-medium text-amber-600">
            Còn {unapproved} task cần nhận/duyệt
          </p>
        ) : tasks.length > 0 ? (
          <p className="text-[11px] font-medium text-emerald-600">
            Đủ điều kiện phê duyệt chapter
          </p>
        ) : null}
      </div>

      <ChevronRight className="size-4 shrink-0 self-center text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

export default function MangakaAssistantReview() {
  const navigate = useNavigate();
  const user = getSession();
  const [selectedSeries, setSelectedSeries] = useState(null);

  const {
    seriesList,
    chapterRows,
    annotatorChapters,
    loadChapterPages,
  } = useMangakaWorkspace(user);

  const { pendingReviews, teReadyChapters, loading: tasksLoading } = useMangakaTasks(chapterRows);

  /** Chapter chờ duyệt task + chapter đã duyệt xong chờ gửi TE */
  const reviewQueue = useMemo(() => {
    const map = new Map();
    for (const r of pendingReviews ?? []) {
      const id = String(r?.chapter?.id ?? r?.submission?.id ?? "");
      if (id) map.set(id, r);
    }
    for (const r of teReadyChapters ?? []) {
      const id = String(r?.chapter?.id ?? r?.submission?.id ?? "");
      if (!id || map.has(id)) continue;
      map.set(id, r);
    }
    return [...map.values()];
  }, [pendingReviews, teReadyChapters]);

  const pendingReviewChapterIds = useMemo(
    () => reviewQueue.map((r) => r?.chapter?.id).filter(Boolean).join("|"),
    [reviewQueue],
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
    for (const review of reviewQueue) {
      const series =
        review?.chapter?.series ??
        review?.submission?.seriesName ??
        "Không rõ series";
      if (!map.has(series)) map.set(series, []);
      map.get(series).push(review);
    }

    function reviewUrgency(review) {
      if (review?.awaitingTe) return 2;
      const tasks = dedupeTasksForMangakaReview(
        review.allTasks ?? review.tasks ?? [],
      );
      const unapproved = countUnapprovedTasks(tasks);
      // Ưu tiên chapter còn task cần duyệt / vừa nộp
      return unapproved > 0 ? 0 : 1;
    }

    return Array.from(map.entries())
      .map(([series, reviews]) => {
        const seriesMeta = (seriesList ?? []).find((s) => s.title === series);
        const sorted = [...reviews].sort((a, b) => {
          const ua = reviewUrgency(a);
          const ub = reviewUrgency(b);
          if (ua !== ub) return ua - ub;
          return chapterNumSort(a, b);
        });
        return { series, seriesMeta, reviews: sorted };
      })
      .sort((a, b) => {
        if (a.reviews.length !== b.reviews.length) {
          return b.reviews.length - a.reviews.length;
        }
        return a.series.localeCompare(b.series, "vi");
      });
  }, [reviewQueue, seriesList]);

  const selectedGroup = useMemo(
    () => reviewsBySeries.find((g) => g.series === selectedSeries) ?? null,
    [reviewsBySeries, selectedSeries],
  );

  useEffect(() => {
    if (selectedSeries && !reviewsBySeries.some((g) => g.series === selectedSeries)) {
      setSelectedSeries(null);
    }
  }, [reviewsBySeries, selectedSeries]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header links={NAV_LINKS} onLogout={user ? handleLogout : undefined} />

      <main className="page-container flex min-h-0 flex-1 flex-col gap-6 py-6 lg:py-8">
        <header className="flex flex-wrap items-center gap-3 border-b border-border/60 pb-4">
          {selectedGroup ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedSeries(null)}>
              <ArrowLeft className="size-4" />
              Tất cả series
            </Button>
          ) : (
            <Button type="button" variant="ghost" size="sm" asChild>
              <Link to="/mangaka">
                <ArrowLeft className="size-4" />
                Quay lại workspace
              </Link>
            </Button>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-widest text-amber-600">
              Mangaka · Duyệt bản Assistant
            </p>
            <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold tracking-tight sm:text-2xl">
              <ClipboardCheck className="size-5 shrink-0 text-amber-600" />
              {selectedGroup ? selectedGroup.series : "Series chờ duyệt"}
              {reviewQueue.length > 0 ? (
                <Badge variant="secondary" className="text-sm font-normal">
                  {selectedGroup
                    ? `${selectedGroup.reviews.length} chapter`
                    : `${reviewsBySeries.length} series · ${reviewQueue.length} chapter`}
                </Badge>
              ) : null}
            </h1>
          </div>
        </header>

        {tasksLoading && reviewQueue.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Đang tải danh sách series chờ duyệt...
            </CardContent>
          </Card>
        ) : reviewQueue.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
              <ClipboardCheck className="size-10 text-muted-foreground/40" />
              <div className="space-y-1">
                <p className="font-medium">Chưa có bản nào chờ duyệt</p>
              </div>
              <Button variant="outline" asChild>
                <Link to="/mangaka" state={{ tab: "annotate" }}>
                  Về Upload & Ghi chú
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : selectedGroup ? (
          <div className="mx-auto w-full max-w-2xl space-y-2">
            {selectedGroup.reviews.map((review) => (
              <ChapterReviewItem
                key={review.chapter?.id ?? review.submission?.id}
                review={review}
                annotatorChapters={annotatorChapters}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {reviewsBySeries.map(({ series, seriesMeta, reviews }) => {
              const color = seriesMeta?.color ?? "#e11d48";
              const coverUrl = seriesMeta?.coverImage
                ? resolveMediaUrl(seriesMeta.coverImage)
                : null;
              const initials = (series.length >= 2 ? series : `${series}●`).slice(0, 2);

              return (
                <button
                  key={series}
                  type="button"
                  onClick={() => setSelectedSeries(series)}
                  className="group text-left"
                >
                  <Card className="gap-0 overflow-hidden py-0 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                    <div
                      className="relative aspect-[3/4] w-full overflow-hidden bg-muted"
                      style={
                        coverUrl
                          ? undefined
                          : {
                              background: `linear-gradient(145deg, ${color}, ${color}99)`,
                            }
                      }
                    >
                      {coverUrl ? (
                        <img
                          src={coverUrl}
                          alt=""
                          className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex size-full items-center justify-center text-2xl font-bold text-white/90">
                          {initials}
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent px-2.5 pb-2.5 pt-10">
                        <p className="line-clamp-2 text-sm font-semibold leading-snug text-white">
                          {series}
                        </p>
                        <p className="mt-1 text-xs font-medium text-amber-200">
                          {reviews.length} chapter chờ duyệt
                        </p>
                      </div>
                    </div>
                  </Card>
                </button>
              );
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
