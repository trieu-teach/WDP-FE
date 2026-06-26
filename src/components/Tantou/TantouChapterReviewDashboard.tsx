import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ImageIcon } from "lucide-react";
import { resolveMediaUrl } from "@/api/http.js";
import {
  isTePageRecord,
  resolveTePageId,
  resolveTePageImageUrl,
  tePageHasImage,
  teReviewsService,
} from "@/api/teReviews.service.js";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChapterListTable } from "./ChapterListTable";
import { TantouPageAnnotator } from "./TantouPageAnnotator";
import { ReviewRatingPanel } from "./ReviewRatingPanel";
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
  resolveStoryPagesForChapter,
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
    options?: { submitAction?: "reject" | "publish" },
  ) => void;
  onSelectChapter: (submissionId: string) => void;
};

function SelectedPills({ items }: { items: string[] }) {
  if (!items.length) {
    return (
      <p className="min-h-9 rounded-md border border-dashed border-border/60 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
        Chưa chọn
      </p>
    );
  }
  return (
    <div className="flex min-h-9 flex-wrap gap-1.5 rounded-md border border-border/60 bg-muted/10 px-3 py-2">
      {items.map((item) => (
        <Badge key={item} variant="secondary">
          {item}
        </Badge>
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
  const readerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraft(createReviewDraft(submission));
    setViewingChapterId(submission.id);
    setViewingPageIndex(submission.pageIndex ?? 0);
    setChapterPagesMeta(submission.pagesMeta ?? []);
    setPageDetailsByIndex({});
    setNotesByPage({});
  }, [submission.id]);

  useEffect(() => {
    let cancelled = false;
    const chapterId = submission.chapterId ?? submission.id;
    if (!chapterId) return;

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
        }
      });

      if (rootAnnotations.length) {
        Object.assign(
          initialNotes,
          mapApiAnnotationsToNotesByPage(rootAnnotations, pages),
        );
      }

      setPageDetailsByIndex(details);
      if (Object.keys(initialNotes).length) {
        setNotesByPage((current) => ({ ...current, ...initialNotes }));
      }
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
  }, [submission.id, submission.chapterId]);

  useEffect(() => {
    let cancelled = false;
    const chapterId = submission.chapterId ?? submission.id;
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
    submission.id,
    submission.chapterId,
    viewingPageIndex,
    chapterPagesMeta,
    pageDetailsByIndex,
    notesByPage,
  ]);

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

  const viewingSubmission = useMemo(() => {
    if (!viewingChapterId) return null;
    const base =
      relatedSubmissions.find((s) => s.id === viewingChapterId) ?? submission;
    if (base.id !== submission.id) return base;
    return {
      ...base,
      pagesMeta: chapterPagesMeta.length ? chapterPagesMeta : base.pagesMeta,
    };
  }, [viewingChapterId, relatedSubmissions, submission, chapterPagesMeta]);

  const storyPages = useMemo(() => {
    if (!viewingSubmission) return [];

    const summary = chapterPagesMeta.length
      ? chapterPagesMeta
      : (viewingSubmission.pagesMeta ?? []);

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

    return resolveStoryPagesForChapter(viewingSubmission, relatedSubmissions);
  }, [
    chapterPagesMeta,
    pageDetailsByIndex,
    relatedSubmissions,
    viewingPageIndex,
    viewingSubmission,
  ]);

  const currentStoryPage = storyPages[viewingPageIndex] ?? storyPages[0];
  const canEditNotes =
    !!viewingSubmission && isSameChapter(viewingSubmission, submission);

  useEffect(() => {
    if (!viewingSubmission) return;
    setViewingPageIndex(
      isSameChapter(viewingSubmission, submission)
        ? (submission.pageIndex ?? 0)
        : 0,
    );
  }, [viewingSubmission?.id, submission]);

  function handleOpenChapter(id: string) {
    setViewingChapterId(id);
    onSelectChapter(id);
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
    const primaryPageIndex = submission.pageIndex ?? 0;
    return {
      ...draft,
      averageScore: 0,
      coverImageUrl: draft.series_cover_image_url || submission.mangakaImageUrl,
      editorialNotes:
        notesByPage[primaryPageIndex] ?? draft.editorialNotes ?? [],
      editorialNotesByPage: notesByPage,
      pagesMeta: chapterPagesMeta.length
        ? chapterPagesMeta
        : submission.pagesMeta,
    };
  }

  function handleEditorialNotesChange(notes: PageNote[]) {
    setNotesByPage((current) => ({ ...current, [viewingPageIndex]: notes }));
    if ((submission.pageIndex ?? 0) === viewingPageIndex) {
      setDraft((current) => ({ ...current, editorialNotes: notes }));
    }
  }

  const coverPreviewUrl = resolveMediaUrl(draft.series_cover_image_url);
  const requiresEbSubmit =
    submission.pipeline !== "recurring" && !submission.seriesMeta?.ebApproved;

  return (
    <div className="space-y-6 dark:text-zinc-100">
      <header className="flex flex-wrap items-center gap-3 border-b border-border/60 pb-4">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          <ArrowLeft className="size-4" />
          Cancel
        </Button>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-widest text-sky-500">
            Tantou · Chapter Review
          </p>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {draft.series_name || submission.seriesTitle}
          </h1>
          <p className="text-sm text-muted-foreground">
            Ch. {submission.chapterNum} · {submission.pageLabel} ·{" "}
            {submission.mangakaName}
          </p>
        </div>
        <Badge
          variant={submission.pipeline === "debut" ? "destructive" : "secondary"}
        >
          {submission.pipeline === "debut" ? "Debut" : "Chapter"}
        </Badge>
      </header>

      <div className="space-y-6">
        <div className="flex flex-col gap-5">
          <Card className="border-border/70 dark:bg-zinc-950/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Thông tin truyện</CardTitle>
              <CardDescription>
                Thông tin do Mangaka khai báo khi tạo series.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6 md:flex-row md:items-start md:gap-8">
              <div className="mx-auto w-full max-w-[200px] shrink-0 space-y-2 md:mx-0 md:w-[220px] lg:w-[240px]">
                <Label className="text-sm font-medium">Ảnh bìa</Label>
                <div className="aspect-[3/4] w-full overflow-hidden rounded-xl border border-border/70 bg-muted/30 shadow-sm">
                  {coverPreviewUrl ? (
                    <img
                      src={coverPreviewUrl}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="flex size-full flex-col items-center justify-center gap-3 p-4 text-center text-muted-foreground">
                      <ImageIcon className="size-10 opacity-35" />
                      <span className="text-sm leading-snug">Chưa có ảnh bìa</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid min-w-0 flex-1 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tantou-series-name">Series</Label>
                  <Input
                    id="tantou-series-name"
                    value={draft.series_name}
                    readOnly
                    className="bg-muted/40"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tantou-author-name">Tên tác giả</Label>
                  <Input
                    id="tantou-author-name"
                    value={draft.series_author_name}
                    readOnly
                    placeholder="—"
                    className="bg-muted/40"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tag</Label>
                  <SelectedPills items={draft.series_tags} />
                </div>
                <div className="space-y-2">
                  <Label>Thể loại</Label>
                  <SelectedPills items={draft.series_genre} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tantou-series-synopsis">Mô tả</Label>
                  <Textarea
                    id="tantou-series-synopsis"
                    value={draft.series_synopsis}
                    onChange={(e) =>
                      setDraft((c) => ({
                        ...c,
                        series_synopsis: e.target.value,
                      }))
                    }
                    className="min-h-28 resize-y dark:bg-zinc-900/80"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <ChapterListTable
            rows={chapterRows}
            activeId={submission.id}
            viewingId={viewingChapterId}
            onOpen={handleOpenChapter}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,420px)] xl:items-stretch xl:gap-8">
          <div className="flex min-h-0 flex-col">
            {viewingSubmission ? (
              <TantouPageAnnotator
                ref={readerRef}
                submission={viewingSubmission}
                storyPages={storyPages}
                currentPageIndex={viewingPageIndex}
                onPageIndexChange={handlePageIndexChange}
                pageLabel={currentStoryPage?.pageLabel}
                pageImageUrl={currentStoryPage?.imageUrl}
                mangakaNotes={getMangakaNotesForStoryPage(
                  viewingSubmission,
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
              <div className="flex min-h-[420px] flex-1 items-center justify-center rounded-2xl border border-dashed border-border/80 bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
                Chọn <strong>Mở</strong> trong danh sách chapter để xem trang
                truyện cần nhận xét.
              </div>
            )}
          </div>

          <div className="flex min-h-0 flex-col">
            <ReviewRatingPanel
              draft={draft}
              requiresEbSubmit={requiresEbSubmit}
              onReviewTextChange={(text) =>
                setDraft((c) => ({ ...c, reviewText: text }))
              }
              onStatusChange={(reviewStatus) =>
                setDraft((c) => ({ ...c, reviewStatus }))
              }
              onSendToMangaka={() =>
                onSaveReview(buildPayload(), { submitAction: "reject" })
              }
              onSendToEb={() =>
                onSaveReview(buildPayload(), { submitAction: "publish" })
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
