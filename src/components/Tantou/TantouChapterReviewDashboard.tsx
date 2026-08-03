import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ImageIcon } from "lucide-react";
import { resolveMediaUrl } from "@/api/http.js";
import { seriesService } from "@/api/series.service.js";
import {
  isTePageRecord,
  resolveTePageId,
  resolveTePageImageUrl,
  tePageHasImage,
  teReviewsService,
} from "@/api/teReviews.service.js";
import {
  formatTeScheduledPublishDisplay,
  isChapterAwaitingTePublish,
  requiresTeManualScheduledPublish,
  TE_CHAPTER_APPROVED_STATUS,
  TE_PUBLISH_BUFFER_HINT,
  tePhaseLabel,
} from "@/utils/teReviewPhase.js";
import {
  isTeSeriesLevelSubmission,
  submissionTeTabType,
} from "@/utils/teReviewPending.js";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChapterListTable } from "./ChapterListTable";
import { TantouPageAnnotator } from "./TantouPageAnnotator";
import { ReviewRatingPanel } from "./ReviewRatingPanel";
import { TePublishScheduleDialog } from "./TePublishScheduleDialog";
import type {
  ChapterRow,
  PageNote,
  ReviewDraft,
  ReviewSavePayload,
  TantouSubmission,
} from "./reviewTypes";
import {
  createReviewDraft,
  formatReleaseDate,
  getMangakaNotesForStoryPage,
  groupSubmissionsByChapter,
  isSameChapter,
  mapApiAnnotationsToNotesByPage,
  mapApiAnnotationsToPageNotes,
  normalizeTeSeriesChapters,
  resolveStoryPagesForChapter,
  resolveViewingSubmission,
  type SeriesProfileChapter,
} from "./reviewUtils";

type PageDetail = {
  pageId: string;
  imageUrl?: string;
  pageNumber: number;
};

function buildPageDetail(
  page: NonNullable<TantouSubmission["pagesMeta"]>[number],
  index: number,
): PageDetail {
  return {
    pageId: resolveTePageId(page),
    pageNumber: Number(page.page_number ?? index + 1),
    imageUrl: resolveTePageImageUrl(page) ?? undefined,
  };
}

type PageMeta = NonNullable<TantouSubmission["pagesMeta"]>[number];

function teResponseToPages(res: {
  page?: unknown;
  pages?: unknown[];
}): PageMeta[] {
  let pages = (res.pages ?? []) as PageMeta[];
  if (!pages.length && isTePageRecord(res.page)) {
    pages = [res.page as PageMeta];
  }
  return pages;
}

function pickTePageWithImage(
  res: { page?: unknown; pages?: unknown[] },
  pageIndex: number,
): PageMeta | null {
  const pages = Array.isArray(res.pages) ? res.pages : [];
  const candidates = [
    res.page,
    pages[pageIndex],
    pages.find(
      (p) =>
        Number((p as { page_number?: number })?.page_number) === pageIndex + 1,
    ),
    pages[0],
  ];
  for (const candidate of candidates) {
    if (isTePageRecord(candidate) && tePageHasImage(candidate)) {
      return candidate as PageMeta;
    }
  }
  for (const candidate of candidates) {
    if (isTePageRecord(candidate)) return candidate as PageMeta;
  }
  return null;
}

