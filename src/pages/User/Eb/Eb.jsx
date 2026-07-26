import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Gavel,
  History,
  Maximize2,
  Plus,
  Star,
} from "lucide-react";
import Header from "@/components/User/Header/Header.jsx";
import Footer from "@/components/User/Footer/Footer.jsx";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSession, logout } from "@/lib/auth.js";
import { cn } from "@/lib/utils";
import { ebEvaluationsService } from "@/api/ebEvaluations.service.js";
import { ebScoresService } from "@/api/ebScores.service.js";
import { mangakaProfileService } from "@/api/mangakaProfile.service.js";
import { getApiErrorMessage } from "@/api/http.js";
import { updateSeriesEbAssessmentInWorkspace } from "@/utils/mangakaWorkspaceReader.js";
import { placeholderPageDataUrl } from "@/utils/placeholderPageDataUrl.js";
import { LABEL_EDITOR_BOARD } from "@/constants/roleTerminology.js";
import {
  EB_SCORE_CRITERIA,
  EB_SCORE_MAX,
  EB_COUNCIL_MIN_FOR_PUBLISH,
  buildEmptyEbComments,
  buildEmptyEbScores,
  buildMemberScoresPayload,
  clampEbScore,
  formatEbClassification,
  mapEbChapterDetailResponse,
  mapEbChapterPendingItem,
  mapEbChapterPreviewResponse,
  mapEbSeriesPendingItem,
  normalizeEbEvaluateResponse,
  normalizeMemberCommentsMap,
  normalizeMemberScoreMap,
  validateEbScore,
  validateMemberScoresPayload,
} from "@/utils/ebEvaluationMappers.js";
import {
  addCouncilMember,
  buildCouncilAggregate,
  isEbChapterFullyScored,
  readCouncilRoster,
  readCouncilSeriesScores,
  saveCouncilMemberAssessment,
} from "@/utils/ebCouncilStorage.js";
import "./Eb.css";

const NAV_LINKS = [
  { to: "/", label: "Trang chủ" },
];

const HERO_IMAGES = [
  "/images/eb1.png",
  "/images/eb2.png",
  "/images/eb3.png",
  "/images/eb4.png",
];
const HERO_SLIDE_MS = 5000;

const SCORE_FIELDS = EB_SCORE_CRITERIA;
const SCORE_MAX = EB_SCORE_MAX;
const SCORE_STEP = 0.5;

function clampScore(value) {
  return clampEbScore(value);
}

function validateScore(value) {
  return validateEbScore(value);
}

function buildInitialNotes() {
  return buildEmptyEbComments();
}

function buildInitialScores() {
  return buildEmptyEbScores();
}

function buildEmptyScoreErrors() {
  return Object.fromEntries(SCORE_FIELDS.map((field) => [field.key, ""]));
}

function formatScoreOrEmpty(value, { scored = true } = {}) {
  if (!scored || value == null || Number.isNaN(Number(value))) {
    return { text: "—", muted: true };
  }
  return { text: Number(value).toFixed(1), muted: false };
}

function isSeriesPendingShape(item) {
  if (!item || typeof item !== "object") return false;
  if (item.first_pending_chapter != null) return true;
  return Boolean(
    item.name
    && item.author_id != null
    && item.chapter_number == null
    && !item.chapter_id,
  );
}

function mapEbPendingListItem(item) {
  if (isSeriesPendingShape(item)) return mapEbSeriesPendingItem(item);
  return mapEbChapterPendingItem(item);
}

function seriesItemToQueueChapter(seriesItem) {
  const fc = seriesItem?.firstChapter;
  if (!fc?.id) return null;
  return {
    id: fc.id,
    seriesId: seriesItem.seriesId ?? seriesItem.id,
    seriesName: seriesItem.seriesName ?? seriesItem.name ?? "Series",
    chapterNumber: fc.chapterNumber,
    title: fc.title ?? "",
    status: seriesItem.status ?? "pending_EB",
    previewImageUrl: seriesItem.coverUrl ?? seriesItem.previewImageUrl,
    mangakaName: seriesItem.mangakaName ?? "",
    mangakaUserId: seriesItem.mangakaUserId ?? null,
    mangakaAvatarUrl: seriesItem.mangakaAvatarUrl ?? null,
    classification: seriesItem.classification ?? null,
    classificationText: seriesItem.classificationText ?? "",
    councilAverage: seriesItem.councilAverage ?? null,
    pages: [],
    raw: seriesItem.raw,
  };
}

function ebMangakaGroupKey(item) {
  const authorId = String(item?.mangakaUserId ?? "").trim();
  if (authorId) return `id:${authorId}`;
  const name = String(item?.mangakaName || "Mangaka").trim();
  return `name:${name.toLowerCase() || "mangaka"}`;
}

function ebMangakaGroupName(item) {
  return String(item?.mangakaName || "Mangaka").trim() || "Mangaka";
}

async function hydrateEbMangakaAvatars(items) {
  const list = Array.isArray(items) ? items : [];
  const ids = [
    ...new Set(
      list
        .map((s) => String(s?.mangakaUserId ?? "").trim())
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
        // giữ fallback initials
      }
    }),
  );
  if (!avatarById.size) return list;

  return list.map((s) => {
    const id = String(s?.mangakaUserId ?? "").trim();
    const avatar = id ? avatarById.get(id) : null;
    if (!avatar) return s;
    return { ...s, mangakaAvatarUrl: avatar };
  });
}

