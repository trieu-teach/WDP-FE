import {
  readMangakaWorkspace,
  resolveAnnotatorChapter,
} from "@/utils/mangakaWorkspaceReader.js";
import type {
  PageNote,
  RatingKey,
  ReviewDraft,
  ReviewRatings,
  StoryPage,
  TantouSubmission,
} from "./reviewTypes";

export const RATING_MAX = 5;

export const RATING_KEYS: RatingKey[] = [
  "pacingContent",
  "visualArt",
  "layoutStoryboard",
  "localizationTech",
];

export function clampRating(value: unknown): number {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return 0;
  const stepped = Math.round(parsed * 2) / 2;
  return Math.min(RATING_MAX, Math.max(0, stepped));
}

export function migrateRatings(
  raw: Partial<ReviewRatings> & Record<string, number> = {},
): ReviewRatings {
  if (raw.pacingContent != null || raw.visualArt != null) {
    return {
      pacingContent: clampRating(raw.pacingContent),
      visualArt: clampRating(raw.visualArt),
      layoutStoryboard: clampRating(raw.layoutStoryboard),
      localizationTech: clampRating(raw.localizationTech),
    };
  }
  return {
    pacingContent: clampRating(raw.pacing ?? raw.plot),
    visualArt: clampRating(raw.style),
    layoutStoryboard: clampRating(raw.layout ?? raw.character),
    localizationTech: clampRating(raw.localization ?? raw.character),
  };
}

export function averageRatings(ratings: ReviewRatings): number {
  const values = RATING_KEYS.map((key) => clampRating(ratings[key]));
  const total = values.reduce((sum, value) => sum + value, 0);
  return values.length ? total / values.length : 0;
}

export function normalizePageNotes(raw: unknown): PageNote[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((n) => n && typeof n === "object")
    .map((n, index) => ({
      id: String((n as PageNote).id ?? `en-${index}`),
      x: Number((n as PageNote).x) || 0,
      y: Number((n as PageNote).y) || 0,
      w: Number((n as PageNote).w) || 0,
      h: Number((n as PageNote).h) || 0,
      text: String((n as PageNote).text ?? ""),
      taskType: String((n as PageNote).taskType ?? "other"),
    }));
}

export function createReviewDraft(submission: TantouSubmission | null): ReviewDraft {
  return {
    storyTitle: submission?.seriesTitle ?? "",
    authorName:
      submission?.seriesMeta?.authorName ?? submission?.mangakaName ?? "",
    synopsis: submission?.seriesMeta?.synopsis ?? "",
    genres: Array.isArray(submission?.seriesMeta?.genres)
      ? [...submission.seriesMeta.genres]
      : [],
    reviewText:
      submission?.reviewText ?? submission?.editorialComment ?? "",
    reviewStatus: submission?.reviewStatus ?? "draft",
    ratings: migrateRatings(submission?.reviewRatings),
    editorialNotes: normalizePageNotes(submission?.editorialNotes),
  };
}

