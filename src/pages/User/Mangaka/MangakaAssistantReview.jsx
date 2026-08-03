import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  ClipboardCheck,
  ImageIcon,
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
      className={cn(
        "group flex w-full min-w-0 cursor-pointer items-center gap-4 rounded-xl border border-border/80 bg-white p-3.5",
        "transition-all duration-150 hover:border-amber-300 hover:bg-amber-50/30 hover:shadow-sm",
        "dark:bg-card dark:hover:border-amber-500/40 dark:hover:bg-amber-500/5",
      )}
    >
      <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-lg bg-gray-100 dark:bg-zinc-800">
        {thumbUrl ? (
          <img
            src={thumbUrl}
            alt=""
            className="size-full object-cover transition-transform duration-200 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-gray-400">
            <BookOpen className="size-6 opacity-50" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate text-base font-bold leading-snug text-gray-900 dark:text-zinc-50">
          Ch. {chapter?.num}
          {chapter?.title ? (
            <span className="font-semibold text-gray-800 dark:text-zinc-200">
              {" "}· {chapter.title}
            </span>
          ) : null}
        </p>
        <p className="truncate text-sm text-gray-600 dark:text-zinc-400">
          {chapter?.assistantName
            ? `Assistant: ${chapter.assistantName}`
            : "Đã nộp từ Assistant"}
          {tasks.length > 0 ? ` · ${approvedTasks}/${tasks.length} task` : ""}
        </p>
        {awaitingTe ? (
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
            Đã duyệt — chọn TE và gửi
          </p>
        ) : unapproved > 0 ? (
          <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
            Còn {unapproved} task cần nhận/duyệt
          </p>
        ) : tasks.length > 0 ? (
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
            Đủ điều kiện phê duyệt chapter
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-2.5 sm:gap-3">
        <Badge
          className={cn(
            "hidden rounded-full px-2.5 py-1 text-xs font-semibold sm:inline-flex",
            awaitingTe
              ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300"
              : "bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-300",
          )}
          variant="secondary"
        >
          {awaitingTe ? "Chờ gửi TE" : "Chờ duyệt"}
        </Badge>
        <span
          className={cn(
            "inline-flex size-9 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-gray-500",
            "transition-all duration-150 group-hover:border-amber-300 group-hover:bg-amber-50 group-hover:text-amber-700",
            "dark:border-zinc-700 dark:bg-zinc-800 dark:group-hover:border-amber-500/40 dark:group-hover:bg-amber-500/10 dark:group-hover:text-amber-300",
          )}
          aria-hidden
        >
          <ChevronRight className="size-4 transition-transform duration-150 group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

function SeriesReviewCard({ series, seriesMeta, reviews, onSelect }) {
  const coverUrl = seriesMeta?.coverImage
    ? resolveMediaUrl(seriesMeta.coverImage)
    : null;
  const pendingCount = reviews.length;

  return (
    <button
      type="button"
      onClick={onSelect}
      className="group cursor-pointer text-left"
    >
      <Card
        className={cn(
          "gap-0 overflow-hidden rounded-xl border-border/70 bg-white py-0 shadow-sm",
          "transition-transform duration-200 hover:scale-[1.02] hover:shadow-md",
          "dark:bg-card",
        )}
      >
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-gray-100 dark:bg-zinc-800">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt=""
              className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-2 bg-gradient-to-b from-gray-50 to-gray-100 text-gray-400 dark:from-zinc-800 dark:to-zinc-900 dark:text-zinc-500">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-gray-200/80 dark:bg-zinc-800 dark:ring-zinc-700">
                <ImageIcon className="size-6" strokeWidth={1.5} />
              </span>
              <span className="text-[11px] font-medium tracking-wide">Chưa có cover</span>
            </div>
          )}
          <span className="absolute right-2 top-2 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 shadow-sm dark:bg-amber-500/20 dark:text-amber-200">
            {pendingCount} chapter chờ duyệt
          </span>
        </div>

        <div className="space-y-1 border-t border-border/60 bg-white px-3 py-3 dark:bg-card">
          <p
            className="truncate text-sm font-bold text-gray-900 dark:text-zinc-50"
            title={series}
          >
            {series}
          </p>
          <p className="text-xs font-medium text-gray-500 dark:text-zinc-400">
            Nhấn để xem chapter
          </p>
        </div>
      </Card>
    </button>
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

      <main
        className={cn(
          "mx-auto flex w-full min-h-[60vh] min-w-0 flex-1 flex-col gap-6 px-6 py-8",
          selectedGroup ? "max-w-5xl" : "page-container max-w-7xl",
        )}
      >
        <header className="flex flex-col gap-3 border-b border-border/60 pb-5">
          <div className="flex flex-wrap items-center gap-2">
            {selectedGroup ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 -ml-2 gap-1.5 rounded-lg px-2 text-gray-600 hover:text-gray-900"
                onClick={() => setSelectedSeries(null)}
              >
                <ArrowLeft className="size-4" />
                Tất cả series
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 -ml-2 gap-1.5 rounded-lg px-2 text-gray-600 hover:text-gray-900"
                asChild
              >
                <Link to="/mangaka">
                  <ArrowLeft className="size-4" />
                  Quay lại workspace
                </Link>
              </Button>
            )}
            <span
              className="inline-flex items-center rounded-full border border-amber-200/80 bg-amber-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
            >
              Mangaka · Duyệt bản Assistant
            </span>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-3">
            <h1 className="flex min-w-0 flex-wrap items-center gap-2.5 text-2xl font-bold tracking-tight text-gray-900 dark:text-zinc-50">
              <ClipboardCheck className="size-6 shrink-0 text-amber-600" />
              <span className="min-w-0 truncate">
                {selectedGroup ? selectedGroup.series : "Series chờ duyệt"}
              </span>
            </h1>
            {reviewQueue.length > 0 ? (
              <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                {selectedGroup
                  ? `${selectedGroup.reviews.length} chapter`
                  : `${reviewsBySeries.length} series · ${reviewQueue.length} chapter`}
              </span>
            ) : null}
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
          <section className="flex flex-1 flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-gray-600 dark:text-zinc-400">
                Chapter cần xử lý
              </p>
              <p className="text-xs text-gray-500 dark:text-zinc-500">
                Chọn một chapter để duyệt chi tiết
              </p>
            </div>
            <div className="flex w-full flex-col gap-3">
              {selectedGroup.reviews.map((review) => (
                <ChapterReviewItem
                  key={review.chapter?.id ?? review.submission?.id}
                  review={review}
                  annotatorChapters={annotatorChapters}
                />
              ))}
            </div>
          </section>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {reviewsBySeries.map(({ series, seriesMeta, reviews }) => (
              <SeriesReviewCard
                key={series}
                series={series}
                seriesMeta={seriesMeta}
                reviews={reviews}
                onSelect={() => setSelectedSeries(series)}
              />
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
