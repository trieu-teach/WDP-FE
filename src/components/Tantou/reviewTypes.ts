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
  pipeline?: "debut" | "recurring";
  status?: string;
  sentAt?: string;
  reviewedAt?: string;
  forwardedAt?: string;
  reviewText?: string;
  editorialComment?: string;
  reviewStatus?: ReviewStatus;
  reviewRatings?: Partial<ReviewRatings> & Record<string, number>;
  seriesMeta?: {
    genres?: string[];
    formatLabel?: string;
    authorName?: string;
    synopsis?: string;
  };
};

export type ReviewDraft = {
  storyTitle: string;
  authorName: string;
  synopsis: string;
  genres: string[];
  reviewText: string;
  reviewStatus: ReviewStatus;
  ratings: ReviewRatings;
  editorialNotes: PageNote[];
};

export type ReviewSavePayload = ReviewDraft & {
  averageScore: number;
  coverImageUrl?: string;
  editorialNotesByPage?: Record<number, PageNote[]>;
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
