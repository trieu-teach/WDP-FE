import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, FileText, MessageSquareText, Search, Sparkles } from "lucide-react";
import Header from "@/components/User/Header/Header.jsx";
import Footer from "@/components/User/Footer/Footer.jsx";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSession, logout } from "@/lib/auth.js";
import { seriesService } from "@/api/series.service.js";
import { mangakaProfileService } from "@/api/mangakaProfile.service.js";
import {
  buildTeAnnotationCreatePayload,
  teReviewsService,
} from "@/api/teReviews.service.js";
import { getApiErrorMessage, resolveMediaUrl } from "@/api/http.js";
import { cn } from "@/lib/utils";
import { apiSeriesToUi } from "@/utils/apiMappers.js";
import {
  getPublicationStatusLabel,
  SERIES_PUBLICATION_STATUSES,
} from "@/utils/seriesModel.js";
import {
  LABEL_EDITOR_BOARD,
  LABEL_TANTOU_EDITOR,
  PATH_TANTOU_EDITOR,
} from "@/constants/roleTerminology.js";
import {
  getTantouSection,
  TANTOU_SECTION_IDS,
} from "@/constants/tantouSections.js";
import { TANTOU_NAV_LINKS } from "@/constants/tantouNav.js";
import {
  formatTeChapterPublishError,
  formatTePublishBufferWarning,
  formatTePublishSuccessMessage,
  formatTeScheduledPublishDisplay,
  parseTeActionNextStep,
  parseTePublishBuffer,
  parseTePublishChapterResult,
  phaseToPipeline,
  resolveTePhase,
  resolveTeUiChapterStatus,
  TE_CHAPTER_APPROVED_STATUS,
  TE_UI_AWAITING_PUBLISH,
} from "@/utils/teReviewPhase.js";
import {
  enrichTeSubmissionAssignment,
  flattenTePendingSections,
  isTeChapterLevelSubmission,
  isTeSeriesLevelSubmission,
  mapTePendingChapterToSubmission,
  parseTePendingResponse,
  resolveTeEntityId,
  sortTePendingSubmissionsNewestFirst,
} from "@/utils/teReviewPending.js";
import {
  pushTantouReviewHistory,
  isSeriesEbApproved,
} from "@/utils/tantouWorkspaceStorage.js";
import TantouPageReview from "./TantouPageReview.jsx";
import { TantouPublicationCalendar } from "@/components/Tantou/TantouPublicationCalendar.jsx";
import { TantouReviewHistory } from "@/components/Tantou/TantouReviewHistory.jsx";
import "./TantouEditor.css";

const NAV_LINKS = TANTOU_NAV_LINKS;

const HERO_IMAGES = [
  "/images/editor1.png",
  "/images/editor2.png",
  "/images/editor3.png",
];
const HERO_SLIDE_MS = 5000;

function statusLabel(status) {
  const map = {
    pending: "Chờ duyệt",
    revision: "Đã gửi chỉnh",
    forwarded_eb: `Đã chuyển ${LABEL_EDITOR_BOARD}`,
    awaiting_publish: "Chờ phát hành",
    scheduled: "Đã lên lịch",
    approved_publish: "Đã phát hành",
  };
  return map[status] ?? status;
}

