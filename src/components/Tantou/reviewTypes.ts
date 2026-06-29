export type ReviewStatus = "draft" | "reject" | "publish";

export type RatingKey =
  | "pacingContent"
  | "visualArt"
  | "layoutStoryboard"
  | "localizationTech";

export type ReviewRatings = Record<RatingKey, number>;

export type PageNote = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  taskType: string;
};

export type TantouSubmission = {
  id: string;
  seriesId?: string | null;
  seriesTitle: string;
  chapterId?: string;
  chapterNum: string;
  pageIndex?: number;
  pageLabel: string;
  mangakaImageUrl?: string;
  mangakaNotes?: Array<{
    id?: string;
    x?: number;
    y?: number;
    w?: number;
    h?: number;
    text?: string;
    taskType?: string;
  }>;
  editorialNotes?: PageNote[];
  editorialNotesByPage?: Record<number, PageNote[]>;
  mangakaName?: string;
  /** Nhóm pending từ GET /te-reviews/pending */
  tabType?: "series_level" | "chapter_level";
  /** Alias — giữ tương thích UI cũ */
  phase?: "series_level" | "chapter_level";
  pipeline?: "debut" | "recurring";
  status?: string;
  /** Status gốc từ BE (pending_TE, approved_by_EB, …) */
  apiChapterStatus?: string;
  /** TE được gán review chapter (null = chưa ai nhận) */
  teId?: string | null;
  teAssignedAt?: string | null;
  teAssignmentStatus?: "unassigned" | "mine" | "other";
  teAssignmentLabel?: string;
  /** false khi chapter.te_id thuộc TE khác */
  canReview?: boolean;
  sentAt?: string;
  reviewedAt?: string;
  forwardedAt?: string;
  reviewText?: string;
  editorialComment?: string;
  reviewStatus?: ReviewStatus;
  reviewRatings?: Partial<ReviewRatings> & Record<string, number>;
  chapterTitle?: string;
  pagesMeta?: Array<{
    _id?: string;
    id?: string;
    page_number?: number;
    pageIndex?: number;
    annotation_count?: number;
    result_image_url?: string;
    original_image_url?: string;
    final_image_url?: string;
    image_url?: string;
    url?: string;
    imageUrl?: string;
    width?: number;
    height?: number;
    status?: string;
    annotations?: unknown[];
  }>;
  seriesMeta?: {
    genres?: string[];
    tags?: string[];
    formatLabel?: string;
    authorName?: string;
    authorId?: string;
    synopsis?: string;
    coverImageUrl?: string;
    seriesApiStatus?: string | null;
    ebApproved?: boolean;
  };
};

export type ReviewDraft = {
  chapter_id: string;
  chapter_number: string;
  chapter_title: string;
  series_id: string;
  series_name: string;
  series_genre: string[];
  series_tags: string[];
  series_synopsis: string;
  series_cover_image_url: string;
  series_author_id: string;
  series_author_name: string;
  reviewText: string;
  quickNotes?: string;
  revisionFeedback?: string;
  reviewStatus: ReviewStatus;
  ratings: ReviewRatings;
  editorialNotes: PageNote[];
};

export type ReviewSavePayload = ReviewDraft & {
  averageScore: number;
  coverImageUrl?: string;
  editorialNotesByPage?: Record<number, PageNote[]>;
  pagesMeta?: TantouSubmission["pagesMeta"];
  chapterApiStatus?: string;
  publishOnly?: boolean;
};

export type StoryPage = {
  pageIndex: number;
  pageLabel: string;
  imageUrl?: string;
};

export type ChapterRow = {
  id: string;
  index: number;
  name: string;
  releaseDate: string;
  status: string;
};