export function formatReleaseDate(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function isColoredSeries(submission: TantouSubmission | null): boolean {
  const label = submission?.seriesMeta?.formatLabel?.toLowerCase() ?? "";
  return label.includes("webtoon") || label.includes("color");
}

export function findNextPendingSubmission(
  submissions: TantouSubmission[],
  currentId: string,
  seriesTitle?: string,
): TantouSubmission | null {
  const pool = submissions
    .filter((s) => s.status === "pending")
    .filter((s) => !seriesTitle || s.seriesTitle === seriesTitle)
    .sort(
      (a, b) =>
        new Date(a.sentAt ?? 0).getTime() - new Date(b.sentAt ?? 0).getTime(),
    );

  if (pool.length === 0) return null;

  const currentIndex = pool.findIndex((s) => s.id === currentId);
  if (currentIndex >= 0 && currentIndex < pool.length - 1) {
    return pool[currentIndex + 1];
  }

  const fallback = pool.find((s) => s.id !== currentId);
  return fallback ?? null;
}

export function isSameChapter(
  a: TantouSubmission,
  b: TantouSubmission,
): boolean {
  if (a.seriesTitle !== b.seriesTitle) return false;
  if (a.chapterId && b.chapterId) return a.chapterId === b.chapterId;
  return String(a.chapterNum) === String(b.chapterNum);
}

export function getChapterPageSubmissions(
  submissions: TantouSubmission[],
  anchor: TantouSubmission,
): TantouSubmission[] {
  return submissions
    .filter((s) => isSameChapter(s, anchor))
    .sort((a, b) => (a.pageIndex ?? 0) - (b.pageIndex ?? 0));
}

export type ChapterGroup = {
  chapterKey: string;
  chapterNum: string;
  representativeSubmissionId: string;
  sentAt?: string;
  status: string;
};

export function groupSubmissionsByChapter(
  submissions: TantouSubmission[],
  seriesTitle: string,
): ChapterGroup[] {
  const map = new Map<string, TantouSubmission[]>();
  for (const sub of submissions.filter((s) => s.seriesTitle === seriesTitle)) {
    const key = sub.chapterId ?? `num:${sub.chapterNum}`;
    const list = map.get(key) ?? [];
    list.push(sub);
    map.set(key, list);
  }
  return Array.from(map.entries())
    .map(([chapterKey, subs]) => {
      subs.sort((a, b) => (a.pageIndex ?? 0) - (b.pageIndex ?? 0));
      const rep =
        subs.find((s) => s.status === "pending") ?? subs[subs.length - 1];
      return {
        chapterKey,
        chapterNum: subs[0].chapterNum,
        representativeSubmissionId: rep.id,
        sentAt: rep.sentAt ?? rep.reviewedAt ?? rep.forwardedAt,
        status: rep.status ?? "pending",
      };
    })
    .sort(
      (a, b) =>
        Number(a.chapterNum) - Number(b.chapterNum) ||
        a.chapterNum.localeCompare(b.chapterNum, "vi"),
    );
}

export function resolveStoryPagesForSubmission(
  submission: TantouSubmission,
): StoryPage[] {
  const ws = readMangakaWorkspace();
  const chapterRow =
    ws.chapterRows?.find(
      (row) =>
        (submission.chapterId &&
          String(row.id) === String(submission.chapterId)) ||
        (row.series === submission.seriesTitle &&
          String(row.num) === String(submission.chapterNum)),
    ) ?? null;
  const chapter =
    resolveAnnotatorChapter(chapterRow, ws.annotatorChapters ?? []) ??
    ws.annotatorChapters?.find(
      (ch) =>
        (submission.chapterId && ch.id === submission.chapterId) ||
        (ch.series === submission.seriesTitle &&
          String(ch.num) === String(submission.chapterNum)),
    );
  if (!chapter?.pages?.length) return [];
  return chapter.pages.map((page, index) => ({
    pageIndex: index,
    pageLabel: page.name?.trim() || `Trang ${index + 1}`,
    imageUrl: page.url ?? undefined,
  }));
}

export function getMangakaNotesForStoryPage(
  submission: TantouSubmission,
  pageIndex: number,
): PageNote[] {
  const ws = readMangakaWorkspace();
  if (submission.chapterId) {
    const fromWorkspace = ws.annotatorNotes?.[`${submission.chapterId}-${pageIndex}`];
    if (Array.isArray(fromWorkspace) && fromWorkspace.length) {
      return normalizePageNotes(fromWorkspace);
    }
  }
  if (
    (submission.pageIndex ?? 0) === pageIndex &&
    submission.mangakaNotes?.length
  ) {
    return normalizePageNotes(submission.mangakaNotes);
  }
  return [];
}

export function resolveStoryPagesForChapter(
  submission: TantouSubmission,
  relatedSubmissions: TantouSubmission[],
): StoryPage[] {
  const fromWorkspace = resolveStoryPagesForSubmission(submission);
  if (fromWorkspace.length) return fromWorkspace;
  const pageSubs = getChapterPageSubmissions(relatedSubmissions, submission);
  if (pageSubs.length) {
    return pageSubs.map((sub) => ({
      pageIndex: sub.pageIndex ?? 0,
      pageLabel: sub.pageLabel || `Trang ${(sub.pageIndex ?? 0) + 1}`,
      imageUrl: sub.mangakaImageUrl,
    }));
  }
  return [
    {
      pageIndex: submission.pageIndex ?? 0,
      pageLabel: submission.pageLabel || `Trang ${(submission.pageIndex ?? 0) + 1}`,
      imageUrl: submission.mangakaImageUrl,
    },
  ];
}