function EbMangakaSelectCard({ group, onSelect }) {
  const initials = (
    group.name.length >= 2 ? group.name : `${group.name}●`
  )
    .slice(0, 2)
    .toUpperCase();

  return (
    <button
      type="button"
      onClick={() => onSelect(group.key)}
      className="group relative text-left"
    >
      <Card className="gap-0 overflow-hidden py-0 shadow-sm transition-all hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md dark:hover:border-sky-500/40">
        <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-gradient-to-br from-sky-500/15 via-muted to-violet-500/10">
          {group.coverUrl ? (
            <img
              src={group.coverUrl}
              alt=""
              className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex size-20 items-center justify-center rounded-2xl bg-sky-600 text-2xl font-bold text-white shadow-lg shadow-sky-900/20">
              {initials}
            </div>
          )}
          <Badge className="absolute right-2 top-2 h-6 min-w-6 justify-center bg-amber-600 px-1.5 text-xs text-white hover:bg-amber-600">
            {group.count}
          </Badge>
        </div>
        <CardContent className="space-y-1 p-3">
          <p className="flex items-center gap-2 truncate text-sm font-semibold">
            <span className="group/avatar inline-flex shrink-0">
              <Avatar
                size="sm"
                className={cn(
                  "size-6 ring-1 ring-border",
                  "transition-all duration-200 ease-out",
                  "group-hover/avatar:scale-110 group-hover/avatar:ring-2 group-hover/avatar:ring-sky-400",
                  "group-hover/avatar:shadow-sm group-hover/avatar:shadow-sky-500/30",
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
          <p className="text-xs text-muted-foreground">
            {group.count} series chờ duyệt
          </p>
        </CardContent>
      </Card>
    </button>
  );
}

function ScoreStars({ value, size = "size-4" }) {
  const safe = clampScore(value);
  return (
    <div className="flex items-center gap-0.5" aria-hidden>
      {Array.from({ length: SCORE_MAX }, (_, idx) => {
        const score = idx + 1;
        const isFull = safe >= score;
        const isHalf = !isFull && safe >= score - 0.5;
        return (
          <span key={score} className={cn("relative inline-flex", size)}>
            <Star className={cn(size, "text-muted-foreground/35")} />
            {isFull ? (
              <Star
                className={cn(
                  "absolute inset-0 fill-amber-400 text-amber-400",
                  size,
                )}
              />
            ) : null}
            {isHalf ? (
              <span className="absolute inset-0 w-1/2 overflow-hidden">
                <Star className={cn("fill-amber-400 text-amber-400", size)} />
              </span>
            ) : null}
          </span>
        );
      })}
    </div>
  );
}

function InteractiveScoreStars({ value, onChange, disabled = false }) {
  const safe = clampScore(value);
  return (
    <div
      className="flex items-center gap-0.5"
      role="radiogroup"
      aria-label="Chấm sao"
    >
      {Array.from({ length: SCORE_MAX }, (_, idx) => {
        const full = idx + 1;
        const half = idx + 0.5;
        const isFull = safe >= full;
        const isHalf = !isFull && safe >= half;
        return (
          <span key={full} className="relative inline-flex size-7 shrink-0">
            <Star className="size-7 text-muted-foreground/30" />
            {isFull ? (
              <Star className="pointer-events-none absolute inset-0 size-7 fill-amber-400 text-amber-400" />
            ) : null}
            {isHalf ? (
              <span className="pointer-events-none absolute inset-0 w-1/2 overflow-hidden">
                <Star className="size-7 fill-amber-400 text-amber-400" />
              </span>
            ) : null}
            <button
              type="button"
              disabled={disabled}
              aria-label={`${half} điểm`}
              className="absolute inset-y-0 left-0 z-10 w-1/2 rounded-l-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed"
              onClick={() => onChange(half.toFixed(1))}
            />
            <button
              type="button"
              disabled={disabled}
              aria-label={`${full} điểm`}
              className="absolute inset-y-0 right-0 z-10 w-1/2 rounded-r-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed"
              onClick={() => onChange(full.toFixed(1))}
            />
          </span>
        );
      })}
    </div>
  );
}

function CriterionScoreRow({
  field,
  value,
  error,
  note,
  onScoreChange,
  onScoreBlur,
  onNoteChange,
  disabled = false,
}) {
  const numeric = clampScore(value);
  const display = String(value ?? "").trim() === "" ? "" : numeric.toFixed(1);

  return (
    <div className="space-y-2 rounded-xl border bg-card px-3 py-3 sm:px-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="min-w-0 lg:w-44 lg:shrink-0">
          <Label htmlFor={field.key} className="text-sm font-medium">
            {field.label}
          </Label>
          <p className="text-xs text-muted-foreground">{field.hint}</p>
        </div>

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
          <InteractiveScoreStars
            value={value}
            disabled={disabled}
            onChange={(next) => onScoreChange(next)}
          />
          <input
            type="range"
            min={0}
            max={SCORE_MAX}
            step={SCORE_STEP}
            value={numeric}
            disabled={disabled}
            aria-label={`Slider ${field.label}`}
            className="eb-score-slider h-2 min-w-[7rem] flex-1 cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-50"
            onChange={(event) =>
              onScoreChange(clampScore(event.target.value).toFixed(1))
            }
          />
          <Input
            id={field.key}
            type="number"
            min="0"
            max={String(SCORE_MAX)}
            step={String(SCORE_STEP)}
            value={display}
            disabled={disabled}
            className="h-9 w-[4.5rem] shrink-0 tabular-nums"
            onChange={(event) => onScoreChange(event.target.value)}
            onBlur={onScoreBlur}
            aria-invalid={Boolean(error)}
          />
          <span className="shrink-0 text-xs text-muted-foreground">
            / {SCORE_MAX}
          </span>
        </div>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <Textarea
        id={`${field.key}-note`}
        value={note}
        disabled={disabled}
        onChange={(event) => onNoteChange(event.target.value)}
        placeholder="Ghi chú tiêu chí (tuỳ chọn)..."
        className="min-h-16 text-sm"
      />
    </div>
  );
}

function getClassification(average, { scored = true } = {}) {
  if (!scored || average == null || Number.isNaN(Number(average))) {
    return {
      label: "CHƯA CHẤM",
      note: "Chưa có điểm Hội đồng để phân loại.",
      className:
        "border-amber-300/80 bg-amber-500/15 text-amber-900 dark:border-amber-500/40 dark:text-amber-200",
    };
  }

  if (average < 2.5) {
    return {
      label: "KHÔNG ĐẠT",
      note: "Series chưa đạt chất lượng, cần chỉnh sửa lớn trước khi xét lại.",
      className:
        "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-200",
    };
  }

  if (average < 3.5) {
    return {
      label: "ĐẠT",
      note: "Series có thể thông qua, nhưng cần cải thiện theo ghi chú.",
      className:
        "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200",
    };
  }

  if (average < 4.25) {
    return {
      label: "TỐT",
      note: "Chất lượng series ổn định, phù hợp duyệt nhanh.",
      className:
        "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/15 dark:text-sky-200",
    };
  }

  return {
    label: "XUẤT SẮC",
    note: "Series chất lượng cao, phù hợp đẩy nổi bật/banner.",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200",
  };
}

function CouncilScoresTable({
  memberRows,
  scoreFields,
  criterionAverages,
  councilAverage,
  scoredCount,
  activeMemberId,
}) {
  const hasScored = scoredCount > 0;
  const councilAvgDisplay = formatScoreOrEmpty(councilAverage, {
    scored: hasScored,
  });

  return (
    <div className="eb-council-table-wrap scrollbar-hide overflow-x-auto rounded-xl border bg-card">
      <table className="eb-council-table w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <th className="px-3 py-2.5 font-medium">Thành viên HĐ</th>
            {scoreFields.map((field) => (
              <th key={field.key} className="px-2 py-2.5 font-medium">
                {field.shortLabel || field.hint || field.label}
              </th>
            ))}
            <th className="px-3 py-2.5 font-medium">ĐTB</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/70">
          {memberRows.length === 0 ? (
            <tr>
              <td
                colSpan={scoreFields.length + 2}
                className="px-3 py-10 text-center text-sm text-muted-foreground"
              >
                Chưa có thành viên Hội đồng.
              </td>
            </tr>
          ) : (
            memberRows.map((row) => {
              const isActive = row.id === activeMemberId;
              return (
                <tr
                  key={row.id}
                  className={isActive ? "bg-sky-500/5" : undefined}
                >
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-foreground">{row.name}</p>
                    <p className="text-xs text-muted-foreground">{row.title}</p>
                    {isActive ? (
                      <Badge variant="outline" className="mt-1 text-[10px]">
                        Đang nhập
                      </Badge>
                    ) : null}
                  </td>
                  {scoreFields.map((field) => (
                    <td
                      key={field.key}
                      className="px-2 py-2.5 text-center tabular-nums"
                    >
                      {row.scored ? (
                        <span className="inline-flex flex-col items-center gap-0.5">
                          <span className="font-medium">
                            {clampScore(row.scores?.[field.key]).toFixed(1)}
                          </span>
                          <ScoreStars value={row.scores?.[field.key]} />
                        </span>
                      ) : (
                        <span className="text-muted-foreground/70">N/A</span>
                      )}
                    </td>
                  ))}
                  <td
                    className={cn(
                      "px-3 py-2.5 text-center font-semibold tabular-nums",
                      !row.scored && "text-muted-foreground/70",
                    )}
                  >
                    {row.scored ? row.average.toFixed(1) : "N/A"}
                  </td>
                </tr>
              );
            })
          )}
          <tr className="eb-council-table__avg border-t-2 bg-muted/25 font-medium">
            <td className="px-3 py-3">
              Trung bình Hội đồng
              <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                {scoredCount}/{memberRows.length} thành viên đã chấm
              </span>
            </td>
            {scoreFields.map((field) => {
              const cell = formatScoreOrEmpty(criterionAverages?.[field.key], {
                scored: hasScored,
              });
              return (
                <td
                  key={field.key}
                  className={cn(
                    "px-2 py-3 text-center tabular-nums",
                    cell.muted
                      ? "text-muted-foreground/70"
                      : "text-foreground",
                  )}
                >
                  {cell.text}
                </td>
              );
            })}
            <td
              className={cn(
                "px-3 py-3 text-center text-base font-bold tabular-nums",
                councilAvgDisplay.muted
                  ? "text-muted-foreground/70"
                  : "text-primary",
              )}
            >
              {councilAvgDisplay.text}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function Eb() {
  const navigate = useNavigate();
  const { chapterId: routeChapterId } = useParams();
  const user = getSession();
  const isChapterDetail = Boolean(routeChapterId);
  const [councilTick, bumpCouncil] = useState(0);
  const [pendingChapters, setPendingChapters] = useState([]);
  const [pendingSeries, setPendingSeries] = useState([]);
  const [chapterPages, setChapterPages] = useState([]);
  const [pagesLoading, setPagesLoading] = useState(false);
  const [apiLoading, setApiLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedChapterId, setSelectedChapterId] = useState("");
  const [activeMemberId, setActiveMemberId] = useState("");
  const [newCouncilMemberName, setNewCouncilMemberName] = useState("");
  const [scores, setScores] = useState(buildInitialScores);
  const [criterionNotes, setCriterionNotes] = useState(buildInitialNotes);
  const [overallComment, setOverallComment] = useState("");
  const [memberNotes, setMemberNotes] = useState("");
  const [evaluationNotes, setEvaluationNotes] = useState("");
  const [lastEvaluation, setLastEvaluation] = useState(null);
  /** true chỉ sau Nộp kết quả chấm thành công (hoặc BE đã có evaluation history). */
  const [scoresSubmitted, setScoresSubmitted] = useState(false);
  const [scoreErrors, setScoreErrors] = useState(buildEmptyScoreErrors);
  const [pinnedChapter, setPinnedChapter] = useState(null);
  const [previewPageIndex, setPreviewPageIndex] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [heroSlide, setHeroSlide] = useState(0);
  const [selectedMangakaKey, setSelectedMangakaKey] = useState(null);
  const refresh = useCallback(() => bumpCouncil((n) => n + 1), []);

  useEffect(() => {
    if (HERO_IMAGES.length < 2) return undefined;
    const timer = window.setInterval(() => {
      setHeroSlide((index) => (index + 1) % HERO_IMAGES.length);
    }, HERO_SLIDE_MS);
    return () => window.clearInterval(timer);
  }, []);

  const loadPending = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setApiLoading(true);
    try {
      const { items } = await ebEvaluationsService.getChapterPending({
        page: 1,
        limit: 50,
      });
      const list = (Array.isArray(items) ? items : [])
        .map(mapEbPendingListItem)
        .filter(Boolean);
      const seriesList = list.filter((item) => item.firstChapter != null);
      const chapterList = list.flatMap((item) => {
        if (item.firstChapter) {
          const mapped = seriesItemToQueueChapter(item);
          return mapped ? [mapped] : [];
        }
        if (item.id && item.chapterNumber != null) return [item];
        return [];
      });
      const seriesWithAvatars = await hydrateEbMangakaAvatars(seriesList);
      const chaptersWithAvatars = await hydrateEbMangakaAvatars(chapterList);
      setPendingSeries(seriesWithAvatars);
      setPendingChapters(chaptersWithAvatars);
    } catch (err) {
      if (!silent) {
        toast.error(getApiErrorMessage(err, "Không tải được hàng chờ EB."));
        setPendingChapters([]);
        setPendingSeries([]);
      }
    } finally {
      if (!silent) setApiLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPending();
  }, [loadPending, councilTick]);

  const queueChapters = useMemo(
    () => pendingChapters.filter((item) => !isEbChapterFullyScored(item)),
    [pendingChapters, councilTick],
  );

  const queueItems = useMemo(() => {
    if (pendingSeries.length) return pendingSeries;
    return queueChapters.map((ch) => ({
      id: ch.seriesId ?? ch.id,
      seriesId: ch.seriesId ?? ch.id,
      name: ch.seriesName,
      seriesName: ch.seriesName,
      coverUrl: ch.previewImageUrl,
      status: ch.status,
      mangakaName: ch.mangakaName,
      mangakaUserId: ch.mangakaUserId ?? null,
      mangakaAvatarUrl: ch.mangakaAvatarUrl ?? null,
      classification: ch.classification,
      classificationText: ch.classificationText,
      firstChapter: {
        id: ch.id,
        chapterNumber: ch.chapterNumber,
        title: ch.title,
      },
    }));
  }, [pendingSeries, queueChapters]);

  const queueByMangaka = useMemo(() => {
    const map = new Map();
    for (const item of queueItems) {
      const key = ebMangakaGroupKey(item);
      const name = ebMangakaGroupName(item);
      if (!map.has(key)) {
        map.set(key, {
          key,
          name,
          coverUrl: null,
          avatarUrl: null,
          items: [],
        });
      }
      const group = map.get(key);
      group.items.push(item);
      if (!group.avatarUrl) {
        group.avatarUrl = item.mangakaAvatarUrl || null;
      }
      if (!group.coverUrl) {
        group.coverUrl = item.coverUrl || item.previewImageUrl || null;
      }
    }
    return [...map.values()]
      .map((g) => ({ ...g, count: g.items.length }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "vi"));
  }, [queueItems]);

  const selectedMangakaGroup = useMemo(
    () => queueByMangaka.find((g) => g.key === selectedMangakaKey) ?? null,
    [queueByMangaka, selectedMangakaKey],
  );

  useEffect(() => {
    if (!selectedMangakaKey) return;
    if (!queueByMangaka.some((g) => g.key === selectedMangakaKey)) {
      setSelectedMangakaKey(null);
    }
  }, [queueByMangaka, selectedMangakaKey]);

  useEffect(() => {
    if (isChapterDetail) setSelectedMangakaKey(null);
  }, [isChapterDetail]);

  const loadChapterDetail = useCallback(async (chapterId) => {
    if (!chapterId) return null
    try {
      const data = await ebEvaluationsService.getChapterDetail(chapterId)
      const mapped = mapEbChapterDetailResponse(data)
      if (mapped) {
        setPinnedChapter(mapped)
        const latestEval = mapped.evaluationHistory?.at(-1)
        const normalized = normalizeEbEvaluateResponse({
          evaluation: latestEval,
          council_average: mapped.councilAverage,
          classification: mapped.classification,
          classification_text: mapped.classificationText,
        })
        // Chỉ coi là đã nộp khi BE có bản evaluation — không unlock bằng councilAverage lẻ
        if (latestEval && normalized.councilAverage != null) {
          setLastEvaluation({
            ...(normalized.evaluation ?? {}),
            council_average: normalized.councilAverage,
            classification: normalized.classification,
            classification_text: normalized.classificationText,
          })
          setScoresSubmitted(true)
        } else {
          setLastEvaluation(null)
          setScoresSubmitted(false)
        }
        return mapped
      }
    } catch {
      // fallback: dùng item từ pending list
    }
    return null
  }, []);

  useEffect(() => {
    if (routeChapterId) {
      setSelectedChapterId(routeChapterId);
    }
  }, [routeChapterId]);

  useEffect(() => {
    if (!routeChapterId) return;
    void loadChapterDetail(routeChapterId);
  }, [routeChapterId, loadChapterDetail]);

  useEffect(() => {
    if (!routeChapterId) {
      setChapterPages([]);
      return;
    }
    let cancelled = false;
    setPagesLoading(true);
    void (async () => {
      try {
        const data = await ebScoresService.getChapterPreview(routeChapterId);
        if (cancelled) return;
        const mapped = mapEbChapterPreviewResponse(data);
        setChapterPages(mapped?.pages ?? []);
        setPreviewPageIndex(0);
      } catch {
        if (!cancelled) {
          setChapterPages([]);
          setPreviewPageIndex(0);
        }
      } finally {
        if (!cancelled) setPagesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [routeChapterId]);

  useEffect(() => {
    function onSync() {
      refresh();
    }
    window.addEventListener("mk-eb-pending-update", onSync);
    window.addEventListener("mk-eb-council-update", onSync);
    window.addEventListener("storage", onSync);
    window.addEventListener("mk-eb-approved-update", onSync);
    return () => {
      window.removeEventListener("mk-eb-pending-update", onSync);
      window.removeEventListener("mk-eb-council-update", onSync);
      window.removeEventListener("storage", onSync);
      window.removeEventListener("mk-eb-approved-update", onSync);
    };
  }, [refresh]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const activeChapter = useMemo(() => {
    const targetId = routeChapterId || selectedChapterId;
    if (targetId) {
      const fromPending = pendingChapters.find(
        (c) => c.id === targetId || String(c.raw?._id) === targetId,
      );
      if (fromPending) return fromPending;
      if (
        pinnedChapter
        && (pinnedChapter.id === targetId
          || String(pinnedChapter.raw?._id) === targetId)
      ) {
        return pinnedChapter;
      }
      return null;
    }
    return pendingChapters[0] ?? null;
  }, [pendingChapters, selectedChapterId, routeChapterId, pinnedChapter]);

  useEffect(() => {
    const targetId = routeChapterId || selectedChapterId;
    if (!targetId) return;
    const fromPending = pendingChapters.find(
      (c) => c.id === targetId || String(c.raw?._id) === targetId,
    );
    if (fromPending) {
      setPinnedChapter(fromPending);
    }
  }, [pendingChapters, routeChapterId, selectedChapterId]);

  const councilKey = activeChapter?.id ?? "";
  const activeTitle = activeChapter?.seriesName ?? "";
  const scoreFields = SCORE_FIELDS;

  const councilRecord = useMemo(
    () => (councilKey ? readCouncilSeriesScores(councilKey) : null),
    [councilKey, councilTick],
  );

  const councilRoster = useMemo(
    () => (councilKey ? readCouncilRoster(councilKey) : []),
    [councilKey, councilTick],
  );

  useEffect(() => {
    if (!councilKey) {
      setActiveMemberId("");
      setScoresSubmitted(false);
      setLastEvaluation(null);
      return;
    }
    setScoresSubmitted(false);
    setLastEvaluation(null);
  }, [councilKey]);

  useEffect(() => {
    if (!councilKey) {
      setActiveMemberId("");
      return;
    }
    const roster = readCouncilRoster(councilKey);
    setActiveMemberId((prev) => {
      if (prev && roster.some((m) => m.id === prev)) return prev;
      return roster[0]?.id ?? "";
    });
  }, [councilKey, councilTick]);

  useEffect(() => {
    if (!councilKey) return;
    const record = readCouncilSeriesScores(councilKey);
    const memberEntry = record?.members?.[activeMemberId];
    if (memberEntry?.scores) {
      const normalizedScores = normalizeMemberScoreMap(memberEntry.scores);
      setScores((current) => ({
        ...current,
        ...Object.fromEntries(
          Object.entries(normalizedScores).map(([key, value]) => [
            key,
            Number(value).toFixed(1),
          ]),
        ),
      }));
      setCriterionNotes((current) => ({
        ...current,
        ...normalizeMemberCommentsMap(memberEntry.criterionNotes),
      }));
      setOverallComment(memberEntry.overallComment ?? "");
      setMemberNotes(memberEntry.notes ?? "");
      setScoreErrors(buildEmptyScoreErrors());
      return;
    }

    setScores(buildInitialScores());
    setCriterionNotes(buildInitialNotes());
    setOverallComment("");
    setMemberNotes("");
    setScoreErrors(buildEmptyScoreErrors());
  }, [councilKey, activeMemberId, councilTick]);
  const activeSeriesImage =
    activeChapter?.previewImageUrl ||
    placeholderPageDataUrl(
      activeChapter
        ? `${activeChapter.seriesName} · Ch.${activeChapter.chapterNumber}`
        : "Chưa chọn chapter",
    );
  const average = useMemo(() => {
    const total = scoreFields.reduce(
      (sum, field) => sum + clampScore(scores[field.key]),
      0,
    );
    return scoreFields.length ? total / scoreFields.length : 0;
  }, [scoreFields, scores]);
  const hasPersonalScores = useMemo(
    () =>
      scoreFields.some((field) => String(scores[field.key] ?? "").trim() !== ""),
    [scoreFields, scores],
  );
  const personalAvgDisplay = formatScoreOrEmpty(average, {
    scored: hasPersonalScores,
  });
  const councilAggregate = useMemo(() => {
    const keys = scoreFields.map((field) => field.key);
    return buildCouncilAggregate(councilRecord, keys, councilRoster);
  }, [councilRecord, scoreFields, councilRoster]);
  const councilClassification = getClassification(
    councilAggregate.councilAverage,
    { scored: councilAggregate.scoredCount > 0 },
  );
  const activeMember = councilRoster.find((m) => m.id === activeMemberId) ?? null;
  const savedScoredCount = councilAggregate.scoredCount;
  const rosterCount = councilRoster.length;
  const allMembersDraftSaved =
    rosterCount > 0 && savedScoredCount >= rosterCount;
  const canSubmitScores =
    allMembersDraftSaved && rosterCount >= EB_COUNCIL_MIN_FOR_PUBLISH;
  const unscoredMemberNames = useMemo(
    () =>
      councilAggregate.memberRows
        .filter((row) => !row.scored)
        .map((row) => row.name)
        .filter(Boolean),
    [councilAggregate.memberRows],
  );
  // Lưu nháp đủ tất cả thành viên → Nộp được; Nộp xong → mới Xác nhận lịch
  const canConfirmPublish = Boolean(
    activeChapter?.id && canSubmitScores && scoresSubmitted,
  );
  const previewPageCount = chapterPages.length;
  const activePreviewPage =
    previewPageCount > 0
      ? chapterPages[
          Math.min(Math.max(previewPageIndex, 0), previewPageCount - 1)
        ]
      : null;
  const previewImageSrc =
    activePreviewPage?.imageUrl
    || activeSeriesImage;

  function handleAddCouncilMember() {
    const name = newCouncilMemberName.trim();
    if (!name) {
      toast.error("Nhập tên thành viên Hội đồng.");
      return;
    }
    if (!councilKey) {
      toast.error("Chưa có chapter để thêm thành viên.");
      return;
    }
    const added = addCouncilMember(councilKey, name);
    if (!added) {
      toast.error("Thành viên này đã có trong Hội đồng.");
      return;
    }
    setNewCouncilMemberName("");
    setActiveMemberId(added.id);
    refresh();
    toast.success(`Đã thêm ${added.name} vào Hội đồng chấm.`);
  }

  function updateScore(key, value) {
    setScores((current) => ({ ...current, [key]: value }));
    setScoreErrors((current) => ({ ...current, [key]: validateScore(value) }));
  }

  function normalizeScoreField(key) {
    const nextValue = clampScore(scores[key]).toFixed(1);
    setScores((current) => ({ ...current, [key]: nextValue }));
    setScoreErrors((current) => ({ ...current, [key]: validateScore(nextValue) }));
  }

  function updateCriterionNote(key, value) {
    setCriterionNotes((current) => ({ ...current, [key]: value }));
  }

  function openChapterEvaluate(chapterId) {
    if (!chapterId) return;
    setSelectedChapterId(chapterId);
    void loadChapterDetail(chapterId);
    navigate(`/eb/chapter/${encodeURIComponent(chapterId)}`);
  }

  function openSeriesReview(seriesId) {
    if (!seriesId) return;
    navigate(`/eb/series/${encodeURIComponent(seriesId)}`);
  }

  function buildMemberScoresDraft() {
    // Chỉ lấy điểm đã Lưu nháp — không gộp draft chưa lưu
    return buildMemberScoresPayload({
      councilRecord,
      members: councilRoster,
      activeMemberId: null,
      draft: null,
    });
  }

  function warnMissingCouncilDrafts() {
    if (rosterCount < EB_COUNCIL_MIN_FOR_PUBLISH) {
      toast.error(
        `Hội đồng cần ít nhất ${EB_COUNCIL_MIN_FOR_PUBLISH} thành viên (hiện ${rosterCount}).`,
      );
      return;
    }
    const remaining = unscoredMemberNames.length
      ? unscoredMemberNames.join(", ")
      : "các thành viên còn lại";
    toast.error(
      `Bạn chưa lưu đủ điểm các thành viên trong hội đồng (${savedScoredCount}/${rosterCount}). Còn thiếu: ${remaining}.`,
    );
  }

  function handleConfirmPublishClick() {
    if (!allMembersDraftSaved || rosterCount < EB_COUNCIL_MIN_FOR_PUBLISH) {
      warnMissingCouncilDrafts();
      return;
    }
    if (!scoresSubmitted) {
      toast.error(
        "Bạn chưa nộp kết quả chấm. Hãy bấm Nộp kết quả chấm trước khi xác nhận lịch phát hành.",
      );
      return;
    }
    if (!activeChapter?.id) return;
    navigate(`/eb/chapter/${encodeURIComponent(activeChapter.id)}/publish`);
  }

  async function handleSubmitScores() {
    if (!activeChapter?.id) {
      toast.error("Chưa có chapter trong hàng chờ để chấm điểm.");
      return;
    }

    if (!councilRoster.length) {
      toast.error("Thêm ít nhất một thành viên Hội đồng trước khi gửi đánh giá.");
      return;
    }

    if (!canSubmitScores) {
      warnMissingCouncilDrafts();
      return;
    }

    const memberScores = buildMemberScoresDraft();
    const payloadError = validateMemberScoresPayload(
      memberScores,
      Math.max(rosterCount, EB_COUNCIL_MIN_FOR_PUBLISH),
    );
    if (payloadError) {
      toast.error(payloadError);
      return;
    }

    setSubmitting(true);
    try {
      const res = await ebEvaluationsService.evaluateChapter(activeChapter.id, {
        member_scores: memberScores,
        ...(evaluationNotes.trim() ? { notes: evaluationNotes.trim() } : {}),
      });
      const normalized = normalizeEbEvaluateResponse(res);
      const evaluation = {
        ...(normalized.evaluation ?? {}),
        council_average: normalized.councilAverage,
        classification: normalized.classification,
        classification_text: normalized.classificationText,
      };
      setLastEvaluation(evaluation);
      setScoresSubmitted(true);
      setPinnedChapter((current) => {
        const base =
          current?.id === activeChapter.id ? current : activeChapter;
        return {
          ...base,
          councilAverage: normalized.councilAverage ?? base?.councilAverage ?? null,
          classification: normalized.classification ?? base?.classification ?? null,
          classificationText:
            normalized.classificationText || base?.classificationText || "",
        };
      });
      if (activeChapter?.id) {
        setSelectedChapterId(activeChapter.id);
      }
      const classificationLabel = formatEbClassification(evaluation);
      const councilAvg = normalized.councilAverage;
      toast.success(
        normalized.message
        || `Đã gửi điểm Hội đồng${classificationLabel ? ` · ${classificationLabel}` : ""}${councilAvg != null ? ` · ĐTB ${Number(councilAvg).toFixed(1)}` : ""}.`,
      );
      void loadPending({ silent: true });
      refresh();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không gửi được điểm đánh giá."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveAssessment() {
    if (!activeChapter?.id) {
      toast.error("Chưa có chapter trong hàng chờ để chấm điểm.");
      return;
    }
    if (!activeMemberId) {
      toast.error("Thêm và chọn thành viên Hội đồng trước khi lưu điểm.");
      return;
    }

    const nextErrors = Object.fromEntries(
      scoreFields.map((field) => [field.key, validateScore(scores[field.key])]),
    );
    setScoreErrors((current) => ({ ...current, ...nextErrors }));
    const hasInvalid = Object.values(nextErrors).some(Boolean);
    if (hasInvalid) {
      toast.error("Có tiêu chí chưa hợp lệ. Vui lòng kiểm tra lại điểm.");
      return;
    }

    const criterionDetails = scoreFields.map((field) => ({
      key: field.key,
      label: field.label,
      hint: field.hint,
      score: clampScore(scores[field.key]),
      note: criterionNotes[field.key] || "",
    }));
    const summaryNotes = criterionDetails
      .filter((criterion) => criterion.note.trim())
      .map((criterion) => `${criterion.label}: ${criterion.note.trim()}`);

    saveCouncilMemberAssessment(councilKey, activeMemberId, {
      scores: Object.fromEntries(
        criterionDetails.map((criterion) => [criterion.key, criterion.score]),
      ),
      criterionNotes: { ...criterionNotes },
      overallComment,
      notes: memberNotes,
      average: Number(average.toFixed(1)),
      assessedAt: new Date().toISOString(),
      enteredBy: user?.name ?? "Đại diện EB",
    });

    const updatedRecord = readCouncilSeriesScores(councilKey);
    const keys = scoreFields.map((field) => field.key);
    const aggregate = buildCouncilAggregate(updatedRecord, keys, councilRoster);
    const councilClass = getClassification(aggregate.councilAverage, {
      scored: aggregate.scoredCount > 0,
    });

    const memberAssessments = aggregate.memberRows
      .filter((row) => row.scored)
      .map((row) => ({
        memberId: row.id,
        memberName: row.name,
        memberTitle: row.title,
        average: row.average,
        scores: row.scores,
        assessedAt: row.assessedAt,
        enteredBy: row.enteredBy,
      }));

    updateSeriesEbAssessmentInWorkspace(activeTitle, {
      seriesTitle: activeTitle,
      chapterNum: activeChapter?.chapterNumber ?? null,
      average: aggregate.councilAverage,
      councilAverage: aggregate.councilAverage,
      memberAverage: Number(average.toFixed(1)),
      activeMemberId,
      activeMemberName: activeMember?.name ?? null,
      classification: councilClass.label,
      classificationNote: councilClass.note,
      scores: aggregate.criterionAverages,
      criteria: scoreFields.map((field) => ({
        key: field.key,
        label: field.label,
        hint: field.hint,
        score: aggregate.criterionAverages[field.key] ?? 0,
        note: "",
      })),
      memberAssessments,
      councilScoredCount: aggregate.scoredCount,
      councilMemberCount: councilRoster.length,
      summaryNotes,
      source: "eb-council",
      assessedAt: new Date().toISOString(),
      enteredBy: user?.name ?? "Đại diện EB",
    });

    refresh();
    toast.success(
      `Đã lưu điểm ${activeMember?.name ?? "thành viên"} · ĐTB HĐ ${aggregate.councilAverage.toFixed(1)} (${aggregate.scoredCount}/${councilRoster.length || 0})`,
    );
  }

  return (
    <div className="ws-page--eb flex min-h-screen flex-col bg-background">
      <Header links={NAV_LINKS} onLogout={user ? handleLogout : undefined} />

      {!isChapterDetail ? (
        <section className="ws-hero--eb eb-hero-slideshow relative overflow-hidden border-b border-white/5 text-white">
          <div className="eb-hero-slides" aria-hidden>
            {HERO_IMAGES.map((src, index) => (
              <img
                key={src}
                src={src}
                alt=""
                className={cn(
                  "eb-hero-slides__img",
                  index === heroSlide && "eb-hero-slides__img--active",
                )}
              />
            ))}
          </div>
          <div className="eb-hero-slides__veil" aria-hidden />
          <div className="page-container relative py-10 md:py-14">
            <div className="max-w-2xl space-y-3">
              <Badge
                variant="secondary"
                className="bg-white/10 text-white hover:bg-white/15"
              >
                {LABEL_EDITOR_BOARD}
              </Badge>
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
                {`Xin chào${user?.name ? `, ${user.name}` : ""}`}
              </h1>
              <p className="leading-relaxed text-zinc-300">
                Chọn series trong hàng chờ để xem nội dung và chấm điểm.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <main className={cn("page-container flex-1 space-y-8 py-8", isChapterDetail && "pb-36")}>
        {isChapterDetail ? (
          <>
            <header className="flex flex-wrap items-center gap-3 border-b border-border/60 pb-4">
              <Button type="button" variant="ghost" size="sm" asChild>
                <Link to="/eb">
                  <ArrowLeft className="size-4" />
                  Quay lại hàng chờ
                </Link>
              </Button>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-widest text-sky-600 dark:text-sky-400">
                  Chấm điểm chapter
                </p>
                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                  {activeChapter
                    ? `${activeChapter.seriesName} · Ch.${activeChapter.chapterNumber}`
                    : "Chapter"}
                </h1>
                {activeChapter?.title ? (
                  <p className="text-sm text-muted-foreground">{activeChapter.title}</p>
                ) : null}
              </div>
            </header>

            {apiLoading ? (
              <Card>
                <CardContent className="py-16 text-center text-muted-foreground">
                  Đang tải thông tin chapter...
                </CardContent>
              </Card>
            ) : !activeChapter ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
                  <p className="text-muted-foreground">
                    Không tìm thấy chapter trong hàng chờ EB.
                  </p>
                  <Button asChild variant="outline">
                    <Link to="/eb">Về hàng chờ</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.85fr)] xl:items-start">
          <Card className="shadow-sm">
            <CardHeader className="space-y-1 pb-3">
              <CardTitle>Nhập điểm (tài khoản đại diện)</CardTitle>
              <CardDescription>
                Chọn thành viên Hội đồng rồi chấm từng tiêu chí bên dưới.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              <div className="space-y-3">
                <Label htmlFor="eb-council-member-name">
                  Thêm thành viên Hội đồng
                </Label>
                <div className="flex overflow-hidden rounded-lg border border-border bg-background shadow-sm focus-within:ring-2 focus-within:ring-ring/40">
                  <Input
                    id="eb-council-member-name"
                    value={newCouncilMemberName}
                    onChange={(event) => setNewCouncilMemberName(event.target.value)}
                    placeholder="Nhập tên thành viên…"
                    className="h-10 rounded-none border-0 shadow-none focus-visible:ring-0"
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleAddCouncilMember();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-10 shrink-0 rounded-none border-0 border-l border-border px-4"
                    onClick={handleAddCouncilMember}
                  >
                    <Plus className="size-4" />
                    Thêm
                  </Button>
                </div>
                {councilRoster.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {councilRoster.map((member) => {
                      const scored = councilAggregate.memberRows.find(
                        (row) => row.id === member.id,
                      )?.scored;
                      return (
                        <Button
                          key={member.id}
                          type="button"
                          size="sm"
                          variant={activeMemberId === member.id ? "default" : "outline"}
                          className={cn(
                            activeMemberId === member.id
                              && "bg-sky-600 text-white hover:bg-sky-700",
                          )}
                          onClick={() => setActiveMemberId(member.id)}
                        >
                          {member.name}
                          {scored ? " · đã chấm" : ""}
                        </Button>
                      );
                    })}
                  </div>
                ) : null}
                {activeMember ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sky-200/70 bg-sky-500/5 px-3 py-2.5 dark:border-sky-500/30">
                    <p className="text-sm text-muted-foreground">
                      Đang nhập điểm cho{" "}
                      <strong className="text-foreground">{activeMember.name}</strong>
                    </p>
                    <p className="text-sm">
                      <span className="text-muted-foreground">Điểm TB cá nhân: </span>
                      <strong
                        className={cn(
                          "tabular-nums",
                          personalAvgDisplay.muted
                            ? "text-muted-foreground/70"
                            : "text-foreground",
                        )}
                      >
                        {personalAvgDisplay.text}
                      </strong>
                      <span className="text-muted-foreground"> / {SCORE_MAX}</span>
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">
                  Điểm các thành viên Hội đồng
                </h3>
                <CouncilScoresTable
                  memberRows={councilAggregate.memberRows}
                  scoreFields={scoreFields}
                  criterionAverages={councilAggregate.criterionAverages}
                  councilAverage={councilAggregate.councilAverage}
                  scoredCount={councilAggregate.scoredCount}
                  activeMemberId={activeMemberId}
                />
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    Tiêu chí chấm điểm
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Điểm TB:{" "}
                    <strong
                      className={cn(
                        "tabular-nums",
                        personalAvgDisplay.muted
                          ? "text-muted-foreground/70"
                          : "text-foreground",
                      )}
                    >
                      {personalAvgDisplay.text}
                    </strong>
                  </p>
                </div>
                <div className="space-y-2">
                  {scoreFields.map((field) => (
                    <CriterionScoreRow
                      key={field.key}
                      field={field}
                      value={scores[field.key]}
                      error={scoreErrors[field.key]}
                      note={criterionNotes[field.key]}
                      disabled={!activeMemberId}
                      onScoreChange={(next) => updateScore(field.key, next)}
                      onScoreBlur={() => normalizeScoreField(field.key)}
                      onNoteChange={(next) =>
                        updateCriterionNote(field.key, next)
                      }
                    />
                  ))}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="eb-overall-comment">Nhận xét tổng thể</Label>
                  <Textarea
                    id="eb-overall-comment"
                    value={overallComment}
                    onChange={(event) => setOverallComment(event.target.value)}
                    placeholder="Nhận xét chung của thành viên này…"
                    className="min-h-20"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eb-member-notes">Ghi chú thêm</Label>
                  <Textarea
                    id="eb-member-notes"
                    value={memberNotes}
                    onChange={(event) => setMemberNotes(event.target.value)}
                    placeholder="Ghi chú bổ sung (tuỳ chọn)…"
                    className="min-h-20"
                  />
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-border/80 bg-gradient-to-br from-muted/40 via-card to-amber-500/5 p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-200">
                      ĐTB Hội đồng
                    </p>
                    <div className="mt-1.5 flex items-end gap-2">
                      <span
                        className={cn(
                          "text-4xl font-bold tracking-tight tabular-nums",
                          councilAggregate.scoredCount > 0
                            ? "text-foreground"
                            : "text-muted-foreground/50",
                        )}
                      >
                        {councilAggregate.scoredCount > 0
                          ? councilAggregate.councilAverage.toFixed(1)
                          : "—"}
                      </span>
                      <span className="mb-1 text-sm text-muted-foreground">
                        / {SCORE_MAX}.0
                      </span>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "px-3 py-1 text-xs font-semibold tracking-wide",
                      councilClassification.className,
                    )}
                  >
                    {councilClassification.label}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {councilAggregate.scoredCount}/{councilRoster.length || 0} thành
                  viên đã chấm
                  {activeMember ? (
                    <>
                      {" "}
                      · Đang nhập cho{" "}
                      <strong className="text-foreground">
                        {activeMember.name}
                      </strong>{" "}
                      (ĐTB {personalAvgDisplay.text})
                    </>
                  ) : null}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {councilClassification.note}
                </p>

                <div className="mt-4 space-y-2">
                  <Label htmlFor="eb-evaluation-notes">
                    Ghi chú đánh giá (tuỳ chọn)
                  </Label>
                  <Textarea
                    id="eb-evaluation-notes"
                    value={evaluationNotes}
                    onChange={(event) => setEvaluationNotes(event.target.value)}
                    placeholder="Ghi chú gửi kèm khi chấm điểm series…"
                    className="min-h-16"
                  />
                </div>

                {lastEvaluation?.council_average != null ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Kết quả vừa gửi: ĐTB{" "}
                    <strong className="text-foreground">
                      {Number(lastEvaluation.council_average).toFixed(1)}
                    </strong>
                    {formatEbClassification(lastEvaluation)
                      ? ` · ${formatEbClassification(lastEvaluation)}`
                      : ""}
                  </p>
                ) : null}

                {activeChapter?.id ? (
                  <div className="mt-4 space-y-2">
                    <Button
                      type="button"
                      className={cn(
                        "w-full gap-2",
                        canConfirmPublish
                          ? "bg-emerald-600 text-white hover:bg-emerald-700"
                          : undefined,
                      )}
                      variant={canConfirmPublish ? "default" : "outline"}
                      onClick={handleConfirmPublishClick}
                      title={
                        canConfirmPublish
                          ? undefined
                          : "Cần lưu nháp đủ tất cả thành viên và nộp kết quả chấm trước"
                      }
                    >
                      <Calendar className="size-4" />
                      Xác nhận lịch phát hành
                      <ArrowRight className="size-4" />
                    </Button>
                    {!canConfirmPublish ? (
                      <p className="text-xs text-muted-foreground">
                        {!allMembersDraftSaved || rosterCount < EB_COUNCIL_MIN_FOR_PUBLISH
                          ? `Bước 1: Lưu nháp đủ tất cả thành viên hội đồng (hiện ${savedScoredCount}/${rosterCount || 0}${
                            unscoredMemberNames.length
                              ? ` · chưa lưu: ${unscoredMemberNames.join(", ")}`
                              : ""
                          }).`
                          : "Bước 2: Bấm Nộp kết quả chấm trước khi xác nhận lịch phát hành."}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <div className="xl:sticky xl:top-4 xl:self-start">
          <Card className="overflow-hidden shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
              <CardTitle className="text-base">Xem trước chapter</CardTitle>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5"
                disabled={!previewImageSrc}
                onClick={() => setZoomOpen(true)}
              >
                <Maximize2 className="size-3.5" />
                Phóng to
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm font-medium text-foreground">
                {activeChapter
                  ? `${activeChapter.seriesName}${activeChapter.title ? ` — ${activeChapter.title}` : ""}`
                  : "Chưa có chapter trong hàng chờ"}
              </p>
              {pagesLoading && chapterPages.length === 0 ? (
                <p className="text-sm text-muted-foreground">Đang tải trang…</p>
              ) : (
                <div className="space-y-3">
                  <button
                    type="button"
                    className="group relative block w-full overflow-hidden rounded-2xl border bg-muted/30 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => setZoomOpen(true)}
                    aria-label="Phóng to trang truyện"
                  >
                    <img
                      src={previewImageSrc}
                      alt={
                        activePreviewPage
                          ? `Trang ${activePreviewPage.pageNumber}`
                          : activeChapter
                            ? `${activeChapter.seriesName} Ch.${activeChapter.chapterNumber}`
                            : "Ảnh chapter đang chấm"
                      }
                      className="max-h-[min(70vh,720px)] w-full object-contain"
                    />
                    <span className="pointer-events-none absolute right-3 top-3 rounded-md bg-black/55 px-2 py-1 text-[10px] font-medium text-white opacity-0 transition group-hover:opacity-100">
                      Bấm để phóng to
                    </span>
                  </button>

                  {previewPageCount > 0 ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1"
                        disabled={previewPageIndex <= 0}
                        onClick={() =>
                          setPreviewPageIndex((idx) => Math.max(0, idx - 1))
                        }
                      >
                        <ChevronLeft className="size-3.5" />
                        Trang trước
                      </Button>
                      <Select
                        value={String(previewPageIndex)}
                        onValueChange={(value) =>
                          setPreviewPageIndex(Number(value))
                        }
                      >
                        <SelectTrigger className="h-8 w-[9.5rem]">
                          <SelectValue
                            placeholder={`Trang ${previewPageIndex + 1}/${previewPageCount}`}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {chapterPages.map((page, index) => (
                            <SelectItem key={page.id ?? index} value={String(index)}>
                              Trang {page.pageNumber ?? index + 1}/{previewPageCount}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1"
                        disabled={previewPageIndex >= previewPageCount - 1}
                        onClick={() =>
                          setPreviewPageIndex((idx) =>
                            Math.min(previewPageCount - 1, idx + 1),
                          )
                        }
                      >
                        Trang sau
                        <ChevronRight className="size-3.5" />
                      </Button>
                    </div>
                  ) : null}
                </div>
              )}
              {activeChapter?.seriesId ? (
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/eb/series/${encodeURIComponent(activeChapter.seriesId)}`}>
                    Xem toàn bộ series & chapters
                  </Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>
          </div>
        </section>
            )}
          </>
        ) : null}

        {!isChapterDetail ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-semibold">
                <Gavel className="size-5 text-amber-600" />
                Hàng chờ duyệt
              </h2>
              <p className="text-sm text-muted-foreground">
                Đồng bộ từ{" "}
                <Link
                  to="/mangaka"
                  className="font-medium text-sky-700 hover:underline dark:text-sky-400"
                >
                  Mangaka
                </Link>
                {" / "}
                <Link
                  to="/tantou"
                  className="font-medium text-sky-700 hover:underline dark:text-sky-400"
                >
                  Tantou
                </Link>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link to="/eb/history">
                  <History className="size-4" />
                  Lịch sử chấm
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/eb/schedule">
                  <Calendar className="size-4" />
                  Lịch publish
                </Link>
              </Button>
            </div>
          </div>

          {apiLoading ? (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                Đang tải hàng chờ EB...
              </CardContent>
            </Card>
          ) : queueItems.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                Không có series nào đang chờ EB duyệt.
              </CardContent>
            </Card>
          ) : (
            <Card className="flex flex-col gap-0 overflow-hidden py-0 shadow-sm">
              <CardHeader className="shrink-0 border-b bg-muted/20 px-5 py-4 sm:px-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1.5">
                    <CardTitle className="flex flex-wrap items-center gap-2.5 text-xl tracking-tight sm:text-2xl">
                      {selectedMangakaGroup ? (
                        <span className="group/avatar inline-flex shrink-0">
                          <Avatar
                            className={cn(
                              "size-9 rounded-full shadow-sm shadow-sky-900/20 ring-1 ring-border",
                              "transition-all duration-200 ease-out",
                              "group-hover/avatar:scale-110 group-hover/avatar:ring-2 group-hover/avatar:ring-sky-400",
                              "group-hover/avatar:shadow-md group-hover/avatar:shadow-sky-500/25",
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
                              )
                                .slice(0, 2)
                                .toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        </span>
                      ) : (
                        <Gavel className="size-5 text-amber-500" />
                      )}
                      <span className="truncate">
                        {selectedMangakaGroup
                          ? selectedMangakaGroup.name
                          : "Chọn Mangaka"}
                      </span>
                      <Badge
                        className={cn(
                          "h-6 min-w-6 justify-center px-2 text-xs font-semibold",
                          selectedMangakaGroup
                            ? "bg-amber-600 text-white hover:bg-amber-600"
                            : "bg-secondary text-secondary-foreground hover:bg-secondary",
                        )}
                      >
                        {selectedMangakaGroup
                          ? selectedMangakaGroup.count
                          : queueItems.length}
                      </Badge>
                    </CardTitle>
                    {!selectedMangakaGroup ? (
                      <CardDescription>
                        Chọn Mangaka để xem series đang chờ EB duyệt.
                      </CardDescription>
                    ) : (
                      <CardDescription>
                        {selectedMangakaGroup.count} series chờ duyệt từ Mangaka
                        này.
                      </CardDescription>
                    )}
                  </div>
                  {selectedMangakaGroup ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 shrink-0 gap-1.5 border-sky-200 bg-background shadow-sm hover:bg-sky-50 dark:border-sky-500/30 dark:hover:bg-sky-500/10"
                      onClick={() => setSelectedMangakaKey(null)}
                    >
                      <ArrowLeft className="size-4" />
                      Tất cả Mangaka
                    </Button>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="scrollbar-hide max-h-[min(640px,calc(100vh-260px))] space-y-2.5 overflow-y-auto px-4 py-4 sm:px-5">
                {selectedMangakaGroup ? (
                  selectedMangakaGroup.items.map((series) => (
                    <Card
                      key={series.id ?? series.seriesId}
                      className="transition-shadow hover:shadow-md"
                    >
                      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 flex-1 gap-4">
                          {series.coverUrl ? (
                            <img
                              src={series.coverUrl}
                              alt=""
                              className="size-16 shrink-0 rounded-lg border object-cover"
                            />
                          ) : null}
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-semibold">
                                {series.name ?? series.seriesName}
                              </h3>
                              <Badge variant="secondary">
                                {series.status ?? "pending_EB"}
                              </Badge>
                              {series.classification ? (
                                <Badge variant="outline">
                                  {series.classification}
                                </Badge>
                              ) : null}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {[
                                series.firstChapter
                                  ? `Ch.${series.firstChapter.chapterNumber}${
                                      series.firstChapter.title
                                        ? ` — ${series.firstChapter.title}`
                                        : ""
                                    }`
                                  : null,
                                series.classificationText,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                            {series.synopsis ? (
                              <p className="line-clamp-2 text-xs text-muted-foreground">
                                {series.synopsis}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            onClick={() =>
                              openSeriesReview(series.seriesId ?? series.id)
                            }
                          >
                            <BookOpen className="size-4" />
                            Xem pages
                          </Button>
                          {series.firstChapter?.id ? (
                            <Button
                              className="bg-emerald-600 text-white hover:bg-emerald-700"
                              onClick={() =>
                                openChapterEvaluate(series.firstChapter.id)
                              }
                            >
                              <CheckCircle2 className="size-4" />
                              Chấm điểm
                            </Button>
                          ) : null}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {queueByMangaka.map((group) => (
                      <EbMangakaSelectCard
                        key={group.key}
                        group={group}
                        onSelect={setSelectedMangakaKey}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </section>
        ) : null}
      </main>

      {isChapterDetail ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/85 shadow-[0_-12px_40px_rgba(15,23,42,0.08)] backdrop-blur-md supports-[backdrop-filter]:bg-background/70 dark:shadow-[0_-12px_40px_rgba(0,0,0,0.35)]">
          <div className="page-container flex flex-wrap items-center justify-between gap-3 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
            <p className="text-xs text-muted-foreground sm:text-sm">
              Điểm TB cá nhân:{" "}
              <strong
                className={cn(
                  "tabular-nums",
                  personalAvgDisplay.muted
                    ? "text-muted-foreground/70"
                    : "text-foreground",
                )}
              >
                {personalAvgDisplay.text}
              </strong>
              {activeMember ? (
                <>
                  {" "}
                  · {activeMember.name}
                </>
              ) : null}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="bg-background"
                onClick={() => void handleSaveAssessment()}
              >
                Lưu nháp
              </Button>
              <Button
                type="button"
                disabled={submitting || !activeChapter?.id}
                title={
                  canSubmitScores
                    ? undefined
                    : "Cần lưu nháp đủ điểm tất cả thành viên hội đồng"
                }
                className="bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                onClick={() => {
                  if (!canSubmitScores) {
                    warnMissingCouncilDrafts();
                    return;
                  }
                  void handleSubmitScores();
                }}
              >
                {submitting ? "Đang nộp…" : "Nộp kết quả chấm"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        <DialogContent className="max-h-[95vh] max-w-[min(96vw,56rem)] overflow-hidden border-none bg-zinc-950 p-2 text-white sm:p-3">
          <DialogTitle className="sr-only">
            Phóng to trang{" "}
            {activePreviewPage?.pageNumber ?? previewPageIndex + 1}
          </DialogTitle>
          <div className="flex max-h-[88vh] items-center justify-center overflow-auto">
            <img
              src={previewImageSrc}
              alt={
                activePreviewPage
                  ? `Trang ${activePreviewPage.pageNumber}`
                  : "Xem trước chapter"
              }
              className="max-h-[86vh] w-auto max-w-full object-contain"
            />
          </div>
          {previewPageCount > 1 ? (
            <div className="flex items-center justify-center gap-2 pb-1 pt-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={previewPageIndex <= 0}
                onClick={() =>
                  setPreviewPageIndex((idx) => Math.max(0, idx - 1))
                }
              >
                <ChevronLeft className="size-3.5" />
                Trước
              </Button>
              <span className="text-xs text-zinc-300">
                {previewPageIndex + 1} / {previewPageCount}
              </span>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={previewPageIndex >= previewPageCount - 1}
                onClick={() =>
                  setPreviewPageIndex((idx) =>
                    Math.min(previewPageCount - 1, idx + 1),
                  )
                }
              >
                Sau
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}