function publicationStatusBadgeClass(status) {
  switch (String(status ?? "").toLowerCase()) {
    case "ongoing":
      return "border-green-200 bg-green-50 text-green-700";
    case "hiatus":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "dropped":
      return "border-red-200 bg-red-50 text-red-700";
    case "completed":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "upcoming":
      return "border-slate-200 bg-slate-50 text-slate-700";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

function statusBadgeClass(status) {
  if (status === "pending") {
    return "border-0 bg-amber-50 text-amber-700";
  }
  if (status === "awaiting_publish") {
    return "border-0 bg-purple-50 text-purple-700";
  }
  if (status === "scheduled") {
    return "border-0 bg-sky-50 text-sky-700";
  }
  if (status === "forwarded_eb" || status === "approved_publish") {
    return "border-0 bg-emerald-50 text-emerald-700";
  }
  if (status === "revision") {
    return "border-0 bg-rose-50 text-rose-700";
  }
  return "border-0 bg-gray-100 text-gray-600";
}

function assignmentBadgeClass(status) {
  if (status === "unassigned") {
    return "border-0 bg-sky-50 text-sky-700";
  }
  if (status === "mine") {
    return "border-0 bg-violet-50 text-violet-700";
  }
  if (status === "other") {
    return "border-0 bg-rose-50 text-rose-700";
  }
  return "border-0 bg-gray-100 text-gray-600";
}

function SubmissionCard({
  sub,
  onReview,
  hideMangakaMeta = false,
}) {
  const canReview = sub.canReview !== false;
  const pageCount = Array.isArray(sub.pagesMeta) && sub.pagesMeta.length > 0
    ? sub.pagesMeta.length
    : 1;
  const chapterLabel = `Chapter ${sub.chapterNum || "?"}`;
  const metaLine = hideMangakaMeta
    ? `${chapterLabel} • ${pageCount} trang`
    : `${chapterLabel} • ${pageCount} trang • ${sub.mangakaName}`;

  return (
    <div
      className={cn(
        "mb-3 flex flex-col items-start justify-between gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm",
        "transition-all duration-150 hover:border-gray-200 sm:flex-row sm:items-center",
        !canReview && "opacity-75",
      )}
    >
      <div className="flex min-w-0 w-full flex-1 items-start gap-3.5 sm:items-center sm:gap-4">
        <div className="h-20 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-100 shadow-sm sm:h-24 sm:w-20">
          {(sub.chapterCoverUrl || sub.mangakaImageUrl) ? (
            <img
              src={sub.chapterCoverUrl || sub.mangakaImageUrl}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center bg-gradient-to-br from-sky-100 to-violet-100 text-lg font-bold text-sky-700/70">
              {(sub.seriesTitle || "?").slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="mb-1 truncate text-base font-semibold text-gray-900">
            {sub.seriesTitle}
          </h3>
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-medium",
                statusBadgeClass(sub.status),
              )}
            >
              {statusLabel(sub.status)}
            </span>
            {sub.teAssignmentStatus ? (
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-medium",
                  assignmentBadgeClass(sub.teAssignmentStatus),
                )}
              >
                {sub.teAssignmentStatus === "unassigned"
                  ? "Chưa ai nhận"
                  : sub.teAssignmentStatus === "mine"
                    ? "Của bạn"
                    : "TE khác"}
              </span>
            ) : null}
          </div>
          <p className="text-xs font-normal text-gray-500">
            {metaLine}
          </p>
          {sub.scheduledPublishAt ? (
            <p className="mt-1 text-[11px] text-sky-600">
              Lịch publish: {formatTeScheduledPublishDisplay(sub.scheduledPublishAt)}
            </p>
          ) : null}
          {sub.teAssignmentLabel ? (
            <p className="mt-1 text-[11px] italic text-gray-400">
              {sub.teAssignmentLabel}
            </p>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        disabled={!canReview}
        className={cn(
          "flex shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-medium text-white shadow-sm transition-colors",
          "hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50",
        )}
        onClick={() => onReview(sub)}
      >
        <MessageSquareText className="size-3.5" />
        Mở & nhận xét
      </button>
    </div>
  );
}

function mangakaGroupKey(sub) {
  const authorId = String(
    sub?.mangakaUserId ?? sub?.seriesMeta?.authorId ?? "",
  ).trim();
  if (authorId) return `id:${authorId}`;
  const name = String(sub?.seriesMeta?.authorName || sub?.mangakaName || "Mangaka").trim();
  return `name:${name.toLowerCase()}`;
}

/** Lấy avatar từ GET /mangaka/profile/:id (profile Mangaka đã chỉnh). */
async function hydrateMangakaAvatarsFromProfiles(items) {
  const list = Array.isArray(items) ? items : [];
  const ids = [
    ...new Set(
      list
        .map((s) => String(s?.mangakaUserId || s?.seriesMeta?.authorId || "").trim())
        .filter(Boolean),
    ),
  ];
  if (!ids.length) return list;

  const avatarById = new Map();
  await Promise.all(
    ids.map(async (id) => {
      try {
        const profile = await mangakaProfileService.getPublicProfile(id);
        const url = String(profile?.user?.avatarUrl ?? "").trim();
        if (url) avatarById.set(id, url);
      } catch {
        // giữ fallback initials nếu profile/avatar không có
      }
    }),
  );
  if (!avatarById.size) return list;

  return list.map((s) => {
    const id = String(s?.mangakaUserId || s?.seriesMeta?.authorId || "").trim();
    const avatar = id ? avatarById.get(id) : null;
    if (!avatar) return s;
    return {
      ...s,
      mangakaAvatarUrl: avatar,
      seriesMeta: {
        ...s.seriesMeta,
        authorAvatarUrl: avatar,
      },
    };
  });
}

function mangakaGroupName(sub) {
  return (
    String(sub?.seriesMeta?.authorName || sub?.mangakaName || "Mangaka").trim()
    || "Mangaka"
  );
}

function MangakaSelectCard({ group, onSelect }) {
  const initials = (
    group.name.length >= 2 ? group.name : `${group.name}●`
  ).slice(0, 2).toUpperCase();

  return (
    <button
      type="button"
      onClick={() => onSelect(group.key)}
      className={cn(
        'group relative cursor-pointer overflow-hidden rounded-xl border border-gray-100 bg-white text-left shadow-sm',
        'transition-all duration-200 hover:-translate-y-1 hover:border-gray-200 hover:shadow-md',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/30',
      )}
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-t-xl bg-gradient-to-br from-sky-50 via-gray-50 to-violet-50">
        {group.coverUrl ? (
          <img
            src={group.coverUrl}
            alt=""
            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-sky-600 text-xl font-bold text-white shadow-lg shadow-sky-900/15">
              {initials}
            </div>
          </div>
        )}
        <span className="absolute right-2 top-2 rounded-full bg-amber-500/90 px-2 py-0.5 text-xs font-bold text-white shadow-sm backdrop-blur-md">
          {group.count}
        </span>
      </div>
      <div className="space-y-1 bg-white p-3">
        <p className="flex items-center gap-2 truncate text-sm font-semibold text-gray-900">
          <span className="group/avatar inline-flex shrink-0">
            <Avatar
              size="sm"
              className={cn(
                'size-6 ring-1 ring-gray-200',
                'transition-all duration-200 ease-out',
                'group-hover/avatar:scale-110 group-hover/avatar:ring-2 group-hover/avatar:ring-sky-400',
              )}
            >
              {group.avatarUrl ? (
                <AvatarImage
                  src={group.avatarUrl}
                  alt=""
                  className="transition-transform duration-300 group-hover/avatar:scale-110"
                />
              ) : null}
              <AvatarFallback className="bg-sky-600 text-[10px] font-bold text-white">
                {initials}
              </AvatarFallback>
            </Avatar>
          </span>
          <span className="truncate">{group.name}</span>
        </p>
        <p className="text-xs text-gray-500">
          {group.count} chapter chờ duyệt
        </p>
      </div>
    </button>
  );
}

export default function TantouEditor() {
  const navigate = useNavigate();
  const { section: sectionId } = useParams();
  const sectionMeta = getTantouSection(sectionId);
  const user = getSession();
  const currentTeId = user?.id ?? null;
  const [submissions, setSubmissions] = useState([]);
  const [pendingSections, setPendingSections] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const [publicationSeries, setPublicationSeries] = useState([]);
  const [publicationLoading, setPublicationLoading] = useState(false);
  const [publicationSearch, setPublicationSearch] = useState("");
  const [publicationStatusFilter, setPublicationStatusFilter] = useState("all");
  const [heroSlide, setHeroSlide] = useState(0);
  const [selectedMangakaKey, setSelectedMangakaKey] = useState(null);

  useEffect(() => {
    if (HERO_IMAGES.length < 2) return undefined;
    const timer = window.setInterval(() => {
      setHeroSlide((index) => (index + 1) % HERO_IMAGES.length);
    }, HERO_SLIDE_MS);
    return () => window.clearInterval(timer);
  }, []);

  const needsQueue =
    sectionId === "series-pending"
    || sectionId === "series-approved";
  const needsPublication = sectionId === "publication-status";

  const refresh = useCallback(() => setTick((n) => n + 1), []);

  const loadPublicationSeries = useCallback(async () => {
    setPublicationLoading(true);
    try {
      // Lấy series đã có publication_status (upcoming/ongoing/hiatus/completed/dropped)
      const statuses = ["upcoming", "ongoing", "hiatus", "completed", "dropped"];
      const batches = await Promise.all(
        statuses.map((publication_status) =>
          seriesService.getAll({ publication_status }).catch(() => null),
        ),
      );
      const byId = new Map();
      for (const batch of batches) {
        const list = Array.isArray(batch)
          ? batch
          : (Array.isArray(batch?.items) ? batch.items : (Array.isArray(batch?.data) ? batch.data : []));
        for (const raw of list) {
          const ui = apiSeriesToUi(raw);
          if (!ui?.id) continue;
          byId.set(String(ui.id), {
            id: String(ui.id),
            title: ui.title,
            publicationStatus: ui.publicationStatus,
            coverImage: ui.coverImage,
          });
        }
      }
      setPublicationSeries(
        [...byId.values()].sort((a, b) =>
          String(a.title).localeCompare(String(b.title), "vi"),
        ),
      );
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không tải được trạng thái phát hành."));
      setPublicationSeries([]);
    } finally {
      setPublicationLoading(false);
    }
  }, []);

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
          const base = baseMapped[index];
          if (!chapterId) {
            return enrichTeQueueItemWithSeriesDetail(base);
          }
          let preview = null;
          try {
            preview = await teReviewsService.getAllChapterPages(chapterId);
          } catch {
            preview = null;
          }
          const remapped = enrichTeSubmissionAssignment(
            mapTePendingChapterToSubmission(
              entry.chapter,
              entry.series,
              entry.tabType,
              preview,
            ),
            currentTeId,
          );
          // Giữ ảnh bìa đã có từ pending — đừng để preview pages ghi đè thành ảnh trang.
          const chapterCoverUrl =
            remapped.chapterCoverUrl
            || base?.chapterCoverUrl
            || null;
          const mangakaImageUrl =
            chapterCoverUrl
            || remapped.mangakaImageUrl
            || base?.mangakaImageUrl
            || null;
          const mangakaAvatarUrl =
            remapped.mangakaAvatarUrl
            || base?.mangakaAvatarUrl
            || remapped.seriesMeta?.authorAvatarUrl
            || base?.seriesMeta?.authorAvatarUrl
            || null;
          return enrichTeQueueItemWithSeriesDetail({
            ...remapped,
            chapterCoverUrl,
            mangakaImageUrl,
            mangakaUserId:
              remapped.mangakaUserId
              || base?.mangakaUserId
              || remapped.seriesMeta?.authorId
              || base?.seriesMeta?.authorId
              || null,
            mangakaAvatarUrl,
            seriesMeta: {
              ...remapped.seriesMeta,
              authorId:
                remapped.seriesMeta?.authorId
                || remapped.mangakaUserId
                || base?.seriesMeta?.authorId
                || base?.mangakaUserId
                || "",
              authorAvatarUrl:
                remapped.seriesMeta?.authorAvatarUrl
                || mangakaAvatarUrl
                || null,
            },
          });
        }),
      );
      const withAvatars = await hydrateMangakaAvatarsFromProfiles(enriched);
      setSubmissions(withAvatars);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không tải được hàng chờ Tantou."));
      setSubmissions([]);
      setPendingSections(null);
      setLoading(false);
    }
  }, [currentTeId]);

  useEffect(() => {
    if (!needsQueue) return;
    void loadQueue();
  }, [loadQueue, tick, needsQueue]);

  useEffect(() => {
    if (!needsPublication) return;
    void loadPublicationSeries();
  }, [loadPublicationSeries, tick, needsPublication]);

  const selected = useMemo(
    () => submissions.find((s) => s.id === selectedId) ?? null,
    [submissions, selectedId],
  );

  const filteredPublicationSeries = useMemo(() => {
    const query = publicationSearch.trim().toLowerCase();
    return publicationSeries.filter((row) => {
      if (
        publicationStatusFilter !== "all"
        && row.publicationStatus !== publicationStatusFilter
      ) {
        return false;
      }
      if (!query) return true;
      return String(row.title ?? "").toLowerCase().includes(query);
    });
  }, [publicationSeries, publicationSearch, publicationStatusFilter]);

  const debutQueue = useMemo(
    () =>
      sortTePendingSubmissionsNewestFirst(
        submissions.filter((s) => isTeSeriesLevelSubmission(s)),
      ),
    [submissions],
  );

  const debutByMangaka = useMemo(() => {
    const map = new Map();
    for (const sub of debutQueue) {
      const key = mangakaGroupKey(sub);
      const name = mangakaGroupName(sub);
      if (!map.has(key)) {
        map.set(key, {
          key,
          name,
          coverUrl: null,
          avatarUrl: null,
          chapters: [],
        });
      }
      const group = map.get(key);
      group.chapters.push(sub);
      if (!group.avatarUrl) {
        group.avatarUrl =
          sub.mangakaAvatarUrl
          || sub.seriesMeta?.authorAvatarUrl
          || null;
      }
      if (!group.coverUrl) {
        group.coverUrl =
          sub.chapterCoverUrl
          || sub.seriesMeta?.coverImageUrl
          || sub.mangakaImageUrl
          || null;
      }
    }
    return [...map.values()]
      .map((g) => ({ ...g, count: g.chapters.length }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "vi"));
  }, [debutQueue]);

  const selectedMangakaGroup = useMemo(
    () => debutByMangaka.find((g) => g.key === selectedMangakaKey) ?? null,
    [debutByMangaka, selectedMangakaKey],
  );

  useEffect(() => {
    if (!selectedMangakaKey) return;
    if (!debutByMangaka.some((g) => g.key === selectedMangakaKey)) {
      setSelectedMangakaKey(null);
    }
  }, [debutByMangaka, selectedMangakaKey]);

  useEffect(() => {
    setSelectedMangakaKey(null);
  }, [sectionId]);

  const recurringQueue = useMemo(
    () =>
      sortTePendingSubmissionsNewestFirst(
        submissions.filter(
          (s) =>
            isTeChapterLevelSubmission(s)
            && (
              s.status === "pending"
              || s.status === "revision"
              // Đã duyệt (approved_by_EB) — vẫn hiện để TE vào lại bấm Phát hành
              || s.status === TE_UI_AWAITING_PUBLISH
            ),
        ),
      ),
    [submissions],
  );

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
        mangakaAvatarUrl:
          (authorObj && typeof authorObj === "object"
            ? resolveMediaUrl(authorObj.avatar_url ?? authorObj.avatarUrl ?? null)
            : null)
          || mapped.mangakaAvatarUrl
          || null,
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
          authorAvatarUrl:
            (authorObj && typeof authorObj === "object"
              ? resolveMediaUrl(authorObj.avatar_url ?? authorObj.avatarUrl ?? null)
              : null)
            || mapped.seriesMeta?.authorAvatarUrl
            || mapped.mangakaAvatarUrl
            || null,
          seriesApiStatus: series?.status ?? mapped.seriesMeta.seriesApiStatus,
          publicationStatus:
            series?.publication_status
            ?? mapped.seriesMeta?.publicationStatus
            ?? null,
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
        publicationStatus: series.publicationStatus ?? raw?.publication_status ?? null,
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
    const scheduledPublishAt = String(
      options.scheduled_publish_at ?? reviewData.scheduled_publish_at ?? "",
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
        toast.success("Đã lưu nháp đánh giá series.");
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

      // Phát hành riêng (POST .../publish) — chỉ khi approved_by_EB
      // Chapter đầu: kèm scheduled_publish_at. Chapter 2+: body rỗng — BE/job cadence.
      if (nextStatus === "release" || reviewData.publishOnly) {
        try {
          const res = await teReviewsService.publishChapter(
            nextChapterId,
            scheduledPublishAt
              ? { scheduled_publish_at: scheduledPublishAt }
              : {},
          );
          const buffer = parseTePublishBuffer(res);
          toast.success(
            formatTePublishSuccessMessage(res, {
              seriesName: nextSeriesName,
              chapterNumber: nextChapterNumber,
              buffer,
            }),
          );

          const bufferWarning = formatTePublishBufferWarning(buffer);
          if (bufferWarning) {
            toast.warning(bufferWarning, { duration: 8000 });
          }

          const chapterResult = parseTePublishChapterResult(res);
          const nextApiStatus =
            chapterResult.apiChapterStatus || TE_CHAPTER_APPROVED_STATUS;
          const nextUiStatus = resolveTeUiChapterStatus({
            apiStatus: nextApiStatus,
            isScheduled: chapterResult.isScheduled,
            scheduledPublishAt: chapterResult.scheduledPublishAt,
          });

          pushTantouReviewHistory({
            id: `${nextChapterId}-${Date.now()}`,
            chapterId: nextChapterId,
            chapterNumber: nextChapterNumber,
            seriesName: nextSeriesName,
            authorName: nextSeriesAuthorName,
            status: "publish",
            averageScore: nextAverage,
            feedback: nextText,
            reviewedAt: new Date().toISOString(),
          });

          setSubmissions((prev) =>
            prev.map((s) => {
              const id = String(s.chapterId ?? s.id);
              if (id !== nextChapterId && s.id !== selected.id) return s;
              return {
                ...s,
                apiChapterStatus: nextApiStatus,
                status: nextUiStatus,
                isScheduled: chapterResult.isScheduled,
                scheduledPublishAt: chapterResult.scheduledPublishAt,
                publishedAt: chapterResult.publishedAt,
              };
            }),
          );

          setReviewOpen(false);
          refresh();
        } catch (err) {
          toast.error(formatTeChapterPublishError(err));
        }
        return;
      }

      if (nextStatus === "publish" || nextStatus === "reject") {
        const seriesLevel = submissionIsSeriesLevel(selected);
        const action = nextStatus === "reject" ? "reject" : "approve";
        const rejectNotes = [nextText, nextRevisionFeedback]
          .filter(Boolean)
          .flatMap((t) => t.split("\n").map((l) => l.trim()).filter(Boolean));
        const noteLines = rejectNotes.length
          ? rejectNotes
          : (nextText ? [nextText] : []);

        // Giai đoạn 2 (series đã EB-approved): CHỈ te-action — BE auto-claim nếu te_id null
        if (!seriesLevel) {
          const res = await teReviewsService.teAction(nextChapterId, {
            action,
            ...(noteLines.length ? { notes: noteLines } : {}),
          });

          if (action === "approve") {
            setSubmissions((prev) =>
              prev.map((s) => {
                const id = String(s.chapterId ?? s.id);
                if (id !== nextChapterId && s.id !== selected.id) return s;
                return {
                  ...s,
                  apiChapterStatus: TE_CHAPTER_APPROVED_STATUS,
                  status: TE_UI_AWAITING_PUBLISH,
                  teId: currentTeId ?? s.teId,
                  teAssignmentStatus: "mine",
                  canReview: true,
                  teAssignmentLabel: "Đang review chapter của bạn",
                };
              }),
            );

            const nextStep = parseTeActionNextStep(res);
            const publishHint =
              !nextStep || nextStep.action === "publish"
                ? " Bấm Phát hành để lên lịch xuất bản."
                : "";
            toast.success(
              res?.message
                ?? `Đã phê duyệt "${nextSeriesName}"${
                  nextChapterNumber ? ` · Ch.${nextChapterNumber}` : ""
                }.${publishHint}`,
            );
            // Giữ workspace mở — TE bấm Phát hành (POST .../publish) riêng
            return;
          }

          toast.success(
            res?.message ?? "Đã yêu cầu Mangaka sửa chapter.",
          );
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
          return;
        }

        // Giai đoạn 1: review-chapter vẫn gộp approve + gửi EB như cũ (không đổi)
        if (!nextSeriesId) {
          toast.error("Thiếu series_id để gửi review.");
          return;
        }

        if ((nextText || nextQuickNotes) && action === "approve") {
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
            `Đã phê duyệt và gửi EB "${nextSeriesName}"${
              nextChapterNumber ? ` · Ch.${nextChapterNumber}` : ""
            }.`,
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
      const status = err?.response?.status;
      const isPublish =
        nextStatus === "release" || reviewData.publishOnly;
      const fallback = isPublish
        ? formatTeChapterPublishError(err)
        : err?.code === "TE_ASSIGNED_OTHER" || status === 403
          ? (err?.message
            || "Chapter này đã được gán cho TE khác.")
          : "Không lưu được review.";
      toast.error(
        isPublish
          ? fallback
          : getApiErrorMessage(err, fallback),
      );
    } finally {
      setSaving(false);
    }
  }

  if (!sectionMeta || !TANTOU_SECTION_IDS.includes(sectionId)) {
    return <Navigate to={PATH_TANTOU_EDITOR} replace />;
  }

  if (reviewOpen && selected) {
    return (
      <div className="relative flex min-h-screen flex-col bg-gray-50">
        <Header
          links={NAV_LINKS}
          onLogout={user ? handleLogout : undefined}
          className="relative z-50"
        />
        <main className="page-container relative z-0 flex-1 overflow-x-hidden py-6 md:py-8">
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
    <div className="ws-page--tantou flex min-h-screen flex-col bg-gray-50">
      <Header links={NAV_LINKS} onLogout={user ? handleLogout : undefined} />

      <section className="ws-hero--tantou te-hero-slideshow te-hero-section relative overflow-hidden text-white">
        <div className="te-hero-slides" aria-hidden>
          {HERO_IMAGES.map((src, index) => (
            <img
              key={src}
              src={src}
              alt=""
              className={cn(
                "te-hero-slides__img",
                index === heroSlide && "te-hero-slides__img--active",
              )}
            />
          ))}
        </div>
        <div
          className="absolute inset-0 z-[1] bg-gradient-to-r from-black/80 via-black/50 to-transparent"
          aria-hidden
        />
        <div className="page-container relative z-[2] pb-10 pt-8 md:pb-12 md:pt-10">
          <div className="max-w-2xl space-y-2.5">
            <Badge
              variant="secondary"
              className="border-0 bg-white/15 px-2.5 py-0.5 text-[10px] font-medium tracking-wide text-white hover:bg-white/20"
            >
              {LABEL_TANTOU_EDITOR}
            </Badge>
            <h1 className="text-2xl font-bold tracking-tight text-white drop-shadow-sm md:text-3xl">
              {sectionMeta.title}
            </h1>
            {sectionMeta.description ? (
              <p className="max-w-xl text-sm leading-relaxed text-white/85 md:text-[15px]">
                {sectionMeta.description}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <main className="page-container flex-1 space-y-5 py-6 md:py-8">
        <Link
          to={PATH_TANTOU_EDITOR}
          className="mb-4 flex items-center gap-1 text-xs text-gray-500 transition-colors hover:text-gray-900"
        >
          <ArrowLeft className="size-3.5" />
          Về khu vực làm việc
        </Link>

        {sectionId === "series-pending" ? (
          <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-5 py-4 sm:px-6">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  {selectedMangakaGroup ? (
                    <span className="group/avatar inline-flex shrink-0">
                      <Avatar
                        className={cn(
                          "size-9 rounded-full shadow-sm shadow-sky-900/20 ring-1 ring-gray-200",
                          "transition-all duration-200 ease-out",
                          "group-hover/avatar:scale-110 group-hover/avatar:ring-2 group-hover/avatar:ring-sky-400",
                        )}
                      >
                        {selectedMangakaGroup.avatarUrl ? (
                          <AvatarImage
                            src={selectedMangakaGroup.avatarUrl}
                            alt=""
                            className="transition-transform duration-300 group-hover/avatar:scale-110"
                          />
                        ) : null}
                        <AvatarFallback className="rounded-full bg-sky-600 text-sm font-bold text-white">
                          {(selectedMangakaGroup.name.length >= 2
                            ? selectedMangakaGroup.name
                            : `${selectedMangakaGroup.name}●`
                          ).slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </span>
                  ) : (
                    <span className="flex size-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                      <Sparkles className="size-4" />
                    </span>
                  )}
                  <h2 className="truncate text-lg font-semibold tracking-tight text-gray-900 sm:text-xl">
                    {selectedMangakaGroup
                      ? selectedMangakaGroup.name
                      : "Chọn Mangaka"}
                  </h2>
                  <span
                    className={cn(
                      "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-semibold",
                      selectedMangakaGroup
                        ? "bg-amber-500 text-white"
                        : "bg-gray-100 text-gray-700",
                    )}
                  >
                    {selectedMangakaGroup
                      ? selectedMangakaGroup.count
                      : (debutQueue.length || pendingSections?.seriesLevel?.count || 0)}
                  </span>
                </div>
                {!selectedMangakaGroup ? (
                  <p className="text-xs text-gray-500 sm:text-sm">
                    Chọn Mangaka để xem chapter đang chờ duyệt.
                  </p>
                ) : (
                  <p className="text-xs text-gray-500 sm:text-sm">
                    {selectedMangakaGroup.count} chapter chờ duyệt từ Mangaka này.
                  </p>
                )}
              </div>
              {selectedMangakaGroup ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 shrink-0 gap-1.5 border-gray-200 bg-white shadow-sm hover:bg-gray-50"
                  onClick={() => setSelectedMangakaKey(null)}
                >
                  <ArrowLeft className="size-4" />
                  Tất cả Mangaka
                </Button>
              ) : null}
            </div>

            <div className="scrollbar-hide max-h-[min(640px,calc(100vh-240px))] overflow-y-auto">
              {debutQueue.length === 0 ? (
                <div className="px-6 py-16 text-center text-sm text-gray-500">
                  {loading ? "Đang tải hàng chờ..." : "Không có series chờ duyệt."}
                </div>
              ) : selectedMangakaGroup ? (
                <div className="space-y-2.5 p-4 sm:p-5">
                  {selectedMangakaGroup.chapters.map((sub) => (
                    <SubmissionCard
                      key={sub.id}
                      sub={sub}
                      onReview={openReview}
                      hideMangakaMeta
                    />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-5 p-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {debutByMangaka.map((group) => (
                    <MangakaSelectCard
                      key={group.key}
                      group={group}
                      onSelect={setSelectedMangakaKey}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        ) : null}

        {sectionId === "series-approved" ? (
          <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 sm:px-6">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                    <FileText className="size-4" />
                  </span>
                  <h2 className="text-lg font-semibold tracking-tight text-gray-900">
                    Chapter chờ duyệt
                  </h2>
                  <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-gray-100 px-2 text-xs font-semibold text-gray-700">
                    {recurringQueue.length}
                  </span>
                </div>
                <p className="text-xs text-gray-500 sm:text-sm">
                  Series đã được Hội đồng chấp nhận — mở chapter để nhận xét và phát hành.
                </p>
              </div>
            </div>
            <div className="p-4 sm:p-5">
              {recurringQueue.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 px-6 py-14 text-center text-sm text-gray-500">
                  {loading ? "Đang tải hàng chờ..." : "Không có chapter chờ duyệt."}
                </div>
              ) : (
                recurringQueue.map((sub) => (
                  <SubmissionCard
                    key={sub.id}
                    sub={sub}
                    onReview={openReview}
                  />
                ))
              )}
            </div>
          </section>
        ) : null}

        {sectionId === "publication-status" ? (
          <>
            <section className="space-y-3">
              <div>
                <h2 className="text-xl font-semibold">Trạng thái phát hành</h2>
                <p className="text-sm text-muted-foreground">
                  Xem trạng thái series sau khi đã phát hành: đang phát hành, tạm ngưng, hoàn thành hoặc bị drop.
                </p>
              </div>

              <div className="flex flex-col gap-2.5 rounded-xl border border-border/70 bg-card/60 p-3 sm:flex-row sm:items-center">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Tìm series..."
                    className="h-9 pl-9"
                    value={publicationSearch}
                    onChange={(e) => setPublicationSearch(e.target.value)}
                    aria-label="Tìm kiếm series"
                  />
                </div>
                <Select
                  value={publicationStatusFilter}
                  onValueChange={setPublicationStatusFilter}
                >
                  <SelectTrigger className="h-9 w-full border-gray-300 text-sm sm:w-52">
                    <SelectValue placeholder="Tất cả trạng thái" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả trạng thái</SelectItem>
                    {SERIES_PUBLICATION_STATUSES.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {publicationLoading && publicationSeries.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    Đang tải trạng thái phát hành...
                  </CardContent>
                </Card>
              ) : publicationSeries.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    Chưa có series có publication_status.
                  </CardContent>
                </Card>
              ) : filteredPublicationSeries.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    Không có series khớp bộ lọc.
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {filteredPublicationSeries.map((row) => (
                      <Card key={row.id} className="border-border/70 shadow-none">
                        <CardContent className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
                          <div
                            className="h-14 w-10 shrink-0 overflow-hidden bg-muted"
                            style={{ aspectRatio: "3 / 4", borderRadius: 4 }}
                          >
                            {row.coverImage ? (
                              <img
                                src={row.coverImage}
                                alt=""
                                className="size-full object-cover"
                              />
                            ) : (
                              <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
                                📚
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="truncate text-[15px] font-semibold leading-snug">
                                {row.title}
                              </h3>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                                  publicationStatusBadgeClass(row.publicationStatus),
                                )}
                              >
                                {getPublicationStatusLabel(row.publicationStatus)}
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : null}

        {sectionId === "history" ? <TantouReviewHistory /> : null}

        {sectionId === "schedule" ? <TantouPublicationCalendar /> : null}
      </main>

      <Footer />
    </div>
  );
}