/** Chỉ gọi ?page=N khi `all=true` trả page thiếu URL ảnh */
async function hydrateMissingPageImages(chapterId: string, pages: PageMeta[]) {
  const missingIndexes = pages
    .map((page, index) => (tePageHasImage(page) ? -1 : index))
    .filter((index) => index >= 0);

  if (!missingIndexes.length) {
    const details: Record<number, PageDetail> = {};
    pages.forEach((page, index) => {
      if (tePageHasImage(page)) details[index] = buildPageDetail(page, index);
    });
    return { details, enrichedPages: pages };
  }

  const details: Record<number, PageDetail> = {};
  const enrichedPages = pages.map((page) => ({ ...page }));

  pages.forEach((page, index) => {
    if (tePageHasImage(page)) {
      details[index] = buildPageDetail(page, index);
    }
  });

  await Promise.all(
    missingIndexes.map(async (index) => {
      const page = pages[index];
      try {
        const res = await teReviewsService.getChapterPage(chapterId, index + 1);
        const tePage = pickTePageWithImage(res, index);
        if (tePage) {
          enrichedPages[index] = { ...page, ...tePage };
          details[index] = buildPageDetail(enrichedPages[index], index);
        }
      } catch {
        // giữ page từ ?all=true
      }
    }),
  );

  return { details, enrichedPages };
}

type TantouChapterReviewDashboardProps = {
  submission: TantouSubmission;
  relatedSubmissions?: TantouSubmission[];
  allSubmissions?: TantouSubmission[];
  onCancel: () => void;
  onSaveReview: (
    payload: ReviewSavePayload,
    options?: {
      submitAction?: "reject" | "publish" | "release";
      saveDraftOnly?: boolean;
      scheduled_publish_at?: string;
    },
  ) => void;
  onSelectChapter: (submissionId: string) => void;
  saving?: boolean;
};

function ChipList({
  items,
  emptyLabel = "—",
  prefix = "#",
}: {
  items: string[];
  emptyLabel?: string;
  prefix?: string;
}) {
  if (!items.length) {
    if (!emptyLabel) return null;
    return <span className="text-xs text-gray-400">{emptyLabel}</span>;
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {items.map((item) => (
        <span
          key={item}
          className="rounded-full border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-600"
        >
          {prefix}
          {String(item).replace(/^#/, "")}
        </span>
      ))}
    </div>
  );
}

export function TantouChapterReviewDashboard({
  submission,
  relatedSubmissions = [],
  allSubmissions = [],
  onCancel,
  onSaveReview,
  onSelectChapter,
  saving = false,
}: TantouChapterReviewDashboardProps) {
  const [draft, setDraft] = useState<ReviewDraft>(() =>
    createReviewDraft(submission),
  );
  const [viewingChapterId, setViewingChapterId] = useState<string | null>(
    () => submission.id,
  );
  const [viewingPageIndex, setViewingPageIndex] = useState(
    () => submission.pageIndex ?? 0,
  );
  const [notesByPage, setNotesByPage] = useState<Record<number, PageNote[]>>(
    () => {
      const initial: Record<number, PageNote[]> = {};
      if (submission.editorialNotesByPage) {
        Object.entries(submission.editorialNotesByPage).forEach(([k, v]) => {
          initial[Number(k)] = v;
        });
      } else if (submission.editorialNotes?.length) {
        initial[submission.pageIndex ?? 0] = submission.editorialNotes;
      }
      return initial;
    },
  );
  const [chapterPagesMeta, setChapterPagesMeta] = useState(
    () => submission.pagesMeta ?? [],
  );
  const [pageDetailsByIndex, setPageDetailsByIndex] = useState<
    Record<number, PageDetail>
  >({});
  const [loadingPage, setLoadingPage] = useState(false);
  const [seriesChapters, setSeriesChapters] = useState<SeriesProfileChapter[]>(
    [],
  );
  const [, setSeriesChaptersLoading] = useState(false);
  const [publishScheduleOpen, setPublishScheduleOpen] = useState(false);
  const readerRef = useRef<HTMLDivElement>(null);

  const resolvedSeriesId =
    submission.seriesId
    ?? relatedSubmissions.find((s) => s.seriesId)?.seriesId
    ?? null;

  const viewingSubmission = useMemo(
    () =>
      resolveViewingSubmission(
        viewingChapterId,
        submission,
        relatedSubmissions,
        seriesChapters,
      ),
    [
      viewingChapterId,
      submission,
      relatedSubmissions,
      seriesChapters,
    ],
  );

  const activeChapterId =
    viewingSubmission.chapterId ?? viewingSubmission.id ?? submission.id;

  useEffect(() => {
    setDraft(createReviewDraft(submission));
    setViewingChapterId(submission.id);
    setViewingPageIndex(submission.pageIndex ?? 0);
    setChapterPagesMeta(submission.pagesMeta ?? []);
    setPageDetailsByIndex({});
    setNotesByPage({});
    setSeriesChapters([]);
  }, [submission.id]);

  /** Lấy toàn bộ chapter theo series (profile TE → fallback /series/:id/chapters) */
  useEffect(() => {
    const seriesId = resolvedSeriesId;
    if (!seriesId) {
      setSeriesChapters([]);
      setSeriesChaptersLoading(false);
      return;
    }

    let cancelled = false;
    setSeriesChaptersLoading(true);

    async function loadSeriesChapters() {
      let chapters: SeriesProfileChapter[] = [];

      try {
        const profileRes = await teReviewsService.getSeriesProfile(seriesId);
        if (cancelled) return;
        chapters = normalizeTeSeriesChapters(
          Array.isArray(profileRes?.chapters) ? profileRes.chapters : [],
        );
      } catch {
        // fallback bên dưới
      }

      if (!chapters.length && !cancelled) {
        try {
          const res = await seriesService.getChapters(seriesId);
          if (cancelled) return;
          chapters = normalizeTeSeriesChapters(
            Array.isArray(res?.chapters) ? res.chapters : [],
          );
        } catch {
          chapters = [];
        }
      }

      if (!cancelled) {
        setSeriesChapters(chapters);
        setSeriesChaptersLoading(false);
      }
    }

    void loadSeriesChapters();
    return () => {
      cancelled = true;
    };
  }, [resolvedSeriesId]);

  useEffect(() => {
    let cancelled = false;
    const chapterId = activeChapterId;
    if (!chapterId) return;

    setChapterPagesMeta([]);
    setPageDetailsByIndex({});
    setNotesByPage({});

    function applyLoadedPages(
      pages: NonNullable<TantouSubmission["pagesMeta"]>,
      rootAnnotations: unknown[] = [],
    ) {
      setChapterPagesMeta(pages);
      const details: Record<number, PageDetail> = {};
      const initialNotes: Record<number, PageNote[]> = {};

      pages.forEach((page, index) => {
        details[index] = buildPageDetail(page, index);
        if (Array.isArray(page.annotations) && page.annotations.length) {
          initialNotes[index] = mapApiAnnotationsToPageNotes(page.annotations);
        } else {
          initialNotes[index] = [];
        }
      });

      if (rootAnnotations.length) {
        Object.assign(
          initialNotes,
          mapApiAnnotationsToNotesByPage(rootAnnotations, pages),
        );
      }

      setPageDetailsByIndex(details);
      setNotesByPage((current) => ({ ...current, ...initialNotes }));
    }

    async function loadAllChapterPages() {
      setLoadingPage(true);
      try {
        const res = await teReviewsService.getAllChapterPages(chapterId);
        if (cancelled) return;

        const pages = teResponseToPages(res);
        if (!pages.length || cancelled) return;

        applyLoadedPages(pages, Array.isArray(res.annotations) ? res.annotations : []);

        if (pages.some((page) => !tePageHasImage(page))) {
          const hydrated = await hydrateMissingPageImages(chapterId, pages);
          if (cancelled) return;
          if (Object.keys(hydrated.details).length) {
            setPageDetailsByIndex((current) => ({ ...current, ...hydrated.details }));
          }
          if (hydrated.enrichedPages.some(tePageHasImage)) {
            setChapterPagesMeta(hydrated.enrichedPages);
          }
        }
      } catch {
        try {
          const res = await teReviewsService.getChapterPage(chapterId, 1);
          if (cancelled) return;
          const pages = teResponseToPages(res);
          if (!pages.length) return;

          applyLoadedPages(pages, Array.isArray(res.annotations) ? res.annotations : []);
          const hydrated = await hydrateMissingPageImages(chapterId, pages);
          if (cancelled) return;
          if (Object.keys(hydrated.details).length) {
            setPageDetailsByIndex((current) => ({ ...current, ...hydrated.details }));
          }
          setChapterPagesMeta(hydrated.enrichedPages);
        } catch {
          // giữ state hiện tại
        }
      } finally {
        if (!cancelled) setLoadingPage(false);
      }
    }

    void loadAllChapterPages();
    return () => {
      cancelled = true;
    };
  }, [activeChapterId]);

  useEffect(() => {
    let cancelled = false;
    const chapterId = activeChapterId;
    if (!chapterId) return;

    const pageMeta = chapterPagesMeta[viewingPageIndex];
    const cachedImage = pageDetailsByIndex[viewingPageIndex]?.imageUrl;
    const cachedNotes = notesByPage[viewingPageIndex];
    const needsImage = !cachedImage && !tePageHasImage(pageMeta);
    const needsNotes = cachedNotes === undefined;
    if (!needsImage && !needsNotes) return;

    async function loadCurrentPageDetail() {
      try {
        const res = await teReviewsService.getChapterPage(
          chapterId,
          viewingPageIndex + 1,
        );
        if (cancelled) return;

        const tePage = pickTePageWithImage(res, viewingPageIndex);
        let imageUrl = resolveTePageImageUrl(tePage ?? undefined) ?? undefined;
        let mergedPage = tePage;

        if (needsImage && !imageUrl && chapterPagesMeta.length) {
          const hydrated = await hydrateMissingPageImages(
            chapterId,
            chapterPagesMeta,
          );
          const detail = hydrated.details[viewingPageIndex];
          if (detail?.imageUrl) {
            imageUrl = detail.imageUrl;
            mergedPage = hydrated.enrichedPages[viewingPageIndex] ?? mergedPage;
          }
        }

        if (needsImage && (imageUrl || mergedPage)) {
          const detail = mergedPage
            ? buildPageDetail(mergedPage, viewingPageIndex)
            : pageDetailsByIndex[viewingPageIndex];
          setPageDetailsByIndex((current) => ({
            ...current,
            [viewingPageIndex]: {
              ...current[viewingPageIndex],
              ...detail,
              imageUrl:
                imageUrl
                ?? detail?.imageUrl
                ?? current[viewingPageIndex]?.imageUrl,
            },
          }));
          if (mergedPage) {
            setChapterPagesMeta((current) => {
              const next = [...current];
              next[viewingPageIndex] = {
                ...(next[viewingPageIndex] ?? {}),
                ...mergedPage,
              };
              return next;
            });
          }
        }

        if (needsNotes) {
          const pageNotes = mapApiAnnotationsToPageNotes(
            res.annotations
            ?? (isTePageRecord(res.page) && Array.isArray(res.page.annotations)
              ? res.page.annotations
              : [])
            ?? [],
          );
          setNotesByPage((current) => ({
            ...current,
            [viewingPageIndex]: pageNotes,
          }));
        }
      } catch {
        if (cancelled) return;

        if (needsImage) {
          try {
            const res = await teReviewsService.getChapterPage(
              chapterId,
              viewingPageIndex + 1,
            );
            if (cancelled) return;
            const tePage = pickTePageWithImage(res, viewingPageIndex);
            if (tePage) {
              const detail = buildPageDetail(tePage, viewingPageIndex);
              setPageDetailsByIndex((current) => ({
                ...current,
                [viewingPageIndex]: {
                  ...current[viewingPageIndex],
                  ...detail,
                },
              }));
            }
          } catch {
            // giữ state hiện tại
          }
        }

        if (needsNotes) {
          try {
            const pageId = resolveTePageId(chapterPagesMeta[viewingPageIndex]);
            const annotations = await teReviewsService.getAnnotations(
              chapterId,
              pageId || undefined,
            );
            if (cancelled) return;
            setNotesByPage((current) => ({
              ...current,
              [viewingPageIndex]: mapApiAnnotationsToPageNotes(
                Array.isArray(annotations) ? annotations : [],
              ),
            }));
          } catch {
            if (!cancelled) {
              setNotesByPage((current) => ({
                ...current,
                [viewingPageIndex]: current[viewingPageIndex] ?? [],
              }));
            }
          }
        }
      }
    }

    void loadCurrentPageDetail();
    return () => {
      cancelled = true;
    };
  }, [
    activeChapterId,
    viewingPageIndex,
    chapterPagesMeta,
    pageDetailsByIndex,
    notesByPage,
  ]);

  // Chỉ hiện chapter Mangaka đã gửi TE (hàng chờ), không lấy toàn bộ series profile.
  const chapterRows: ChapterRow[] = useMemo(() => {
    return groupSubmissionsByChapter(
      relatedSubmissions,
      submission.seriesTitle,
    ).map((group, index) => ({
      id: group.representativeSubmissionId,
      index: index + 1,
      name: `Ch. ${group.chapterNum}`,
      releaseDate: formatReleaseDate(group.sentAt),
      status: group.status,
    }));
  }, [relatedSubmissions, submission.seriesTitle]);

  const viewingSubmissionWithPages = useMemo(
    () => ({
      ...viewingSubmission,
      pagesMeta: chapterPagesMeta.length
        ? chapterPagesMeta
        : viewingSubmission.pagesMeta,
    }),
    [viewingSubmission, chapterPagesMeta],
  );

  const storyPages = useMemo(() => {
    if (!viewingSubmissionWithPages) return [];

    const summary = chapterPagesMeta.length
      ? chapterPagesMeta
      : (viewingSubmissionWithPages.pagesMeta ?? []);

    if (summary.length) {
      return summary.map((page, index) => ({
        pageIndex: index,
        pageLabel: page.page_number
          ? `Trang ${page.page_number}`
          : `Trang ${index + 1}`,
        imageUrl:
          pageDetailsByIndex[index]?.imageUrl ??
          resolveTePageImageUrl(page) ??
          undefined,
      }));
    }

    const detail = pageDetailsByIndex[viewingPageIndex];
    if (detail?.imageUrl) {
      return [
        {
          pageIndex: viewingPageIndex,
          pageLabel: `Trang ${detail.pageNumber}`,
          imageUrl: detail.imageUrl,
        },
      ];
    }

    return resolveStoryPagesForChapter(
      viewingSubmissionWithPages,
      relatedSubmissions,
    );
  }, [
    chapterPagesMeta,
    pageDetailsByIndex,
    relatedSubmissions,
    viewingPageIndex,
    viewingSubmissionWithPages,
  ]);

  const currentStoryPage = storyPages[viewingPageIndex] ?? storyPages[0];
  const canEditNotes = !!viewingSubmissionWithPages;

  useEffect(() => {
    if (!viewingSubmissionWithPages) return;
    setViewingPageIndex(
      isSameChapter(viewingSubmissionWithPages, submission)
        ? (submission.pageIndex ?? 0)
        : 0,
    );
  }, [viewingSubmissionWithPages?.id, submission]);

  function handleOpenChapter(id: string) {
    setViewingChapterId(id);
    const inQueue = relatedSubmissions.some(
      (s) => String(s.id) === id || String(s.chapterId) === id,
    );
    if (inQueue) onSelectChapter(id);
    setViewingPageIndex(0);
    requestAnimationFrame(() => {
      readerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  function handlePageIndexChange(nextIndex: number) {
    if (nextIndex < 0 || nextIndex >= storyPages.length) return;
    setViewingPageIndex(nextIndex);
  }

  function buildPayload(): ReviewSavePayload {
    const target = viewingSubmissionWithPages;
    const primaryPageIndex = target.pageIndex ?? 0;
    const chapterApiStatus =
      target.apiChapterStatus
      ?? seriesChapters.find(
        (ch) => String(ch._id ?? ch.id) === String(target.chapterId ?? target.id),
      )?.status
      ?? "";
    const publishOnly =
      !requiresEbSubmit && isChapterAwaitingTePublish(chapterApiStatus);

    return {
      ...draft,
      chapter_id: target.chapterId ?? target.id,
      chapter_number: String(target.chapterNum ?? ""),
      chapter_title: String(target.chapterTitle ?? ""),
      averageScore: 0,
      coverImageUrl: draft.series_cover_image_url || target.mangakaImageUrl,
      editorialNotes:
        notesByPage[primaryPageIndex] ?? draft.editorialNotes ?? [],
      editorialNotesByPage: notesByPage,
      pagesMeta: chapterPagesMeta.length
        ? chapterPagesMeta
        : target.pagesMeta,
      chapterApiStatus,
      publishOnly,
    };
  }

  function handleEditorialNotesChange(notes: PageNote[]) {
    setNotesByPage((current) => ({ ...current, [viewingPageIndex]: notes }));
    if ((submission.pageIndex ?? 0) === viewingPageIndex) {
      setDraft((current) => ({ ...current, editorialNotes: notes }));
    }
  }

  const coverPreviewUrl = resolveMediaUrl(draft.series_cover_image_url);
  const requiresEbSubmit = isTeSeriesLevelSubmission(submission);
  const resolvedChapterApiStatus =
    viewingSubmissionWithPages.apiChapterStatus
    ?? seriesChapters.find(
      (ch) =>
        String(ch._id ?? ch.id)
        === String(viewingSubmissionWithPages.chapterId ?? viewingSubmissionWithPages.id),
    )?.status
    ?? "";
  const publishOnlyMode =
    !requiresEbSubmit && isChapterAwaitingTePublish(resolvedChapterApiStatus);
  const assignedTeCanPublish =
    viewingSubmissionWithPages.canReview !== false
    && viewingSubmissionWithPages.teAssignmentStatus !== "other";
  const publishEnabled =
    publishOnlyMode && assignedTeCanPublish;
  const publishDisabledReason = publishOnlyMode
    ? (!assignedTeCanPublish
      ? (viewingSubmissionWithPages.teAssignmentLabel
        || "Chỉ TE đã phê duyệt chapter mới được phát hành.")
      : undefined)
    : "Phê duyệt trước — Publish chỉ khi chapter ở approved_by_EB.";

  const scheduledPublishLabel = formatTeScheduledPublishDisplay(
    viewingSubmissionWithPages.scheduledPublishAt
      ?? seriesChapters.find(
        (ch) =>
          String(ch._id ?? ch.id)
          === String(
            viewingSubmissionWithPages.chapterId ?? viewingSubmissionWithPages.id,
          ),
      )?.scheduled_publish_at
      ?? null,
  );

  const needsManualSchedule = requiresTeManualScheduledPublish([
    ...seriesChapters,
    ...relatedSubmissions.map((s) => ({
      status: s.apiChapterStatus ?? s.status,
      publishedAt: s.publishedAt,
    })),
    {
      status:
        viewingSubmissionWithPages.apiChapterStatus
        ?? viewingSubmissionWithPages.status,
      publishedAt: viewingSubmissionWithPages.publishedAt,
    },
  ]);

  // Đồng bộ status local sau approve (giữ nút Publish hiện ngay)
  useEffect(() => {
    if (!isChapterAwaitingTePublish(submission.apiChapterStatus)) return;
    const chId = String(submission.chapterId ?? submission.id);
    setSeriesChapters((prev) =>
      prev.map((ch) =>
        String(ch._id ?? ch.id) === chId
          ? { ...ch, status: TE_CHAPTER_APPROVED_STATUS }
          : ch,
      ),
    );
  }, [submission.apiChapterStatus, submission.chapterId, submission.id]);

  useEffect(() => {
    const seriesId = resolvedSeriesId;
    if (!seriesId || !isTeSeriesLevelSubmission(submission)) {
      return;
    }

    let cancelled = false;

    async function loadSeriesReviewContext() {
      try {
        const [reviewRes, profileRes] = await Promise.all([
          teReviewsService.getSeriesReview(seriesId).catch(() => null),
          teReviewsService.getSeriesProfile(seriesId).catch(() => null),
        ]);
        if (cancelled) return;

        const review = reviewRes?.review ?? reviewRes ?? null;
        const series = profileRes?.series ?? profileRes ?? null;

        setDraft((current) => ({
          ...current,
          ...(review?.feedback
            ? { reviewText: String(review.feedback) }
            : {}),
          ...(review?.quick_notes
            ? { quickNotes: String(review.quick_notes) }
            : {}),
          ...(review?.revision_feedback
            ? { revisionFeedback: String(review.revision_feedback) }
            : {}),
          ...(series?.name ? { series_name: String(series.name) } : {}),
          ...(series?.synopsis
            ? { series_synopsis: String(series.synopsis) }
            : {}),
          ...(Array.isArray(series?.genre) && series.genre.length
            ? { series_genre: series.genre }
            : {}),
          ...(Array.isArray(series?.tags) && series.tags.length
            ? { series_tags: series.tags }
            : {}),
          ...(series?.cover_image_url
            ? { series_cover_image_url: String(series.cover_image_url) }
            : {}),
        }));
      } catch {
        // giữ draft hiện tại
      }
    }

    void loadSeriesReviewContext();
    return () => {
      cancelled = true;
    };
  }, [resolvedSeriesId, submission.tabType, submission.phase, submission.pipeline]);

  const seriesTitle = draft.series_name || submission.seriesTitle;
  const authorName =
    draft.series_author_name
    || submission.seriesMeta?.authorName
    || submission.mangakaName
    || "—";

  return (
    <div className="space-y-3 text-gray-900">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-1.5 text-xs text-gray-500 hover:text-gray-900"
          onClick={onCancel}
        >
          <ArrowLeft className="size-3.5" />
          Quay lại
        </Button>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-white px-3 py-2.5 shadow-sm">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="h-14 w-11 shrink-0 overflow-hidden rounded-md border border-gray-100 bg-gray-50">
            {coverPreviewUrl ? (
              <img
                src={coverPreviewUrl}
                alt=""
                className="size-full object-cover"
              />
            ) : (
              <div className="flex size-full items-center justify-center text-gray-400">
                <ImageIcon className="size-4 opacity-60" />
              </div>
            )}
          </div>
          <div className="min-w-0 space-y-0.5">
            <h1 className="truncate text-base font-semibold tracking-tight text-gray-900 sm:text-lg">
              {seriesTitle || "—"}
            </h1>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
              <span className="font-medium text-gray-700">{authorName}</span>
              <span className="text-gray-300">·</span>
              <span>
                Tập {viewingSubmissionWithPages.chapterNum || "?"} ·{" "}
                {viewingSubmissionWithPages.pageLabel || "Trang 1"}
              </span>
              {(draft.series_genre?.length || draft.series_tags?.length) ? (
                <>
                  <span className="text-gray-300">·</span>
                  <div className="inline-flex flex-wrap items-center gap-1">
                    <ChipList items={draft.series_genre} emptyLabel="" />
                    <ChipList items={draft.series_tags} emptyLabel="" />
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-medium",
            requiresEbSubmit
              ? "border-amber-200 bg-amber-50 text-amber-700"
              : "border-sky-200 bg-sky-50 text-sky-700",
          )}
        >
          {tePhaseLabel(submissionTeTabType(submission))}
        </span>
      </div>

      <ChapterListTable
        rows={chapterRows}
        activeId={activeChapterId}
        viewingId={viewingChapterId ?? activeChapterId}
        loading={false}
        onOpen={handleOpenChapter}
      />

      <div className="mt-1 grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,320px)] lg:gap-5">
        <div className="relative z-0 min-w-0">
          {viewingSubmissionWithPages ? (
            <TantouPageAnnotator
              ref={readerRef}
              submission={viewingSubmissionWithPages}
              storyPages={storyPages}
              currentPageIndex={viewingPageIndex}
              onPageIndexChange={handlePageIndexChange}
              pageLabel={currentStoryPage?.pageLabel}
              pageImageUrl={currentStoryPage?.imageUrl}
              mangakaNotes={getMangakaNotesForStoryPage(
                viewingSubmissionWithPages,
                viewingPageIndex,
              )}
              editorialNotes={notesByPage[viewingPageIndex] ?? []}
              readOnly={!canEditNotes || loadingPage}
              onEditorialNotesChange={
                canEditNotes ? handleEditorialNotesChange : undefined
              }
              onClose={() => setViewingChapterId(null)}
            />
          ) : (
            <div className="flex min-h-[240px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 shadow-sm">
              Chọn <strong>Mở</strong> trong danh sách chapter để xem trang
              truyện cần nhận xét.
            </div>
          )}
        </div>

        <div className="sticky top-20 z-10 h-fit self-start">
          <ReviewRatingPanel
            draft={draft}
            requiresEbSubmit={requiresEbSubmit}
            publishOnlyMode={publishOnlyMode}
            publishEnabled={publishEnabled}
            publishDisabledReason={publishDisabledReason}
            publishHint={
              publishOnlyMode
                ? (needsManualSchedule
                  ? TE_PUBLISH_BUFFER_HINT
                  : "Chapter tiếp theo sẽ lên lịch theo chu kỳ series (publication_schedule). Job tự publish khi đủ buffer.")
                : undefined
            }
            scheduledPublishAt={
              publishOnlyMode && scheduledPublishLabel
                ? scheduledPublishLabel
                : null
            }
            saving={saving}
            onReviewTextChange={(text) =>
              setDraft((c) => ({ ...c, reviewText: text }))
            }
            onQuickNotesChange={(text) =>
              setDraft((c) => ({ ...c, quickNotes: text }))
            }
            onRevisionFeedbackChange={(text) =>
              setDraft((c) => ({ ...c, revisionFeedback: text }))
            }
            onStatusChange={(reviewStatus) =>
              setDraft((c) => ({ ...c, reviewStatus }))
            }
            onSaveDraft={
              requiresEbSubmit
                ? () => onSaveReview(buildPayload(), { saveDraftOnly: true })
                : undefined
            }
            onSendToMangaka={() =>
              onSaveReview(buildPayload(), { submitAction: "reject" })
            }
            onSendToEb={() =>
              onSaveReview(buildPayload(), { submitAction: "publish" })
            }
            onPublish={() => {
              if (!publishEnabled) return;
              if (needsManualSchedule) {
                setPublishScheduleOpen(true);
                return;
              }
              onSaveReview(buildPayload(), { submitAction: "release" });
            }}
          />
        </div>
      </div>

      <TePublishScheduleDialog
        open={publishScheduleOpen}
        onOpenChange={setPublishScheduleOpen}
        confirming={saving}
        initialScheduledAt={viewingSubmissionWithPages.scheduledPublishAt ?? null}
        onConfirm={(scheduledPublishAtIso) => {
          setPublishScheduleOpen(false);
          onSaveReview(
            {
              ...buildPayload(),
              scheduled_publish_at: scheduledPublishAtIso,
            },
            {
              submitAction: "release",
              scheduled_publish_at: scheduledPublishAtIso,
            },
          );
        }}
      />
    </div>
  );
}
